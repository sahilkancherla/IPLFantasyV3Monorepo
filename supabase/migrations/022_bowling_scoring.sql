-- Add lbw_bowled_wickets column to match_scores
-- (count of wickets taken via LBW or bowled dismissal, for +8 pts each)
ALTER TABLE match_scores
  ADD COLUMN IF NOT EXISTS lbw_bowled_wickets INTEGER NOT NULL DEFAULT 0;

-- Update bowling scoring rules:
--   Per wicket: 25 pts (was 20)
--   LBW/bowled wicket: +8 pts each (new)
--   Maiden over: 12 pts (was 5)
--   Haul bonuses are mutually exclusive (only highest applies):
--     3 wickets: +4 pts (was +10)
--     4 wickets: +8 pts (was +20)
--     5 wickets: +16 pts (was +30)

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
  pts := pts + p_runs;                              -- 1 pt per run
  pts := pts + p_fours;                             -- +1 per 4
  pts := pts + (p_sixes * 2);                       -- +2 per 6

  -- Milestone bonuses are mutually exclusive — only the highest applies
  IF p_runs >= 100 THEN
    pts := pts + 16;                                -- century bonus
  ELSIF p_runs >= 50 THEN
    pts := pts + 8;                                 -- half-century bonus
  ELSIF p_runs >= 30 THEN
    pts := pts + 4;                                 -- 30-run bonus
  END IF;

  IF p_is_out AND p_runs = 0 THEN
    pts := pts - 2;                                 -- duck penalty
  END IF;

  -- ── Bowling ──────────────────────────────────────────────
  pts := pts + (p_wickets * 25);                    -- 25 pts per wicket
  pts := pts + (p_lbw_bowled_wickets * 8);          -- +8 per LBW/bowled wicket

  -- Haul bonuses are mutually exclusive — only the highest applies
  IF p_wickets >= 5 THEN
    pts := pts + 16;
  ELSIF p_wickets >= 4 THEN
    pts := pts + 8;
  ELSIF p_wickets >= 3 THEN
    pts := pts + 4;
  END IF;

  pts := pts + (p_maidens * 12);                    -- 12 pts per maiden

  IF p_balls_bowled >= 24 THEN                      -- min 4 overs
    overs := p_balls_bowled::DECIMAL / 6;
    economy_rate := p_runs_conceded::DECIMAL / overs;
    IF economy_rate < 6 THEN
      pts := pts + 5;
    ELSIF economy_rate > 10 THEN
      pts := pts - 5;
    END IF;
  END IF;

  -- ── Fielding ─────────────────────────────────────────────
  pts := pts + (p_catches * 5);
  pts := pts + (p_stumpings * 10);
  pts := pts + (p_run_outs_direct * 10);
  pts := pts + (p_run_outs_indir * 5);

  RETURN pts;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
