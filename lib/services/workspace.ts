import { and, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  membershipRoles,
  permissions,
  rolePermissions,
  roles,
  workspaceMemberships,
  workspaces,
} from "@/db/schema/workspace";
import { AppError } from "@/lib/api/response";

/**
 * Workspace bootstrap (§4.1-§4.4, §4.9 / ADR-020).
 *
 * Creation runs through the `app_bootstrap_workspace` SQL function
 * (drizzle/0014), not through direct inserts. That function is the only writer
 * that can create a workspace and its founding membership, it derives the
 * creator from `app.current_user_id` rather than a parameter, and it generates
 * the workspace id and slug itself — so it cannot be aimed at an existing or
 * orphaned workspace, and it cannot be used to squat a slug.
 *
 * The §4.9 gates are enforced in two places on purpose:
 *   * here — the `workspace.organization.create` permission check, because the
 *     role/permission union is application authorization logic and does not
 *     belong in SQL, plus the audit record written by the calling service;
 *   * in the function — verified email, UNDER_13, and the per-user limit,
 *     because those are invariants that must hold even if a caller forgets.
 */
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** §4.9 default: 3 organization workspaces per user, configurable. */
export const DEFAULT_ORG_WORKSPACE_LIMIT = 3;

export function organizationWorkspaceLimit() {
  const configured = Number(process.env.ORG_WORKSPACE_LIMIT_PER_USER);
  return Number.isInteger(configured) && configured > 0
    ? configured
    : DEFAULT_ORG_WORKSPACE_LIMIT;
}

export type WorkspaceBootstrapInput = {
  type: "PERSONAL" | "ORGANIZATION";
  name: string;
  ownerUserId: string;
  /** Workspace role codes granted to the founding member, e.g. ["ORG_OWNER"]. */
  roleCodes: string[];
};

export type PersonalWorkspaceUser = {
  id: string;
  name?: string | null;
};

/**
 * Does the user hold `workspace.organization.create` through any ACTIVE
 * membership? §3.4/§6: effective permissions are the union over the roles of a
 * user's active memberships — never a single role column, never a hardcoded
 * role array.
 */
export async function canCreateOrganizationWorkspace(tx: Transaction, userId: string) {
  const [row] = await tx
    .select({ n: count() })
    .from(workspaceMemberships)
    .innerJoin(membershipRoles, eq(membershipRoles.membershipId, workspaceMemberships.id))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, membershipRoles.roleId))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(
      and(
        eq(workspaceMemberships.userId, userId),
        eq(workspaceMemberships.status, "ACTIVE"),
        eq(permissions.code, "workspace.organization.create"),
      ),
    );
  return (row?.n ?? 0) > 0;
}

/**
 * Runs `fn` with `app.current_user_id` set, restoring whatever was there before.
 *
 * `app_bootstrap_workspace` reads the creator from the transaction-local GUC, so
 * it has to be set — but this transaction may be doing unrelated workspace-scoped
 * work before and after (NEW-5). Saving and restoring both GUCs keeps the
 * mutation from leaking. `current_setting(..., true)` yields NULL when unset,
 * restored here as '' — the same value `withWorkspaceContext` writes for
 * "absent", which the fail-closed accessors collapse back to NULL.
 */
async function withPreservedContext<T>(
  tx: Transaction,
  userId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = (await tx.execute(sql`
    select
      coalesce(current_setting('app.current_user_id', true), '') as user_id,
      coalesce(current_setting('app.current_workspace_id', true), '') as workspace_id
  `)) as unknown as { rows: Array<{ user_id: string; workspace_id: string }> };
  const before = previous.rows[0] ?? { user_id: "", workspace_id: "" };

  const restore = async () => {
    await tx.execute(sql`select set_config('app.current_user_id', ${before.user_id}, true)`);
    await tx.execute(
      sql`select set_config('app.current_workspace_id', ${before.workspace_id}, true)`,
    );
  };

  await tx.execute(sql`select set_config('app.current_user_id', ${userId}, true)`);
  try {
    const result = await fn();
    await restore();
    return result;
  } catch (error) {
    // On failure the transaction is already aborted, so the restore itself would
    // raise 25P02 and mask the real cause. It is also moot: SET LOCAL dies with
    // the transaction. Best-effort only, and never at the expense of the error
    // the caller needs to see.
    await restore().catch(() => {});
    throw error;
  }
}

/**
 * Maps the function's SQLSTATEs onto stable application error codes.
 *
 * Drizzle wraps driver errors in its own `Failed query` Error and hangs the
 * original on `cause`, so the SQLSTATE and the RAISE message have to be read
 * from there — reading `error.code` off the wrapper alone silently matches
 * nothing and every gate would surface as an opaque 500.
 */
function translateBootstrapError(error: unknown): never {
  const cause = (error as { cause?: unknown }).cause;
  const driverError = (cause ?? error) as { code?: string; message?: string };
  const code = driverError.code;
  const message = `${driverError.message ?? ""} ${(error as { message?: string }).message ?? ""}`;
  if (code === "53400") {
    throw new AppError(
      "RATE_LIMITED",
      `Organization workspace creation limit reached (${organizationWorkspaceLimit()} per user)`,
      429,
    );
  }
  if (code === "42501") {
    if (message.includes("email is not verified")) {
      throw new AppError("FORBIDDEN", "A verified email address is required", 403);
    }
    if (message.includes("under 13")) {
      throw new AppError(
        "FORBIDDEN",
        "Accounts under 13 cannot create organization workspaces",
        403,
      );
    }
    throw new AppError("FORBIDDEN", "Workspace creation is not permitted", 403);
  }
  throw error;
}

/**
 * Rejects any attempt to grant a PLATFORM-scope role through a workspace
 * membership (AGENTS.md §6.5: platform and workspace roles are separate scopes).
 *
 * This is the application half of the control. The database enforces the same
 * rule structurally via the `membership_roles_scope_check` trigger and the
 * membership_roles RLS predicates (drizzle/0015), so neither layer is load-
 * bearing alone. Rejecting here — rather than silently filtering — means a
 * caller that asks for SUPER_ADMIN gets an error instead of a quietly reduced
 * grant it might not notice.
 */
export async function assertWorkspaceScopedRoles(tx: Transaction, roleCodes: string[]) {
  if (roleCodes.length === 0) return;
  const rows = await tx
    .select({ code: roles.code, scope: roles.scope })
    .from(roles)
    .where(inArray(roles.code, roleCodes));

  const known = new Set(rows.map((row) => row.code));
  const unknown = roleCodes.filter((code) => !known.has(code));
  if (unknown.length > 0) {
    throw new AppError("VALIDATION_ERROR", `Unknown workspace role: ${unknown.join(", ")}`, 400);
  }

  const platformRoles = rows.filter((row) => row.scope !== "WORKSPACE").map((row) => row.code);
  if (platformRoles.length > 0) {
    throw new AppError(
      "FORBIDDEN",
      `Platform-scope roles cannot be granted through a workspace membership: ${platformRoles.join(", ")}`,
      403,
    );
  }
}

export async function provisionWorkspace(tx: Transaction, input: WorkspaceBootstrapInput) {
  await assertWorkspaceScopedRoles(tx, input.roleCodes);

  if (input.type === "ORGANIZATION") {
    // §4.9 permission gate, checked before the call so the caller gets a precise
    // error rather than the function's generic refusal.
    if (!(await canCreateOrganizationWorkspace(tx, input.ownerUserId))) {
      throw new AppError(
        "FORBIDDEN",
        "The workspace.organization.create permission is required",
        403,
      );
    }
  }

  // Role codes are passed as one bound parameter and split server-side, so no
  // caller-supplied text is ever concatenated into SQL.
  const roleCodeList = input.roleCodes.join(",");

  const workspaceId = await withPreservedContext(tx, input.ownerUserId, async () => {
    try {
      const result = (await tx.execute(sql`
        select "app_bootstrap_workspace"(
          ${input.type},
          ${input.name},
          string_to_array(${roleCodeList}, ','),
          ${organizationWorkspaceLimit()}
        ) as workspace_id
      `)) as unknown as { rows: Array<{ workspace_id: string }> };
      return result.rows[0].workspace_id;
    } catch (error) {
      translateBootstrapError(error);
    }
  });

  const [workspace] = await tx.select().from(workspaces).where(eq(workspaces.id, workspaceId));
  const [membership] = await tx
    .select()
    .from(workspaceMemberships)
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, input.ownerUserId),
      ),
    );

  return { workspace, membership };
}

/**
 * Ensures the canonical post-verification workspace state for a normal user:
 * exactly one PERSONAL workspace, one ACTIVE founding membership, and LEARNER.
 *
 * Idempotency and concurrency safety live in `app_bootstrap_workspace`
 * (drizzle/0016). Keeping this as an internal service instead of a route avoids
 * reintroducing the unrestricted PERSONAL-workspace claim/bootstrap API closed
 * by drizzle/0014 (NEW-9).
 */
export async function ensurePersonalWorkspaceForUser(input: PersonalWorkspaceUser) {
  return db.transaction((tx) =>
    provisionWorkspace(tx, {
      type: "PERSONAL",
      name: input.name?.trim() || "Personal Workspace",
      ownerUserId: input.id,
      roleCodes: ["LEARNER"],
    }),
  );
}
