-- price_snapshots was keyed only by card_id -> cards(id), but the cards table
-- is not synced. Key snapshots by card name so history accrues per card
-- directly from the price API.
ALTER TABLE price_snapshots ADD COLUMN IF NOT EXISTS card_name TEXT;
CREATE INDEX IF NOT EXISTS price_snapshots_card_name_idx
  ON price_snapshots (card_name, recorded_at DESC);
