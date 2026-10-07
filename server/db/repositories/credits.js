export function createCreditsRepository(db) {
  return {
    async getAccount(workspaceId) {
      if (!db) return null;

      const result = await db.query(
        `SELECT workspace_id, balance, monthly_limit, updated_at
         FROM credit_accounts
         WHERE workspace_id = $1
         LIMIT 1`,
        [workspaceId]
      );

      return result.rows[0] || null;
    },

    async recordUsage({ workspaceId, apiKeyId, service, model, credits, requestId, status }) {
      if (!db) throw new Error('database_not_configured');

      const client = await db.connect();

      try {
        await client.query('BEGIN');

        const account = await client.query(
          `SELECT balance
           FROM credit_accounts
           WHERE workspace_id = $1
           FOR UPDATE`,
          [workspaceId]
        );

        if (!account.rows[0]) {
          throw new Error('credit_account_not_found');
        }

        if (account.rows[0].balance < credits) {
          const error = new Error('insufficient_credits');
          error.code = 'insufficient_credits';
          throw error;
        }

        await client.query(
          `UPDATE credit_accounts
           SET balance = balance - $1, updated_at = now()
           WHERE workspace_id = $2`,
          [credits, workspaceId]
        );

        await client.query(
          `INSERT INTO credit_ledger
           (workspace_id, amount, type, reference_id, metadata)
           VALUES ($1, $2, 'usage', $3, $4)`,
          [workspaceId, -credits, requestId || null, JSON.stringify({ service, model })]
        );

        await client.query(
          `INSERT INTO usage_records
           (workspace_id, api_key_id, service, model, credits, request_id, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [workspaceId, apiKeyId || null, service, model || null, credits, requestId || null, status]
        );

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  };
}
