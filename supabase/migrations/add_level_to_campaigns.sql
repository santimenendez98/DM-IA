-- Add party level to campaigns
-- Can be set at creation and auto-increments when the DM authorizes a level-up.

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1;
