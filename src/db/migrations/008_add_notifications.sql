-- 008_add_notifications.sql
-- Adds notifications and user preferences tables

-- Notification type enum
CREATE TYPE notification_type AS ENUM (
  'rsvp_received',     -- Someone responded to your event
  'event_finalized',    -- Your event has been confirmed
  'event_invited',      -- You've been invited to an event
  'options_ready'       -- Activity options are ready
);

-- User preferences table for email and notification settings
CREATE TABLE user_preferences (
    user_id UUID PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
    email_on_event_confirmed BOOLEAN NOT NULL DEFAULT TRUE,
    email_on_new_rsvp BOOLEAN NOT NULL DEFAULT FALSE,
    email_on_options_ready BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications table
CREATE TABLE notification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_id UUID REFERENCES event(id) ON DELETE SET NULL,
    link VARCHAR(500),
    read BOOLEAN NOT NULL DEFAULT FALSE,
    expired BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for notifications
CREATE INDEX idx_notification_user_id ON notification(user_id);
CREATE INDEX idx_notification_user_unread ON notification(user_id, read, expired) WHERE read = FALSE AND expired = FALSE;
CREATE INDEX idx_notification_created_at ON notification(created_at DESC);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for user_preferences updated_at
CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
