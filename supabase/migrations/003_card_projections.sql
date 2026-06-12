CREATE TABLE card_projections (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_name                 TEXT NOT NULL,
  verdict                   TEXT NOT NULL CHECK (verdict IN ('BUY','HOLD','SELL')),
  confidence                FLOAT NOT NULL,
  reasoning                 TEXT NOT NULL,
  flavor_text               TEXT,
  key_signals               JSONB,
  signal_pips               JSONB,
  algorithm_json            JSONB,
  source                    TEXT NOT NULL CHECK (source IN ('claude','algorithm')),
  purpose_key               TEXT,
  cached_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at                TIMESTAMPTZ NOT NULL,
  outcome_price_validated   BOOL NOT NULL DEFAULT false,
  outcome_signal_validated  BOOL NOT NULL DEFAULT false,
  outcome_user_validated    BOOL NOT NULL DEFAULT false,
  outcome_score             FLOAT,
  validated_at              TIMESTAMPTZ
);
CREATE INDEX ON card_projections (card_name, expires_at);
CREATE INDEX ON card_projections (outcome_price_validated, cached_at);
CREATE INDEX ON card_projections (outcome_signal_validated, cached_at);
