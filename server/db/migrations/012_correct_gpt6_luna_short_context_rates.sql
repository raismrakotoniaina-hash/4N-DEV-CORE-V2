-- Correct GPT-6 Luna to OpenAI's Standard short-context rates.
-- Core requests are currently capped far below the 272K long-context threshold.
-- Keep the previous tariff rows as historical records; only close their active period.

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
  input_cost_per_1m_usd, cached_input_cost_per_1m_usd,
  output_cost_per_1m_usd, image_cost_usd, margin_multiplier,
  effective_from, status
)
VALUES (
  'openai', 'gpt-6-luna', 'chat',
  0.05, 0.005, 0.25, NULL, 1.6666666667,
  now(), 'active'
);

UPDATE customer_model_pricing
SET status = 'inactive',
    effective_to = COALESCE(effective_to, now())
WHERE public_model = '4n-luna-6'
  AND service = 'chat'
  AND status = 'active'
  AND effective_to IS NULL;

INSERT INTO customer_model_pricing (
  public_model, service,
  input_price_per_1m_usd, cached_input_price_per_1m_usd,
  output_price_per_1m_usd, image_price_usd,
  effective_from, status, notes
)
VALUES (
  '4n-luna-6', 'chat',
  0.0833333333, 0.0083333333, 0.4166666667, NULL,
  now(), 'active',
  'GPT-6 Luna Standard short-context pricing; customer rates target 40% gross margin before operating costs.'
);

COMMIT;
