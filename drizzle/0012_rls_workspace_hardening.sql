-- Phase 1: RLS hardening for the workspace/RBAC foundation (ADR-009, §16.3).
--
-- Companion to 0011_workspace_foundation.sql. That migration created the
-- canonical Workspace / WorkspaceMembership / RBAC tables; this one gives them
-- the enforcement half of ADR-009:
--
--   * a non-owner, non-superuser, non-BYPASSRLS runtime role (`app_rw`);
--   * ENABLE + FORCE ROW LEVEL SECURITY on the workspace-owned tables;
--   * every policy carries both USING and WITH CHECK;
--   * missing `app.current_workspace_id` fails closed (NULL comparison => no rows).
--
-- SCOPE / DELIBERATE DEFERRAL: the legacy organization-tenancy tables hardened
-- in 0006_auth_and_rls.sql (organizations, courses, enrollments, ai_*, ...) are
-- intentionally left as-is. They are still read and written by application code
-- that connects as the table owner (db/index.ts), so adding FORCE to them now
-- would silently return zero rows across the running application. Their cutover
-- to `app.current_workspace_id` + FORCE belongs to the compatibility/cutover
-- phase, after those services move onto db/runtime.ts. This migration therefore
-- only hardens tables that no owner-connection code path reads yet.

-- ---------------------------------------------------------------------------
-- 1. Context accessors
-- ---------------------------------------------------------------------------
-- `current_setting(..., true)` yields NULL when the GUC was never set, and ''
-- when db/runtime.ts sets an absent workspace explicitly. Both must collapse to
-- NULL so that every `col = app_current_workspace_id()` comparison evaluates to
-- NULL (not TRUE) and the row is excluded. This is the fail-closed contract in
-- §16.3.2 — do not rewrite these to COALESCE onto a sentinel string.

CREATE OR REPLACE FUNCTION "app_current_workspace_id"() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT NULLIF(current_setting('app.current_workspace_id', true), '') $$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION "app_current_user_id"() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT NULLIF(current_setting('app.current_user_id', true), '') $$;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2. Runtime role
-- ---------------------------------------------------------------------------
-- Created without a password: it cannot authenticate until an operator runs
-- `RUNTIME_DB_PASSWORD=... npm run db:setup-runtime-role`. Requires the
-- migration connection to hold CREATEROLE (or superuser); if it does not, this
-- statement fails loudly rather than leaving an unhardened database behind —
-- pre-create `app_rw` with the same attributes and re-run.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rw') THEN
    CREATE ROLE "app_rw" WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;--> statement-breakpoint

-- Re-asserted even when the role pre-existed: ADR-009 requires these to hold.
ALTER ROLE "app_rw" WITH NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;--> statement-breakpoint

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO "app_rw"', current_database());
END $$;--> statement-breakpoint

GRANT USAGE ON SCHEMA "public" TO "app_rw";--> statement-breakpoint

-- Least privilege, granted table by table. No ALTER DEFAULT PRIVILEGES: a future
-- workspace-owned table must not become readable by the runtime role before its
-- own RLS policy exists in the same migration (§7 of AGENTS.md).
GRANT SELECT, INSERT, UPDATE, DELETE ON "workspaces" TO "app_rw";--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "workspace_memberships" TO "app_rw";--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "membership_roles" TO "app_rw";--> statement-breakpoint

-- Reference/authorization catalogs are read-only at runtime: role and permission
-- definitions, their mapping, and platform-role grants change only by migration
-- or an audited admin path running as the owner — never from request handling.
GRANT SELECT ON "roles" TO "app_rw";--> statement-breakpoint
GRANT SELECT ON "permissions" TO "app_rw";--> statement-breakpoint
GRANT SELECT ON "role_permissions" TO "app_rw";--> statement-breakpoint
GRANT SELECT ON "user_platform_roles" TO "app_rw";--> statement-breakpoint

-- Global identity, needed to resolve the caller and render member lists.
-- `user.birth_date` remains minimized at the API layer (§16.5); column-level
-- revocation is deferred to the migration that first exposes member listings.
GRANT SELECT ON "user" TO "app_rw";--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 3. workspaces
-- ---------------------------------------------------------------------------
-- Visible when the caller holds an ACTIVE membership, narrowed to the pinned
-- workspace whenever `app.current_workspace_id` is set. With no workspace pinned
-- (db/runtime.ts `withUserContext`) the caller sees exactly their own
-- workspaces — the workspace switcher — and nothing else.

ALTER TABLE "workspaces" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workspaces" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS "workspaces_select" ON "workspaces";--> statement-breakpoint
CREATE POLICY "workspaces_select" ON "workspaces" FOR SELECT
  USING (
    ("app_current_workspace_id"() IS NULL OR "id" = "app_current_workspace_id"())
    AND EXISTS (
      SELECT 1 FROM "workspace_memberships" wm
      WHERE wm."workspace_id" = "workspaces"."id"
        AND wm."user_id" = "app_current_user_id"()
        AND wm."status" = 'ACTIVE'
    )
  );--> statement-breakpoint

-- Creation is the one operation with no pre-existing membership to check
-- (registration bootstraps a Personal Workspace, ADR-020 gates Organization
-- Workspace creation). RLS can only require an authenticated context here; the
-- `workspace.organization.create` permission check stays in the application
-- service, which is where §4.9's rate limit and verified-adult rule live.
DROP POLICY IF EXISTS "workspaces_insert" ON "workspaces";--> statement-breakpoint
CREATE POLICY "workspaces_insert" ON "workspaces" FOR INSERT
  WITH CHECK ("app_current_user_id"() IS NOT NULL);--> statement-breakpoint

-- Mutation requires the workspace to be pinned: WITH CHECK repeats the predicate
-- so a row cannot be updated out of the caller's workspace.
DROP POLICY IF EXISTS "workspaces_update" ON "workspaces";--> statement-breakpoint
CREATE POLICY "workspaces_update" ON "workspaces" FOR UPDATE
  USING (
    "id" = "app_current_workspace_id"()
    AND EXISTS (
      SELECT 1 FROM "workspace_memberships" wm
      WHERE wm."workspace_id" = "workspaces"."id"
        AND wm."user_id" = "app_current_user_id"()
        AND wm."status" = 'ACTIVE'
    )
  )
  WITH CHECK (
    "id" = "app_current_workspace_id"()
    AND EXISTS (
      SELECT 1 FROM "workspace_memberships" wm
      WHERE wm."workspace_id" = "workspaces"."id"
        AND wm."user_id" = "app_current_user_id"()
        AND wm."status" = 'ACTIVE'
    )
  );--> statement-breakpoint

-- No DELETE policy: workspace deletion is a lifecycle command (status CLOSED),
-- not a runtime row delete. Absent policy => denied for app_rw.

-- ---------------------------------------------------------------------------
-- 4. workspace_memberships
-- ---------------------------------------------------------------------------
-- These policies deliberately compare only against the GUCs and never sub-select
-- `workspace_memberships` itself: a policy that reads its own table raises
-- "infinite recursion detected in policy for relation". Consequence: any context
-- that has pinned a workspace can read that workspace's membership rows. That is
-- sound because db/runtime.ts only pins a workspace *after* the application has
-- validated an active membership (§4.8), and because listing members still
-- requires `workspace.member.manage` at the service layer. RLS is the second
-- line here, not the first.

ALTER TABLE "workspace_memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workspace_memberships" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_memberships_select" ON "workspace_memberships";--> statement-breakpoint
CREATE POLICY "workspace_memberships_select" ON "workspace_memberships" FOR SELECT
  USING (
    "workspace_id" = "app_current_workspace_id"()
    OR ("app_current_workspace_id"() IS NULL AND "user_id" = "app_current_user_id"())
  );--> statement-breakpoint

-- The unpinned branch covers registration bootstrap only: a user joining the
-- workspace they just created, as themselves. Inviting anyone else requires the
-- workspace to be pinned.
DROP POLICY IF EXISTS "workspace_memberships_insert" ON "workspace_memberships";--> statement-breakpoint
CREATE POLICY "workspace_memberships_insert" ON "workspace_memberships" FOR INSERT
  WITH CHECK (
    "workspace_id" = "app_current_workspace_id"()
    OR ("app_current_workspace_id"() IS NULL AND "user_id" = "app_current_user_id"())
  );--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_memberships_update" ON "workspace_memberships";--> statement-breakpoint
CREATE POLICY "workspace_memberships_update" ON "workspace_memberships" FOR UPDATE
  USING ("workspace_id" = "app_current_workspace_id"())
  WITH CHECK ("workspace_id" = "app_current_workspace_id"());--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_memberships_delete" ON "workspace_memberships";--> statement-breakpoint
CREATE POLICY "workspace_memberships_delete" ON "workspace_memberships" FOR DELETE
  USING ("workspace_id" = "app_current_workspace_id"());--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 5. membership_roles
-- ---------------------------------------------------------------------------
-- No workspace_id column: isolation is inherited from the parent membership. The
-- EXISTS below is itself evaluated under workspace_memberships' RLS, so a
-- membership in another workspace is invisible and the predicate fails.

ALTER TABLE "membership_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "membership_roles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS "membership_roles_select" ON "membership_roles";--> statement-breakpoint
CREATE POLICY "membership_roles_select" ON "membership_roles" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "workspace_memberships" wm
      WHERE wm."id" = "membership_roles"."membership_id"
    )
  );--> statement-breakpoint

-- Granting or revoking a role always requires the workspace to be pinned. This
-- closes the escalation path an unpinned self-grant would otherwise open (a
-- member writing themselves ORG_OWNER in a workspace they merely belong to);
-- `app_current_workspace_id()` being NULL makes the predicate NULL => denied.
-- Registration bootstrap must therefore set the workspace context before
-- granting the initial LEARNER role on a new Personal Workspace.
DROP POLICY IF EXISTS "membership_roles_insert" ON "membership_roles";--> statement-breakpoint
CREATE POLICY "membership_roles_insert" ON "membership_roles" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "workspace_memberships" wm
      WHERE wm."id" = "membership_roles"."membership_id"
        AND wm."workspace_id" = "app_current_workspace_id"()
    )
  );--> statement-breakpoint

DROP POLICY IF EXISTS "membership_roles_update" ON "membership_roles";--> statement-breakpoint
CREATE POLICY "membership_roles_update" ON "membership_roles" FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "workspace_memberships" wm
      WHERE wm."id" = "membership_roles"."membership_id"
        AND wm."workspace_id" = "app_current_workspace_id"()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "workspace_memberships" wm
      WHERE wm."id" = "membership_roles"."membership_id"
        AND wm."workspace_id" = "app_current_workspace_id"()
    )
  );--> statement-breakpoint

DROP POLICY IF EXISTS "membership_roles_delete" ON "membership_roles";--> statement-breakpoint
CREATE POLICY "membership_roles_delete" ON "membership_roles" FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "workspace_memberships" wm
      WHERE wm."id" = "membership_roles"."membership_id"
        AND wm."workspace_id" = "app_current_workspace_id"()
    )
  );--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 6. Authorization catalogs
-- ---------------------------------------------------------------------------
-- roles / permissions / role_permissions are global, workspace-independent
-- reference data (§16.3.4: platform-scope rows, read-only to any authenticated
-- context, writable only by platform roles). They carry no workspace_id, so
-- ENABLE without FORCE is the correct pairing: the runtime role is restricted to
-- authenticated reads by the policies plus the SELECT-only grants above, while
-- migrations continue to seed them as the owner. Adding FORCE here would break
-- every future catalog seed migration for no isolation gain.

ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "roles_authenticated_read" ON "roles";--> statement-breakpoint
CREATE POLICY "roles_authenticated_read" ON "roles" FOR SELECT
  USING ("app_current_user_id"() IS NOT NULL);--> statement-breakpoint

ALTER TABLE "permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "permissions_authenticated_read" ON "permissions";--> statement-breakpoint
CREATE POLICY "permissions_authenticated_read" ON "permissions" FOR SELECT
  USING ("app_current_user_id"() IS NOT NULL);--> statement-breakpoint

ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "role_permissions_authenticated_read" ON "role_permissions";--> statement-breakpoint
CREATE POLICY "role_permissions_authenticated_read" ON "role_permissions" FOR SELECT
  USING ("app_current_user_id"() IS NOT NULL);--> statement-breakpoint

-- Platform-role grants are user-scoped, not workspace-scoped (§3.1): a caller may
-- read their own grants to resolve platform scope, and nothing else. There is no
-- write policy and no write grant — elevation is granted out-of-band and audited
-- (§3.5), never from a request handler.
ALTER TABLE "user_platform_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "user_platform_roles_self_read" ON "user_platform_roles";--> statement-breakpoint
CREATE POLICY "user_platform_roles_self_read" ON "user_platform_roles" FOR SELECT
  USING ("user_id" = "app_current_user_id"());
