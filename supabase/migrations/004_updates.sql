-- ============================================================
-- 004_updates.sql — Schema updates for full fantasy season
-- ============================================================

-- ── profiles ────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL DEFAULT '';

-- Backfill from username/display_name for existing rows
UPDATE profiles SET full_name = COALESCE(display_name, username) WHERE full_name = '';

-- ── leagues ─────────────────────────────────────────────────
-- Replace old status enum with new four-stage enum
ALTER TABLE leagues
  DROP CONSTRAINT IF EXISTS leagues_status_check;

ALTER TABLE leagues
  ADD CONSTRAINT leagues_status_check
  CHECK (status IN ('draft_pending','draft_active','league_active','league_complete'));

-- Migrate old status values
UPDATE leagues SET status = 'draft_pending'   WHERE status IN ('setup','auction_pending');
UPDATE leagues SET status = 'draft_active'    WHERE status = 'auction_live';
UPDATE leagues SET status = 'league_active'   WHERE status = 'post_auction';
UPDATE leagues SET status = 'league_complete' WHERE status = 'active';

-- Rename / add columns
ALTER TABLE leagues
  RENAME COLUMN max_members TO max_teams;

ALTER TABLE leagues
  ALTER COLUMN max_teams SET DEFAULT 6;

ALTER TABLE leagues
  ADD COLUMN IF NOT EXISTS roster_size        INTEGER NOT NULL DEFAULT 16,
  ADD COLUMN IF NOT EXISTS trade_deadline_week INTEGER,
  ADD COLUMN IF NOT EXISTS veto_hours          INTEGER NOT NULL DEFAULT 24;

-- ── league_members ───────────────────────────────────────────
ALTER TABLE league_members
  RENAME COLUMN squad_count TO roster_count;

ALTER TABLE league_members
  ADD COLUMN IF NOT EXISTS waiver_priority INTEGER NOT NULL DEFAULT 0;

-- ── match_scores — add detailed batting/bowling stats ────────
ALTER TABLE match_scores
  ADD COLUMN IF NOT EXISTS ipl_week          INTEGER,
  ADD COLUMN IF NOT EXISTS balls_faced       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fours             INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sixes             INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_out            BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS balls_bowled      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS runs_conceded     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS maidens           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS run_outs_direct   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS run_outs_indirect INTEGER NOT NULL DEFAULT 0;

-- ── leaderboard_cache — add W/L ──────────────────────────────
ALTER TABLE leaderboard_cache
  ADD COLUMN IF NOT EXISTS wins   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS losses INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- NEW TABLES
-- ============================================================

-- ipl_weeks — maps calendar weeks to IPL match windows
CREATE TABLE IF NOT EXISTS ipl_weeks (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  week_num   INTEGER NOT NULL UNIQUE,
  label      TEXT    NOT NULL,
  start_date DATE    NOT NULL,
  end_date   DATE    NOT NULL,
  lock_time  TIMESTAMPTZ NOT NULL,
  is_playoff BOOLEAN NOT NULL DEFAULT FALSE
);

-- Add FK from match_scores to ipl_weeks
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'match_scores_ipl_week_fk' AND table_name = 'match_scores'
  ) THEN
    ALTER TABLE match_scores
      ADD CONSTRAINT match_scores_ipl_week_fk
      FOREIGN KEY (ipl_week) REFERENCES ipl_weeks(week_num) ON DELETE SET NULL;
  END IF;
END; $$;

-- weekly_matchups — auto-generated round-robin per league
CREATE TABLE IF NOT EXISTS weekly_matchups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id   UUID    NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  week_num    INTEGER NOT NULL REFERENCES ipl_weeks(week_num),
  home_user   UUID    NOT NULL REFERENCES profiles(id),
  away_user   UUID    NOT NULL REFERENCES profiles(id),
  home_points DECIMAL(10,2) NOT NULL DEFAULT 0,
  away_points DECIMAL(10,2) NOT NULL DEFAULT 0,
  winner_id   UUID REFERENCES profiles(id),
  is_final    BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (league_id, week_num, home_user),
  UNIQUE (league_id, week_num, away_user)
);

-- weekly_lineups — manager's starting 11 for a given week
CREATE TABLE IF NOT EXISTS weekly_lineups (
  id        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID    NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id   UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_num  INTEGER NOT NULL REFERENCES ipl_weeks(week_num),
  player_id UUID    NOT NULL REFERENCES players(id),
  slot_role TEXT    NOT NULL CHECK (slot_role IN ('batsman','bowler','all_rounder','wicket_keeper')),
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  set_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (league_id, user_id, week_num, player_id)
);
CREATE INDEX IF NOT EXISTS weekly_lineups_week_idx ON weekly_lineups (league_id, week_num);

-- waiver_claims
CREATE TABLE IF NOT EXISTS waiver_claims (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id       UUID    NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  claimant_id     UUID    NOT NULL REFERENCES profiles(id),
  claim_player_id UUID    NOT NULL REFERENCES players(id),
  drop_player_id  UUID    NOT NULL REFERENCES players(id),
  status          TEXT    NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','granted','denied','cancelled')),
  priority_at_submission INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS waiver_claims_league_idx ON waiver_claims (league_id, status);

-- trade_proposals
CREATE TABLE IF NOT EXISTS trade_proposals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id    UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  proposer_id  UUID NOT NULL REFERENCES profiles(id),
  receiver_id  UUID NOT NULL REFERENCES profiles(id),
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','accepted','rejected','vetoed','cancelled','expired')),
  veto_deadline TIMESTAMPTZ,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS trade_proposals_league_idx ON trade_proposals (league_id, status);

-- trade_items — players exchanged in a trade
CREATE TABLE IF NOT EXISTS trade_items (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id  UUID NOT NULL REFERENCES trade_proposals(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id),
  from_user UUID NOT NULL REFERENCES profiles(id),
  to_user   UUID NOT NULL REFERENCES profiles(id)
);

-- ============================================================
-- DB FUNCTIONS
-- ============================================================

-- Fantasy point calculation (pure function, no side effects)
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
  strike_rate  DECIMAL(8,2);
  economy_rate DECIMAL(8,2);
  overs        DECIMAL(8,2);
BEGIN
  -- ── Batting ──────────────────────────────────────────────
  pts := pts + p_runs;                              -- 1 pt per run
  pts := pts + p_fours;                             -- +1 per 4
  pts := pts + (p_sixes * 2);                       -- +2 per 6

  IF p_runs >= 100 THEN
    pts := pts + 25;                                -- century bonus
  ELSIF p_runs >= 50 THEN
    pts := pts + 10;                                -- half-century bonus
  END IF;

  IF p_is_out AND p_runs = 0 THEN
    pts := pts - 5;                                 -- duck penalty
  END IF;

  IF p_balls_faced >= 10 THEN
    strike_rate := (p_runs::DECIMAL / p_balls_faced) * 100;
    IF strike_rate >= 150 THEN
      pts := pts + 5;
    ELSIF strike_rate < 70 THEN
      pts := pts - 5;
    END IF;
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

-- Generate round-robin matchup schedule for a league
-- Called when admin transitions league_active
CREATE OR REPLACE FUNCTION generate_schedule(p_league_id UUID) RETURNS VOID AS $$
DECLARE
  members     UUID[];
  n           INTEGER;
  week_row    RECORD;
  week_index  INTEGER := 0;
  i           INTEGER;
  j           INTEGER;
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

  -- Round-robin scheduling (circle method)
  -- If odd number of teams, add a bye (NULL)
  IF n % 2 = 1 THEN
    members := members || ARRAY[NULL::UUID];
    n := n + 1;
  END IF;

  fixed    := members[1];
  rotation := members[2:n];

  FOR week_row IN
    SELECT week_num FROM ipl_weeks WHERE NOT is_playoff ORDER BY week_num
  LOOP
    week_index := week_index + 1;

    -- Build schedule for this round
    -- pair fixed with rotation[1], then rotation[n/2] vs rotation[2], etc.
    FOR i IN 1..n/2 LOOP
      IF i = 1 THEN
        home_id := fixed;
        away_id := rotation[1];
      ELSE
        home_id := rotation[i];
        away_id := rotation[n - i];
      END IF;

      -- Skip bye (NULL) matchups
      IF home_id IS NOT NULL AND away_id IS NOT NULL THEN
        INSERT INTO weekly_matchups (league_id, week_num, home_user, away_user)
        VALUES (p_league_id, week_row.week_num, home_id, away_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;

    -- Rotate: move rotation[n-1] to front
    rotation := rotation[n-1:n-1] || rotation[1:n-2];
    week_index := week_index + 1;
    EXIT WHEN week_index > 20; -- safety cap
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Finalize a week: sum starter points, update matchup winner, update leaderboard
CREATE OR REPLACE FUNCTION finalize_week(p_league_id UUID, p_week_num INTEGER) RETURNS VOID AS $$
DECLARE
  matchup RECORD;
  home_pts DECIMAL(10,2);
  away_pts DECIMAL(10,2);
  winner   UUID;
BEGIN
  FOR matchup IN
    SELECT * FROM weekly_matchups
    WHERE league_id = p_league_id AND week_num = p_week_num AND is_final = FALSE
  LOOP
    -- Sum points for home team's starters this week
    SELECT COALESCE(SUM(ms.fantasy_points), 0)
    INTO home_pts
    FROM weekly_lineups wl
    JOIN match_scores ms ON ms.player_id = wl.player_id AND ms.ipl_week = p_week_num
    WHERE wl.league_id = p_league_id
      AND wl.user_id   = matchup.home_user
      AND wl.week_num  = p_week_num;

    -- Sum points for away team's starters this week
    SELECT COALESCE(SUM(ms.fantasy_points), 0)
    INTO away_pts
    FROM weekly_lineups wl
    JOIN match_scores ms ON ms.player_id = wl.player_id AND ms.ipl_week = p_week_num
    WHERE wl.league_id = p_league_id
      AND wl.user_id   = matchup.away_user
      AND wl.week_num  = p_week_num;

    winner := CASE
      WHEN home_pts > away_pts THEN matchup.home_user
      WHEN away_pts > home_pts THEN matchup.away_user
      ELSE NULL  -- tie — no winner recorded
    END;

    -- Update matchup
    UPDATE weekly_matchups
    SET home_points = home_pts,
        away_points = away_pts,
        winner_id   = winner,
        is_final    = TRUE
    WHERE id = matchup.id;

    -- Update leaderboard W/L/pts for home
    INSERT INTO leaderboard_cache (league_id, user_id, wins, losses, total_points, last_updated)
    VALUES (p_league_id, matchup.home_user,
            CASE WHEN matchup.home_user = winner THEN 1 ELSE 0 END,
            CASE WHEN matchup.away_user = winner THEN 1 ELSE 0 END,
            home_pts, NOW())
    ON CONFLICT (league_id, user_id) DO UPDATE
      SET wins         = leaderboard_cache.wins + EXCLUDED.wins,
          losses       = leaderboard_cache.losses + EXCLUDED.losses,
          total_points = leaderboard_cache.total_points + EXCLUDED.total_points,
          last_updated = NOW();

    -- Update leaderboard W/L/pts for away
    INSERT INTO leaderboard_cache (league_id, user_id, wins, losses, total_points, last_updated)
    VALUES (p_league_id, matchup.away_user,
            CASE WHEN matchup.away_user = winner THEN 1 ELSE 0 END,
            CASE WHEN matchup.home_user = winner THEN 1 ELSE 0 END,
            away_pts, NOW())
    ON CONFLICT (league_id, user_id) DO UPDATE
      SET wins         = leaderboard_cache.wins + EXCLUDED.wins,
          losses       = leaderboard_cache.losses + EXCLUDED.losses,
          total_points = leaderboard_cache.total_points + EXCLUDED.total_points,
          last_updated = NOW();
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Update handle_new_user trigger to include full_name
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, full_name, display_name)
  VALUES (
    NEW.id,
    split_part(NEW.email, '@', 1),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
