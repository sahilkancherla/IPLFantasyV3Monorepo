-- app_settings: simple key/value store for runtime toggles controlled by
-- super admins. Avoids hardcoding feature flags in the client bundle and
-- means a flip propagates to all clients without redeploying.

CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES profiles(id)
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_settings_select ON app_settings;
CREATE POLICY app_settings_select ON app_settings
  FOR SELECT TO authenticated USING (true);

-- Seed: images on by default. Stored as JSONB so we can extend the same
-- mechanism to future settings without schema changes.
INSERT INTO app_settings (key, value) VALUES
  ('images_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;
