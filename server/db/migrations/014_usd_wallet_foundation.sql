-- 4N DEV Core V2
-- USD-denominated prepaid wallet foundation.
-- Legacy credit accounts/ledgers are retained as historical records and are
-- deliberately NOT converted: their units may represent legacy credits, not USD.

BEGIN;

CREATE TABLE IF NOT EXISTS usd_wallet_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE REFERENCES workspaces(id),
  balance_usd NUMERIC(20, 8) NOT NULL DEFAULT 0 CHECK (balance_usd >= 0),
  reserved_usd NUMERIC(20, 8) NOT NULL DEFAULT 0 CHECK (reserved_usd >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (reserved_usd <= balance_usd)
);

CREATE TABLE IF NOT EXISTS usd_wallet_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  api_key_id UUID REFERENCES api_keys(id),
  request_id TEXT NOT NULL UNIQUE,
  reserved_usd NUMERIC(20, 8) NOT NULL CHECK (reserved_usd > 0),
  settled_usd NUMERIC(20, 8) CHECK (settled_usd >= 0),
  status TEXT NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'settled', 'released')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS usd_wallet_reservations_workspace_idx
  ON usd_wallet_reservations(workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS usd_wallet_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  amount_usd NUMERIC(20, 8) NOT NULL,
  type TEXT NOT NULL
    CHECK (type IN ('topup', 'reservation', 'charge', 'release', 'refund', 'adjustment')),
  reference_id TEXT,
  reference_type TEXT,
  balance_before_usd NUMERIC(20, 8) NOT NULL CHECK (balance_before_usd >= 0),
  balance_after_usd NUMERIC(20, 8) NOT NULL CHECK (balance_after_usd >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS usd_wallet_ledger_workspace_idx
  ON usd_wallet_ledger(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS usd_wallet_ledger_reference_idx
  ON usd_wallet_ledger(reference_type, reference_id);

-- New workspaces start with a zero USD wallet. No legacy credit balance is
-- interpreted as dollars; top-ups must credit this wallet through verified
-- payment settlement or an audited administrative adjustment.
INSERT INTO usd_wallet_accounts (workspace_id)
SELECT id FROM workspaces
ON CONFLICT (workspace_id) DO NOTHING;

COMMIT;
