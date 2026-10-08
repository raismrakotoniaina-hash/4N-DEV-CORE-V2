function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeCurrency(value) {
  return String(value || '').trim().toUpperCase();
}

export function createBillingRepository(db) {
  return {
    async listPackages({ currency } = {}) {
      if (!db) throw new Error('database_not_configured');

      const params = [];
      let where = 'p.active = true AND pp.active = true';

      if (currency) {
        params.push(normalizeCurrency(currency));
        where += ' AND pp.currency = $1';
      }

      const result = await db.query(
        `SELECT
           p.id,
           p.code,
           p.name,
           p.credits,
           pp.currency,
           pp.amount
         FROM credit_packages p
         JOIN credit_package_prices pp ON pp.package_id = p.id
         WHERE ${where}
         ORDER BY p.credits ASC, pp.amount ASC`,
        params
      );

      return result.rows;
    },

    async getPackagePrice({ code, currency }) {
      if (!db) throw new Error('database_not_configured');

      const result = await db.query(
        `SELECT
           p.id,
           p.code,
           p.name,
           p.credits,
           pp.currency,
           pp.amount
         FROM credit_packages p
         JOIN credit_package_prices pp ON pp.package_id = p.id
         WHERE p.code = $1
           AND p.active = true
           AND pp.currency = $2
           AND pp.active = true
         LIMIT 1`,
        [code, normalizeCurrency(currency)]
      );

      return result.rows[0] || null;
    },

    async createPendingTransaction({
      workspaceId,
      packageCode,
      currency,
      paymentProvider,
      paymentReference,
      metadata = {}
    }) {
      if (!db) throw new Error('database_not_configured');

      const packagePrice = await this.getPackagePrice({
        code: packageCode,
        currency
      });

      if (!packagePrice) {
        const error = new Error('package_not_available');
        error.code = 'package_not_available';
        throw error;
      }

      const result = await db.query(
        `INSERT INTO billing_transactions
         (workspace_id, package_id, amount, currency, credits, payment_provider, payment_reference, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          workspaceId,
          packagePrice.id,
          packagePrice.amount,
          packagePrice.currency,
          packagePrice.credits,
          paymentProvider || null,
          paymentReference || null,
          JSON.stringify(metadata)
        ]
      );

      return {
        ...result.rows[0],
        package_code: packagePrice.code,
        package_name: packagePrice.name
      };
    },

    async getTransaction({ id, paymentProvider, paymentReference, providerTransactionId }) {
      if (!db) throw new Error('database_not_configured');

      if (id) {
        const result = await db.query(
          'SELECT * FROM billing_transactions WHERE id = $1 LIMIT 1',
          [id]
        );
        return result.rows[0] || null;
      }

      if (paymentProvider && paymentReference) {
        const result = await db.query(
          `SELECT * FROM billing_transactions
           WHERE payment_provider = $1 AND payment_reference = $2
           LIMIT 1`,
          [paymentProvider, paymentReference]
        );
        return result.rows[0] || null;
      }

      if (paymentProvider && providerTransactionId) {
        const result = await db.query(
          `SELECT * FROM billing_transactions
           WHERE payment_provider = $1 AND provider_transaction_id = $2
           LIMIT 1`,
          [paymentProvider, providerTransactionId]
        );
        return result.rows[0] || null;
      }

      return null;
    },

    async completeTransaction({
      transactionId,
      providerTransactionId,
      paymentReference,
      paymentMetadata = {}
    }) {
      if (!db) throw new Error('database_not_configured');

      const client = await db.connect();

      try {
        await client.query('BEGIN');

        let transactionResult;

        if (transactionId) {
          transactionResult = await client.query(
            'SELECT * FROM billing_transactions WHERE id = $1 FOR UPDATE',
            [transactionId]
          );
        } else if (providerTransactionId) {
          transactionResult = await client.query(
            `SELECT * FROM billing_transactions
             WHERE payment_provider = $1 AND provider_transaction_id = $2
             FOR UPDATE`,
            [paymentMetadata.paymentProvider, providerTransactionId]
          );
        } else if (paymentReference) {
          transactionResult = await client.query(
            `SELECT * FROM billing_transactions
             WHERE payment_provider = $1 AND payment_reference = $2
             FOR UPDATE`,
            [paymentMetadata.paymentProvider, paymentReference]
          );
        } else {
          throw new Error('billing_transaction_identifier_required');
        }

        const transaction = transactionResult.rows[0];
        if (!transaction) throw new Error('billing_transaction_not_found');

        if (transaction.status === 'completed') {
          await client.query('COMMIT');
          return transaction;
        }

        if (transaction.status !== 'pending') {
          throw new Error('billing_transaction_not_pending');
        }

        const accountResult = await client.query(
          `SELECT balance
           FROM credit_accounts
           WHERE workspace_id = $1
           FOR UPDATE`,
          [transaction.workspace_id]
        );

        let balanceBefore = 0;

        if (!accountResult.rows[0]) {
          await client.query(
            `INSERT INTO credit_accounts (workspace_id, balance, reserved_balance)
             VALUES ($1, 0, 0)
             ON CONFLICT (workspace_id) DO NOTHING`,
            [transaction.workspace_id]
          );
        }

        const lockedAccount = await client.query(
          `SELECT balance
           FROM credit_accounts
           WHERE workspace_id = $1
           FOR UPDATE`,
          [transaction.workspace_id]
        );

        if (!lockedAccount.rows[0]) throw new Error('credit_account_not_found');

        balanceBefore = asNumber(lockedAccount.rows[0].balance);
        const credits = asNumber(transaction.credits);
        const balanceAfter = balanceBefore + credits;

        await client.query(
          `UPDATE credit_accounts
           SET balance = $1,
               updated_at = now()
           WHERE workspace_id = $2`,
          [balanceAfter, transaction.workspace_id]
        );

        const providerTx = providerTransactionId || transaction.provider_transaction_id;
        const reference = paymentReference || transaction.payment_reference;

        await client.query(
          `UPDATE billing_transactions
           SET status = 'completed',
               provider_transaction_id = COALESCE($1, provider_transaction_id),
               payment_reference = COALESCE($2, payment_reference),
               metadata = metadata || $3::jsonb,
               completed_at = now()
           WHERE id = $4`,
          [
            providerTx || null,
            reference || null,
            JSON.stringify(paymentMetadata),
            transaction.id
          ]
        );

        await client.query(
          `INSERT INTO credit_ledger
           (workspace_id, amount, type, reference_id, reference_type,
            balance_before, balance_after, metadata)
           VALUES ($1, $2, 'purchase', $3, 'billing_transaction', $4, $5, $6)`,
          [
            transaction.workspace_id,
            credits,
            transaction.id,
            balanceBefore,
            balanceAfter,
            JSON.stringify({
              packageId: transaction.package_id,
              amount: transaction.amount,
              currency: transaction.currency,
              credits,
              paymentProvider: transaction.payment_provider,
              providerTransactionId: providerTx || null,
              paymentReference: reference || null
            })
          ]
        );

        const completed = await client.query(
          'SELECT * FROM billing_transactions WHERE id = $1',
          [transaction.id]
        );

        await client.query('COMMIT');
        return completed.rows[0];
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async updateCheckoutMetadata({ transactionId, checkout }) {
      if (!db) throw new Error('database_not_configured');

      const result = await db.query(
        `UPDATE billing_transactions
         SET metadata = metadata || $1::jsonb
         WHERE id = $2
         RETURNING *`,
        [JSON.stringify({ checkout }), transactionId]
      );

      return result.rows[0] || null;
    },

    async updateStatus({ transactionId, status, metadata = {} }) {
      if (!db) throw new Error('database_not_configured');

      const allowed = new Set(['failed', 'cancelled', 'refunded']);
      if (!allowed.has(status)) throw new Error('invalid_billing_status');

      const result = await db.query(
        `UPDATE billing_transactions
         SET status = $1,
             metadata = metadata || $2::jsonb
         WHERE id = $3
           AND status = 'pending'
         RETURNING *`,
        [status, JSON.stringify(metadata), transactionId]
      );

      return result.rows[0] || null;
    }
  };
}
