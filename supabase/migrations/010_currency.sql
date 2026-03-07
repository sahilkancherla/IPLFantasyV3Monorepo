-- Add currency setting to leagues (usd or lakhs)
ALTER TABLE leagues
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'lakhs'
    CHECK (currency IN ('usd', 'lakhs'));
