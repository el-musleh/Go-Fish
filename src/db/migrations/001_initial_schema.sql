-- 001_initial_schema.sql
-- Creates all tables for the Go Fish application

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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INVITATION_LINK table
CREATE TABLE IF NOT EXISTS invitation_link (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index on token (Req 4.4)
CREATE UNIQUE INDEX idx_invitation_link_token ON invitation_link(token);

-- RESPONSE table
CREATE TABLE IF NOT EXISTS response (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    invitee_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    available_dates JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one response per invitee per event (Req 5.5)
ALTER TABLE response ADD CONSTRAINT uq_response_event_invitee UNIQUE (event_id, invitee_id);

-- ACTIVITY_OPTION table
CREATE TABLE IF NOT EXISTS activity_option (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    suggested_date DATE NOT NULL,
    rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 3),
    is_selected BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
