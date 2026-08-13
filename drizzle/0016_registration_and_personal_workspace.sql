-- Phase 1 registration completion (NEW-18 / ADR-007): make the hardened
-- workspace bootstrap idempotent for the post-verification PERSONAL path.
--
-- No new API or generic claim path is introduced. app_rw still cannot INSERT a
-- workspace directly; it can only execute this SECURITY DEFINER function, which
-- derives the creator from app.current_user_id and cannot target an existing
-- workspace by id (drizzle/0014).

-- Better Auth 1.6's adapter factory materializes an `id` for every model. The
-- existing rate_limit table used `key` as its sole identifier, which prevented
-- the real sign-up lifecycle from reaching its database-backed registration
-- rate limiter. Keep key as the logical primary key and add the adapter id with
-- a safe default/backfill in one additive change.
ALTER TABLE "rate_limit" ADD COLUMN IF NOT EXISTS "id" text;--> statement-breakpoint
UPDATE "rate_limit" SET "id" = gen_random_uuid()::text WHERE "id" IS NULL;--> statement-breakpoint
ALTER TABLE "rate_limit" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;--> statement-breakpoint
ALTER TABLE "rate_limit" ALTER COLUMN "id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rate_limit_id_unique" ON "rate_limit" ("id");--> statement-breakpoint
-- Better Auth stores epoch milliseconds; PostgreSQL integer overflows in 2026.
ALTER TABLE "rate_limit" ALTER COLUMN "last_request" TYPE bigint;--> statement-breakpoint

-- The 0011 backfill and 0014 creator-lineage backfill established this invariant
-- for existing data. The partial unique index makes it structural for all future
-- writes as well as retries of the registration lifecycle.
CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_one_personal_per_creator_uidx"
  ON "workspaces" ("created_by_id")
  WHERE "type" = 'PERSONAL' AND "created_by_id" IS NOT NULL;--> statement-breakpoint

-- Reconciliation may reactivate the canonical founding membership after a
-- transient/partial lifecycle retry. app_bootstrap is NOLOGIN and owns only the
-- bootstrap function; this grant does not create a new authentication path.
GRANT UPDATE ON "workspace_memberships" TO "app_bootstrap";--> statement-breakpoint

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
  v_effective_role_codes text[] := p_role_codes;
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

  IF p_type = 'PERSONAL' THEN
    -- Serialize only this user's PERSONAL bootstrap attempts. This makes two
    -- verification/request retries converge before either can insert.
    PERFORM pg_advisory_xact_lock(hashtextextended('personal-workspace:' || v_user, 0));

    SELECT w."id" INTO v_workspace_id
      FROM public."workspaces" w
     WHERE w."type" = 'PERSONAL'
       AND w."created_by_id" = v_user;

    IF FOUND THEN
      INSERT INTO public."workspace_memberships"
        ("id", "workspace_id", "user_id", "status")
      VALUES (gen_random_uuid()::text, v_workspace_id, v_user, 'ACTIVE')
      ON CONFLICT ("workspace_id", "user_id") DO UPDATE
        SET "status" = 'ACTIVE', "updated_at" = now()
      RETURNING "id" INTO v_membership_id;

      -- PERSONAL bootstrap is not a caller-selected role-grant mechanism.
      -- LEARNER is forced even if a compromised caller supplies ORG_OWNER or a
      -- PLATFORM role; the scope trigger in 0015 remains defense in depth.
      INSERT INTO public."membership_roles" ("membership_id", "role_id", "granted_by_id")
      SELECT v_membership_id, r."id", v_user
        FROM public."roles" r
       WHERE r."code" = 'LEARNER' AND r."scope" = 'WORKSPACE'
      ON CONFLICT DO NOTHING;

      RETURN v_workspace_id;
    END IF;

    v_effective_role_codes := ARRAY['LEARNER'];
  ELSE
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

  INSERT INTO public."membership_roles" ("membership_id", "role_id", "granted_by_id")
  SELECT v_membership_id, r."id", v_user
    FROM public."roles" r
   WHERE r."code" = ANY(v_effective_role_codes)
     AND r."scope" = 'WORKSPACE'
  ON CONFLICT DO NOTHING;

  RETURN v_workspace_id;
END;
$$;--> statement-breakpoint

ALTER FUNCTION "app_bootstrap_workspace"(text, text, text[], int) OWNER TO "app_bootstrap";--> statement-breakpoint
REVOKE ALL ON FUNCTION "app_bootstrap_workspace"(text, text, text[], int) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "app_bootstrap_workspace"(text, text, text[], int) TO "app_rw";--> statement-breakpoint

DO $$
BEGIN
  EXECUTE format('GRANT EXECUTE ON FUNCTION "app_bootstrap_workspace"(text, text, text[], int) TO %I', current_user);
END $$;
