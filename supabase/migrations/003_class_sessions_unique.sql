-- Add unique constraint on class_sessions (schedule_id, date)
-- This prevents duplicate sessions for the same schedule on the same date
-- Run this in Supabase SQL Editor
ALTER TABLE class_sessions ADD CONSTRAINT class_sessions_schedule_id_date_key UNIQUE (schedule_id, date);
