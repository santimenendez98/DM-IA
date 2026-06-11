-- Add game_language column to campaigns
-- Stores the language the DM AI will use in this campaign.
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS game_language TEXT NOT NULL DEFAULT 'es';
