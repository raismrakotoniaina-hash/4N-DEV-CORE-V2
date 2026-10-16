-- 4N DEV Core V2
-- Activate customer-facing token tariffs from the configured provider costs.
-- Customer rates use the margin multiplier already configured per provider model.
-- Public model IDs are kept separate from private provider model IDs.

BEGIN;

INSERT INTO customer_model_pricing (
  public_model,
  service,
  input_price_per_1m_usd,
  output_price_per_1m_usd,
  image_price_usd,
  effective_from,
  status,
  notes
)
SELECT
  CASE
    WHEN service = 'chat' THEN '4n-chat'
    WHEN service = 'coding' THEN '4n-code'
  END,
  service,
  input_cost_per_1m_usd * margin_multiplier,
  output_cost_per_1m_usd * margin_multiplier,
  NULL,
  GREATEST(effective_from, now()),
  'active',
  'Derived from provider_pricing using the configured margin_multiplier.'
FROM provider_pricing
WHERE provider = 'openai'
  AND service IN ('chat', 'coding')
  AND status = 'active'
  AND effective_from <= now()
  AND (effective_to IS NULL OR effective_to > now())
  AND input_cost_per_1m_usd IS NOT NULL
  AND output_cost_per_1m_usd IS NOT NULL
  AND (
    (service = 'chat' AND provider_model = 'gpt-5.6-luna')
    OR
    (service = 'coding' AND provider_model = 'gpt-5.6-sol')
  )
  AND NOT EXISTS (
    SELECT 1
    FROM customer_model_pricing existing
    WHERE existing.public_model = CASE
      WHEN provider_pricing.service = 'chat' THEN '4n-chat'
      WHEN provider_pricing.service = 'coding' THEN '4n-code'
    END
      AND existing.service = provider_pricing.service
      AND existing.status = 'active'
      AND existing.effective_from <= now()
      AND (existing.effective_to IS NULL OR existing.effective_to > now())
  );

COMMIT;
