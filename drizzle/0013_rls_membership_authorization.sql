-- Phase 1 security remediation: close the cross-workspace membership hole and
-- make workspace pinning insufficient on its own (ADR-009, §16.3).
--
-- Fixes two defects in 0012_rls_workspace_hardening.sql:
--
--   P0-1  `workspace_memberships_insert` carried an unpinned branch whose only
--         constraint was `user_id = app_current_user_id()`. It placed NO
--         constraint on `workspace_id`, so any authenticated caller running in a
--         user-scoped (unpinned) context could insert an ACTIVE membership for
--         themselves into an ARBITRARY workspace. Verified chain: self-join ->
--         workspace becomes visible -> pin it -> read all memberships ->
--         self-grant ORG_OWNER -> evict the legitimate owner -> mutate the
--         workspace. Full cross-tenant takeover at the layer that is supposed to
--         be the isolation boundary.
--
--   P2-1  Every policy on workspace_memberships / membership_roles compared only
--         against the GUCs, never against the caller's own membership, because a
--         policy that sub-selects its own table raises "infinite recursion
--         detected in policy for relation". Consequence: pinning a workspace was
--         by itself sufficient to read and write all of its memberships and role
--         grants. RLS provided no second line at all for those tables.
--
-- Both are fixed here. Membership is now verified inside every policy via
-- SECURITY DEFINER helpers that break the recursion (section 1), and the
-- bootstrap case that the unpinned branch existed to serve is handled by an
-- explicit, narrow "unclaimed workspace" predicate instead (section 3).

-- ---------------------------------------------------------------------------
-- 1. Membership-verification helpers
-- ---------------------------------------------------------------------------
-- Why these are safe, given SECURITY DEFINER is a privilege-escalation
-- primitive and deserves the scrutiny:
--
--   * They are owned by `app_rls_definer`, a NOLOGIN role that exists only to
--     own these functions. It cannot authenticate, so it is not a login path.
--   * `app_rw` is NOT granted BYPASSRLS. The bypass is confined to the function
--     body, which is the minimum needed to escape policy recursion.
--   * They return `boolean` and nothing else. There is no code path by which a
--     caller extracts a row, a column value, or a count of another tenant's data
--     through them.
--   * `app_is_active_member` and `app_is_co_member` answer only about the
--     CURRENT caller (`app.current_user_id`), which the application sets and the
--     caller cannot forge from SQL. A caller therefore cannot probe "is user X a
--     member of workspace Y" for an arbitrary X.
--   * `app_workspace_is_unclaimed` leaks exactly one bit — whether a workspace
--     has zero memberships. A workspace with no members holds no tenant data, so
--     that bit discloses nothing about any tenant.
--   * `search_path` is pinned to `pg_catalog, public`, so the bodies cannot be
--     hijacked by a caller-controlled temp schema shadowing a table name.
--   * EXECUTE is revoked from PUBLIC and granted only to `app_rw`.
--   * All are STABLE, not VOLATILE, so they are safe inside policy predicates.
--
-- Requires the migration connection to be superuser: BYPASSRLS may only be
-- granted by a superuser. If it is not, pre-create `app_rls_definer` with
-- BYPASSRLS and re-run; this statement fails loudly rather than leaving the
-- database half-hardened.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rls_definer') THEN
    CREATE ROLE "app_rls_definer" WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION BYPASSRLS;
  END IF;
END $$;--> statement-breakpoint

ALTER ROLE "app_rls_definer" WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;--> statement-breakpoint

-- The definer role must be able to reach the tables it inspects. It is granted
-- SELECT only -- it can never write on any caller's behalf.
GRANT USAGE ON SCHEMA "public" TO "app_rls_definer";--> statement-breakpoint
GRANT SELECT ON "workspace_memberships" TO "app_rls_definer";--> statement-breakpoint

-- Is the current caller an ACTIVE member of the given workspace?
-- NULL workspace (no pin) => EXISTS over an impossible predicate => false.
-- NULL caller (unauthenticated) => same. Fail closed in both directions.
CREATE OR REPLACE FUNCTION "app_is_active_member"(p_workspace_id text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = pg_catalog, public
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM public."workspace_memberships" wm
      WHERE wm."workspace_id" = p_workspace_id
        AND wm."user_id" = NULLIF(current_setting('app.current_user_id', true), '')
        AND wm."status" = 'ACTIVE'
    )
  $$;--> statement-breakpoint

ALTER FUNCTION "app_is_active_member"(text) OWNER TO "app_rls_definer";--> statement-breakpoint
REVOKE ALL ON FUNCTION "app_is_active_member"(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "app_is_active_member"(text) TO "app_rw";--> statement-breakpoint

-- Does the given workspace have no memberships at all? True only for a
-- just-created workspace, which is the sole legitimate case for inserting a
-- membership without already holding one (registration / org bootstrap).
CREATE OR REPLACE FUNCTION "app_workspace_is_unclaimed"(p_workspace_id text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = pg_catalog, public
  AS $$
    SELECT p_workspace_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public."workspace_memberships" wm
      WHERE wm."workspace_id" = p_workspace_id
    )
  $$;--> statement-breakpoint

ALTER FUNCTION "app_workspace_is_unclaimed"(text) OWNER TO "app_rls_definer";--> statement-breakpoint
REVOKE ALL ON FUNCTION "app_workspace_is_unclaimed"(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "app_workspace_is_unclaimed"(text) TO "app_rw";--> statement-breakpoint

-- Is the given user an ACTIVE member of the pinned workspace, AND is the caller
-- themselves an ACTIVE member of it? Both halves are required: without the
-- second, pinning an arbitrary workspace would disclose its roster.
CREATE OR REPLACE FUNCTION "app_is_co_member"(p_user_id text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = pg_catalog, public
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM public."workspace_memberships" wm
      WHERE wm."workspace_id" = NULLIF(current_setting('app.current_workspace_id', true), '')
        AND wm."user_id" = p_user_id
        AND wm."status" = 'ACTIVE'
    ) AND EXISTS (
      SELECT 1 FROM public."workspace_memberships" self
      WHERE self."workspace_id" = NULLIF(current_setting('app.current_workspace_id', true), '')
        AND self."user_id" = NULLIF(current_setting('app.current_user_id', true), '')
        AND self."status" = 'ACTIVE'
    )
  $$;--> statement-breakpoint

ALTER FUNCTION "app_is_co_member"(text) OWNER TO "app_rls_definer";--> statement-breakpoint
REVOKE ALL ON FUNCTION "app_is_co_member"(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "app_is_co_member"(text) TO "app_rw";--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2. workspaces
-- ---------------------------------------------------------------------------
-- Unchanged in shape, but membership is now asserted through the helper instead
-- of an inline EXISTS, so all three tables express the same rule.

DROP POLICY IF EXISTS "workspaces_select" ON "workspaces";--> statement-breakpoint
CREATE POLICY "workspaces_select" ON "workspaces" FOR SELECT
  USING (
    ("app_current_workspace_id"() IS NULL OR "id" = "app_current_workspace_id"())
    AND "app_is_active_member"("id")
  );--> statement-breakpoint

-- INSERT still cannot require membership: at creation time none exists. The
-- `workspace.organization.create` permission check, the §4.9 rate limit, and the
-- verified-adult rule remain the application service's responsibility.
DROP POLICY IF EXISTS "workspaces_insert" ON "workspaces";--> statement-breakpoint
CREATE POLICY "workspaces_insert" ON "workspaces" FOR INSERT
  WITH CHECK ("app_current_user_id"() IS NOT NULL);--> statement-breakpoint

DROP POLICY IF EXISTS "workspaces_update" ON "workspaces";--> statement-breakpoint
CREATE POLICY "workspaces_update" ON "workspaces" FOR UPDATE
  USING ("id" = "app_current_workspace_id"() AND "app_is_active_member"("id"))
  WITH CHECK ("id" = "app_current_workspace_id"() AND "app_is_active_member"("id"));--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 3. workspace_memberships
-- ---------------------------------------------------------------------------
-- Pinning is no longer sufficient anywhere. Every predicate now also demands
-- that the caller hold an ACTIVE membership in the pinned workspace.

DROP POLICY IF EXISTS "workspace_memberships_select" ON "workspace_memberships";--> statement-breakpoint
CREATE POLICY "workspace_memberships_select" ON "workspace_memberships" FOR SELECT
  USING (
    ("workspace_id" = "app_current_workspace_id"() AND "app_is_active_member"("workspace_id"))
    -- Unpinned: the workspace switcher. Own membership rows only, never a roster.
    OR ("app_current_workspace_id"() IS NULL AND "user_id" = "app_current_user_id"())
  );--> statement-breakpoint

-- P0-1's fix. The workspace must be pinned, AND either:
--   (a) the caller is already an ACTIVE member -- inviting/adding someone; or
--   (b) the workspace has NO members yet and the caller is adding themselves --
--       the bootstrap case, i.e. the workspace they just created in this same
--       transaction.
-- The removed branch allowed (b)'s shape against ANY workspace, including
-- populated ones belonging to other tenants. `app_workspace_is_unclaimed` is
-- what makes "the workspace they just created" actually expressible in SQL.
DROP POLICY IF EXISTS "workspace_memberships_insert" ON "workspace_memberships";--> statement-breakpoint
CREATE POLICY "workspace_memberships_insert" ON "workspace_memberships" FOR INSERT
  WITH CHECK (
    "workspace_id" = "app_current_workspace_id"()
    AND (
      "app_is_active_member"("workspace_id")
      OR (
        "app_workspace_is_unclaimed"("workspace_id")
        AND "user_id" = "app_current_user_id"()
      )
    )
  );--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_memberships_update" ON "workspace_memberships";--> statement-breakpoint
CREATE POLICY "workspace_memberships_update" ON "workspace_memberships" FOR UPDATE
  USING ("workspace_id" = "app_current_workspace_id"() AND "app_is_active_member"("workspace_id"))
  WITH CHECK ("workspace_id" = "app_current_workspace_id"() AND "app_is_active_member"("workspace_id"));--> statement-breakpoint

DROP POLICY IF EXISTS "workspace_memberships_delete" ON "workspace_memberships";--> statement-breakpoint
CREATE POLICY "workspace_memberships_delete" ON "workspace_memberships" FOR DELETE
  USING ("workspace_id" = "app_current_workspace_id"() AND "app_is_active_member"("workspace_id"));--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 4. membership_roles
-- ---------------------------------------------------------------------------
-- Same rule, reached through the parent membership. The EXISTS is now redundant
-- with the helper for isolation purposes but is retained: it binds the role row
-- to a membership that genuinely lives in the pinned workspace, which the helper
-- alone does not express.

DROP POLICY IF EXISTS "membership_roles_select" ON "membership_roles";--> statement-breakpoint
CREATE POLICY "membership_roles_select" ON "membership_roles" FOR SELECT
  USING (
    "app_is_active_member"("app_current_workspace_id"())
    AND EXISTS (
      SELECT 1 FROM "workspace_memberships" wm
      WHERE wm."id" = "membership_roles"."membership_id"
        AND wm."workspace_id" = "app_current_workspace_id"()
    )
  );--> statement-breakpoint

-- Bootstrap note: the owner's own membership is inserted immediately before the
-- first role grant, so by this point the caller IS an active member and no
-- unclaimed-workspace exception is needed here.
DROP POLICY IF EXISTS "membership_roles_insert" ON "membership_roles";--> statement-breakpoint
CREATE POLICY "membership_roles_insert" ON "membership_roles" FOR INSERT
  WITH CHECK (
    "app_is_active_member"("app_current_workspace_id"())
    AND EXISTS (
      SELECT 1 FROM "workspace_memberships" wm
      WHERE wm."id" = "membership_roles"."membership_id"
        AND wm."workspace_id" = "app_current_workspace_id"()
    )
  );--> statement-breakpoint

DROP POLICY IF EXISTS "membership_roles_update" ON "membership_roles";--> statement-breakpoint
CREATE POLICY "membership_roles_update" ON "membership_roles" FOR UPDATE
  USING (
    "app_is_active_member"("app_current_workspace_id"())
    AND EXISTS (
      SELECT 1 FROM "workspace_memberships" wm
      WHERE wm."id" = "membership_roles"."membership_id"
        AND wm."workspace_id" = "app_current_workspace_id"()
    )
  )
  WITH CHECK (
    "app_is_active_member"("app_current_workspace_id"())
    AND EXISTS (
      SELECT 1 FROM "workspace_memberships" wm
      WHERE wm."id" = "membership_roles"."membership_id"
        AND wm."workspace_id" = "app_current_workspace_id"()
    )
  );--> statement-breakpoint

DROP POLICY IF EXISTS "membership_roles_delete" ON "membership_roles";--> statement-breakpoint
CREATE POLICY "membership_roles_delete" ON "membership_roles" FOR DELETE
  USING (
    "app_is_active_member"("app_current_workspace_id"())
    AND EXISTS (
      SELECT 1 FROM "workspace_memberships" wm
      WHERE wm."id" = "membership_roles"."membership_id"
        AND wm."workspace_id" = "app_current_workspace_id"()
    )
  );--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 5. user PII minimisation (P1-4)
-- ---------------------------------------------------------------------------
-- 0012 granted blanket `SELECT ON "user"` to app_rw with no RLS on the table, so
-- any workspace context could read EVERY user row in the platform, birth_date
-- and age_band included -- directly contrary to §16.5 and the minor-safety rules
-- in §13, and to this schema's own "never exposed in list endpoints" comment.
--
-- Two independent controls replace it:
--   1. Column privileges. `birth_date`, `age_band` and `two_factor_enabled` are
--      simply not granted, so selecting them as app_rw raises 42501 regardless
--      of which rows RLS would have allowed. Age/safety attributes must be read
--      through the privileged safety-profile path (owner connection), never
--      through an ordinary workspace query.
--   2. Row policy. A caller sees themselves, plus ACTIVE co-members of the
--      pinned workspace -- enough to render a member list, nothing more.
--
-- ENABLE without FORCE is deliberate and load-bearing: better-auth writes and
-- reads `user` through the owner connection (db/index.ts). Adding FORCE here
-- would apply these policies to better-auth itself and break authentication.
-- The owner is the trusted path; app_rw is the constrained one.

REVOKE SELECT ON "user" FROM "app_rw";--> statement-breakpoint
GRANT SELECT ("id", "name", "email", "email_verified", "image", "created_at", "updated_at")
  ON "user" TO "app_rw";--> statement-breakpoint

ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS "user_self_or_co_member_read" ON "user";--> statement-breakpoint
CREATE POLICY "user_self_or_co_member_read" ON "user" FOR SELECT
  USING (
    "id" = "app_current_user_id"()
    OR "app_is_co_member"("id")
  );
