import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import createBillingRouter from '../routes/billing.js';

test('Zopayo webhook rejects a currency mismatch before crediting balance', async (t) => {
  let completed = false;
  const billingService = {
    async getTransaction() {
      return {
        id: 'transaction-1',
        workspace_id: 'workspace-1',
        status: 'pending',
        amount: '10.00',
        currency: 'USD',
        payment_reference: '4N-reference'
      };
    },
    async completeTransaction() {
      completed = true;
      throw new Error('must not complete a mismatched payment');
    },
    async updateStatus() {
      throw new Error('must not update a mismatched payment');
    }
  };
  const zopayo = {
    parseWebhook(payload) {
      return {
        status: String(payload.statut_general || '').toUpperCase(),
        reference: payload.reference,
        merchantReference: payload.id_relation || payload.reference,
        transactionId: payload.id_transaction,
        amountPaid: payload.montant_paye ?? payload.montant,
        currency: String(payload.devise || '').toUpperCase(),
        raw: payload
      };
    },
    amountMatches(received, expected) {
      return Number.isFinite(Number(received))
        && Number.isFinite(Number(expected))
        && Math.abs(Number(received) - Number(expected)) < 0.000001;
    }
  };
  const app = express();
  app.use(express.json());
  app.use('/api/billing', createBillingRouter({
    billingService,
    sessionMiddleware: (_req, _res, next) => next(),
    zopayo,
    corsOrigin: 'https://console.4ndev.dev',
    zopayoWebhookSecret: 'test-webhook-secret'
  }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/billing/webhook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-webhook-secret': 'test-webhook-secret'
    },
    body: JSON.stringify({
      statut_general: 'COMPLETED',
      id_relation: '4N-reference',
      id_transaction: 'provider-transaction-1',
      montant_paye: '10.00',
      devise: 'EUR'
    })
  });

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'webhook_currency_mismatch');
  assert.equal(completed, false);
});
