-- 4N DEV Core V2
-- Public customer tariffs and display FX rates.
--
-- Additive-only migration: preserve existing credit accounts, ledger entries,
-- reservations, usage records, and billing transactions. This migration does
-- not activate or change any production prices.
--
-- USD remains the canonical wallet currency. Customer tariffs are separate
-- from provider costs so 4N DEV can set its own public prices.

BEGIN;

CREATE TABLE IF NOT EXISTS customer_model_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_model TEXT NOT NULL,
  service TEXT NOT NULL CHECK (service IN ('chat', 'coding', 'image', 'embedding', 'planner', 'builder')),
  input_price_per_1m_usd NUMERIC(20,10),
  output_price_per_1m_usd NUMERIC(20,10),
  image_price_usd NUMERIC(20,10),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('active', 'inactive')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (input_price_per_1m_usd IS NULL OR input_price_per_1m_usd >= 0),
  CHECK (output_price_per_1m_usd IS NULL OR output_price_per_1m_usd >= 0),
  CHECK (image_price_usd IS NULL OR image_price_usd >= 0),
  CHECK (input_price_per_1m_usd IS NOT NULL OR output_price_per_1m_usd IS NOT NULL OR image_price_usd IS NOT NULL),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE INDEX IF NOT EXISTS customer_model_pricing_lookup_idx
  ON customer_model_pricing(public_model, service, status, effective_from DESC);

CREATE TABLE IF NOT EXISTS display_exchange_rates (
  currency CHAR(3) PRIMARY KEY CHECK (currency IN ('EUR', 'MGA')),
  usd_to_currency NUMERIC(20,10) NOT NULL CHECK (usd_to_currency > 0),
  source TEXT NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
