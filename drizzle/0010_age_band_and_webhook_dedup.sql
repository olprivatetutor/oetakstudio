-- Phase 0: minor-safety foundation (ADR-007, §3.6) and billing webhook idempotency (§13.10).
DO $$ BEGIN
  CREATE TYPE "public"."age_band" AS ENUM('UNDER_13', 'TEEN_13_17', 'ADULT', 'UNSPECIFIED');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "birth_date" date;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "age_band" "age_band" DEFAULT 'UNSPECIFIED' NOT NULL;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."payment_webhook_event_status" AS ENUM('received', 'processed', 'failed', 'ignored');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "payment_webhook_events" (
  "id" text PRIMARY KEY NOT NULL,
  "provider" text NOT NULL,
  "provider_event_id" text NOT NULL,
  "event_type" text NOT NULL,
  "signature_verified" boolean DEFAULT true NOT NULL,
  "payload" jsonb NOT NULL,
  "status" "payment_webhook_event_status" DEFAULT 'received' NOT NULL,
  "processed_at" timestamp,
  "attempt_count" integer DEFAULT 1 NOT NULL,
  "last_error" text,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_webhook_events_provider_event_unique" ON "payment_webhook_events" ("provider", "provider_event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_webhook_events_status_idx" ON "payment_webhook_events" ("status", "created_at");
