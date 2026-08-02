DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'content_track' AND e.enumlabel = 'REL'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'content_track' AND e.enumlabel = 'ESP'
  ) THEN
    ALTER TYPE "public"."content_track" RENAME VALUE 'REL' TO 'ESP';
  END IF;
END $$;--> statement-breakpoint
ALTER TYPE "public"."content_track" ADD VALUE IF NOT EXISTS 'LNP';--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'organization_type' AND e.enumlabel = 'general'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'organization_type' AND e.enumlabel = 'institution'
  ) THEN
    ALTER TYPE "public"."organization_type" RENAME VALUE 'general' TO 'institution';
  END IF;
END $$;--> statement-breakpoint
ALTER TYPE "public"."organization_type" ADD VALUE IF NOT EXISTS 'corporate';--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'organization_role' AND e.enumlabel = 'student'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'organization_role' AND e.enumlabel = 'learner'
  ) THEN
    ALTER TYPE "public"."organization_role" RENAME VALUE 'student' TO 'learner';
  END IF;
END $$;--> statement-breakpoint
ALTER TYPE "public"."organization_role" ADD VALUE IF NOT EXISTS 'content';--> statement-breakpoint
ALTER TYPE "public"."organization_role" ADD VALUE IF NOT EXISTS 'guardian';--> statement-breakpoint
ALTER TYPE "public"."course_status" ADD VALUE IF NOT EXISTS 'in_review';--> statement-breakpoint
ALTER TYPE "public"."course_status" ADD VALUE IF NOT EXISTS 'needs_revision';--> statement-breakpoint
ALTER TYPE "public"."course_status" ADD VALUE IF NOT EXISTS 'rejected';--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."organization_member_status" AS ENUM('invited', 'active', 'suspended', 'removed'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'expired', 'revoked'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."assessment_purpose" AS ENUM('diagnostic', 'formative', 'summative'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."question_type" AS ENUM('multiple_choice', 'true_false', 'fill_blank', 'matching', 'essay', 'speaking', 'listening', 'interactive_scenario', 'project'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."ai_job_status" AS ENUM('queued', 'processing', 'completed', 'failed', 'canceled'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'open', 'paid', 'void', 'uncollectible'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."payment_status" AS ENUM('pending', 'succeeded', 'failed', 'refunded'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

ALTER TABLE "organization_members" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "organization_members" ALTER COLUMN "status" TYPE "organization_member_status" USING (
  CASE
    WHEN "status" IN ('invited', 'active', 'suspended', 'removed') THEN "status"::"organization_member_status"
    ELSE 'active'::"organization_member_status"
  END
);--> statement-breakpoint
ALTER TABLE "organization_members" ALTER COLUMN "status" SET DEFAULT 'active';--> statement-breakpoint

ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "prerequisites" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "standards" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "ai_confidence" integer;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "is_template" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "published_at" timestamp;--> statement-breakpoint
UPDATE "courses" SET "is_public" = true, "published_at" = COALESCE("published_at", "updated_at") WHERE "organization_id" IS NULL AND "status" = 'published';--> statement-breakpoint

ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "purpose" "assessment_purpose" DEFAULT 'formative' NOT NULL;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "questions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "time_limit_minutes" integer;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "max_attempts" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "retake_cooldown_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "assessment_submissions" ADD COLUMN IF NOT EXISTS "answers" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "assessment_submissions" ADD COLUMN IF NOT EXISTS "attempt_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "assessment_submissions" ADD COLUMN IF NOT EXISTS "started_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "assessment_submissions" ADD COLUMN IF NOT EXISTS "submitted_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "assessment_submissions" ADD COLUMN IF NOT EXISTS "graded_by_id" text;--> statement-breakpoint
ALTER TABLE "assessment_submissions" ADD COLUMN IF NOT EXISTS "ai_feedback" jsonb;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "assessment_submissions" ADD CONSTRAINT "assessment_submissions_graded_by_id_user_id_fk" FOREIGN KEY ("graded_by_id") REFERENCES "public"."user"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assessment_submissions_attempt_unique" ON "assessment_submissions" ("assessment_id", "user_id", "attempt_number");--> statement-breakpoint

ALTER TABLE "ai_conversations" ADD COLUMN IF NOT EXISTS "organization_id" text;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD COLUMN IF NOT EXISTS "context" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD COLUMN IF NOT EXISTS "ended_at" timestamp;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_conversations_org_idx" ON "ai_conversations" ("organization_id");--> statement-breakpoint
ALTER TABLE "ai_messages" ADD COLUMN IF NOT EXISTS "input_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD COLUMN IF NOT EXISTS "output_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD COLUMN IF NOT EXISTS "cost_micros" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD COLUMN IF NOT EXISTS "provider" text;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD COLUMN IF NOT EXISTS "model" text;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD COLUMN IF NOT EXISTS "response_time_ms" integer;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "organization_invitations" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "email" text NOT NULL,
  "role" "organization_role" DEFAULT 'learner' NOT NULL,
  "token_hash" text NOT NULL,
  "status" "invitation_status" DEFAULT 'pending' NOT NULL,
  "invited_by_id" text NOT NULL REFERENCES "user"("id") ON DELETE restrict,
  "expires_at" timestamp NOT NULL,
  "accepted_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organization_invitations_token_unique" ON "organization_invitations" ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_invitations_org_status_idx" ON "organization_invitations" ("organization_id", "status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_invitations_email_idx" ON "organization_invitations" ("email");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "guardian_learners" (
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "guardian_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "learner_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "created_by_id" text NOT NULL REFERENCES "user"("id") ON DELETE restrict,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL,
  CONSTRAINT "guardian_learners_pk" PRIMARY KEY("organization_id", "guardian_user_id", "learner_user_id"),
  CONSTRAINT "guardian_learners_distinct_users" CHECK ("guardian_user_id" <> "learner_user_id")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guardian_learners_guardian_idx" ON "guardian_learners" ("guardian_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guardian_learners_learner_idx" ON "guardian_learners" ("learner_user_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "course_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "course_id" text NOT NULL REFERENCES "courses"("id") ON DELETE cascade,
  "version" integer NOT NULL,
  "created_by_id" text NOT NULL REFERENCES "user"("id") ON DELETE restrict,
  "snapshot" jsonb NOT NULL,
  "revision_notes" text,
  "created_at" timestamp NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "course_versions_course_version_unique" ON "course_versions" ("course_id", "version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_versions_course_idx" ON "course_versions" ("course_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "subscription_plans" (
  "code" "subscription_plan" PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "monthly_price_cents" integer NOT NULL,
  "annual_price_cents" integer,
  "currency" text DEFAULT 'USD' NOT NULL,
  "included_seats" integer DEFAULT 1 NOT NULL,
  "course_limit" integer,
  "features" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoices" (
  "id" text PRIMARY KEY NOT NULL,
  "subscription_id" text NOT NULL REFERENCES "subscriptions"("id") ON DELETE cascade,
  "invoice_number" text NOT NULL,
  "amount_cents" integer NOT NULL,
  "currency" text DEFAULT 'USD' NOT NULL,
  "status" "invoice_status" DEFAULT 'draft' NOT NULL,
  "due_at" timestamp,
  "paid_at" timestamp,
  "items" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "external_id" text,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_number_unique" ON "invoices" ("invoice_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_external_unique" ON "invoices" ("external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_subscription_idx" ON "invoices" ("subscription_id", "created_at");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
  "id" text PRIMARY KEY NOT NULL,
  "invoice_id" text NOT NULL REFERENCES "invoices"("id") ON DELETE cascade,
  "provider" text NOT NULL,
  "payment_method" text,
  "amount_cents" integer NOT NULL,
  "currency" text DEFAULT 'USD' NOT NULL,
  "status" "payment_status" DEFAULT 'pending' NOT NULL,
  "transaction_id" text,
  "failure_reason" text,
  "refunded_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payments_transaction_unique" ON "payments" ("provider", "transaction_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_invoice_idx" ON "payments" ("invoice_id", "created_at");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usage_records" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text REFERENCES "organizations"("id") ON DELETE cascade,
  "user_id" text REFERENCES "user"("id") ON DELETE set null,
  "feature" text NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL,
  "unit" text NOT NULL,
  "cost_cents" integer DEFAULT 0 NOT NULL,
  "recorded_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_records_org_date_idx" ON "usage_records" ("organization_id", "recorded_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_records_user_date_idx" ON "usage_records" ("user_id", "recorded_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_records_feature_idx" ON "usage_records" ("feature");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "ai_configurations" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text REFERENCES "organizations"("id") ON DELETE cascade,
  "feature" text NOT NULL,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "requests_per_minute" integer DEFAULT 20 NOT NULL,
  "monthly_budget_cents" integer,
  "is_active" boolean DEFAULT true NOT NULL,
  "updated_by_id" text REFERENCES "user"("id") ON DELETE set null,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_configurations_org_feature_unique" ON "ai_configurations" ("organization_id", "feature");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_configurations_global_feature_unique" ON "ai_configurations" ("feature") WHERE "organization_id" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_configurations_feature_idx" ON "ai_configurations" ("feature", "is_active");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_usage_records" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text REFERENCES "organizations"("id") ON DELETE set null,
  "user_id" text REFERENCES "user"("id") ON DELETE set null,
  "feature" text NOT NULL,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "input_tokens" integer DEFAULT 0 NOT NULL,
  "output_tokens" integer DEFAULT 0 NOT NULL,
  "cost_micros" integer DEFAULT 0 NOT NULL,
  "response_time_ms" integer,
  "success" boolean DEFAULT true NOT NULL,
  "error_code" text,
  "created_at" timestamp NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_org_created_idx" ON "ai_usage_records" ("organization_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_user_created_idx" ON "ai_usage_records" ("user_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_feature_idx" ON "ai_usage_records" ("feature", "provider");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_generation_jobs" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text REFERENCES "organizations"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "input_file_url" text,
  "input" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" "ai_job_status" DEFAULT 'queued' NOT NULL,
  "progress" integer DEFAULT 0 NOT NULL,
  "output" jsonb,
  "provider" text,
  "model" text,
  "error" text,
  "completed_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_generation_jobs_org_status_idx" ON "ai_generation_jobs" ("organization_id", "status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_generation_jobs_user_idx" ON "ai_generation_jobs" ("user_id");
