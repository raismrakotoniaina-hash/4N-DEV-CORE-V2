import test from 'node:test';
import assert from 'node:assert/strict';
import { createPricingRepository } from './pricing.js';

test('provider pricing query retrieves cache-write rate', async () => {
  const expected = { cache_write_cost_per_1m_usd: '0.25' };
  const db = {
    async query(sql, params) {
      assert.match(sql, /cache_write_cost_per_1m_usd/);
      assert.deepEqual(params, ['openai', 'gpt-5.6-luna', 'chat']);
      return { rows: [expected] };
    }
  };

  const pricing = await createPricingRepository(db).getActivePricing({
    provider: 'openai',
    providerModel: 'gpt-5.6-luna',
    service: 'chat'
  });

  assert.equal(pricing.cache_write_cost_per_1m_usd, '0.25');
});

test('customer pricing query retrieves cache-write tariff', async () => {
  const expected = { cache_write_price_per_1m_usd: '0.625' };
  const db = {
    async query(sql, params) {
      assert.match(sql, /cache_write_price_per_1m_usd/);
      assert.deepEqual(params, ['4n-chat-naya-5.6', 'chat']);
      return { rows: [expected] };
    }
  };

  const pricing = await createPricingRepository(db).getActiveCustomerPricing({
    publicModel: '4n-chat-naya-5.6',
    service: 'chat'
  });

  assert.equal(pricing.cache_write_price_per_1m_usd, '0.625');
});
