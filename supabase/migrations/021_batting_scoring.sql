-- Update batting scoring rules:
--   Milestone bonuses are mutually exclusive (only highest applies):
--     30+ runs: +4 pts
--     50+ runs: +8 pts  (was +10, supersedes 30-run bonus)
--     100+ runs: +16 pts (was +25, supersedes 30 and 50 bonuses)
--   Duck penalty: -2 pts (was -5)
--   Strike rate bonuses removed

CREATE OR REPLACE FUNCTION calc_fantasy_points(
  p_runs            INTEGER,
  p_balls_faced     INTEGER,
  p_fours           INTEGER,
  p_sixes           INTEGER,
  p_is_out          BOOLEAN,
  p_wickets         INTEGER,
  p_balls_bowled    INTEGER,
  p_runs_conceded   INTEGER,
  p_maidens         INTEGER,
  p_catches         INTEGER,
  p_stumpings       INTEGER,
  p_run_outs_direct INTEGER,
  p_run_outs_indir  INTEGER
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
  pts := pts + (p_wickets * 20);                    -- 20 pts per wicket

  IF p_wickets >= 5 THEN
    pts := pts + 30;
  ELSIF p_wickets >= 4 THEN
    pts := pts + 20;
  ELSIF p_wickets >= 3 THEN
    pts := pts + 10;
  END IF;

  pts := pts + (p_maidens * 5);                     -- 5 pts per maiden

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
