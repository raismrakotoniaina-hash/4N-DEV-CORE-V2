-- 4N DEV Core V2
-- Billing Integrity V1
-- Idempotent payment references for prepaid credit purchases.

BEGIN;

ALTER TABLE billing_transactions
  ADD COLUMN IF NOT EXISTS payment_reference TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS billing_provider_transaction_unique_idx
  ON billing_transactions(payment_provider, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS billing_provider_reference_unique_idx
  ON billing_transactions(payment_provider, payment_reference)
  WHERE payment_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS credit_packages_active_idx
  ON credit_packages(active, code);

CREATE INDEX IF NOT EXISTS credit_package_prices_currency_active_idx
  ON credit_package_prices(currency, active, package_id);

COMMIT;
