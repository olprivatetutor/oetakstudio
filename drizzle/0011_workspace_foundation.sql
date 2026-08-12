-- Phase 1: Workspace foundation (app_summary.md §4, §13.2, Design Rules #1-#4).
-- Introduces the canonical User -> WorkspaceMembership -> Workspace model and
-- RBAC tables, and backfills them from the existing organization-based
-- tenancy. Existing organization_id columns and organization_members are left
-- untouched (expand -> backfill -> dual-write; contract is Phase 2+ work).

DO $$ BEGIN CREATE TYPE "public"."workspace_type" AS ENUM('PERSONAL', 'ORGANIZATION'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."workspace_status" AS ENUM('ACTIVE', 'RESTRICTED', 'SUSPENDED', 'CLOSED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."workspace_membership_status" AS ENUM('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."role_scope" AS ENUM('PLATFORM', 'WORKSPACE'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "workspaces" (
  "id" text PRIMARY KEY NOT NULL,
  "type" "workspace_type" NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "status" "workspace_status" DEFAULT 'ACTIVE' NOT NULL,
  "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_slug_unique" ON "workspaces" ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspaces_type_idx" ON "workspaces" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspaces_status_idx" ON "workspaces" ("status");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "workspace_memberships" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "status" "workspace_membership_status" DEFAULT 'ACTIVE' NOT NULL,
  "joined_at" timestamp NOT NULL DEFAULT now(),
  "invited_by_id" text REFERENCES "user"("id") ON DELETE set null,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_memberships_workspace_user_unique" ON "workspace_memberships" ("workspace_id", "user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspace_memberships_user_idx" ON "workspace_memberships" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspace_memberships_workspace_status_idx" ON "workspace_memberships" ("workspace_id", "status");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "roles" (
  "id" text PRIMARY KEY NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "scope" "role_scope" NOT NULL,
  "description" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "roles_code_unique" ON "roles" ("code");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "permissions" (
  "id" text PRIMARY KEY NOT NULL,
  "code" text NOT NULL,
  "description" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "permissions_code_unique" ON "permissions" ("code");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "role_permissions" (
  "role_id" text NOT NULL REFERENCES "roles"("id") ON DELETE cascade,
  "permission_id" text NOT NULL REFERENCES "permissions"("id") ON DELETE cascade,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "role_permissions_pk" PRIMARY KEY ("role_id", "permission_id")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permissions_permission_idx" ON "role_permissions" ("permission_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "membership_roles" (
  "membership_id" text NOT NULL REFERENCES "workspace_memberships"("id") ON DELETE cascade,
  "role_id" text NOT NULL REFERENCES "roles"("id") ON DELETE cascade,
  "granted_by_id" text REFERENCES "user"("id") ON DELETE set null,
  "granted_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "membership_roles_pk" PRIMARY KEY ("membership_id", "role_id")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "membership_roles_role_idx" ON "membership_roles" ("role_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_platform_roles" (
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "role_id" text NOT NULL REFERENCES "roles"("id") ON DELETE cascade,
  "granted_by_id" text REFERENCES "user"("id") ON DELETE set null,
  "granted_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "user_platform_roles_pk" PRIMARY KEY ("user_id", "role_id")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_platform_roles_role_idx" ON "user_platform_roles" ("role_id");--> statement-breakpoint

ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "workspace_id" text REFERENCES "workspaces"("id") ON DELETE restrict;--> statement-breakpoint

-- Seed canonical roles (§3.1).
INSERT INTO "roles" ("id", "code", "name", "scope", "description") VALUES
  (gen_random_uuid()::text, 'SUPER_ADMIN', 'Super Admin', 'PLATFORM', 'Full platform administration, via audited elevation for cross-workspace access.'),
  (gen_random_uuid()::text, 'PLATFORM_CONTENT_ADMIN', 'Platform Content Admin', 'PLATFORM', 'Manages global frameworks and platform course templates.'),
  (gen_random_uuid()::text, 'ORG_OWNER', 'Organization Owner', 'WORKSPACE', 'Highest organization-level privileges within a workspace.'),
  (gen_random_uuid()::text, 'ORG_ADMIN', 'Organization Admin', 'WORKSPACE', 'Organization administration within a workspace.'),
  (gen_random_uuid()::text, 'TEACHER', 'Teacher', 'WORKSPACE', 'Assigned-class teaching, assessment review, and analytics.'),
  (gen_random_uuid()::text, 'CONTENT_CREATOR', 'Content Creator', 'WORKSPACE', 'Course and assessment authoring within a workspace.'),
  (gen_random_uuid()::text, 'LEARNER', 'Learner', 'WORKSPACE', 'Learning, assessment, and AI Tutor access.'),
  (gen_random_uuid()::text, 'GUARDIAN', 'Guardian', 'WORKSPACE', 'Read-only visibility into linked learners with an ACTIVE relationship.')
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint

-- Seed a baseline permission catalog (§3.4). Additional permissions may be
-- added later without migration risk (a pure catalog table).
INSERT INTO "permissions" ("id", "code", "description") VALUES
  (gen_random_uuid()::text, 'platform.administer', 'Platform administration.'),
  (gen_random_uuid()::text, 'platform.elevate', 'Audited, per-request cross-workspace read elevation (§3.5).'),
  (gen_random_uuid()::text, 'framework.manage.global', 'Manage global (platform-scoped) learning frameworks.'),
  (gen_random_uuid()::text, 'course.template.author', 'Author platform course templates.'),
  (gen_random_uuid()::text, 'workspace.settings.manage', 'Manage organization workspace settings.'),
  (gen_random_uuid()::text, 'workspace.billing.manage', 'Manage workspace billing and subscription.'),
  (gen_random_uuid()::text, 'workspace.member.manage', 'Manage workspace membership.'),
  (gen_random_uuid()::text, 'workspace.role.assign', 'Assign workspace roles to members.'),
  (gen_random_uuid()::text, 'workspace.class.manage', 'Manage classes/cohorts.'),
  (gen_random_uuid()::text, 'workspace.organization.create', 'Create a new Organization workspace (ADR-020; rate-limited, verified-adult only).'),
  (gen_random_uuid()::text, 'course.author.workspace', 'Author courses within a workspace.'),
  (gen_random_uuid()::text, 'course.publish.workspace', 'Publish workspace course content.'),
  (gen_random_uuid()::text, 'course.assign', 'Assign courses/offerings to learners.'),
  (gen_random_uuid()::text, 'assessment.create', 'Create assessments.'),
  (gen_random_uuid()::text, 'assessment.review', 'Review learner assessment submissions.'),
  (gen_random_uuid()::text, 'ai.score.review', 'Override/review AI-generated scores.'),
  (gen_random_uuid()::text, 'analytics.class.view', 'View class/organization analytics.'),
  (gen_random_uuid()::text, 'learn.access', 'Learn, take assessments, and use the AI Tutor.'),
  (gen_random_uuid()::text, 'progress.view.self', 'View own learning progress.'),
  (gen_random_uuid()::text, 'learner.progress.view.linked', 'View progress of an explicitly linked learner (accepted guardian relationship only).')
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint

-- Baseline role -> permission grants (§3.4 matrix). "Via membership" cells are
-- intentionally NOT granted to the platform-scope roles below: SUPER_ADMIN and
-- PLATFORM_CONTENT_ADMIN only get workspace-scoped capabilities through an
-- actual workspace membership + workspace role, never from the platform role
-- alone. "Configurable"/"Limited" cells are seeded to their conventional
-- default role here; per-workspace overrides are a later capability-settings
-- feature, not required for this migration.
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM (VALUES
  ('SUPER_ADMIN', ARRAY['platform.administer','platform.elevate']),
  ('PLATFORM_CONTENT_ADMIN', ARRAY['framework.manage.global','course.template.author']),
  ('ORG_OWNER', ARRAY['workspace.settings.manage','workspace.billing.manage','workspace.member.manage','workspace.role.assign','workspace.class.manage','course.author.workspace','course.publish.workspace','course.assign','assessment.create','assessment.review','ai.score.review','analytics.class.view','learn.access','progress.view.self']),
  ('ORG_ADMIN', ARRAY['workspace.settings.manage','workspace.billing.manage','workspace.member.manage','workspace.role.assign','workspace.class.manage','course.author.workspace','course.publish.workspace','course.assign','assessment.create','assessment.review','ai.score.review','analytics.class.view','learn.access','progress.view.self']),
  ('TEACHER', ARRAY['workspace.class.manage','course.author.workspace','course.publish.workspace','course.assign','assessment.create','assessment.review','ai.score.review','analytics.class.view','learn.access','progress.view.self']),
  ('CONTENT_CREATOR', ARRAY['course.author.workspace','assessment.create','analytics.class.view','learn.access','progress.view.self']),
  ('LEARNER', ARRAY['learn.access','progress.view.self','workspace.organization.create']),
  ('GUARDIAN', ARRAY['learner.progress.view.linked'])
) AS m(code, perms)
JOIN "roles" r ON r.code = m.code
JOIN "permissions" p ON p.code = ANY(m.perms)
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- One Personal Workspace per existing user (§5.1). Slug is deterministic from
-- the user id so this block is safe to re-run.
INSERT INTO "workspaces" ("id", "type", "name", "slug", "status")
SELECT gen_random_uuid()::text, 'PERSONAL', COALESCE(NULLIF(trim(u."name"), ''), 'Personal Workspace'), 'personal-' || md5(u."id"), 'ACTIVE'
FROM "user" u
WHERE NOT EXISTS (
  SELECT 1 FROM "workspace_memberships" wm
  JOIN "workspaces" w ON w."id" = wm."workspace_id"
  WHERE wm."user_id" = u."id" AND w."type" = 'PERSONAL'
);--> statement-breakpoint

INSERT INTO "workspace_memberships" ("id", "workspace_id", "user_id", "status")
SELECT gen_random_uuid()::text, w."id", u."id", 'ACTIVE'
FROM "user" u
JOIN "workspaces" w ON w."slug" = 'personal-' || md5(u."id") AND w."type" = 'PERSONAL'
WHERE NOT EXISTS (
  SELECT 1 FROM "workspace_memberships" wm WHERE wm."workspace_id" = w."id" AND wm."user_id" = u."id"
);--> statement-breakpoint

INSERT INTO "membership_roles" ("membership_id", "role_id")
SELECT wm."id", r."id"
FROM "workspace_memberships" wm
JOIN "workspaces" w ON w."id" = wm."workspace_id" AND w."type" = 'PERSONAL'
JOIN "roles" r ON r."code" = 'LEARNER'
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- One Organization Workspace per existing organization (§4.4), 1:1 linked.
INSERT INTO "workspaces" ("id", "type", "name", "slug", "status")
SELECT gen_random_uuid()::text, 'ORGANIZATION', o."name", 'org-' || o."slug", 'ACTIVE'
FROM "organizations" o
WHERE o."workspace_id" IS NULL;--> statement-breakpoint

UPDATE "organizations" o
SET "workspace_id" = w."id"
FROM "workspaces" w
WHERE w."slug" = 'org-' || o."slug" AND w."type" = 'ORGANIZATION' AND o."workspace_id" IS NULL;--> statement-breakpoint

-- organization_members -> workspace_memberships (status mapped, dual-write
-- going forward; organization_members remains authoritative for existing
-- code paths per the compatibility strategy).
INSERT INTO "workspace_memberships" ("id", "workspace_id", "user_id", "status", "joined_at")
SELECT gen_random_uuid()::text, o."workspace_id", om."user_id",
  (CASE om."status"::text
    WHEN 'active' THEN 'ACTIVE'
    WHEN 'invited' THEN 'INVITED'
    WHEN 'suspended' THEN 'SUSPENDED'
    WHEN 'removed' THEN 'REMOVED'
    ELSE 'ACTIVE'
  END)::"workspace_membership_status",
  om."created_at"
FROM "organization_members" om
JOIN "organizations" o ON o."id" = om."organization_id"
WHERE NOT EXISTS (
  SELECT 1 FROM "workspace_memberships" wm
  WHERE wm."workspace_id" = o."workspace_id" AND wm."user_id" = om."user_id"
);--> statement-breakpoint

INSERT INTO "membership_roles" ("membership_id", "role_id")
SELECT wm."id", r."id"
FROM "organization_members" om
JOIN "organizations" o ON o."id" = om."organization_id"
JOIN "workspace_memberships" wm ON wm."workspace_id" = o."workspace_id" AND wm."user_id" = om."user_id"
JOIN (VALUES
  ('owner','ORG_OWNER'),
  ('admin','ORG_ADMIN'),
  ('teacher','TEACHER'),
  ('content','CONTENT_CREATOR'),
  ('learner','LEARNER'),
  ('guardian','GUARDIAN')
) AS rolemap(org_role, role_code) ON rolemap.org_role = om."role"::text
JOIN "roles" r ON r."code" = rolemap.role_code
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- app_admins -> user_platform_roles (§3.1 platform scope).
INSERT INTO "user_platform_roles" ("user_id", "role_id")
SELECT aa."user_id", r."id"
FROM "app_admins" aa
JOIN (VALUES ('owner','SUPER_ADMIN'), ('admin','SUPER_ADMIN'), ('content','PLATFORM_CONTENT_ADMIN')) AS rolemap(admin_role, role_code)
  ON rolemap.admin_role = aa."role"::text
JOIN "roles" r ON r."code" = rolemap.role_code
WHERE aa."status" = 'active'
ON CONFLICT DO NOTHING;--> statement-breakpoint

ALTER TABLE "organizations" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_workspace_unique" ON "organizations" ("workspace_id");
