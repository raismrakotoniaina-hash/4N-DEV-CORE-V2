-- 4N DEV Core V2
-- Canonical USD prepaid wallet packages.
--
-- USD is the only active checkout currency in this catalog migration.
-- EUR/MGA amounts in the original migration were static placeholders, not
-- exchange-rate-derived prices; deactivate them rather than charge stale FX.
-- Existing billing_transactions retain their historical amount/currency/credits.

BEGIN;

INSERT INTO credit_packages (code, name, credits, active)
VALUES
  ('starter', 'Starter - $5', 500, true),
  ('developer', 'Developer - $10', 1000, true),
  ('pro', 'Pro - $20', 2000, true),
  ('business', 'Business - $50', 5000, true),
  ('enterprise', 'Enterprise - $100', 10000, true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    credits = EXCLUDED.credits,
    active = true;

-- Deactivate legacy non-USD checkout amounts; never delete financial history.
UPDATE credit_package_prices
SET active = false
WHERE currency IN ('EUR', 'MGA');

INSERT INTO credit_package_prices (package_id, currency, amount, active)
SELECT p.id, 'USD', v.amount, true
FROM credit_packages p
JOIN (
  VALUES
    ('starter', 5::NUMERIC),
    ('developer', 10::NUMERIC),
    ('pro', 20::NUMERIC),
    ('business', 50::NUMERIC),
    ('enterprise', 100::NUMERIC)
) AS v(code, amount) ON p.code = v.code
ON CONFLICT (package_id, currency) DO UPDATE
SET amount = EXCLUDED.amount,
    active = true;

COMMIT;
