-- Ensure GPT-6 Luna provider costs match the official Standard short-context rate card.
-- Preserve the established 4N DEV Chat tariff ($0.50 input / $3.00 output per 1M tokens).
-- Keep historical pricing rows; only close active periods and insert canonical-ID rows.

BEGIN;

UPDATE provider_pricing
SET status = 'inactive',
    effective_to = COALESCE(effective_to, now())
WHERE provider = 'openai'
  AND provider_model = 'gpt-6-luna'
  AND service = 'chat'
  AND status = 'active'
  AND effective_to IS NULL;

INSERT INTO provider_pricing (
  provider, provider_model, service,
  input_cost_per_1m_usd, cached_input_cost_per_1m_usd, cache_write_cost_per_1m_usd,
  output_cost_per_1m_usd, image_cost_usd, margin_multiplier,
  effective_from, status
)
VALUES (
  'openai', 'gpt-6-luna', 'chat',
  0.10, 0.01, 0.125, 0.50, NULL, 1.6666666667,
  now(), 'active'
);

UPDATE customer_model_pricing
SET status = 'inactive',
    effective_to = COALESCE(effective_to, now())
WHERE public_model = '4n-chat-naya-6'
  AND service = 'chat'
  AND status = 'active'
  AND effective_to IS NULL;

INSERT INTO customer_model_pricing (
  public_model, service,
  input_price_per_1m_usd, cached_input_price_per_1m_usd, cache_write_price_per_1m_usd,
  output_price_per_1m_usd, image_price_usd,
  effective_from, status, notes
)
VALUES (
  '4n-chat-naya-6', 'chat',
  0.50, 0.025, 0.3125, 3.00, NULL,
  now(), 'active',
  'Luna 6; retains existing Chat input/output tariffs. Cached and cache-write rates are 2.5x configured provider costs.'
);

COMMIT;
