-- Add story_context column to campaigns
-- Stores the pre-existing world/story context fed to the DM AI.
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS story_context TEXT NULL;
