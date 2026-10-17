import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import { createUsdWalletRepository } from './usd-wallet.js';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

test('USD wallet serializes concurrent reservations and settles idempotently', {
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

  try {
    const developer = await pool.query(
      `INSERT INTO developers (email, full_name, password_hash)
       VALUES ($1, $2, $3) RETURNING id`,
      [`wallet-test-${suffix}@example.invalid`, 'Wallet Integration Test', 'not-a-real-password-hash']
    );
    developerId = developer.rows[0].id;

    const workspace = await pool.query(
      `INSERT INTO workspaces (name, slug, owner_developer_id)
       VALUES ($1, $2, $3) RETURNING id`,
      ['Wallet integration test', `wallet-test-${suffix}`, developerId]
    );
    workspaceId = workspace.rows[0].id;

    await pool.query(
      'INSERT INTO usd_wallet_accounts (workspace_id, balance_usd) VALUES ($1, 10)',
      [workspaceId]
    );

    const wallet = createUsdWalletRepository(pool);
    const requestA = `wallet-test-${suffix}-a`;
    const requestB = `wallet-test-${suffix}-b`;
    const outcomes = await Promise.allSettled([
      wallet.reserve({ workspaceId, requestId: requestA, amountUsd: 7 }),
      wallet.reserve({ workspaceId, requestId: requestB, amountUsd: 7 })
    ]);

    assert.equal(outcomes.filter((item) => item.status === 'fulfilled').length, 1,
      'only one concurrent $7 reservation should succeed against a $10 wallet');
    assert.equal(outcomes.filter((item) => item.status === 'rejected' && item.reason?.code === 'insufficient_usd_balance').length, 1,
      'the other concurrent reservation should fail for insufficient balance');

    const successful = outcomes.find((item) => item.status === 'fulfilled').value;
    const beforeSettlement = await wallet.getAccount(workspaceId);
    assert.equal(Number(beforeSettlement.balance_usd), 10);
    assert.equal(Number(beforeSettlement.reserved_usd), 7);
    assert.equal(Number(beforeSettlement.available_usd), 3);

    const requestId = successful.request_id;
    const reservationId = successful.id;
    const metadata = {
      requestId,
      service: 'chat',
      publicModel: 'test-model',
      inputTokens: 10,
      cachedInputTokens: 2,
      outputTokens: 5,
      providerCostUsd: 0.01,
      marginMultiplier: 1.6667
    };

    await wallet.settle({ reservationId, workspaceId, chargedUsd: 5, metadata });
    await wallet.settle({ reservationId, workspaceId, chargedUsd: 5, metadata });
    await assert.rejects(
      wallet.settle({ reservationId, workspaceId, chargedUsd: 4, metadata }),
      /usd_reservation_already_settled_differently/
    );

    const account = await wallet.getAccount(workspaceId);
    assert.equal(Number(account.balance_usd), 5);
    assert.equal(Number(account.reserved_usd), 0);
    assert.equal(Number(account.available_usd), 5);

    const ledger = await pool.query(
      `SELECT type, amount_usd FROM usd_wallet_ledger
       WHERE workspace_id = $1 AND type = 'charge' AND reference_id = $2`,
      [workspaceId, reservationId]
    );
    assert.equal(ledger.rowCount, 1, 'settling twice must create only one charge ledger row');
    assert.equal(Number(ledger.rows[0].amount_usd), -5);

    const usage = await pool.query(
      'SELECT request_id, charged_usd FROM usage_records WHERE workspace_id = $1 AND request_id = $2',
      [workspaceId, requestId]
    );
    assert.equal(usage.rowCount, 1, 'one wallet charge should create one usage record');
    assert.equal(Number(usage.rows[0].charged_usd), 5);
  } finally {
    if (workspaceId) {
      await pool.query('DELETE FROM usage_records WHERE workspace_id = $1', [workspaceId]);
      await pool.query('DELETE FROM usd_wallet_ledger WHERE workspace_id = $1', [workspaceId]);
      await pool.query('DELETE FROM usd_wallet_reservations WHERE workspace_id = $1', [workspaceId]);
      await pool.query('DELETE FROM usd_wallet_accounts WHERE workspace_id = $1', [workspaceId]);
      await pool.query('DELETE FROM credit_ledger WHERE workspace_id = $1', [workspaceId]);
      await pool.query('DELETE FROM credit_accounts WHERE workspace_id = $1', [workspaceId]);
      await pool.query('DELETE FROM api_keys WHERE workspace_id = $1', [workspaceId]);
      await pool.query('DELETE FROM workspaces WHERE id = $1', [workspaceId]);
    }
    if (developerId) await pool.query('DELETE FROM developers WHERE id = $1', [developerId]);
    await pool.end();
  }
});
