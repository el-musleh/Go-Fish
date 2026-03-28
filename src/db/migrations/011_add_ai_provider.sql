-- Add ai_provider column to user table for storing user's preferred AI provider
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS ai_provider VARCHAR(50);
