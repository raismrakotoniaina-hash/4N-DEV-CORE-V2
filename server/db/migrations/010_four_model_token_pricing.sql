-- 4N DEV Core V2
-- Four selectable OpenAI models with customer token tariffs.
-- Additive and audit-safe: preserve legacy credit/ledger/usage records.
-- Customer prices target a 40% gross margin before hosting, payment fees, taxes,
-- and other operating costs (customer rate = provider rate / 0.60).

BEGIN;

ALTER TABLE provider_pricing
  ADD COLUMN IF NOT EXISTS cached_input_cost_per_1m_usd NUMERIC(20,10);

ALTER TABLE customer_model_pricing
  ADD COLUMN IF NOT EXISTS cached_input_price_per_1m_usd NUMERIC(20,10);

-- End previous active versions for these exact provider model/service pairs.
UPDATE provider_pricing
SET status = 'inactive', effective_to = COALESCE(effective_to, now())
WHERE provider = 'openai'
  AND (provider_model, service) IN (
    ('gpt-5.6-luna', 'chat'),
    ('gpt-6-luna', 'chat'),
    ('gpt-5.6-sol', 'coding'),
    ('gpt-6.1-sol', 'coding')
  )
  AND status = 'active';

INSERT INTO provider_pricing (
  provider, provider_model, service,
  input_cost_per_1m_usd, cached_input_cost_per_1m_usd,
  output_cost_per_1m_usd, image_cost_usd, margin_multiplier,
  effective_from, status
)
VALUES
  ('openai', 'gpt-5.6-luna', 'chat',   0.20, 0.02,  1.20, NULL, 1.6667, now(), 'active'),
  ('openai', 'gpt-6-luna',   'chat',   0.10, 0.01,  0.50, NULL, 1.6667, now(), 'active'),
  ('openai', 'gpt-5.6-sol',  'coding', 4.00, 0.40, 20.00, NULL, 1.6667, now(), 'active'),
  ('openai', 'gpt-6.1-sol',  'coding', 2.00, 0.10, 10.00, NULL, 1.6667, now(), 'active');

-- Use stable, separately selectable public model IDs; never expose provider IDs as API secrets.
INSERT INTO customer_model_pricing (
  public_model, service,
  input_price_per_1m_usd, cached_input_price_per_1m_usd,
  output_price_per_1m_usd, image_price_usd,
  effective_from, status, notes
)
VALUES
  ('4n-luna-5.6', 'chat',   0.3333333333, 0.0333333333,  2.0000000000, NULL, now(), 'active', 'GPT-5.6 Luna; 40% target gross margin over OpenAI Standard rates.'),
  ('4n-luna-6',   'chat',   0.1666666667, 0.0166666667,  0.8333333333, NULL, now(), 'active', 'GPT-6 Luna; 40% target gross margin over OpenAI Standard rates.'),
  ('4n-sol-5.6',  'coding', 6.6666666667, 0.6666666667, 33.3333333333, NULL, now(), 'active', 'GPT-5.6 Sol; 40% target gross margin over OpenAI Standard rates.'),
  ('4n-sol-6.1',  'coding', 3.3333333333, 0.1666666667, 16.6666666667, NULL, now(), 'active', 'GPT-6.1 Sol; 40% target gross margin over OpenAI Standard rates.');

COMMIT;
