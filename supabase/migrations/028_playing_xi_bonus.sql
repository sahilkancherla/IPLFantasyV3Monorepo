-- Add is_in_xi flag to match_scores.
-- Players in the playing XI get a free +4 bonus points.
-- Default TRUE so existing records automatically receive the bonus.

ALTER TABLE match_scores ADD COLUMN is_in_xi BOOLEAN NOT NULL DEFAULT TRUE;

-- Update calc_fantasy_points to accept p_in_xi (defaults TRUE for backwards compat).
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
  p_lbw_bowled_wickets INTEGER DEFAULT 0,
  p_role               TEXT    DEFAULT 'batsman',
  p_in_xi              BOOLEAN DEFAULT TRUE
) RETURNS DECIMAL(8,2) AS $$
DECLARE
  pts          DECIMAL(8,2) := 0;
  strike_rate  DECIMAL(8,2);
  economy_rate DECIMAL(8,2);
  overs        DECIMAL(8,2);
BEGIN
  -- ── Playing XI bonus ─────────────────────────────────────
  IF p_in_xi THEN
    pts := pts + 4;
  END IF;

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

  IF p_balls_bowled >= 12 THEN
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

  -- ── Strike Rate (batsman / wicket_keeper / all_rounder only) ────────────
  IF p_role IN ('batsman', 'wicket_keeper', 'all_rounder')
     AND p_balls_faced > 0
     AND (p_balls_faced >= 10 OR p_runs >= 20)
  THEN
    strike_rate := (p_runs::DECIMAL / p_balls_faced) * 100;

    IF    strike_rate < 50  THEN pts := pts - 6;
    ELSIF strike_rate < 60  THEN pts := pts - 4;
    ELSIF strike_rate < 70  THEN pts := pts - 2;
    ELSIF strike_rate < 130 THEN pts := pts + 0;
    ELSIF strike_rate < 150 THEN pts := pts + 2;
    ELSIF strike_rate < 170 THEN pts := pts + 4;
    ELSE                         pts := pts + 6;
    END IF;
  END IF;

  RETURN pts;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
