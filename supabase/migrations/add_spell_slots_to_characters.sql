-- Add spell slot tracking to characters.
-- spell_slots_used stores how many slots of each level have been used.
-- Keys are spell levels (1-9), values are used count.
-- An empty object ({}) means all slots are available (full recovery).
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS spell_slots_used jsonb NOT NULL DEFAULT '{}';
