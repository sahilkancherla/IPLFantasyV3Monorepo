-- ============================================================
-- 001_schema.sql — Full IPL Fantasy schema
-- ============================================================

-- profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      TEXT NOT NULL UNIQUE,
  display_name  TEXT,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- players (static IPL player database)
CREATE TABLE IF NOT EXISTS players (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  ipl_team       TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('batsman','bowler','all_rounder','wicket_keeper')),
  base_price     INTEGER NOT NULL DEFAULT 200,
  nationality    TEXT NOT NULL DEFAULT 'Indian',
  image_url      TEXT,
  ipl_season     INTEGER NOT NULL DEFAULT 2025,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- leagues
CREATE TABLE IF NOT EXISTS leagues (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  invite_code      TEXT NOT NULL UNIQUE,
  admin_id         UUID NOT NULL REFERENCES profiles(id),
  starting_budget  INTEGER NOT NULL DEFAULT 1000,
  max_squad_size   INTEGER NOT NULL DEFAULT 15,
  max_members      INTEGER NOT NULL DEFAULT 10,
  status           TEXT NOT NULL DEFAULT 'setup'
                   CHECK (status IN ('setup','auction_pending','auction_live','post_auction','active')),
  bid_timeout_secs INTEGER NOT NULL DEFAULT 15,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- league_members
CREATE TABLE IF NOT EXISTS league_members (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id        UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  remaining_budget INTEGER NOT NULL,
  squad_count      INTEGER NOT NULL DEFAULT 0,
  joined_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (league_id, user_id)
);

-- auction_sessions
CREATE TABLE IF NOT EXISTS auction_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id         UUID NOT NULL UNIQUE REFERENCES leagues(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','live','paused','completed')),
  current_player_id UUID REFERENCES players(id),
  current_bid       INTEGER,
  current_bidder_id UUID REFERENCES profiles(id),
  timer_expires_at  TIMESTAMPTZ,
  players_sold      INTEGER NOT NULL DEFAULT 0,
  players_unsold    INTEGER NOT NULL DEFAULT 0,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- auction_player_queue
CREATE TABLE IF NOT EXISTS auction_player_queue (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id      UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  player_id      UUID NOT NULL REFERENCES players(id),
  queue_position INTEGER NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','live','sold','unsold')),
  sold_to        UUID REFERENCES profiles(id),
  sold_price     INTEGER,
  UNIQUE (league_id, player_id),
  UNIQUE (league_id, queue_position)
);

-- bids (append-only audit log)
CREATE TABLE IF NOT EXISTS bids (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES auction_sessions(id) ON DELETE CASCADE,
  player_id   UUID NOT NULL REFERENCES players(id),
  bidder_id   UUID NOT NULL REFERENCES profiles(id),
  amount      INTEGER NOT NULL,
  placed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS bids_session_player_idx ON bids (session_id, player_id, placed_at DESC);

-- team_rosters
CREATE TABLE IF NOT EXISTS team_rosters (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id   UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  player_id   UUID NOT NULL REFERENCES players(id),
  price_paid  INTEGER NOT NULL,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (league_id, player_id)
);

-- match_scores
CREATE TABLE IF NOT EXISTS match_scores (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id      UUID NOT NULL REFERENCES players(id),
  match_id       TEXT NOT NULL,
  match_date     DATE NOT NULL,
  fantasy_points DECIMAL(6,2) NOT NULL DEFAULT 0,
  runs_scored    INTEGER DEFAULT 0,
  wickets_taken  INTEGER DEFAULT 0,
  catches        INTEGER DEFAULT 0,
  stumpings      INTEGER DEFAULT 0,
  run_outs       INTEGER DEFAULT 0,
  raw_data       JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_id, match_id)
);

-- leaderboard_cache
CREATE TABLE IF NOT EXISTS leaderboard_cache (
  league_id    UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_points DECIMAL(10,2) NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (league_id, user_id)
);

-- ============================================================
-- DB Functions & Triggers
-- ============================================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name)
  VALUES (NEW.id, NEW.email, split_part(NEW.email, '@', 1))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Generate invite code
CREATE OR REPLACE FUNCTION generate_invite_code() RETURNS TEXT AS $$
  SELECT upper(substring(md5(random()::text) FROM 1 FOR 6));
$$ LANGUAGE sql;

-- Refresh leaderboard for a league
CREATE OR REPLACE FUNCTION refresh_leaderboard(p_league_id UUID) RETURNS VOID AS $$
BEGIN
  INSERT INTO leaderboard_cache (league_id, user_id, total_points, last_updated)
  SELECT tr.league_id, tr.user_id, COALESCE(SUM(ms.fantasy_points), 0), NOW()
  FROM team_rosters tr
  LEFT JOIN match_scores ms ON ms.player_id = tr.player_id
  WHERE tr.league_id = p_league_id
  GROUP BY tr.league_id, tr.user_id
  ON CONFLICT (league_id, user_id)
  DO UPDATE SET total_points = EXCLUDED.total_points, last_updated = NOW();
END;
$$ LANGUAGE plpgsql;
