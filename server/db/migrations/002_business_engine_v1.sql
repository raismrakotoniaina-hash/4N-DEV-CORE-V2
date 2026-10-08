-- 4N DEV Core V2
-- Business Engine V1
-- Prepaid fractional-credit billing foundation.
--
-- Rules:
--   1 credit = USD 0.01
--   charged_credits = charged_usd * 100
--   provider cost is based on actual usage
--   reservation -> provider execution -> settlement/refund
--   public models never expose private provider/model identity

BEGIN;

-- ---------------------------------------------------------------------------
-- Existing credit account: migrate integer credits to fractional credits.
-- monthly_limit belongs to the retired subscription-era model and is removed.
-- ---------------------------------------------------------------------------
ALTER TABLE credit_accounts
  ALTER COLUMN balance TYPE NUMERIC(20,6)
    USING balance::NUMERIC(20,6);

ALTER TABLE credit_accounts
  DROP COLUMN IF EXISTS monthly_limit;

ALTER TABLE credit_accounts
  ADD COLUMN IF NOT EXISTS reserved_balance NUMERIC(20,6) NOT NULL DEFAULT 0
    CHECK (reserved_balance >= 0);

-- ---------------------------------------------------------------------------
-- Existing ledger: turn it into the financial journal.
-- ---------------------------------------------------------------------------
ALTER TABLE credit_ledger
  ALTER COLUMN amount TYPE NUMERIC(20,6)
    USING amount::NUMERIC(20,6);

ALTER TABLE credit_ledger
  ADD COLUMN IF NOT EXISTS balance_before NUMERIC(20,6),
  ADD COLUMN IF NOT EXISTS balance_after NUMERIC(20,6),
  ADD COLUMN IF NOT EXISTS reference_type TEXT;

-- Preserve existing reference_id and use the pair reference_type/reference_id
-- for auditable billing, reservation and usage events.
CREATE INDEX IF NOT EXISTS credit_ledger_reference_idx
  ON credit_ledger(reference_type, reference_id);

-- ---------------------------------------------------------------------------
-- Existing usage table: add real metering and financial attribution.
-- ---------------------------------------------------------------------------
ALTER TABLE usage_records
  ALTER COLUMN credits TYPE NUMERIC(20,6)
    USING credits::NUMERIC(20,6);

ALTER TABLE usage_records
  ADD COLUMN IF NOT EXISTS public_model TEXT,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_model TEXT,
  ADD COLUMN IF NOT EXISTS input_tokens BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_tokens BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_tokens BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_cost_usd NUMERIC(20,10),
  ADD COLUMN IF NOT EXISTS margin_multiplier NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS charged_usd NUMERIC(20,10),
  ADD COLUMN IF NOT EXISTS reservation_credits NUMERIC(20,6),
  ADD COLUMN IF NOT EXISTS refunded_credits NUMERIC(20,6);

-- Existing rows may not have public_model. Keep legacy model values where
-- available so the migration remains lossless.
UPDATE usage_records
SET public_model = model
WHERE public_model IS NULL AND model IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Prepaid package catalog.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS credit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  credits NUMERIC(20,6) NOT NULL CHECK (credits > 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS credit_package_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES credit_packages(id),
  currency CHAR(3) NOT NULL CHECK (currency IN ('USD', 'EUR', 'MGA')),
  amount NUMERIC(20,6) NOT NULL CHECK (amount > 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(package_id, currency)
);

CREATE INDEX IF NOT EXISTS credit_package_prices_lookup_idx
  ON credit_package_prices(package_id, currency, active);

-- ---------------------------------------------------------------------------
-- Private provider/model pricing.
-- Never expose provider/provider_model through the public API.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS provider_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_model TEXT NOT NULL,
  service TEXT NOT NULL,
  input_cost_per_1m_usd NUMERIC(20,10),
  output_cost_per_1m_usd NUMERIC(20,10),
  image_cost_usd NUMERIC(20,10),
  margin_multiplier NUMERIC(10,4) NOT NULL DEFAULT 2.0000
    CHECK (margin_multiplier > 0),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    input_cost_per_1m_usd IS NULL OR input_cost_per_1m_usd >= 0
  ),
  CHECK (
    output_cost_per_1m_usd IS NULL OR output_cost_per_1m_usd >= 0
  ),
  CHECK (
    image_cost_usd IS NULL OR image_cost_usd >= 0
  )
);

CREATE INDEX IF NOT EXISTS provider_pricing_lookup_idx
  ON provider_pricing(provider, provider_model, service, status);

CREATE INDEX IF NOT EXISTS provider_pricing_effective_idx
  ON provider_pricing(provider_model, service, effective_from DESC);

-- ---------------------------------------------------------------------------
-- Credit reservations.
-- request_id is unique so a retry cannot reserve twice for the same request.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS credit_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  api_key_id UUID REFERENCES api_keys(id),
  request_id TEXT NOT NULL UNIQUE,
  reserved_credits NUMERIC(20,6) NOT NULL CHECK (reserved_credits > 0),
  settled_credits NUMERIC(20,6) NOT NULL DEFAULT 0
    CHECK (settled_credits >= 0),
  refunded_credits NUMERIC(20,6) NOT NULL DEFAULT 0
    CHECK (refunded_credits >= 0),
  status TEXT NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'settled', 'refunded', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ,
  CHECK (settled_credits + refunded_credits <= reserved_credits)
);

CREATE INDEX IF NOT EXISTS credit_reservations_workspace_idx
  ON credit_reservations(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS credit_reservations_status_idx
  ON credit_reservations(status, created_at DESC);

-- ---------------------------------------------------------------------------
-- Payment transactions for prepaid purchases.
-- Supports Zopayo and future payment providers.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  package_id UUID REFERENCES credit_packages(id),
  amount NUMERIC(20,6) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL CHECK (currency IN ('USD', 'EUR', 'MGA')),
  credits NUMERIC(20,6) NOT NULL CHECK (credits > 0),
  exchange_rate NUMERIC(20,10),
  payment_provider TEXT,
  provider_transaction_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (
      status IN (
        'pending',
        'completed',
        'failed',
        'cancelled',
        'refunded'
      )
    ),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS billing_workspace_idx
  ON billing_transactions(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS billing_provider_transaction_idx
  ON billing_transactions(payment_provider, provider_transaction_id);

-- ---------------------------------------------------------------------------
-- V1 prepaid catalog
-- Fixed package prices; credits do not change with FX.
-- ---------------------------------------------------------------------------
INSERT INTO credit_packages (code, name, credits)
VALUES
  ('starter', 'Starter', 500),
  ('developer', 'Developer', 1000),
  ('pro', 'Pro', 2500),
  ('business', 'Business', 5000)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  credits = EXCLUDED.credits;

INSERT INTO credit_package_prices (package_id, currency, amount)
SELECT p.id, v.currency, v.amount
FROM credit_packages p
JOIN (
  VALUES
    ('starter', 'USD'::CHAR(3), 5::NUMERIC),
    ('starter', 'EUR'::CHAR(3), 5::NUMERIC),
    ('starter', 'MGA'::CHAR(3), 22500::NUMERIC),
    ('developer', 'USD'::CHAR(3), 10::NUMERIC),
    ('developer', 'EUR'::CHAR(3), 10::NUMERIC),
    ('developer', 'MGA'::CHAR(3), 45000::NUMERIC),
    ('pro', 'USD'::CHAR(3), 25::NUMERIC),
    ('pro', 'EUR'::CHAR(3), 25::NUMERIC),
    ('pro', 'MGA'::CHAR(3), 112500::NUMERIC),
    ('business', 'USD'::CHAR(3), 50::NUMERIC),
    ('business', 'EUR'::CHAR(3), 50::NUMERIC),
    ('business', 'MGA'::CHAR(3), 225000::NUMERIC)
) AS v(code, currency, amount)
  ON p.code = v.code
ON CONFLICT (package_id, currency) DO UPDATE
SET
  amount = EXCLUDED.amount,
  active = true;

COMMIT;
