-- Tracks when the DM removes a character from an active campaign.
-- Distinct from is_dead / died_in_campaign_id (which records AI-triggered combat death).
-- No FK constraint so the data persists after the campaign is deleted.

ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS expelled_from_campaign_id   UUID,
  ADD COLUMN IF NOT EXISTS expelled_from_campaign_name TEXT;
