-- 018_week_status.sql
-- Adds a status column to ipl_weeks: 'pending' | 'live' | 'completed'

ALTER TABLE ipl_weeks
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'live', 'completed'));
