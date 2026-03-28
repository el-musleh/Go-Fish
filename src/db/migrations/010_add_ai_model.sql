-- Add ai_model column to user table for storing user's preferred AI model
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS ai_model VARCHAR(100);
