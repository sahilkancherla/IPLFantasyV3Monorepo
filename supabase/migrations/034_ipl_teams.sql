-- ipl_teams: lookup table for the 10 IPL franchises with display name,
-- short abbreviation, slug, and the public storage path of their logo.
-- Used by the mobile app to render team logos and abbreviations without
-- hardcoding metadata in the client.

CREATE TABLE IF NOT EXISTS ipl_teams (
  slug         TEXT PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  abbrev       TEXT NOT NULL,
  logo_path    TEXT NOT NULL,        -- relative path inside the team-logos bucket
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: read open to anyone authenticated; writes service-role only.
ALTER TABLE ipl_teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ipl_teams_select ON ipl_teams;
CREATE POLICY ipl_teams_select ON ipl_teams
  FOR SELECT TO authenticated USING (true);

INSERT INTO ipl_teams (slug, name, abbrev, logo_path, display_order) VALUES
  ('chennai-super-kings',         'Chennai Super Kings',         'CSK',  'chennai-super-kings.png',         1),
  ('delhi-capitals',              'Delhi Capitals',              'DC',   'delhi-capitals.png',              2),
  ('gujarat-titans',              'Gujarat Titans',              'GT',   'gujarat-titans.png',              3),
  ('kolkata-knight-riders',       'Kolkata Knight Riders',       'KKR',  'kolkata-knight-riders.png',       4),
  ('lucknow-super-giants',        'Lucknow Super Giants',        'LSG',  'lucknow-super-giants.png',        5),
  ('mumbai-indians',              'Mumbai Indians',              'MI',   'mumbai-indians.png',              6),
  ('punjab-kings',                'Punjab Kings',                'PBKS', 'punjab-kings.png',                7),
  ('rajasthan-royals',            'Rajasthan Royals',            'RR',   'rajasthan-royals.png',            8),
  ('royal-challengers-bengaluru', 'Royal Challengers Bengaluru', 'RCB',  'royal-challengers-bengaluru.png', 9),
  ('sunrisers-hyderabad',         'Sunrisers Hyderabad',         'SRH',  'sunrisers-hyderabad.png',         10)
ON CONFLICT (slug) DO UPDATE SET
  name          = EXCLUDED.name,
  abbrev        = EXCLUDED.abbrev,
  logo_path     = EXCLUDED.logo_path,
  display_order = EXCLUDED.display_order;
