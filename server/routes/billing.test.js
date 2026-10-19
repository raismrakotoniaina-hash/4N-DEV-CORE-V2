import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import createBillingRouter from './billing.js';

const SECRET = 'test-webhook-secret';

function makeWebhook(overrides = {}) {
  return {
    status: 'COMPLETED',
    transactionId: 'zopayo-tx-001',
    merchantReference: '4N-test-reference',
    currency: 'USD',
    amountPaid: 5,
    raw: {},
    ...overrides
  };
}

async function startWebhookServer({ transactionStatus = 'pending' } = {}) {
  let completeCalls = 0;
  const transaction = {
    id: 'transaction-1',
    status: transactionStatus,
    currency: 'USD',
    amount: '5.00',
    workspace_id: 'workspace-1'
  };

  const billingService = {
    async getTransaction() { return { ...transaction }; },
    async completeTransaction() {
      completeCalls += 1;
      transaction.status = 'completed';
      return { ...transaction };
    },
    async updateStatus() { return { ...transaction }; }
  };

  const zopayo = {
    parseWebhook(payload) { return payload; },
    amountMatches(received, expected) {
      const a = Number(received);
      const b = Number(expected);
      return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.000001;
    }
  };

  const app = express();
  app.use(express.json());
  app.use('/billing', createBillingRouter({
    billingService,
    sessionMiddleware: (_req, _res, next) => next(),
    zopayo,
    corsOrigin: 'https://console.example.test',
    zopayoWebhookSecret: SECRET
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();

  return {
    url: `http://127.0.0.1:${address.port}/billing/webhook`,
    getCompleteCalls: () => completeCalls,
    close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  };
}

async function postWebhook(server, payload) {
  return fetch(server.url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-webhook-secret': SECRET
    },
    body: JSON.stringify(payload)
  });
}

test('webhook rejects a currency that differs from the pending transaction', async () => {
  const server = await startWebhookServer();
  try {
    const response = await postWebhook(server, makeWebhook({ currency: 'MGA' }));
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'webhook_currency_mismatch');
    assert.equal(server.getCompleteCalls(), 0);
  } finally {
    await server.close();
  }
});

test('webhook rejects an amount that differs from the pending transaction', async () => {
  const server = await startWebhookServer();
  try {
    const response = await postWebhook(server, makeWebhook({ amountPaid: 4.99 }));
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'webhook_amount_mismatch');
    assert.equal(server.getCompleteCalls(), 0);
  } finally {
    await server.close();
  }
});

test('replayed webhook for a completed transaction does not credit it again', async () => {
  const server = await startWebhookServer({ transactionStatus: 'completed' });
  try {
    const response = await postWebhook(server, makeWebhook());
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.status, 'already_completed');
    assert.equal(server.getCompleteCalls(), 0);
  } finally {
    await server.close();
  }
});
