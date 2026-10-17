import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import { createBillingRepository } from './billing.js';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

test('concurrent duplicate payment callbacks credit a USD wallet only once', {
  skip: !databaseUrl ? 'DATABASE_URL is not configured' : false
}, async () => {
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    max: 5
  });
  const suffix = crypto.randomUUID();
  let developerId;
  let workspaceId;
  let transactionId;

  try {
    const developer = await pool.query(
      `INSERT INTO developers (email, full_name, password_hash)
       VALUES ($1, $2, $3) RETURNING id`,
      [`billing-test-${suffix}@example.invalid`, 'Billing Integration Test', 'not-a-real-password-hash']
    );
    developerId = developer.rows[0].id;

    const workspace = await pool.query(
      `INSERT INTO workspaces (name, slug, owner_developer_id)
       VALUES ($1, $2, $3) RETURNING id`,
      ['Billing integration test', `billing-test-${suffix}`, developerId]
    );
    workspaceId = workspace.rows[0].id;

    await pool.query(
      'INSERT INTO usd_wallet_accounts (workspace_id, balance_usd) VALUES ($1, 0)',
      [workspaceId]
    );

    const transaction = await pool.query(
      `INSERT INTO billing_transactions
         (workspace_id, amount, currency, credits, payment_provider, payment_reference, status)
       VALUES ($1, 10, 'USD', 1000, 'zopayo', $2, 'pending')
       RETURNING id`,
      [workspaceId, `4N-test-${suffix}`]
    );
    transactionId = transaction.rows[0].id;

    const billing = createBillingRepository(pool);
    const callback = () => billing.completeTransaction({
      transactionId,
      providerTransactionId: `provider-tx-${suffix}`,
      paymentReference: `4N-test-${suffix}`,
      paymentMetadata: {
        paymentProvider: 'zopayo',
        callbackTest: true
      }
    });

    const results = await Promise.all([callback(), callback()]);
    assert.equal(results.length, 2);
    assert.ok(results.every((result) => result.status === 'completed'));

    const wallet = await pool.query(
      'SELECT balance_usd, reserved_usd FROM usd_wallet_accounts WHERE workspace_id = $1',
      [workspaceId]
    );
    assert.equal(Number(wallet.rows[0].balance_usd), 10,
      'two concurrent callbacks for the same $10 transaction must credit only $10 total');
    assert.equal(Number(wallet.rows[0].reserved_usd), 0);

    const ledger = await pool.query(
      `SELECT amount_usd FROM usd_wallet_ledger
       WHERE workspace_id = $1 AND type = 'topup' AND reference_type = 'billing_transaction' AND reference_id = $2`,
      [workspaceId, transactionId]
    );
    assert.equal(ledger.rowCount, 1, 'one completed transaction must produce one top-up ledger entry');
    assert.equal(Number(ledger.rows[0].amount_usd), 10);

    const stored = await pool.query(
      'SELECT status FROM billing_transactions WHERE id = $1',
      [transactionId]
    );
    assert.equal(stored.rows[0].status, 'completed');
  } finally {
    if (workspaceId) {
      await pool.query('DELETE FROM usd_wallet_ledger WHERE workspace_id = $1', [workspaceId]);
      await pool.query('DELETE FROM usd_wallet_reservations WHERE workspace_id = $1', [workspaceId]);
      await pool.query('DELETE FROM usd_wallet_accounts WHERE workspace_id = $1', [workspaceId]);
      if (transactionId) await pool.query('DELETE FROM billing_transactions WHERE id = $1', [transactionId]);
      await pool.query('DELETE FROM credit_ledger WHERE workspace_id = $1', [workspaceId]);
      await pool.query('DELETE FROM credit_accounts WHERE workspace_id = $1', [workspaceId]);
      await pool.query('DELETE FROM api_keys WHERE workspace_id = $1', [workspaceId]);
      await pool.query('DELETE FROM workspaces WHERE id = $1', [workspaceId]);
    }
    if (developerId) await pool.query('DELETE FROM developers WHERE id = $1', [developerId]);
    await pool.end();
  }
});
