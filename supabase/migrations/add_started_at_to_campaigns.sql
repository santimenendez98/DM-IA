-- Add started_at column to campaigns.
-- Tracks when a campaign's first play session began.

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NULL;

-- ── Trigger: auto-stamp started_at on first message ──────────────────────────
-- Fires on every INSERT into campaign_messages. If the parent campaign has no
-- started_at yet, it stamps it now. This is the canonical source of truth —
-- client-side PATCH calls are belt-and-suspenders on top of this.

CREATE OR REPLACE FUNCTION stamp_campaign_started()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE campaigns
  SET    started_at = NOW()
  WHERE  id = NEW.campaign_id
    AND  started_at IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_stamp_campaign_started ON campaign_messages;

CREATE TRIGGER trg_stamp_campaign_started
  AFTER INSERT ON campaign_messages
  FOR EACH ROW
  EXECUTE FUNCTION stamp_campaign_started();

-- ── Backfill: stamp campaigns that already have messages ─────────────────────
UPDATE campaigns c
SET    started_at = (
  SELECT MIN(created_at)
  FROM   campaign_messages m
  WHERE  m.campaign_id = c.id
)
WHERE  started_at IS NULL
  AND  EXISTS (
    SELECT 1 FROM campaign_messages m WHERE m.campaign_id = c.id
  );
