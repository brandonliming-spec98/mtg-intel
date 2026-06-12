CREATE TABLE projection_algorithms (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose_key         TEXT UNIQUE NOT NULL,
  purpose_description TEXT NOT NULL,
  algorithm_json      JSONB NOT NULL,
  success_rate        FLOAT NOT NULL DEFAULT 0,
  validation_count    INT NOT NULL DEFAULT 0,
  promoted            BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_validated_at   TIMESTAMPTZ
);

CREATE INDEX ON projection_algorithms (promoted);
