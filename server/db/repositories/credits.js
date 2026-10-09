function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function createCreditsRepository(db) {
  return {
    async getAccount(workspaceId) {
      if (!db) return null;

      const result = await db.query(
        `SELECT workspace_id, balance, reserved_balance, monthly_limit, updated_at
         FROM credit_accounts
         WHERE workspace_id = $1
         LIMIT 1`,
        [workspaceId]
      );

      if (!result.rows[0]) return null;

      const row = result.rows[0];
      const balance = asNumber(row.balance);
      const reservedBalance = asNumber(row.reserved_balance);
      const monthlyLimit = asNumber(row.monthly_limit);

      return {
        ...row,
        balance,
        reserved_balance: reservedBalance,
        monthly_limit: monthlyLimit,
        available_balance: Math.max(0, balance - reservedBalance)
      };
    },

    async reserve({ workspaceId, apiKeyId, requestId, credits, metadata = {} }) {
      if (!db) throw new Error('database_not_configured');

      const amount = Number(credits);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('invalid_reservation_amount');
      }

      const client = await db.connect();

      try {
        await client.query('BEGIN');

        const existing = await client.query(
          `SELECT *
           FROM credit_reservations
           WHERE request_id = $1
           LIMIT 1
           FOR UPDATE`,
          [requestId]
        );

        if (existing.rows[0]) {
          await client.query('COMMIT');
          return existing.rows[0];
        }

        const accountResult = await client.query(
          `SELECT balance, reserved_balance
           FROM credit_accounts
           WHERE workspace_id = $1
           FOR UPDATE`,
          [workspaceId]
        );

        if (!accountResult.rows[0]) {
          throw new Error('credit_account_not_found');
        }

        const balance = asNumber(accountResult.rows[0].balance);
        const reservedBalance = asNumber(accountResult.rows[0].reserved_balance);
        const available = balance - reservedBalance;

        if (available < amount) {
          const error = new Error('insufficient_credits');
          error.code = 'insufficient_credits';
          throw error;
        }

        await client.query(
          `UPDATE credit_accounts
           SET reserved_balance = reserved_balance + $1,
               updated_at = now()
           WHERE workspace_id = $2`,
          [amount, workspaceId]
        );

        const reservation = await client.query(
          `INSERT INTO credit_reservations
           (workspace_id, api_key_id, request_id, reserved_credits)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [workspaceId, apiKeyId || null, requestId, amount]
        );

        await client.query(
          `INSERT INTO credit_ledger
           (workspace_id, amount, type, reference_id, reference_type, balance_before, balance_after, metadata)
           VALUES ($1, 0, 'reservation', $2, 'credit_reservation', $3, $3, $4)`,
          [
            workspaceId,
            reservation.rows[0].id,
            balance,
            JSON.stringify({ requestId, reservedCredits: amount, ...metadata })
          ]
        );

        await client.query('COMMIT');
        return reservation.rows[0];
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async settle({
      reservationId,
      workspaceId,
      apiKeyId,
      requestId,
      service,
      publicModel,
      provider,
      providerModel,
      inputTokens = 0,
      outputTokens = 0,
      providerCostUsd,
      marginMultiplier,
      chargedUsd,
      chargedCredits,
      metadata = {}
    }) {
      if (!db) throw new Error('database_not_configured');

      const amount = Number(chargedCredits);
      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error('invalid_settlement_amount');
      }

      const client = await db.connect();

      try {
        await client.query('BEGIN');

        const reservationResult = await client.query(
          `SELECT *
           FROM credit_reservations
           WHERE id = $1
             AND workspace_id = $2
           FOR UPDATE`,
          [reservationId, workspaceId]
        );

        const reservation = reservationResult.rows[0];
        if (!reservation) throw new Error('credit_reservation_not_found');

        if (reservation.status !== 'reserved') {
          await client.query('COMMIT');
          return reservation;
        }

        const reserved = asNumber(reservation.reserved_credits);
        if (amount > reserved + 0.000001) {
          throw new Error('settlement_exceeds_reservation');
        }

        const accountResult = await client.query(
          `SELECT balance, reserved_balance
           FROM credit_accounts
           WHERE workspace_id = $1
           FOR UPDATE`,
          [workspaceId]
        );

        if (!accountResult.rows[0]) throw new Error('credit_account_not_found');

        const balance = asNumber(accountResult.rows[0].balance);
        const reservedBalance = asNumber(accountResult.rows[0].reserved_balance);
        const newBalance = balance - amount;
        if (newBalance < -0.000001) {
          const error = new Error('insufficient_credits');
          error.code = 'insufficient_credits';
          throw error;
        }

        const refunded = Math.max(0, reserved - amount);
        const newReservedBalance = Math.max(0, reservedBalance - reserved);

        await client.query(
          `UPDATE credit_accounts
           SET balance = $1,
               reserved_balance = $2,
               updated_at = now()
           WHERE workspace_id = $3`,
          [Math.max(0, newBalance), newReservedBalance, workspaceId]
        );

        await client.query(
          `UPDATE credit_reservations
           SET settled_credits = $1,
               refunded_credits = $2,
               status = 'settled',
               settled_at = now()
           WHERE id = $3`,
          [amount, refunded, reservationId]
        );

        await client.query(
          `INSERT INTO credit_ledger
           (workspace_id, amount, type, reference_id, reference_type, balance_before, balance_after, metadata)
           VALUES ($1, $2, 'usage', $3, 'credit_reservation', $4, $5, $6)`,
          [
            workspaceId,
            -amount,
            reservationId,
            balance,
            Math.max(0, newBalance),
            JSON.stringify({ requestId, service, publicModel, provider, providerModel, ...metadata })
          ]
        );

        await client.query(
          `INSERT INTO usage_records
           (workspace_id, api_key_id, service, model, public_model, provider, provider_model,
            credits, request_id, status, input_tokens, output_tokens, total_tokens,
            provider_cost_usd, margin_multiplier, charged_usd, reservation_credits, refunded_credits)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'success', $10, $11, $12, $13, $14, $15, $16, $17)`,
          [
            workspaceId,
            apiKeyId || null,
            service,
            publicModel,
            publicModel,
            provider,
            providerModel,
            amount,
            requestId || null,
            Number(inputTokens) || 0,
            Number(outputTokens) || 0,
            (Number(inputTokens) || 0) + (Number(outputTokens) || 0),
            Number(providerCostUsd) || 0,
            Number(marginMultiplier) || 0,
            Number(chargedUsd) || 0,
            reserved,
            refunded
          ]
        );

        await client.query('COMMIT');

        return {
          ...reservation,
          settled_credits: amount,
          refunded_credits: refunded,
          status: 'settled'
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async failReservation({ reservationId, workspaceId, reason, metadata = {} }) {
      if (!db) throw new Error('database_not_configured');

      const client = await db.connect();

      try {
        await client.query('BEGIN');

        const reservationResult = await client.query(
          `SELECT *
           FROM credit_reservations
           WHERE id = $1
             AND workspace_id = $2
           FOR UPDATE`,
          [reservationId, workspaceId]
        );

        const reservation = reservationResult.rows[0];
        if (!reservation) throw new Error('credit_reservation_not_found');

        if (reservation.status !== 'reserved') {
          await client.query('COMMIT');
          return reservation;
        }

        const reserved = asNumber(reservation.reserved_credits);

        const accountResult = await client.query(
          `SELECT balance, reserved_balance
           FROM credit_accounts
           WHERE workspace_id = $1
           FOR UPDATE`,
          [workspaceId]
        );

        if (!accountResult.rows[0]) throw new Error('credit_account_not_found');

        const balance = asNumber(accountResult.rows[0].balance);
        const reservedBalance = asNumber(accountResult.rows[0].reserved_balance);

        await client.query(
          `UPDATE credit_accounts
           SET reserved_balance = $1,
               updated_at = now()
           WHERE workspace_id = $2`,
          [Math.max(0, reservedBalance - reserved), workspaceId]
        );

        await client.query(
          `UPDATE credit_reservations
           SET refunded_credits = reserved_credits,
               status = 'failed',
               settled_at = now()
           WHERE id = $1`,
          [reservationId]
        );

        await client.query(
          `INSERT INTO credit_ledger
           (workspace_id, amount, type, reference_id, reference_type, balance_before, balance_after, metadata)
           VALUES ($1, 0, 'refund', $2, 'credit_reservation', $3, $3, $4)`,
          [
            workspaceId,
            reservationId,
            balance,
            JSON.stringify({ reason, refundedCredits: reserved, ...metadata })
          ]
        );

        await client.query('COMMIT');

        return {
          ...reservation,
          refunded_credits: reserved,
          status: 'failed'
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async recordNonBillableUsage({
      workspaceId,
      apiKeyId,
      service,
      publicModel,
      provider,
      providerModel,
      inputTokens = 0,
      outputTokens = 0,
      requestId,
      status = 'success'
    }) {
      if (!db) throw new Error('database_not_configured');

      await db.query(
        `INSERT INTO usage_records
         (workspace_id, api_key_id, service, model, public_model, provider, provider_model,
          credits, request_id, status, input_tokens, output_tokens, total_tokens,
          provider_cost_usd, margin_multiplier, charged_usd, reservation_credits, refunded_credits)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, $10, $11, $12, 0, 0, 0, 0, 0)`,
        [
          workspaceId,
          apiKeyId || null,
          service,
          publicModel,
          publicModel,
          provider,
          providerModel,
          requestId || null,
          status,
          Number(inputTokens) || 0,
          Number(outputTokens) || 0,
          (Number(inputTokens) || 0) + (Number(outputTokens) || 0)
        ]
      );
    }
  };
}
