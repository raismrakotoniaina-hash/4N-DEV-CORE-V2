-- 4N DEV Core V2
-- Production provider pricing V1.
--
-- Business rules:
--   1 credit = USD 0.01
--   default margin = 2.5x provider cost
--   billing is based on actual token usage
--   public model names remain independent from private provider/model IDs
--
-- Source: OpenAI API pricing checked on 2026-10-08.
-- Chat: gpt-5.6-luna = $0.20 / 1M input, $1.20 / 1M output.
-- Code: gpt-5.6-sol = $4.00 / 1M input, $20.00 / 1M output.
-- Image pricing is intentionally not activated here because GPT Image 2.5
-- pricing varies by image output token consumption, quality and size. The
-- current Core image billing path uses a fixed image_cost_usd and therefore
-- must be upgraded to usage-aware image settlement before production image
-- billing is enabled.

BEGIN;

INSERT INTO provider_pricing (
  provider,
  provider_model,
  service,
  input_cost_per_1m_usd,
  output_cost_per_1m_usd,
  image_cost_usd,
  margin_multiplier,
  effective_from,
  status
)
VALUES
  (
    'openai',
    'gpt-5.6-luna',
    'chat',
    0.20,
    1.20,
    NULL,
    2.5000,
    now(),
    'active'
  ),
  (
    'openai',
    'gpt-5.6-sol',
    'coding',
    4.00,
    20.00,
    NULL,
    2.5000,
    now(),
    'active'
  )
ON CONFLICT DO NOTHING;

COMMIT;
