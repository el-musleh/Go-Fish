-- Migration: Add auth_id column for Supabase Auth ID mapping
-- Run this in Supabase SQL Editor

-- Add auth_id column to store Supabase Auth user ID
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE;

-- Add updated_at for tracking
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Add index for faster lookups by auth_id and email
CREATE INDEX IF NOT EXISTS idx_user_auth_id ON "user"(auth_id);
CREATE INDEX IF NOT EXISTS idx_user_email ON "user"(email);

-- Also add indexes to other tables for better performance
CREATE INDEX IF NOT EXISTS idx_event_inviter ON "event"(inviter_id);
CREATE INDEX IF NOT EXISTS idx_response_event ON "response"(event_id);
CREATE INDEX IF NOT EXISTS idx_response_invitee ON "response"(invitee_id);
CREATE INDEX IF NOT EXISTS idx_notification_user ON "notification"(user_id);
CREATE INDEX IF NOT EXISTS idx_taste_benchmark_user ON "taste_benchmark"(user_id);

-- Enable RLS (Row Level Security) - handled by Supabase service role key in Edge Functions
-- Note: Edge Functions use service role key which bypasses RLS
