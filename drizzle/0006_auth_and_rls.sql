ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "two_factor_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rate_limit" (
  "key" text PRIMARY KEY NOT NULL,
  "count" integer NOT NULL,
  "last_request" integer NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "two_factor" (
  "id" text PRIMARY KEY NOT NULL,
  "secret" text NOT NULL,
  "backup_codes" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "two_factor_user_unique" ON "two_factor" ("user_id");--> statement-breakpoint

ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "organizations_tenant_isolation" ON "organizations";--> statement-breakpoint
CREATE POLICY "organizations_tenant_isolation" ON "organizations"
  USING ("id" = NULLIF(current_setting('app.current_tenant_id', true), ''));--> statement-breakpoint

ALTER TABLE "organization_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "organization_members_tenant_isolation" ON "organization_members";--> statement-breakpoint
CREATE POLICY "organization_members_tenant_isolation" ON "organization_members"
  USING (
    "organization_id" = NULLIF(current_setting('app.current_tenant_id', true), '')
    OR "user_id" = NULLIF(current_setting('app.current_user_id', true), '')
  );--> statement-breakpoint

ALTER TABLE "organization_invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "organization_invitations_tenant_isolation" ON "organization_invitations";--> statement-breakpoint
CREATE POLICY "organization_invitations_tenant_isolation" ON "organization_invitations"
  USING ("organization_id" = NULLIF(current_setting('app.current_tenant_id', true), ''));--> statement-breakpoint

ALTER TABLE "courses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "courses_tenant_isolation" ON "courses";--> statement-breakpoint
CREATE POLICY "courses_tenant_isolation" ON "courses"
  USING (
    "organization_id" IS NULL
    OR "organization_id" = NULLIF(current_setting('app.current_tenant_id', true), '')
    OR "owner_id" = NULLIF(current_setting('app.current_user_id', true), '')
  );--> statement-breakpoint

ALTER TABLE "enrollments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "enrollments_tenant_isolation" ON "enrollments";--> statement-breakpoint
CREATE POLICY "enrollments_tenant_isolation" ON "enrollments"
  USING (
    "organization_id" = NULLIF(current_setting('app.current_tenant_id', true), '')
    OR "user_id" = NULLIF(current_setting('app.current_user_id', true), '')
  );--> statement-breakpoint

ALTER TABLE "content_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "content_assets_tenant_isolation" ON "content_assets";--> statement-breakpoint
CREATE POLICY "content_assets_tenant_isolation" ON "content_assets"
  USING (
    "organization_id" IS NULL
    OR "organization_id" = NULLIF(current_setting('app.current_tenant_id', true), '')
    OR "owner_id" = NULLIF(current_setting('app.current_user_id', true), '')
  );--> statement-breakpoint

ALTER TABLE "learning_objectives" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "learning_objectives_tenant_isolation" ON "learning_objectives";--> statement-breakpoint
CREATE POLICY "learning_objectives_tenant_isolation" ON "learning_objectives"
  USING (
    "organization_id" IS NULL
    OR "organization_id" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );--> statement-breakpoint

ALTER TABLE "curricula" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "curricula_tenant_isolation" ON "curricula";--> statement-breakpoint
CREATE POLICY "curricula_tenant_isolation" ON "curricula"
  USING (
    "organization_id" IS NULL
    OR "organization_id" = NULLIF(current_setting('app.current_tenant_id', true), '')
  );--> statement-breakpoint

ALTER TABLE "ai_conversations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "ai_conversations_tenant_isolation" ON "ai_conversations";--> statement-breakpoint
CREATE POLICY "ai_conversations_tenant_isolation" ON "ai_conversations"
  USING (
    "organization_id" = NULLIF(current_setting('app.current_tenant_id', true), '')
    OR "user_id" = NULLIF(current_setting('app.current_user_id', true), '')
  );--> statement-breakpoint

ALTER TABLE "ai_usage_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "ai_usage_records_tenant_isolation" ON "ai_usage_records";--> statement-breakpoint
CREATE POLICY "ai_usage_records_tenant_isolation" ON "ai_usage_records"
  USING (
    "organization_id" = NULLIF(current_setting('app.current_tenant_id', true), '')
    OR "user_id" = NULLIF(current_setting('app.current_user_id', true), '')
  );
