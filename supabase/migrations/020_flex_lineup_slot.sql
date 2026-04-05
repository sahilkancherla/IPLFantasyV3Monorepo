-- Add 'flex' as a valid slot_role (3 flex spots, any player role)
ALTER TABLE weekly_lineups DROP CONSTRAINT IF EXISTS weekly_lineups_slot_role_check;
ALTER TABLE weekly_lineups ADD CONSTRAINT weekly_lineups_slot_role_check
  CHECK (slot_role IN ('batsman', 'bowler', 'all_rounder', 'wicket_keeper', 'flex'));
