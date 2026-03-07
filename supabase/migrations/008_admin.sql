-- IPL Matches table for admin-entered game data
CREATE TABLE IF NOT EXISTS ipl_matches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id     TEXT NOT NULL UNIQUE,
  home_team    TEXT NOT NULL,
  away_team    TEXT NOT NULL,
  match_date   DATE NOT NULL,
  week_num     INTEGER REFERENCES ipl_weeks(week_num),
  venue        TEXT,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- System-wide key-value settings
CREATE TABLE IF NOT EXISTS system_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO system_settings (key, value)
VALUES ('current_week', '1')
ON CONFLICT (key) DO NOTHING;
