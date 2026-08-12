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
function runtimeConnectionString() {
  return process.env.RUNTIME_DATABASE_URL ?? process.env.DATABASE_URL!;
}

export const runtimeDb = drizzle(runtimeConnectionString(), { schema });

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
