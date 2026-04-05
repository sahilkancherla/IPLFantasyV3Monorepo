-- 015_weeks_type.sql
-- Adds week_type column to ipl_weeks: 'regular' | 'playoff' | 'finals'
-- Keeps is_playoff in sync for backwards compatibility.

ALTER TABLE ipl_weeks
  ADD COLUMN IF NOT EXISTS week_type TEXT NOT NULL DEFAULT 'regular'
    CHECK (week_type IN ('regular', 'playoff', 'finals'));

-- Backfill from existing is_playoff flag
UPDATE ipl_weeks SET week_type = 'playoff' WHERE is_playoff = true;
