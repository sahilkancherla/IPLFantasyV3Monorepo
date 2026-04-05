-- 017_match_status.sql
-- Adds a status column to ipl_matches: 'pending' | 'live' | 'completed'
-- Backfills from is_completed, keeps is_completed in sync via a trigger.

ALTER TABLE ipl_matches
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'live', 'completed'));

-- Backfill from existing is_completed flag
UPDATE ipl_matches SET status = 'completed' WHERE is_completed = true;

-- Keep is_completed in sync when status changes
CREATE OR REPLACE FUNCTION sync_match_is_completed()
RETURNS TRIGGER AS $$
BEGIN
  NEW.is_completed := (NEW.status = 'completed');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_match_is_completed ON ipl_matches;
CREATE TRIGGER trg_sync_match_is_completed
  BEFORE INSERT OR UPDATE OF status ON ipl_matches
  FOR EACH ROW EXECUTE FUNCTION sync_match_is_completed();
