-- 019_fix_generate_schedule.sql
-- Fixes off-by-one in circle round-robin pairing.
-- Bug: away_id := rotation[n - i] sampled the wrong slot, producing self-matchups
--      for even-sized leagues (e.g. 4 teams: rotation[4-2]=rotation[2] = home team).
-- Fix: away_id := rotation[n - i + 1]

CREATE OR REPLACE FUNCTION generate_schedule(p_league_id UUID) RETURNS VOID AS $$
DECLARE
  members     UUID[];
  n           INTEGER;
  week_row    RECORD;
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

  -- Round-robin (circle method). Odd number of teams → add bye (NULL).
  IF n % 2 = 1 THEN
    members := members || ARRAY[NULL::UUID];
    n := n + 1;
  END IF;

  fixed    := members[1];
  rotation := members[2:n];   -- n-1 elements, 1-indexed in PostgreSQL

  FOR week_row IN
    SELECT week_num FROM ipl_weeks WHERE week_type = 'regular' ORDER BY week_num
  LOOP
    -- Circle method pairs:
    --   i=1        : fixed  vs rotation[1]
    --   i=2..n/2   : rotation[i] vs rotation[n-i+1]
    --
    -- rotation has n-1 elements (indices 1..n-1).
    -- For i in 2..n/2: the partner is at index n-i+1, which ranges from n-1 down to n/2+1.
    -- This guarantees every element is used exactly once per round.
    FOR i IN 1..n/2 LOOP
      IF i = 1 THEN
        home_id := fixed;
        away_id := rotation[1];
      ELSE
        home_id := rotation[i];
        away_id := rotation[n - i + 1];
      END IF;

      IF home_id IS NOT NULL AND away_id IS NOT NULL THEN
        INSERT INTO weekly_matchups (league_id, week_num, home_user, away_user)
        VALUES (p_league_id, week_row.week_num, home_id, away_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;

    -- Circle rotation: last element moves to front of rotation
    rotation := rotation[n-1:n-1] || rotation[1:n-2];
  END LOOP;
END;
$$ LANGUAGE plpgsql;
