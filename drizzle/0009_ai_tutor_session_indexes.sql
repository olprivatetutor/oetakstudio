CREATE INDEX IF NOT EXISTS "ai_conversations_user_created_idx"
  ON "ai_conversations" USING btree ("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "ai_conversations_user_status_idx"
  ON "ai_conversations" USING btree ("user_id", "status");
