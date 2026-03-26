-- 008_add_missing_indexes.sql
-- Add indexes on all FK columns used in WHERE clauses.
-- Without these every filtered query is a full table scan.

CREATE INDEX IF NOT EXISTS idx_event_inviter_id        ON event(inviter_id);
CREATE INDEX IF NOT EXISTS idx_event_status             ON event(status);
CREATE INDEX IF NOT EXISTS idx_event_archived           ON event(archived);

CREATE INDEX IF NOT EXISTS idx_response_event_id        ON response(event_id);
CREATE INDEX IF NOT EXISTS idx_response_invitee_id      ON response(invitee_id);

CREATE INDEX IF NOT EXISTS idx_activity_option_event_id ON activity_option(event_id);

CREATE INDEX IF NOT EXISTS idx_email_log_status         ON email_log(status);
CREATE INDEX IF NOT EXISTS idx_email_log_event_id       ON email_log(event_id);

CREATE INDEX IF NOT EXISTS idx_invitation_link_event_id ON invitation_link(event_id);

-- Fix missing NOT NULL on archived column (added in migration 007 without the constraint)
ALTER TABLE event ALTER COLUMN archived SET NOT NULL;
