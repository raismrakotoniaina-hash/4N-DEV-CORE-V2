import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateImageCost, calculateTokenCost } from './ai-service.js';

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
