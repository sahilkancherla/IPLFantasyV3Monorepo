-- Add 'upcoming' as a valid match status
ALTER TABLE ipl_matches DROP CONSTRAINT IF EXISTS ipl_matches_status_check;
ALTER TABLE ipl_matches ADD CONSTRAINT ipl_matches_status_check
  CHECK (status IN ('pending', 'upcoming', 'live', 'completed'));
