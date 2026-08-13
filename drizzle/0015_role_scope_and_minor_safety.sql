-- Phase 1 blocking security work: role-scope separation (NEW-8) and the
-- minor-safety consent foundation (P1-A, ADR-007 / §3.6 / §12.11).

-- ---------------------------------------------------------------------------
-- 1. PLATFORM vs WORKSPACE role scope separation (NEW-8)
-- ---------------------------------------------------------------------------
-- `membership_roles` had no scope constraint, so any ACTIVE member could insert
-- (own_membership_id, SUPER_ADMIN) and, through the canonical permission union
-- (workspace_memberships -> membership_roles -> role_permissions), acquire
-- `platform.administer` / `platform.elevate`. This violates the non-negotiable
-- invariant in AGENTS.md §6.5 that platform and workspace roles are separate
-- scopes, and §22's prohibition on conflating them.
--
-- Enforced with TRIGGERS rather than RLS predicates alone, deliberately: a
-- trigger fires for every writer including the table owner and the seed scripts,
-- whereas an RLS predicate is skipped for the owner connection (and entirely for
-- a superuser). The RLS predicates are added too, so the runtime role fails at
-- the policy boundary before it ever reaches the trigger.
--
-- CHECK constraints cannot express this: they may not contain subqueries, and
-- the scope lives on `roles`.

CREATE OR REPLACE FUNCTION "app_assert_workspace_role_scope"() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = pg_catalog, public
  AS $$
DECLARE
  v_scope text;
  v_code text;
BEGIN
  SELECT r."scope"::text, r."code" INTO v_scope, v_code
    FROM public."roles" r WHERE r."id" = NEW."role_id";

  IF v_scope IS NULL THEN
    RAISE EXCEPTION 'ROLE_SCOPE_VIOLATION: unknown role %', NEW."role_id"
      USING ERRCODE = '23514';
  END IF;

  IF v_scope <> 'WORKSPACE' THEN
    RAISE EXCEPTION 'ROLE_SCOPE_VIOLATION: role % has scope % and cannot be granted through a workspace membership', v_code, v_scope
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS "membership_roles_scope_check" ON "membership_roles";--> statement-breakpoint
CREATE TRIGGER "membership_roles_scope_check"
  BEFORE INSERT OR UPDATE ON "membership_roles"
  FOR EACH ROW EXECUTE FUNCTION "app_assert_workspace_role_scope"();--> statement-breakpoint

-- Symmetric guard: a WORKSPACE role must not be granted platform-wide either.
-- Without this the separation only holds in one direction.
CREATE OR REPLACE FUNCTION "app_assert_platform_role_scope"() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = pg_catalog, public
  AS $$
DECLARE
  v_scope text;
  v_code text;
BEGIN
  SELECT r."scope"::text, r."code" INTO v_scope, v_code
    FROM public."roles" r WHERE r."id" = NEW."role_id";

  IF v_scope IS NULL THEN
    RAISE EXCEPTION 'ROLE_SCOPE_VIOLATION: unknown role %', NEW."role_id"
      USING ERRCODE = '23514';
  END IF;

  IF v_scope <> 'PLATFORM' THEN
    RAISE EXCEPTION 'ROLE_SCOPE_VIOLATION: role % has scope % and cannot be granted as a platform role', v_code, v_scope
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS "user_platform_roles_scope_check" ON "user_platform_roles";--> statement-breakpoint
CREATE TRIGGER "user_platform_roles_scope_check"
  BEFORE INSERT OR UPDATE ON "user_platform_roles"
  FOR EACH ROW EXECUTE FUNCTION "app_assert_platform_role_scope"();--> statement-breakpoint

-- Defense in depth at the policy boundary. `roles` is a different table, so this
-- sub-select cannot recurse the way a self-referencing policy would.
DROP POLICY IF EXISTS "membership_roles_insert" ON "membership_roles";--> statement-breakpoint
CREATE POLICY "membership_roles_insert" ON "membership_roles" FOR INSERT
  WITH CHECK (
    "app_is_active_member"("app_current_workspace_id"())
    AND EXISTS (
      SELECT 1 FROM "workspace_memberships" wm
      WHERE wm."id" = "membership_roles"."membership_id"
        AND wm."workspace_id" = "app_current_workspace_id"()
    )
    AND EXISTS (
      SELECT 1 FROM "roles" r
      WHERE r."id" = "membership_roles"."role_id" AND r."scope" = 'WORKSPACE'
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
    AND EXISTS (
      SELECT 1 FROM "roles" r
      WHERE r."id" = "membership_roles"."role_id" AND r."scope" = 'WORKSPACE'
    )
  );--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2. Consent records (§13 `consent_records`, ADR-007)
-- ---------------------------------------------------------------------------
-- Explicit, auditable, revocable. Row existence in `guardian_learners` must
-- never stand in for consent (§13/§3.6): a relationship says who may see a
-- learner's progress, not that anyone consented to AI processing.

DO $$ BEGIN
  CREATE TYPE "public"."consent_type" AS ENUM('AI_FEATURES', 'DATA_PROCESSING', 'COMMUNICATIONS');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."consent_basis" AS ENUM('GUARDIAN', 'INSTITUTIONAL', 'SELF');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "consent_records" (
  "id" text PRIMARY KEY NOT NULL,
  -- NULL for consent that is not scoped to one workspace (e.g. a guardian
  -- consenting for their child independently of any organization).
  "workspace_id" text REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "subject_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "consent_type" "consent_type" NOT NULL,
  "basis" "consent_basis" NOT NULL,
  "granted_by_id" text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "granted_at" timestamp NOT NULL DEFAULT now(),
  "revoked_at" timestamp,
  "revoked_by_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "consent_records_subject_idx"
  ON "consent_records" ("subject_user_id", "consent_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consent_records_workspace_idx"
  ON "consent_records" ("workspace_id");--> statement-breakpoint
-- At most one live consent per (subject, type, basis, workspace). Revoked rows
-- are retained for audit, so the uniqueness is partial on `revoked_at IS NULL`
-- (§13.1). Two partial indexes because NULL workspace_id does not compare equal.
CREATE UNIQUE INDEX IF NOT EXISTS "consent_records_live_scoped_unique"
  ON "consent_records" ("subject_user_id", "consent_type", "basis", "workspace_id")
  WHERE "revoked_at" IS NULL AND "workspace_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "consent_records_live_global_unique"
  ON "consent_records" ("subject_user_id", "consent_type", "basis")
  WHERE "revoked_at" IS NULL AND "workspace_id" IS NULL;--> statement-breakpoint

-- No app_rw grants: consent is read and written through the owner connection by
-- the safety-profile resolver only. RLS is enabled so the table fails closed if
-- a grant is ever added without a policy.
ALTER TABLE "consent_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 3. Institutional consent mode (§3.6 rule 3, §13 organizations)
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "public"."consent_mode" AS ENUM('GUARDIAN', 'INSTITUTIONAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "consent_mode" "consent_mode" DEFAULT 'GUARDIAN' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "consent_asserted_by_id" text REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "consent_asserted_at" timestamp;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 4. Guardian relationship state (§18: a pending relationship grants nothing)
-- ---------------------------------------------------------------------------
-- Added with DEFAULT 'ACTIVE' so pre-existing rows keep the access they already
-- had (they predate the concept and were treated as active), then the default is
-- switched to 'PENDING' so every NEW relationship fails closed until accepted.

DO $$ BEGIN
  CREATE TYPE "public"."guardian_link_status" AS ENUM('PENDING', 'ACTIVE', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

ALTER TABLE "guardian_learners" ADD COLUMN IF NOT EXISTS "status" "guardian_link_status" DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "guardian_learners" ALTER COLUMN "status" SET DEFAULT 'PENDING';--> statement-breakpoint
ALTER TABLE "guardian_learners" ADD COLUMN IF NOT EXISTS "accepted_at" timestamp;--> statement-breakpoint
ALTER TABLE "guardian_learners" ADD COLUMN IF NOT EXISTS "revoked_at" timestamp;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "guardian_learners_status_idx" ON "guardian_learners" ("status");--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 5. AI execution safety metadata (§12.4/§12.11)
-- ---------------------------------------------------------------------------
-- "The applied profile id is recorded on ai_executions so any past response can
-- be explained." `ai_usage_records` is this repository's AI execution audit
-- record; the canonical `ai_executions` rename belongs to the AI cutover, not
-- here.

ALTER TABLE "ai_usage_records" ADD COLUMN IF NOT EXISTS "safety_profile" text;--> statement-breakpoint
ALTER TABLE "ai_usage_records" ADD COLUMN IF NOT EXISTS "moderation_outcome" text;
