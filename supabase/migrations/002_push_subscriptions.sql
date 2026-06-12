-- Push subscriptions — single-user for now.
-- Multi-user path: add user_id UUID REFERENCES auth.users, add RLS policy.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription JSONB     NOT NULL,
  watchlist  JSONB       NOT NULL DEFAULT '[]',
  last_notified JSONB    NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
