-- 016_schedule_week_type.sql
-- Updates generate_schedule to use week_type = 'regular' instead of NOT is_playoff

CREATE OR REPLACE FUNCTION generate_schedule(p_league_id UUID) RETURNS VOID AS $$
DECLARE
  members     UUID[];
  n           INTEGER;
  week_row    RECORD;
  round       INTEGER := 0;
  i           INTEGER;
  rotation    UUID[];
  fixed       UUID;
  home_id     UUID;
  away_id     UUID;
BEGIN
  -- Get member IDs ordered by join date
  SELECT ARRAY_AGG(user_id ORDER BY joined_at)
  INTO members
  FROM league_members
  WHERE league_id = p_league_id;

  n := array_length(members, 1);
  IF n < 2 THEN RETURN; END IF;

  -- Delete any existing matchups for this league
  DELETE FROM weekly_matchups WHERE league_id = p_league_id;

  -- Round-robin (circle method). Odd teams → add bye (NULL).
  IF n % 2 = 1 THEN
    members := members || ARRAY[NULL::UUID];
    n := n + 1;
  END IF;

  fixed    := members[1];
  rotation := members[2:n];

  FOR week_row IN
    SELECT week_num FROM ipl_weeks WHERE week_type = 'regular' ORDER BY week_num
  LOOP
    -- pair fixed vs rotation[1], then rotation[i] vs rotation[n-i]
    FOR i IN 1..n/2 LOOP
      IF i = 1 THEN
        home_id := fixed;
        away_id := rotation[1];
      ELSE
        home_id := rotation[i];
        away_id := rotation[n - i];
      END IF;

      IF home_id IS NOT NULL AND away_id IS NOT NULL THEN
        INSERT INTO weekly_matchups (league_id, week_num, home_user, away_user)
        VALUES (p_league_id, week_row.week_num, home_id, away_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;

    -- Circle rotation: last element moves to front
    rotation := rotation[n-1:n-1] || rotation[1:n-2];
    round := round + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
