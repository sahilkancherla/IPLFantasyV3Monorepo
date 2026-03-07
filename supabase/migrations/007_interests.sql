-- Player interests: users mark players they want prioritized in the draft queue
CREATE TABLE IF NOT EXISTS player_interests (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id  UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  player_id  UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (league_id, user_id, player_id)
);

CREATE INDEX IF NOT EXISTS player_interests_league_idx ON player_interests (league_id);
CREATE INDEX IF NOT EXISTS player_interests_user_idx   ON player_interests (league_id, user_id);
