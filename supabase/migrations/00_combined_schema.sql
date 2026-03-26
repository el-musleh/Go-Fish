-- Combined migrations for Go Fish application
-- Run this in Supabase SQL Editor to create all tables

-- 001_initial_schema.sql
-- Event status enum
CREATE TYPE event_status AS ENUM ('collecting', 'generating', 'options_ready', 'finalized');

-- Email log status enum
CREATE TYPE email_status AS ENUM ('pending', 'sent', 'failed');

-- Auth provider enum
CREATE TYPE auth_provider AS ENUM ('google', 'email');

-- USER table
CREATE TABLE IF NOT EXISTS "user" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    auth_provider auth_provider NOT NULL,
    has_taste_benchmark BOOLEAN NOT NULL DEFAULT FALSE,
    ai_api_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TASTE_BENCHMARK table
CREATE TABLE IF NOT EXISTS taste_benchmark (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
    answers JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- EVENT table
CREATE TABLE IF NOT EXISTS event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inviter_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    response_window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    response_window_end TIMESTAMPTZ NOT NULL,
    status event_status NOT NULL DEFAULT 'collecting',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    location_city VARCHAR(255),
    location_country VARCHAR(10),
    location_lat DOUBLE PRECISION,
    location_lng DOUBLE PRECISION,
    preferred_date DATE,
    preferred_time TIME,
    duration_minutes INTEGER,
    ai_suggestions JSONB,
    archived BOOLEAN DEFAULT FALSE NOT NULL
);

-- INVITATION_LINK table
CREATE TABLE IF NOT EXISTS invitation_link (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invitation_link_token ON invitation_link(token);

-- RESPONSE table
CREATE TABLE IF NOT EXISTS response (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    invitee_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    available_dates JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, invitee_id)
);

-- ACTIVITY_OPTION table
CREATE TABLE IF NOT EXISTS activity_option (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    suggested_date DATE NOT NULL,
    suggested_time VARCHAR(5),
    rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 3),
    is_selected BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_url TEXT,
    venue_name VARCHAR(255),
    price_range VARCHAR(100),
    weather_note VARCHAR(500),
    image_url TEXT
);

-- EMAIL_LOG table
CREATE TABLE IF NOT EXISTS email_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    status email_status NOT NULL DEFAULT 'pending',
    retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count <= 3),
    last_attempt TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notification type enum
CREATE TYPE notification_type AS ENUM (
  'rsvp_received',
  'event_finalized',
  'event_invited',
  'options_ready'
);

-- User preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
    email_on_event_confirmed BOOLEAN NOT NULL DEFAULT TRUE,
    email_on_new_rsvp BOOLEAN NOT NULL DEFAULT FALSE,
    email_on_options_ready BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notification (
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_event_inviter_id ON event(inviter_id);
CREATE INDEX IF NOT EXISTS idx_event_status ON event(status);
CREATE INDEX IF NOT EXISTS idx_event_archived ON event(archived);
CREATE INDEX IF NOT EXISTS idx_response_event_id ON response(event_id);
CREATE INDEX IF NOT EXISTS idx_response_invitee_id ON response(invitee_id);
CREATE INDEX IF NOT EXISTS idx_activity_option_event_id ON activity_option(event_id);
CREATE INDEX IF NOT EXISTS idx_email_log_status ON email_log(status);
CREATE INDEX IF NOT EXISTS idx_email_log_event_id ON email_log(event_id);
CREATE INDEX IF NOT EXISTS idx_invitation_link_event_id ON invitation_link(event_id);
CREATE INDEX IF NOT EXISTS idx_notification_user_id ON notification(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_user_unread ON notification(user_id, read, expired) WHERE read = FALSE AND expired = FALSE;
CREATE INDEX IF NOT EXISTS idx_notification_created_at ON notification(created_at DESC);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for user_preferences updated_at
DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();