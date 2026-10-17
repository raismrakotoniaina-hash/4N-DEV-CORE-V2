import crypto from 'node:crypto';

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeCurrency(value) {
  return String(value || '').trim().toUpperCase();
}

function createPaymentReference() {
  return `4N-${crypto.randomUUID()}`;
}

export function createBillingRepository(db) {
  return {
    async listPackages({ currency } = {}) {
      if (!db) throw new Error('database_not_configured');

      const params = [];
      let where = "p.active = true AND pp.active = true AND pp.currency = 'USD'";

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
           AND pp.currency = 'USD'
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
      metadata = {}
    }) {
      if (!db) throw new Error('database_not_configured');

      // The canonical wallet is USD-only until verified FX conversion is implemented.
      if (normalizeCurrency(currency) !== 'USD') {
        const error = new Error('package_not_available');
        error.code = 'package_not_available';
        throw error;
      }

      const packagePrice = await this.getPackagePrice({
        code: packageCode,
        currency
      });

      if (!packagePrice) {
        const error = new Error('package_not_available');
        error.code = 'package_not_available';
        throw error;
      }

      const provider = paymentProvider || 'zopayo';
      const paymentReference = createPaymentReference();

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
          provider,
          paymentReference,
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

        if (String(transaction.currency).toUpperCase() !== 'USD') {
          const error = new Error('unsupported_wallet_currency');
          error.code = 'unsupported_wallet_currency';
          throw error;
        }

        const topupUsd = asNumber(transaction.amount);
        if (topupUsd <= 0) throw new Error('invalid_wallet_topup_amount');

        await client.query(
          `INSERT INTO usd_wallet_accounts (workspace_id)
           VALUES ($1) ON CONFLICT (workspace_id) DO NOTHING`,
          [transaction.workspace_id]
        );

        const walletResult = await client.query(
          `SELECT balance_usd
           FROM usd_wallet_accounts
           WHERE workspace_id = $1
           FOR UPDATE`,
          [transaction.workspace_id]
        );
        if (!walletResult.rows[0]) throw new Error('usd_wallet_account_not_found');

        const balanceBeforeUsd = asNumber(walletResult.rows[0].balance_usd);
        const balanceAfterUsd = Number((balanceBeforeUsd + topupUsd).toFixed(8));

        await client.query(
          `UPDATE usd_wallet_accounts
           SET balance_usd = $1, updated_at = now()
           WHERE workspace_id = $2`,
          [balanceAfterUsd, transaction.workspace_id]
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
          `INSERT INTO usd_wallet_ledger
           (workspace_id, amount_usd, type, reference_id, reference_type,
            balance_before_usd, balance_after_usd, metadata)
           VALUES ($1, $2, 'topup', $3, 'billing_transaction', $4, $5, $6::jsonb)`,
          [
            transaction.workspace_id,
            topupUsd,
            transaction.id,
            balanceBeforeUsd,
            balanceAfterUsd,
            JSON.stringify({
              packageId: transaction.package_id,
              amount: transaction.amount,
              currency: transaction.currency,
              paymentProvider: transaction.payment_provider,
              providerTransactionId: providerTx || null,
              paymentReference: reference || null,
              ...paymentMetadata
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
