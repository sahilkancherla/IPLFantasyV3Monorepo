-- Add team_name to league_members
ALTER TABLE league_members ADD COLUMN team_name TEXT NOT NULL DEFAULT '';
