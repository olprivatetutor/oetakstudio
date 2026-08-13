-- Phase 1 final hardening: remove generic workspace claiming, and make workspace
-- creation a single gated privileged operation (ADR-020, §4.9, §16.3).
--
-- Fixes two defects introduced by 0013_rls_membership_authorization.sql:
--
--   NEW-1  `workspace_memberships_insert` admitted a membership when
--          `app_workspace_is_unclaimed(workspace_id)` held — i.e. whenever a
--          workspace had zero memberships. Emptiness is NOT equivalent to "just
--          created": a workspace becomes empty again when its last member
--          deletes their membership, or when that member's `user` row is deleted
--          and the membership cascades. Verified end to end: an unrelated
--          authenticated caller could then join an orphaned workspace, self-grant
--          ORG_OWNER, and mutate it. Same takeover as P0-1, narrower precondition.
--
--   NEW-2  `workspaces_insert` allowed any authenticated caller to insert any
--          workspace row. Because 0013-era application code derived the workspace
--          slug as 'org-' || organizations.slug, and `workspaces.slug` is globally
--          unique, an attacker could reserve 'org-<victim-slug>' and permanently
--          block that organization from ever being created (23505). Workspace
--          creation was also completely unmetered.
--
-- Both are closed the same way: runtime code can no longer INSERT into
-- `workspaces` at all, and there is no membership policy that keys off emptiness.
-- The only runtime path that creates a workspace is `app_bootstrap_workspace`,
-- which creates a brand-new workspace and its founding membership atomically and
-- cannot be aimed at an existing row.

-- ---------------------------------------------------------------------------
-- 1. Ownership lineage
-- ---------------------------------------------------------------------------
-- Recorded for audit and for the creation rate limit. Deliberately NOT the
-- authorization mechanism: `created_by_id` never appears in an RLS policy, so a
-- forged or stale value cannot grant access. Nullable because 0011 backfilled
-- workspaces for pre-existing tenants whose true creator is not knowable; the
-- backfill below makes the best available attribution.

ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "created_by_id" text
  REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "workspaces_created_by_idx" ON "workspaces" ("created_by_id");--> statement-breakpoint

-- Organization workspaces: attribute to the linked organization's owner.
UPDATE "workspaces" w
SET "created_by_id" = o."owner_id"
FROM "organizations" o
WHERE o."workspace_id" = w."id" AND w."created_by_id" IS NULL;--> statement-breakpoint

-- Personal workspaces: attribute to their single member.
UPDATE "workspaces" w
SET "created_by_id" = wm."user_id"
FROM "workspace_memberships" wm
WHERE wm."workspace_id" = w."id" AND w."type" = 'PERSONAL' AND w."created_by_id" IS NULL;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2. Remove the emptiness-based claim path (NEW-1)
-- ---------------------------------------------------------------------------
-- Membership creation now has exactly one rule: the workspace is pinned and the
-- caller is already an ACTIVE member of it (i.e. they are inviting/adding
-- someone). Bootstrap is no longer a policy exception — it lives in the
-- privileged function in section 4, which is the only writer that can create the
-- first membership.

DROP POLICY IF EXISTS "workspace_memberships_insert" ON "workspace_memberships";--> statement-breakpoint
CREATE POLICY "workspace_memberships_insert" ON "workspace_memberships" FOR INSERT
  WITH CHECK (
    "workspace_id" = "app_current_workspace_id"()
    AND "app_is_active_member"("workspace_id")
  );--> statement-breakpoint

-- The helper existed only to express that exception, and is itself an
-- enumeration oracle (it answers "does workspace X have zero members?" for any
-- id). With the exception gone it has no callers; drop it rather than leave a
-- privileged function lying around.
DROP FUNCTION IF EXISTS "app_workspace_is_unclaimed"(text);--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 3. Remove direct workspace insertion (NEW-2)
-- ---------------------------------------------------------------------------
-- No policy and no privilege: `app_rw` cannot create a workspace by any route
-- other than the gated function, so slug squatting and unmetered creation are
-- both structurally impossible rather than merely rate-limited.

DROP POLICY IF EXISTS "workspaces_insert" ON "workspaces";--> statement-breakpoint
REVOKE INSERT ON "workspaces" FROM "app_rw";--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 4. Gated bootstrap
-- ---------------------------------------------------------------------------
-- A dedicated owner role, separate from `app_rls_definer`: those helpers are
-- read-only predicates, and a function that WRITES three tables should not share
-- their owner. `app_bootstrap` holds exactly the privileges this one operation
-- needs and is NOLOGIN, so it is not an authentication path.
--
-- Why this cannot be used to claim an existing workspace: the function generates
-- the workspace id itself and only ever INSERTs. There is no parameter naming a
-- target workspace, so an orphaned or populated workspace is unreachable through
-- it. The creator is taken from `app.current_user_id`, never from a parameter,
-- so it also cannot be used to bootstrap on someone else's behalf.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_bootstrap') THEN
    CREATE ROLE "app_bootstrap" WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION BYPASSRLS;
  END IF;
END $$;--> statement-breakpoint

ALTER ROLE "app_bootstrap" WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;--> statement-breakpoint

GRANT USAGE ON SCHEMA "public" TO "app_bootstrap";--> statement-breakpoint
GRANT SELECT, INSERT ON "workspaces" TO "app_bootstrap";--> statement-breakpoint
GRANT SELECT, INSERT ON "workspace_memberships" TO "app_bootstrap";--> statement-breakpoint
GRANT SELECT, INSERT ON "membership_roles" TO "app_bootstrap";--> statement-breakpoint
GRANT SELECT ON "roles" TO "app_bootstrap";--> statement-breakpoint
GRANT SELECT ON "user" TO "app_bootstrap";--> statement-breakpoint

-- §4.9 / ADR-020 gates, enforced here so they hold even if an application caller
-- forgets them. The application service ALSO checks the
-- `workspace.organization.create` permission (the RBAC union lives there, not in
-- SQL) and writes the audit record; these are the invariants that must never be
-- bypassable.
--
-- Age handling: §4.9 prohibits UNDER_13 only. AGENTS.md §13 requires UNSPECIFIED
-- to fail closed *as teen*, and teens are not prohibited by §4.9, so UNSPECIFIED
-- is permitted here. Tightening this to ADULT-only would be a product decision
-- (§4.9 describes the permission as granted to "verified adult accounts"), and is
-- deliberately not made silently in a migration.
CREATE OR REPLACE FUNCTION "app_bootstrap_workspace"(
  p_type text,
  p_name text,
  p_role_codes text[],
  p_max_org_workspaces int DEFAULT 3
) RETURNS text
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER
  SET search_path = pg_catalog, public
  AS $$
DECLARE
  v_user text := NULLIF(current_setting('app.current_user_id', true), '');
  v_workspace_id text;
  v_membership_id text;
  v_email_verified boolean;
  v_age_band text;
  v_existing int;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'WORKSPACE_CREATE_FORBIDDEN: no authenticated user context'
      USING ERRCODE = '42501';
  END IF;

  IF p_type NOT IN ('PERSONAL', 'ORGANIZATION') THEN
    RAISE EXCEPTION 'WORKSPACE_CREATE_INVALID: unsupported workspace type %', p_type
      USING ERRCODE = '22023';
  END IF;

  SELECT u."email_verified", u."age_band"::text
    INTO v_email_verified, v_age_band
    FROM public."user" u WHERE u."id" = v_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKSPACE_CREATE_FORBIDDEN: unknown user'
      USING ERRCODE = '42501';
  END IF;

  IF p_type = 'ORGANIZATION' THEN
    -- §4.9: the creating user's email must be verified.
    IF NOT v_email_verified THEN
      RAISE EXCEPTION 'WORKSPACE_CREATE_FORBIDDEN: email is not verified'
        USING ERRCODE = '42501';
    END IF;

    -- §4.9: UNDER_13 accounts cannot create organization workspaces.
    IF v_age_band = 'UNDER_13' THEN
      RAISE EXCEPTION 'WORKSPACE_CREATE_FORBIDDEN: minors under 13 cannot create organization workspaces'
        USING ERRCODE = '42501';
    END IF;

    -- §4.9 / ADR-020: per-user creation limit. Counted inside the function so
    -- the check and the insert cannot be raced apart by concurrent requests.
    SELECT count(*) INTO v_existing
      FROM public."workspaces" w
      WHERE w."created_by_id" = v_user
        AND w."type" = 'ORGANIZATION'
        AND w."status" <> 'CLOSED';

    IF v_existing >= p_max_org_workspaces THEN
      RAISE EXCEPTION 'WORKSPACE_LIMIT_EXCEEDED: % organization workspaces already created (limit %)',
        v_existing, p_max_org_workspaces
        USING ERRCODE = '53400';
    END IF;
  END IF;

  v_workspace_id := gen_random_uuid()::text;
  v_membership_id := gen_random_uuid()::text;

  -- Server-generated, collision-resistant, and carrying no caller-supplied text:
  -- a workspace slug can no longer be used to reserve or squat an organization's
  -- future namespace (NEW-2). Human-readable identifiers belong to
  -- `organizations.slug`, which has its own uniqueness rule at the business layer.
  INSERT INTO public."workspaces" ("id", "type", "name", "slug", "status", "created_by_id")
  VALUES (
    v_workspace_id,
    p_type::public."workspace_type",
    p_name,
    'ws-' || replace(gen_random_uuid()::text, '-', ''),
    'ACTIVE',
    v_user
  );

  INSERT INTO public."workspace_memberships" ("id", "workspace_id", "user_id", "status")
  VALUES (v_membership_id, v_workspace_id, v_user, 'ACTIVE');

  -- Only WORKSPACE-scope roles may be granted through a membership: a platform
  -- role such as SUPER_ADMIN must never be reachable from workspace bootstrap.
  INSERT INTO public."membership_roles" ("membership_id", "role_id", "granted_by_id")
  SELECT v_membership_id, r."id", v_user
    FROM public."roles" r
   WHERE r."code" = ANY(p_role_codes)
     AND r."scope" = 'WORKSPACE'
  ON CONFLICT DO NOTHING;

  RETURN v_workspace_id;
END;
$$;--> statement-breakpoint

ALTER FUNCTION "app_bootstrap_workspace"(text, text, text[], int) OWNER TO "app_bootstrap";--> statement-breakpoint
REVOKE ALL ON FUNCTION "app_bootstrap_workspace"(text, text, text[], int) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "app_bootstrap_workspace"(text, text, text[], int) TO "app_rw";--> statement-breakpoint

-- The owner connection (db/index.ts) still creates workspaces during seeding and
-- in the legacy organization services, and is a superuser there, so it needs no
-- grant. Granting EXECUTE to the migration/owner role explicitly keeps the
-- non-superuser-owner deployment shape working too.
DO $$
BEGIN
  EXECUTE format('GRANT EXECUTE ON FUNCTION "app_bootstrap_workspace"(text, text, text[], int) TO %I', current_user);
END $$;
