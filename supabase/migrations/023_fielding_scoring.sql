-- Update fielding scoring rules:
--   Catch: 8 pts each (was 5) + 4 pt bonus for 3+ catches in a match
--   Stumping: 12 pts (was 10)
--   Run out (only player involved): 12 pts (was 10)
--   Run out (multiple players involved): 6 pts (was 5)

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

  IF p_balls_bowled >= 24 THEN
    overs := p_balls_bowled::DECIMAL / 6;
    economy_rate := p_runs_conceded::DECIMAL / overs;
    IF economy_rate < 6 THEN
      pts := pts + 5;
    ELSIF economy_rate > 10 THEN
      pts := pts - 5;
    END IF;
  END IF;

  -- ── Fielding ─────────────────────────────────────────────
  pts := pts + (p_catches * 8);
  IF p_catches >= 3 THEN
    pts := pts + 4;                                 -- 3-catch bonus
  END IF;
  pts := pts + (p_stumpings * 12);
  pts := pts + (p_run_outs_direct * 12);            -- only player involved
  pts := pts + (p_run_outs_indir * 6);              -- multiple players involved

  RETURN pts;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
