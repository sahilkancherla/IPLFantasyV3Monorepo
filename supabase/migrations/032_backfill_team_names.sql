-- Backfill team_name for existing league_members using display_name or username from profiles
UPDATE league_members lm
SET team_name = COALESCE(NULLIF(p.display_name, ''), p.username, 'Team')
FROM profiles p
WHERE lm.user_id = p.id
  AND lm.team_name = '';
