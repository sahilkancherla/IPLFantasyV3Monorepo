-- ============================================================
-- 002_rls.sql — Row Level Security policies
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_player_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_rosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_cache ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- profiles
-- ============================================================
CREATE POLICY "Users can read all profiles"
  ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);

-- ============================================================
-- players (public read)
-- ============================================================
CREATE POLICY "Anyone can read players"
  ON players FOR SELECT TO authenticated USING (true);

-- ============================================================
-- leagues
-- ============================================================
CREATE POLICY "Members can read their leagues"
  ON leagues FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT league_id FROM league_members WHERE user_id = auth.uid()
    )
  );

-- Service role handles writes (backend uses service_role key)

-- ============================================================
-- league_members
-- ============================================================
CREATE POLICY "Members can read league_members for their leagues"
  ON league_members FOR SELECT TO authenticated
  USING (
    league_id IN (
      SELECT league_id FROM league_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- auction_sessions
-- ============================================================
CREATE POLICY "Members can read auction sessions for their leagues"
  ON auction_sessions FOR SELECT TO authenticated
  USING (
    league_id IN (
      SELECT league_id FROM league_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- auction_player_queue
-- ============================================================
CREATE POLICY "Members can read auction queue for their leagues"
  ON auction_player_queue FOR SELECT TO authenticated
  USING (
    league_id IN (
      SELECT league_id FROM league_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- bids
-- ============================================================
CREATE POLICY "Members can read bids for their leagues"
  ON bids FOR SELECT TO authenticated
  USING (
    session_id IN (
      SELECT id FROM auction_sessions
      WHERE league_id IN (
        SELECT league_id FROM league_members WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================================
-- team_rosters
-- ============================================================
CREATE POLICY "Members can read team rosters for their leagues"
  ON team_rosters FOR SELECT TO authenticated
  USING (
    league_id IN (
      SELECT league_id FROM league_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- match_scores (public read for authenticated)
-- ============================================================
CREATE POLICY "Authenticated users can read match scores"
  ON match_scores FOR SELECT TO authenticated USING (true);

-- ============================================================
-- leaderboard_cache
-- ============================================================
CREATE POLICY "Members can read leaderboard for their leagues"
  ON leaderboard_cache FOR SELECT TO authenticated
  USING (
    league_id IN (
      SELECT league_id FROM league_members WHERE user_id = auth.uid()
    )
  );
