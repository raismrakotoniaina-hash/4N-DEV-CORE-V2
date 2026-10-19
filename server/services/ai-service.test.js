import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateImageCost, calculateTokenCost, createAiService } from './ai-service.js';
import { modelCatalog, aiServiceModelCatalog, providerModelCatalog } from '../config/model-catalog.js';

const providerPricing = {
  input_cost_per_1m_usd: '0.20',
  output_cost_per_1m_usd: '1.20'
};
const customerPricing = {
  input_price_per_1m_usd: '0.50',
  output_price_per_1m_usd: '2.50'
};

test('token charges use 4N DEV customer tariffs, not provider costs', () => {
  const result = calculateTokenCost(100_000, 50_000, providerPricing, customerPricing);
  assert.equal(result.providerCostUsd, 0.08);
  assert.equal(result.chargedUsd, 0.175);
  assert.equal(result.chargedCredits, 17.5);
  assert.equal(result.marginMultiplier, 2.1875);
});

test('zero-token usage is charged zero without inventing provider margin', () => {
  const result = calculateTokenCost(0, 0, providerPricing, customerPricing);
  assert.equal(result.providerCostUsd, 0);
  assert.equal(result.chargedUsd, 0);
  assert.equal(result.chargedCredits, 0);
  assert.equal(result.marginMultiplier, 0);
});

test('missing customer input or output tariff fails closed, including null', () => {
  assert.throws(
    () => calculateTokenCost(10, 10, providerPricing, { ...customerPricing, input_price_per_1m_usd: null }),
    (error) => error.code === 'customer_pricing_not_configured' && error.status === 503
  );
  assert.throws(
    () => calculateTokenCost(10, 10, providerPricing, { ...customerPricing, output_price_per_1m_usd: undefined }),
    (error) => error.code === 'customer_pricing_not_configured' && error.status === 503
  );
});

test('missing provider rates fail closed instead of being treated as free', () => {
  assert.throws(
    () => calculateTokenCost(10, 10, { ...providerPricing, input_cost_per_1m_usd: null }, customerPricing),
    (error) => error.code === 'pricing_not_configured' && error.status === 503
  );
});

test('negative or non-finite token usage is rejected', () => {
  assert.throws(() => calculateTokenCost(-1, 0, providerPricing, customerPricing), (error) => error.code === 'invalid_usage');
  assert.throws(() => calculateTokenCost(Number.NaN, 0, providerPricing, customerPricing), (error) => error.code === 'invalid_usage');
});

test('image charge uses customer image tariff and keeps provider cost separate', () => {
  const result = calculateImageCost(
    { image_cost_usd: '0.04' },
    { image_price_usd: '0.10' }
  );
  assert.equal(result.providerCostUsd, 0.04);
  assert.equal(result.chargedUsd, 0.1);
  assert.equal(result.chargedCredits, 10);
  assert.equal(result.marginMultiplier, 2.5);
});

test('missing image price or provider cost fails closed', () => {
  assert.throws(
    () => calculateImageCost({ image_cost_usd: '0.04' }, { image_price_usd: null }),
    (error) => error.code === 'customer_pricing_not_configured' && error.status === 503
  );
  assert.throws(
    () => calculateImageCost({ image_cost_usd: null }, { image_price_usd: '0.10' }),
    (error) => error.code === 'pricing_not_configured' && error.status === 503
  );
});

test('cached input tokens use separate provider and customer rates', () => {
  const result = calculateTokenCost(
    1_000_000,
    1_000_000,
    { input_cost_per_1m_usd: '0.10', cached_input_cost_per_1m_usd: '0.01', output_cost_per_1m_usd: '0.50' },
    { input_price_per_1m_usd: '0.1666666667', cached_input_price_per_1m_usd: '0.0166666667', output_price_per_1m_usd: '0.8333333333' },
    500_000
  );
  assert.equal(Number(result.providerCostUsd.toFixed(4)), 0.555);
  assert.equal(Number(result.chargedUsd.toFixed(4)), 0.925);
  assert.equal(Number(result.marginMultiplier.toFixed(4)), 1.6667);
});

test('cached input cannot exceed total input tokens', () => {
  assert.throws(
    () => calculateTokenCost(10, 0, providerPricing, customerPricing, 11),
    (error) => error.code === 'invalid_usage'
  );
});


test('public API model catalog contains exactly the four requested IDs', () => {
  assert.deepEqual(modelCatalog.map((model) => model.id), [
    '4n-chat-naya-5.6',
    '4n-chat-naya-6',
    '4n-code-nael-5.6',
    '4n-code-nael-6.1'
  ]);
  assert.equal(modelCatalog.length, 4);
  assert.deepEqual(modelCatalog.map((model) => model.service), ['chat', 'chat', 'coding', 'coding']);
});

test('provider mappings use the four verified provider model IDs', () => {
  assert.deepEqual(providerModelCatalog, {
    '4n-chat-naya-5.6': 'gpt-5.6-luna',
    '4n-chat-naya-6': 'gpt-6-luna',
    '4n-code-nael-5.6': 'gpt-5.6-sol',
    '4n-code-nael-6.1': 'gpt-6.1-sol'
  });
});

test('image endpoint model stays internal and is not exposed as a fifth public text model', () => {
  assert.equal(aiServiceModelCatalog.length, 5);
  assert.equal(aiServiceModelCatalog.at(-1).id, '4n-image');
  assert.equal(modelCatalog.some((model) => model.id === '4n-image'), false);
});

test('cache-write tokens use their own provider and customer rates', () => {
  const result = calculateTokenCost(
    1_000_000,
    100_000,
    { input_cost_per_1m_usd: '0.20', cached_input_cost_per_1m_usd: '0.02', cache_write_cost_per_1m_usd: '0.25', output_cost_per_1m_usd: '1.20' },
    { input_price_per_1m_usd: '0.50', cached_input_price_per_1m_usd: '0.05', cache_write_price_per_1m_usd: '0.625', output_price_per_1m_usd: '3.00' },
    200_000,
    300_000
  );
  assert.equal(Number(result.providerCostUsd.toFixed(6)), 0.299);
  assert.equal(Number(result.chargedUsd.toFixed(6)), 0.7475);
});

test('cache-write usage fails closed if either cache-write tariff is missing', () => {
  assert.throws(
    () => calculateTokenCost(10, 1, providerPricing, customerPricing, 0, 2),
    (error) => error.code === 'pricing_not_configured'
  );
  assert.throws(
    () => calculateTokenCost(10, 1,
      { ...providerPricing, cache_write_cost_per_1m_usd: '0.25' },
      customerPricing, 0, 2),
    (error) => error.code === 'customer_pricing_not_configured'
  );
});

test('cached-read plus cache-write tokens cannot exceed input tokens', () => {
  assert.throws(
    () => calculateTokenCost(10, 0,
      { ...providerPricing, cache_write_cost_per_1m_usd: '0.25' },
      { ...customerPricing, cache_write_price_per_1m_usd: '0.625' }, 6, 5),
    (error) => error.code === 'invalid_usage'
  );
});

test('USD wallet settlement metadata preserves cached-read and cache-write token counts', async () => {
  let settled;
  const provider = {
    id: 'openai',
    async coding() {
      return { model: 'gpt-5.6-sol', output: 'ok', language: 'javascript', inputTokens: 8, cachedInputTokens: 3, cacheWriteInputTokens: 2, outputTokens: 4 };
    }
  };
  const creditsService = {
    async getPricing() {
      return { input_cost_per_1m_usd: '4', cached_input_cost_per_1m_usd: '0.4', cache_write_cost_per_1m_usd: '5', output_cost_per_1m_usd: '20' };
    },
    async getCustomerPricing() {
      return { input_price_per_1m_usd: '10', cached_input_price_per_1m_usd: '1', cache_write_price_per_1m_usd: '12.5', output_price_per_1m_usd: '50' };
    }
  };
  const usdWalletRepository = {
    async reserve({ amountUsd }) { return { id: 'reservation-1', reserved_usd: Math.max(amountUsd, 1) }; },
    async settle(details) { settled = details; },
    async release() { throw new Error('unexpected release'); }
  };
  const ai = createAiService({
    provider,
    creditsService,
    usdWalletRepository,
    modelCatalog: [{ id: '4n-code-nael-5.6', service: 'coding', status: 'active' }],
    providerModelCatalog: { '4n-code-nael-5.6': 'gpt-5.6-sol' }
  });
  await ai.coding(
    { auth: { workspaceId: 'workspace-1', apiKeyId: 'key-1' }, requestId: 'request-1' },
    { model: '4n-code-nael-5.6', prompt: 'write a tiny function', max_output_tokens: 4 }
  );
  assert.equal(settled.metadata.cachedInputTokens, 3);
  assert.equal(settled.metadata.cacheWriteInputTokens, 2);
  assert.equal(settled.metadata.inputTokens, 8);
  assert.equal(settled.metadata.outputTokens, 4);
  assert.ok(settled.chargedUsd > 0);
});
