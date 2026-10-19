-- 4N DEV Core V2
-- Four requested public models with cache-aware token pricing.
-- Preserve historical billing rows; retire old aliases instead of deleting records.
-- Customer uncached tariffs retain the existing service-level prices:
-- Chat $0.50 input / $3.00 output; Coding $10.00 input / $50.00 output per 1M tokens.
-- Effective margin varies by model and token class; these are not a uniform margin promise.

BEGIN;

ALTER TABLE provider_pricing
  ADD COLUMN IF NOT EXISTS cached_input_cost_per_1m_usd NUMERIC(20,10),
  ADD COLUMN IF NOT EXISTS cache_write_cost_per_1m_usd NUMERIC(20,10);

ALTER TABLE customer_model_pricing
  ADD COLUMN IF NOT EXISTS cached_input_price_per_1m_usd NUMERIC(20,10),
  ADD COLUMN IF NOT EXISTS cache_write_price_per_1m_usd NUMERIC(20,10);

-- End previous active versions for the four provider model/service pairs.
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
  input_cost_per_1m_usd, cached_input_cost_per_1m_usd, cache_write_cost_per_1m_usd,
  output_cost_per_1m_usd, image_cost_usd, margin_multiplier,
  effective_from, status
)
VALUES
  ('openai', 'gpt-5.6-luna', 'chat',    0.20, 0.02,  0.25,  1.20, NULL, 1.6667, now(), 'active'),
  ('openai', 'gpt-6-luna',   'chat',    0.10, 0.01,  0.125, 0.50, NULL, 1.6667, now(), 'active'),
  ('openai', 'gpt-5.6-sol',  'coding',  4.00, 0.40,  5.00, 20.00, NULL, 1.6667, now(), 'active'),
  ('openai', 'gpt-6.1-sol',  'coding',  2.00, 0.05,  2.50, 10.00, NULL, 1.6667, now(), 'active');

-- Retire generic IDs, temporary aliases and existing versions of canonical IDs.
-- Existing rows remain available for audit/history.
UPDATE customer_model_pricing
SET status = 'inactive', effective_to = COALESCE(effective_to, now())
WHERE status = 'active'
  AND (public_model, service) IN (
    ('4n-chat', 'chat'),
    ('4n-code', 'coding'),
    ('4n-luna-5.6', 'chat'),
    ('4n-luna-6', 'chat'),
    ('4n-sol-5.6', 'coding'),
    ('4n-sol-6.1', 'coding'),
    ('4n-chat-naya-5.6', 'chat'),
    ('4n-chat-naya-6', 'chat'),
    ('4n-code-nael-5.6', 'coding'),
    ('4n-code-nael-6.1', 'coding')
  );

-- Exactly one new active customer tariff per requested public model.
-- Cached/cache-write customer rates use 2.5x the configured provider cost.
INSERT INTO customer_model_pricing (
  public_model, service,
  input_price_per_1m_usd, cached_input_price_per_1m_usd, cache_write_price_per_1m_usd,
  output_price_per_1m_usd, image_price_usd,
  effective_from, status, notes
)
VALUES
  ('4n-chat-naya-5.6', 'chat',   0.50, 0.05,  0.625,  3.00, NULL, now(), 'active', 'Luna 5.6; retains existing Chat input/output tariffs.'),
  ('4n-chat-naya-6',   'chat',   0.50, 0.025, 0.3125, 3.00, NULL, now(), 'active', 'Luna 6; retains existing Chat input/output tariffs.'),
  ('4n-code-nael-5.6', 'coding', 10.00, 1.00, 12.50, 50.00, NULL, now(), 'active', 'Sol 5.6; retains existing Coding input/output tariffs.'),
  ('4n-code-nael-6.1', 'coding', 10.00, 0.125, 6.25, 50.00, NULL, now(), 'active', 'Sol 6.1; retains existing Coding input/output tariffs.');

COMMIT;
