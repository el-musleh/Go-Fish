-- 006_add_event_suggestions.sql
-- Store AI-generated event suggestions in the database so they are
-- shared across all users and not regenerated on every request.

ALTER TABLE event ADD COLUMN IF NOT EXISTS ai_suggestions JSONB;
