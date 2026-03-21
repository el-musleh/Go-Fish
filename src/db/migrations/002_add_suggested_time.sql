-- 002_add_suggested_time.sql
-- Add suggested_time to activity_option for time-aware suggestions
ALTER TABLE activity_option ADD COLUMN suggested_time VARCHAR(5);
