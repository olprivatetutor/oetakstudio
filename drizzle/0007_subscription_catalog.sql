DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'subscription_plan' AND e.enumlabel = 'starter')
     AND NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'subscription_plan' AND e.enumlabel = 'personal') THEN
    ALTER TYPE "public"."subscription_plan" RENAME VALUE 'starter' TO 'personal';
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'subscription_plan' AND e.enumlabel = 'pro')
     AND NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'subscription_plan' AND e.enumlabel = 'team') THEN
    ALTER TYPE "public"."subscription_plan" RENAME VALUE 'pro' TO 'team';
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'subscription_plan' AND e.enumlabel = 'growth')
     AND NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'subscription_plan' AND e.enumlabel = 'professional') THEN
    ALTER TYPE "public"."subscription_plan" RENAME VALUE 'growth' TO 'professional';
  END IF;
END $$;--> statement-breakpoint
ALTER TYPE "public"."subscription_plan" ADD VALUE IF NOT EXISTS 'school';--> statement-breakpoint
ALTER TYPE "public"."subscription_plan" ADD VALUE IF NOT EXISTS 'university';--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "provider" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "external_customer_id" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "external_subscription_id" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "billing_interval" text DEFAULT 'monthly' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_external_subscription_unique" ON "subscriptions" ("provider", "external_subscription_id");
