-- MTG Intel Platform — Initial Schema
-- Run this in Supabase SQL editor or via supabase db push

-- Cards table (synced from Scryfall bulk data)
CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scryfall_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  set_code TEXT NOT NULL,
  collector_number TEXT,
  rarity TEXT,
  mana_cost TEXT,
  type_line TEXT,
  oracle_text TEXT,
  image_uri TEXT,
  legalities JSONB DEFAULT '{}',
  reserved BOOLEAN DEFAULT false,
  edhrec_rank INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cards_name_idx ON cards(name);
CREATE INDEX IF NOT EXISTS cards_set_code_idx ON cards(set_code);

-- Price snapshots
CREATE TABLE IF NOT EXISTS price_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('mtgstocks', 'mtggoldfish', 'tcgplayer', 'scryfall')),
  price_usd DECIMAL(10,2),
  price_usd_foil DECIMAL(10,2),
  recorded_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS price_snapshots_card_idx ON price_snapshots(card_id, recorded_at DESC);

-- Intel signals (Phase 2)
CREATE TABLE IF NOT EXISTS intel_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES cards(id) ON DELETE SET NULL,
  card_name_raw TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('youtube', 'reddit', 'news', 'mtggoldfish')),
  source_url TEXT,
  source_title TEXT,
  sentiment TEXT CHECK (sentiment IN ('bullish', 'bearish', 'neutral')),
  signal_strength INTEGER CHECK (signal_strength BETWEEN 1 AND 10),
  summary TEXT,
  raw_excerpt TEXT,
  published_at TIMESTAMPTZ,
  ingested_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS intel_signals_card_idx ON intel_signals(card_id, ingested_at DESC);
CREATE INDEX IF NOT EXISTS intel_signals_sentiment_idx ON intel_signals(sentiment, signal_strength DESC);

-- YouTube channels
CREATE TABLE IF NOT EXISTS yt_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT UNIQUE NOT NULL,
  channel_name TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ,
  active BOOLEAN DEFAULT true
);

-- Seed tracked channels
INSERT INTO yt_channels (channel_id, channel_name) VALUES
  ('UCTp-iVOtTrKau0skmfZlo5Q', 'Alpha Investments'),
  ('UCnfVFv4Ixv-IG9roR6YGLzQ', 'Tolarian Community College'),
  ('UCZAzmjABNeQ8nFubzE-e8qg', 'MTGGoldfish')
ON CONFLICT (channel_id) DO NOTHING;

-- Reddit posts (Phase 2)
CREATE TABLE IF NOT EXISTS reddit_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id TEXT UNIQUE NOT NULL,
  subreddit TEXT NOT NULL,
  title TEXT,
  url TEXT,
  score INTEGER,
  processed BOOLEAN DEFAULT false,
  created_utc TIMESTAMPTZ,
  ingested_at TIMESTAMPTZ DEFAULT now()
);

-- Future data source registry (stub for TCGPlayer, Twitter, etc.)
CREATE TABLE IF NOT EXISTS data_source_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}'
);

-- Seed stubs for future sources
INSERT INTO data_source_registry (source_key, enabled) VALUES
  ('tcgplayer', false),
  ('twitter', false),
  ('instagram', false),
  ('tiktok', false)
ON CONFLICT (source_key) DO NOTHING;
