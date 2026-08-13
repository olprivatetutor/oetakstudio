import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "@/db/schema/auth";

const timestampColumns = {
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
};

const idColumn = (name = "id") =>
  text(name)
    .$defaultFn(() => crypto.randomUUID())
    .notNull();

// app_summary.md §4.1: Workspace is the canonical security/business-data boundary.
export const workspaceTypeEnum = pgEnum("workspace_type", ["PERSONAL", "ORGANIZATION"]);

export const workspaceStatusEnum = pgEnum("workspace_status", [
  "ACTIVE",
  "RESTRICTED",
  "SUSPENDED",
  "CLOSED",
]);

export const workspaceMembershipStatusEnum = pgEnum("workspace_membership_status", [
  "INVITED",
  "ACTIVE",
  "SUSPENDED",
  "REMOVED",
]);

// §3.1: platform-scoped roles are not membership-bound; workspace-scoped roles are.
export const roleScopeEnum = pgEnum("role_scope", ["PLATFORM", "WORKSPACE"]);

export const workspaces = pgTable(
  "workspaces",
  {
    id: idColumn().primaryKey(),
    type: workspaceTypeEnum("type").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: workspaceStatusEnum("status").default("ACTIVE").notNull(),
    settings: jsonb("settings").$type<Record<string, unknown>>().default({}).notNull(),
    // §4.9/ADR-020 lineage and creation rate limit. Audit/attribution only —
    // never used as an authorization predicate, so a stale value grants nothing.
    createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
    ...timestampColumns,
  },
  (table) => [
    uniqueIndex("workspaces_slug_unique").on(table.slug),
    index("workspaces_type_idx").on(table.type),
    index("workspaces_status_idx").on(table.status),
    index("workspaces_created_by_idx").on(table.createdById),
  ],
);

// §4.2: User <-N:M-> Workspace via WorkspaceMembership. A membership may hold
// multiple roles (see membershipRoles) — never a single role column here.
export const workspaceMemberships = pgTable(
  "workspace_memberships",
  {
    id: idColumn().primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: workspaceMembershipStatusEnum("status").default("ACTIVE").notNull(),
    joinedAt: timestamp("joined_at")
      .$defaultFn(() => new Date())
      .notNull(),
    invitedById: text("invited_by_id").references(() => user.id, { onDelete: "set null" }),
    ...timestampColumns,
  },
  (table) => [
    uniqueIndex("workspace_memberships_workspace_user_unique").on(
      table.workspaceId,
      table.userId,
    ),
    index("workspace_memberships_user_idx").on(table.userId),
    index("workspace_memberships_workspace_status_idx").on(table.workspaceId, table.status),
  ],
);

// Stable string keys per §13.2 (e.g. "course.publish", "assessment.review"),
// seeded via migration — never runtime data entry.
export const roles = pgTable(
  "roles",
  {
    id: idColumn().primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    scope: roleScopeEnum("scope").notNull(),
    description: text("description"),
    ...timestampColumns,
  },
  (table) => [uniqueIndex("roles_code_unique").on(table.code)],
);

export const permissions = pgTable(
  "permissions",
  {
    id: idColumn().primaryKey(),
    code: text("code").notNull(),
    description: text("description"),
    ...timestampColumns,
  },
  (table) => [uniqueIndex("permissions_code_unique").on(table.code)],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: text("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
    ...timestampColumns,
  },
  (table) => [
    primaryKey({ columns: [table.roleId, table.permissionId], name: "role_permissions_pk" }),
    index("role_permissions_permission_idx").on(table.permissionId),
  ],
);

// §13.2 `membership_roles`: (membership_id, role_id) — a membership may hold N roles.
export const membershipRoles = pgTable(
  "membership_roles",
  {
    membershipId: text("membership_id")
      .notNull()
      .references(() => workspaceMemberships.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    grantedById: text("granted_by_id").references(() => user.id, { onDelete: "set null" }),
    grantedAt: timestamp("granted_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.membershipId, table.roleId], name: "membership_roles_pk" }),
    index("membership_roles_role_idx").on(table.roleId),
  ],
);

// §13.2 `user_platform_roles`: (user_id, role_id) — platform-scoped role assignment,
// independent of any workspace membership.
export const userPlatformRoles = pgTable(
  "user_platform_roles",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    grantedById: text("granted_by_id").references(() => user.id, { onDelete: "set null" }),
    grantedAt: timestamp("granted_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.roleId], name: "user_platform_roles_pk" }),
    index("user_platform_roles_role_idx").on(table.roleId),
  ],
);
