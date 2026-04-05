-- ============================================================
-- 014_weeks_datetime_window.sql
-- Adds window_start / window_end TIMESTAMPTZ to ipl_weeks
-- ============================================================

ALTER TABLE ipl_weeks ADD COLUMN IF NOT EXISTS window_start TIMESTAMPTZ;
ALTER TABLE ipl_weeks ADD COLUMN IF NOT EXISTS window_end   TIMESTAMPTZ;
