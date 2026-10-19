-- 4N DEV Core V2
-- Canonical public IDs for the four requested Luna/Sol models.
-- Preserve legacy rows as inactive history; do not delete billing records.
-- Keep the existing public customer tariffs: Chat $0.50/$3.00 and Coding $10/$50
-- per million uncached input/output tokens. Cached rates follow provider cache discounts.

BEGIN;

-- Migration 010 supplies the verified provider costs and cache rates for all four IDs.
-- Retire generic/temporary public aliases so only the requested text-model IDs remain active.
UPDATE customer_model_pricing
SET status = 'inactive',
    effective_to = COALESCE(effective_to, now())
WHERE status = 'active'
  AND (public_model, service) IN (
    ('4n-chat', 'chat'),
    ('4n-code', 'coding'),
    ('4n-luna-5.6', 'chat'),
    ('4n-luna-6', 'chat'),
    ('4n-sol-5.6', 'coding'),
    ('4n-sol-6.1', 'coding')
  );

-- Create one canonical active tariff row per requested model.
-- Existing rows are versioned inactive, not deleted, to preserve audit history.
UPDATE customer_model_pricing
SET status = 'inactive',
    effective_to = COALESCE(effective_to, now())
WHERE status = 'active'
  AND (public_model, service) IN (
    ('4n-chat-naya-5.6', 'chat'),
    ('4n-chat-naya-6', 'chat'),
    ('4n-code-nael-5.6', 'coding'),
    ('4n-code-nael-6.1', 'coding')
  );

INSERT INTO customer_model_pricing (
  public_model, service,
  input_price_per_1m_usd, cached_input_price_per_1m_usd, cache_write_price_per_1m_usd,
  output_price_per_1m_usd, image_price_usd,
  effective_from, status, notes
)
VALUES
  ('4n-chat-naya-5.6', 'chat',   0.50, 0.05,  0.625,  3.00, NULL, now(), 'active', 'Luna 5.6; preserves existing 4N DEV Chat tariff.'),
  ('4n-chat-naya-6',   'chat',   0.50, 0.05,  0.625,  3.00, NULL, now(), 'active', 'Luna 6; same 4N DEV Chat tariff as Luna 5.6.'),
  ('4n-code-nael-5.6', 'coding', 10.00, 1.00, 12.50, 50.00, NULL, now(), 'active', 'Sol 5.6; preserves existing 4N DEV Coding tariff.'),
  ('4n-code-nael-6.1', 'coding', 10.00, 0.50, 12.50, 50.00, NULL, now(), 'active', 'Sol 6.1; same 4N DEV Coding tariff as Sol 5.6.');

COMMIT;
