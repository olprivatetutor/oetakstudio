DO $$ BEGIN CREATE TYPE "public"."content_track" AS ENUM('SCH', 'PRO', 'LNG', 'REL', 'GEN'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."organization_type" AS ENUM('school', 'general'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."content_asset_kind" AS ENUM('video', 'audio', 'document', 'image', 'interactive', 'scorm', 'h5p', 'template'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."content_asset_status" AS ENUM('draft', 'review', 'approved', 'published', 'archived'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."placement_scope" AS ENUM('strict_lo_scope', 'open_proficiency'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."placement_status" AS ENUM('draft', 'submitted', 'scored'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."notification_type" AS ENUM('system', 'course', 'assessment', 'billing', 'discussion'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."discussion_visibility" AS ENUM('course', 'organization', 'private'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "type" "organization_type" DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "primary_content_track" "content_track" DEFAULT 'PRO' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "curriculum_mode" text DEFAULT 'inherited' NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "content_track" "content_track" DEFAULT 'GEN' NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "curriculum_code" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "school_level" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "grade_label" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "subject_code" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "skill_framework" text;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_tracks" (
  "id" "content_track" PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "target_audience" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "curricula" (
  "id" text PRIMARY KEY NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "track" "content_track" DEFAULT 'SCH' NOT NULL,
  "organization_id" text,
  "source" text DEFAULT 'system' NOT NULL,
  "regions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "characteristics" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subjects" (
  "id" text PRIMARY KEY NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "track" "content_track" DEFAULT 'SCH' NOT NULL,
  "description" text,
  "key_topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "learning_objectives" (
  "id" text PRIMARY KEY NOT NULL,
  "objective_id" text NOT NULL,
  "organization_id" text,
  "track" "content_track" DEFAULT 'SCH' NOT NULL,
  "curriculum_code" text NOT NULL,
  "level_code" text NOT NULL,
  "grade_label" text NOT NULL,
  "subject_code" text NOT NULL,
  "topic" text NOT NULL,
  "objective" text NOT NULL,
  "bloom_taxonomy" text NOT NULL,
  "assessment_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "prerequisites" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "course_learning_objectives" (
  "course_id" text NOT NULL,
  "learning_objective_id" text NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL,
  CONSTRAINT "course_learning_objectives_pk" PRIMARY KEY("course_id","learning_objective_id")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "placement_tests" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "organization_id" text,
  "course_id" text,
  "track" "content_track" NOT NULL,
  "curriculum_code" text,
  "level_code" text,
  "grade_label" text,
  "subject_code" text,
  "skill_framework" text,
  "scope" "placement_scope" NOT NULL,
  "status" "placement_status" DEFAULT 'draft' NOT NULL,
  "score" integer,
  "recommended_level" text,
  "report" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "placement_responses" (
  "id" text PRIMARY KEY NOT NULL,
  "placement_test_id" text NOT NULL,
  "learning_objective_id" text,
  "question" text NOT NULL,
  "answer" text NOT NULL,
  "is_correct" boolean,
  "score" integer,
  "feedback" text,
  "created_at" timestamp NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_assets" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text,
  "owner_id" text NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "kind" "content_asset_kind" NOT NULL,
  "status" "content_asset_status" DEFAULT 'draft' NOT NULL,
  "source_url" text,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "personal_library_items" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "course_id" text,
  "asset_id" text,
  "notes" text,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "discussion_threads" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text,
  "course_id" text,
  "created_by_id" text NOT NULL,
  "title" text NOT NULL,
  "visibility" "discussion_visibility" DEFAULT 'course' NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "discussion_posts" (
  "id" text PRIMARY KEY NOT NULL,
  "thread_id" text NOT NULL,
  "author_id" text NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "type" "notification_type" DEFAULT 'system' NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "action_url" text,
  "read_at" timestamp,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "curricula" ADD CONSTRAINT "curricula_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "learning_objectives" ADD CONSTRAINT "learning_objectives_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "course_learning_objectives" ADD CONSTRAINT "course_learning_objectives_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "course_learning_objectives" ADD CONSTRAINT "course_learning_objectives_learning_objective_id_learning_objectives_id_fk" FOREIGN KEY ("learning_objective_id") REFERENCES "public"."learning_objectives"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "placement_tests" ADD CONSTRAINT "placement_tests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "placement_tests" ADD CONSTRAINT "placement_tests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "placement_tests" ADD CONSTRAINT "placement_tests_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "placement_responses" ADD CONSTRAINT "placement_responses_placement_test_id_placement_tests_id_fk" FOREIGN KEY ("placement_test_id") REFERENCES "public"."placement_tests"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "placement_responses" ADD CONSTRAINT "placement_responses_learning_objective_id_learning_objectives_id_fk" FOREIGN KEY ("learning_objective_id") REFERENCES "public"."learning_objectives"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "content_assets" ADD CONSTRAINT "content_assets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "content_assets" ADD CONSTRAINT "content_assets_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "personal_library_items" ADD CONSTRAINT "personal_library_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "personal_library_items" ADD CONSTRAINT "personal_library_items_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "personal_library_items" ADD CONSTRAINT "personal_library_items_asset_id_content_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."content_assets"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "discussion_threads" ADD CONSTRAINT "discussion_threads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "discussion_threads" ADD CONSTRAINT "discussion_threads_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "discussion_threads" ADD CONSTRAINT "discussion_threads_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "discussion_posts" ADD CONSTRAINT "discussion_posts_thread_id_discussion_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."discussion_threads"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "discussion_posts" ADD CONSTRAINT "discussion_posts_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "curricula_code_idx" ON "curricula" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "curricula_track_idx" ON "curricula" USING btree ("track");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "curricula_org_idx" ON "curricula" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subjects_code_unique" ON "subjects" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subjects_track_idx" ON "subjects" USING btree ("track");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "learning_objectives_objective_id_unique" ON "learning_objectives" USING btree ("objective_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "learning_objectives_scope_idx" ON "learning_objectives" USING btree ("track", "curriculum_code", "level_code", "grade_label", "subject_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "learning_objectives_org_idx" ON "learning_objectives" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_learning_objectives_objective_idx" ON "course_learning_objectives" USING btree ("learning_objective_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "placement_tests_user_idx" ON "placement_tests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "placement_tests_org_idx" ON "placement_tests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "placement_tests_scope_idx" ON "placement_tests" USING btree ("track", "curriculum_code", "subject_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "placement_responses_test_idx" ON "placement_responses" USING btree ("placement_test_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_assets_org_idx" ON "content_assets" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_assets_owner_idx" ON "content_assets" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_assets_kind_status_idx" ON "content_assets" USING btree ("kind", "status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "personal_library_items_user_idx" ON "personal_library_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "personal_library_items_course_idx" ON "personal_library_items" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "personal_library_items_asset_idx" ON "personal_library_items" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "discussion_threads_org_idx" ON "discussion_threads" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "discussion_threads_course_idx" ON "discussion_threads" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "discussion_posts_thread_idx" ON "discussion_posts" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_unread_idx" ON "notifications" USING btree ("user_id", "read_at");
