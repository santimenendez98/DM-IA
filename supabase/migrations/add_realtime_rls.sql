-- ── Realtime RLS policies ─────────────────────────────────────
-- Run this in the Supabase SQL editor.

-- 1. Campaign members (owner OR player with a character) can SELECT messages.
DROP POLICY IF EXISTS "Campaign members can read messages" ON campaign_messages;
CREATE POLICY "Campaign members can read messages"
ON campaign_messages FOR SELECT TO authenticated
USING (
  campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
  OR campaign_id IN (
    SELECT cc.campaign_id FROM campaign_characters cc
    JOIN characters ch ON ch.id = cc.character_id
    WHERE ch.user_id = auth.uid()
  )
);

-- 2. Campaign members can SELECT campaign_characters (see who's in the party).
DROP POLICY IF EXISTS "Campaign members can read party" ON campaign_characters;
CREATE POLICY "Campaign members can read party"
ON campaign_characters FOR SELECT TO authenticated
USING (
  campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid())
  OR character_id IN (SELECT id FROM characters WHERE user_id = auth.uid())
);

-- 3. Campaign participants can SELECT campaigns they belong to.
--    (Extends the existing owner/public policy to include private-but-joined campaigns.)
DROP POLICY IF EXISTS "Campaign participants can read campaigns" ON campaigns;
CREATE POLICY "Campaign participants can read campaigns"
ON campaigns FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR is_public = true
  OR id IN (
    SELECT cc.campaign_id FROM campaign_characters cc
    JOIN characters ch ON ch.id = cc.character_id
    WHERE ch.user_id = auth.uid()
  )
);

-- 4. Add tables to the realtime publication (safe – ignores if already present).
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE campaign_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE campaign_characters;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE campaigns;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
