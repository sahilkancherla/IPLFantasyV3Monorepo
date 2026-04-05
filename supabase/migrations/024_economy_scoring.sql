-- Update economy rate bonus rules:
--   Minimum overs: 2 (12 balls), was 4 (24 balls)
--   < 5.00:   +6 pts
--   5 - 5.99: +4 pts
--   6 - 6.99: +2 pts
--   7 - 9.99:  0 pts
--   10 - 10.99: -2 pts
--   11 - 11.99: -4 pts
--   12+:       -6 pts

CREATE OR REPLACE FUNCTION calc_fantasy_points(
  p_runs               INTEGER,
  p_balls_faced        INTEGER,
  p_fours              INTEGER,
  p_sixes              INTEGER,
  p_is_out             BOOLEAN,
  p_wickets            INTEGER,
  p_balls_bowled       INTEGER,
  p_runs_conceded      INTEGER,
  p_maidens            INTEGER,
  p_catches            INTEGER,
  p_stumpings          INTEGER,
  p_run_outs_direct    INTEGER,
  p_run_outs_indir     INTEGER,
  p_lbw_bowled_wickets INTEGER DEFAULT 0
) RETURNS DECIMAL(8,2) AS $$
DECLARE
  pts          DECIMAL(8,2) := 0;
  economy_rate DECIMAL(8,2);
  overs        DECIMAL(8,2);
BEGIN
  -- ── Batting ──────────────────────────────────────────────
  pts := pts + p_runs;
  pts := pts + p_fours;
  pts := pts + (p_sixes * 2);

  IF p_runs >= 100 THEN
    pts := pts + 16;
  ELSIF p_runs >= 50 THEN
    pts := pts + 8;
  ELSIF p_runs >= 30 THEN
    pts := pts + 4;
  END IF;

  IF p_is_out AND p_runs = 0 THEN
    pts := pts - 2;
  END IF;

  -- ── Bowling ──────────────────────────────────────────────
  pts := pts + (p_wickets * 25);
  pts := pts + (p_lbw_bowled_wickets * 8);

  IF p_wickets >= 5 THEN
    pts := pts + 16;
  ELSIF p_wickets >= 4 THEN
    pts := pts + 8;
  ELSIF p_wickets >= 3 THEN
    pts := pts + 4;
  END IF;

  pts := pts + (p_maidens * 12);

  IF p_balls_bowled >= 12 THEN                      -- min 2 overs
    overs        := p_balls_bowled::DECIMAL / 6;
    economy_rate := p_runs_conceded::DECIMAL / overs;

    IF    economy_rate < 5  THEN pts := pts + 6;
    ELSIF economy_rate < 6  THEN pts := pts + 4;
    ELSIF economy_rate < 7  THEN pts := pts + 2;
    ELSIF economy_rate < 10 THEN pts := pts + 0;
    ELSIF economy_rate < 11 THEN pts := pts - 2;
    ELSIF economy_rate < 12 THEN pts := pts - 4;
    ELSE                         pts := pts - 6;
    END IF;
  END IF;

  -- ── Fielding ─────────────────────────────────────────────
  pts := pts + (p_catches * 8);
  IF p_catches >= 3 THEN
    pts := pts + 4;
  END IF;
  pts := pts + (p_stumpings * 12);
  pts := pts + (p_run_outs_direct * 12);
  pts := pts + (p_run_outs_indir * 6);

  RETURN pts;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
