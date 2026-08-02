COMMIT;--> statement-breakpoint
BEGIN;--> statement-breakpoint
INSERT INTO "subscription_plans" ("code", "name", "monthly_price_cents", "annual_price_cents", "currency", "included_seats", "course_limit", "features", "is_active", "created_at", "updated_at") VALUES
  ('free', 'Free', 0, 0, 'USD', 1, 3, '["Basic AI tutor", "Three courses"]'::jsonb, true, now(), now()),
  ('personal', 'Personal', 1900, 19000, 'USD', 1, NULL, '["Full AI tutor", "Unlimited courses", "Certificates"]'::jsonb, true, now(), now()),
  ('team', 'Team', 9900, 99000, 'USD', 10, NULL, '["Organization workspace", "Content creation", "Team analytics"]'::jsonb, true, now(), now()),
  ('professional', 'Professional', 29900, 299000, 'USD', 50, NULL, '["Custom branding", "Advanced analytics", "All learning features"]'::jsonb, true, now(), now()),
  ('enterprise', 'Enterprise', 0, NULL, 'USD', 1, NULL, '["Enterprise SSO", "White label", "Custom AI models"]'::jsonb, true, now(), now()),
  ('school', 'School', 49900, 499000, 'USD', 200, NULL, '["Multiple curricula", "Guardian access", "School analytics"]'::jsonb, true, now(), now()),
  ('university', 'University', 99900, 999000, 'USD', 1000, NULL, '["Advanced analytics", "API access", "Large cohorts"]'::jsonb, true, now(), now())
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "monthly_price_cents" = EXCLUDED."monthly_price_cents",
  "annual_price_cents" = EXCLUDED."annual_price_cents",
  "currency" = EXCLUDED."currency",
  "included_seats" = EXCLUDED."included_seats",
  "course_limit" = EXCLUDED."course_limit",
  "features" = EXCLUDED."features",
  "is_active" = EXCLUDED."is_active",
  "updated_at" = now();
