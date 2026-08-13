import "dotenv/config";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import * as authSchema from "@/db/schema/auth";
import * as learningSchema from "@/db/schema/learning";
import * as workspaceSchema from "@/db/schema/workspace";

const schema = { ...authSchema, ...learningSchema, ...workspaceSchema };

/**
 * Runtime connection for workspace-scoped code (ADR-009 / §16.3.2).
 *
 * This intentionally connects as a **separate, non-owner role** (`app_rw`,
 * created by drizzle/0012_rls_workspace_hardening.sql) rather than reusing
 * `db` from `db/index.ts`. `db` connects as the table owner so existing
 * Course/Enrollment/AI/Billing services keep working unchanged during this
 * migration; `runtimeDb` is the connection PostgreSQL RLS actually applies
 * to. Falls back to `DATABASE_URL` only for local/dev bootstrapping before
 * `RUNTIME_DATABASE_URL` is configured — production deployments must set it.
 */
/**
 * Resolves the connection string without ever throwing at module load.
 *
 * The production requirement is enforced in `assertRuntimeRoleIsRestricted`
 * instead (NEW-3): `next build` runs with NODE_ENV=production, so throwing here
 * would fail the build on any machine whose build-time environment differs from
 * its runtime environment — a deployment footgun, not a security control. The
 * check still runs before any protected query, because every context helper
 * awaits the assertion before opening its transaction.
 */
function runtimeConnectionString() {
  // `||`, not `??`: an env var set to the empty string is "unset" here, both in
  // .env files and in CI. Using `??` would treat "" as a configured connection
  // string and hand the driver an unusable one, and would also disagree with the
  // falsy check the production guard below uses.
  return process.env.RUNTIME_DATABASE_URL || process.env.DATABASE_URL || "";
}

export const runtimeDb = drizzle(runtimeConnectionString(), { schema });

/**
 * Verifies that the runtime connection cannot defeat RLS, before any protected
 * query runs. Two independent checks:
 *
 *   1. In production, `RUNTIME_DATABASE_URL` must be set. Falling back to
 *      `DATABASE_URL` connects as the owner — typically a superuser, which
 *      bypasses RLS unconditionally (FORCE does not apply to superusers) — and
 *      would silently turn every policy in 0012/0013/0014 into a no-op.
 *   2. The role we are ACTUALLY connected as is inspected live. Asserting this
 *      about `app_rw` by name proves nothing if the connection string points
 *      somewhere else.
 *
 * The successful result is cached for the process. A failure is NOT cached
 * (NEW-4): the cache slot is cleared on rejection so a later call can retry once
 * the configuration or the database is fixed, rather than poisoning the process.
 */
let privilegeCheck: Promise<void> | null = null;

async function runPrivilegeCheck(): Promise<void> {
  if (process.env.NODE_ENV === "production" && !process.env.RUNTIME_DATABASE_URL) {
    throw new Error(
      "RUNTIME_DATABASE_URL is required in production (ADR-009 / §16.3.2). " +
        "Workspace-scoped queries must not run on the owner connection, which bypasses RLS. " +
        "Set it to the app_rw role: postgresql://app_rw:<password>@<host>:<port>/<database>",
    );
  }

  {
    const { rows } = (await runtimeDb.execute(sql`
      select
        current_user as role_name,
        (select rolsuper from pg_roles where rolname = current_user) as is_super,
        (select rolbypassrls from pg_roles where rolname = current_user) as bypasses_rls,
        (select count(*) from pg_tables
          where schemaname = 'public'
            and tableowner = current_user
            and tablename in ('workspaces', 'workspace_memberships', 'membership_roles')
        ) as owned_protected_tables
    `)) as unknown as {
      rows: Array<{
        role_name: string;
        is_super: boolean;
        bypasses_rls: boolean;
        owned_protected_tables: string | number;
      }>;
    };

    const row = rows[0];
    const problems: string[] = [];
    if (row.is_super) problems.push("is a superuser (bypasses RLS unconditionally)");
    if (row.bypasses_rls) problems.push("has BYPASSRLS");
    if (Number(row.owned_protected_tables) > 0) {
      problems.push("owns RLS-protected tables (FORCE ROW LEVEL SECURITY assumes a non-owner)");
    }
    if (problems.length > 0) {
      throw new Error(
        `Runtime database role "${row.role_name}" cannot enforce workspace isolation: ` +
          `${problems.join("; ")}. Point RUNTIME_DATABASE_URL at the app_rw role (ADR-009 / §16.3.2).`,
      );
    }
  }
}

async function assertRuntimeRoleIsRestricted(): Promise<void> {
  if (!privilegeCheck) {
    const pending = runPrivilegeCheck();
    privilegeCheck = pending;
    // Assigned first, then observed: clearing the slot cannot race ahead of the
    // assignment, so a failure never stays cached as the memoised result. The
    // handler only resets state; the rejection still propagates to the caller
    // through `pending`.
    pending.catch(() => {
      if (privilegeCheck === pending) privilegeCheck = null;
    });
  }
  return privilegeCheck;
}

export type WorkspaceContext = {
  userId: string;
  /** Omit or pass null for user-scoped-only queries (e.g. "list my workspaces"). */
  workspaceId?: string | null;
};

type RuntimeTx = Parameters<Parameters<typeof runtimeDb.transaction>[0]>[0];

/**
 * Runs `fn` inside a transaction with `app.current_user_id` (and
 * `app.current_workspace_id` when provided) set via `SET LOCAL`
 * (`set_config(..., true)`), so RLS enforces isolation for every query `fn`
 * issues. `workspaceId` must already be membership-validated by the caller —
 * RLS is defense in depth here, not a substitute for that check (§4.8).
 */
export async function withWorkspaceContext<T>(
  context: WorkspaceContext,
  fn: (tx: RuntimeTx) => Promise<T>,
): Promise<T> {
  await assertRuntimeRoleIsRestricted();
  return runtimeDb.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.current_user_id', ${context.userId}, true)`);
    await tx.execute(
      sql`select set_config('app.current_workspace_id', ${context.workspaceId ?? ""}, true)`,
    );
    return fn(tx);
  });
}

export async function withUserContext<T>(
  userId: string,
  fn: (tx: RuntimeTx) => Promise<T>,
): Promise<T> {
  return withWorkspaceContext({ userId, workspaceId: null }, fn);
}

/**
 * Pins `workspaceId` as the transaction-local workspace context.
 *
 * Bootstrap use only. `workspace_memberships_insert` requires the target
 * workspace to be pinned (drizzle/0013), so a workspace created mid-transaction
 * must be pinned here before its first membership row is written. Outside
 * bootstrap, the pin belongs to `withWorkspaceContext` after the application has
 * validated membership — do not use this to widen an existing context.
 */
export async function pinWorkspace(tx: RuntimeTx, workspaceId: string) {
  await tx.execute(sql`select set_config('app.current_workspace_id', ${workspaceId}, true)`);
}
