import { createHash } from "node:crypto";
import { inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { membershipRoles, roles, workspaceMemberships, workspaces } from "@/db/schema/workspace";

/**
 * Workspace bootstrap (§4.1-§4.4, ADR-009).
 *
 * 0011_workspace_foundation.sql backfilled a Workspace for every existing user
 * and organization and made `organizations.workspace_id` NOT NULL, but no
 * application path was updated to create one — so organization creation would
 * have failed at runtime with a NOT NULL violation. This service is that path.
 *
 * The ordering here is a security requirement, not a convenience:
 * `workspace_memberships_insert` (drizzle/0013) requires the target workspace to
 * be pinned as `app.current_workspace_id`, and admits an unclaimed workspace
 * only for a caller adding themselves. Creating the workspace, pinning it, and
 * only then writing the first membership is what closes P0-1 while keeping
 * bootstrap possible.
 *
 * Takes a transaction so callers on the owner connection (db/index.ts) and on
 * the RLS-restricted runtime connection (db/runtime.ts) share one code path.
 * Setting the GUCs is a no-op when the caller is a superuser that bypasses RLS,
 * and required as soon as it is not — so it is done unconditionally.
 */
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type WorkspaceBootstrapInput = {
  type: "PERSONAL" | "ORGANIZATION";
  name: string;
  slug: string;
  ownerUserId: string;
  /** Workspace role codes granted to the founding member, e.g. ["ORG_OWNER"]. */
  roleCodes: string[];
};

export async function provisionWorkspace(tx: Transaction, input: WorkspaceBootstrapInput) {
  await tx.execute(sql`select set_config('app.current_user_id', ${input.ownerUserId}, true)`);

  const [workspace] = await tx
    .insert(workspaces)
    .values({ type: input.type, name: input.name, slug: input.slug })
    .returning();

  // Pin before the first membership write — see the ordering note above.
  await tx.execute(sql`select set_config('app.current_workspace_id', ${workspace.id}, true)`);

  const [membership] = await tx
    .insert(workspaceMemberships)
    .values({ workspaceId: workspace.id, userId: input.ownerUserId, status: "ACTIVE" })
    .returning();

  if (input.roleCodes.length > 0) {
    const roleRows = await tx
      .select({ id: roles.id })
      .from(roles)
      .where(inArray(roles.code, input.roleCodes));
    if (roleRows.length > 0) {
      await tx
        .insert(membershipRoles)
        .values(roleRows.map((role) => ({ membershipId: membership.id, roleId: role.id })))
        .onConflictDoNothing();
    }
  }

  return { workspace, membership };
}

/**
 * Organization Workspace slug, matching the backfill in 0011 (`'org-' || o.slug`)
 * so pre-existing and newly created organizations share one naming rule.
 * `workspaces.slug` is globally unique.
 */
export function organizationWorkspaceSlug(organizationSlug: string) {
  return `org-${organizationSlug}`;
}

/** Personal Workspace slug, matching 0011's `'personal-' || md5(u.id)`. */
export function personalWorkspaceSlug(userId: string) {
  return `personal-${createHash("md5").update(userId).digest("hex")}`;
}
