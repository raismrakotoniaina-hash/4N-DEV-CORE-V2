function amount(value, code = 'invalid_usd_amount') {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    const error = new Error(code);
    error.code = code;
    throw error;
  }
  return parsed;
}

export function createUsdWalletRepository(db) {
  if (!db) throw new Error('database_not_configured');

  async function ensureAccount(client, workspaceId) {
    await client.query(
      `INSERT INTO usd_wallet_accounts (workspace_id)
       VALUES ($1) ON CONFLICT (workspace_id) DO NOTHING`,
      [workspaceId]
    );
  }

  return {
    async getAccount(workspaceId) {
      const result = await db.query(
        `SELECT workspace_id, balance_usd, reserved_usd,
                balance_usd - reserved_usd AS available_usd, updated_at
         FROM usd_wallet_accounts WHERE workspace_id = $1 LIMIT 1`,
        [workspaceId]
      );
      return result.rows[0] || null;
    },

    async reserve({ workspaceId, apiKeyId, requestId, amountUsd, metadata = {} }) {
      const amountToReserve = amount(amountUsd);
      if (amountToReserve <= 0 || !requestId) {
        const error = new Error('invalid_usd_reservation');
        error.code = 'invalid_usd_reservation';
        throw error;
      }

      const client = await db.connect();
      try {
        await client.query('BEGIN');
        await ensureAccount(client, workspaceId);

        const existing = await client.query(
          'SELECT * FROM usd_wallet_reservations WHERE request_id = $1 FOR UPDATE',
          [requestId]
        );
        if (existing.rows[0]) {
          if (existing.rows[0].workspace_id !== workspaceId || existing.rows[0].status === 'released') {
            const error = new Error('duplicate_request_id');
            error.code = 'duplicate_request_id';
            throw error;
          }
          await client.query('COMMIT');
          return existing.rows[0];
        }

        const accountResult = await client.query(
          'SELECT balance_usd, reserved_usd FROM usd_wallet_accounts WHERE workspace_id = $1 FOR UPDATE',
          [workspaceId]
        );
        const account = accountResult.rows[0];
        const balance = Number(account.balance_usd);
        const reserved = Number(account.reserved_usd);
        if (balance - reserved + 0.000000001 < amountToReserve) {
          const error = new Error('insufficient_usd_balance');
          error.code = 'insufficient_usd_balance';
          error.status = 402;
          error.expose = true;
          throw error;
        }

        await client.query(
          'UPDATE usd_wallet_accounts SET reserved_usd = reserved_usd + $1, updated_at = now() WHERE workspace_id = $2',
          [amountToReserve, workspaceId]
        );
        const inserted = await client.query(
          `INSERT INTO usd_wallet_reservations
             (workspace_id, api_key_id, request_id, reserved_usd, metadata)
           VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING *`,
          [workspaceId, apiKeyId || null, requestId, amountToReserve, JSON.stringify(metadata)]
        );
        await client.query(
          `INSERT INTO usd_wallet_ledger
             (workspace_id, amount_usd, type, reference_id, reference_type,
              balance_before_usd, balance_after_usd, metadata)
           VALUES ($1, 0, 'reservation', $2, 'usd_wallet_reservation', $3, $3, $4::jsonb)`,
          [workspaceId, inserted.rows[0].id, balance, JSON.stringify({ requestId, reservedUsd: amountToReserve, ...metadata })]
        );
        await client.query('COMMIT');
        return inserted.rows[0];
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async settle({ reservationId, workspaceId, chargedUsd, metadata = {} }) {
      const charge = amount(chargedUsd, 'invalid_usd_settlement');
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        const reservationResult = await client.query(
          'SELECT * FROM usd_wallet_reservations WHERE id = $1 AND workspace_id = $2 FOR UPDATE',
          [reservationId, workspaceId]
        );
        const reservation = reservationResult.rows[0];
        if (!reservation) throw new Error('usd_reservation_not_found');
        if (reservation.status === 'settled') {
          if (Math.abs(Number(reservation.settled_usd) - charge) > 0.00000001) {
            throw new Error('usd_reservation_already_settled_differently');
          }
          await client.query('COMMIT');
          return reservation;
        }
        if (reservation.status !== 'reserved') throw new Error('usd_reservation_not_active');
        const reserved = Number(reservation.reserved_usd);
        if (charge > reserved + 0.00000001) throw new Error('usd_settlement_exceeds_reservation');

        const accountResult = await client.query(
          'SELECT balance_usd, reserved_usd FROM usd_wallet_accounts WHERE workspace_id = $1 FOR UPDATE',
          [workspaceId]
        );
        const balance = Number(accountResult.rows[0].balance_usd);
        const reservedBalance = Number(accountResult.rows[0].reserved_usd);
        if (charge > balance + 0.00000001 || reserved > reservedBalance + 0.00000001) {
          throw new Error('usd_wallet_invariant_violation');
        }
        const newBalance = Math.max(0, balance - charge);
        const newReserved = Math.max(0, reservedBalance - reserved);
        await client.query(
          'UPDATE usd_wallet_accounts SET balance_usd = $1, reserved_usd = $2, updated_at = now() WHERE workspace_id = $3',
          [newBalance, newReserved, workspaceId]
        );
        await client.query(
          `UPDATE usd_wallet_reservations
           SET settled_usd = $1, status = 'settled', settled_at = now()
           WHERE id = $2`,
          [charge, reservationId]
        );
        await client.query(
          `INSERT INTO usd_wallet_ledger
             (workspace_id, amount_usd, type, reference_id, reference_type,
              balance_before_usd, balance_after_usd, metadata)
           VALUES ($1, $2, 'charge', $3, 'usd_wallet_reservation', $4, $5, $6::jsonb)`,
          [workspaceId, -charge, reservationId, balance, newBalance, JSON.stringify(metadata)]
        );
        await client.query('COMMIT');
        return { ...reservation, settled_usd: charge, status: 'settled' };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async release({ reservationId, workspaceId, metadata = {} }) {
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        const reservationResult = await client.query(
          'SELECT * FROM usd_wallet_reservations WHERE id = $1 AND workspace_id = $2 FOR UPDATE',
          [reservationId, workspaceId]
        );
        const reservation = reservationResult.rows[0];
        if (!reservation) throw new Error('usd_reservation_not_found');
        if (reservation.status !== 'reserved') {
          await client.query('COMMIT');
          return reservation;
        }
        const accountResult = await client.query(
          'SELECT balance_usd, reserved_usd FROM usd_wallet_accounts WHERE workspace_id = $1 FOR UPDATE',
          [workspaceId]
        );
        const balance = Number(accountResult.rows[0].balance_usd);
        const reservedBalance = Number(accountResult.rows[0].reserved_usd);
        const reserved = Number(reservation.reserved_usd);
        if (reserved > reservedBalance + 0.00000001) throw new Error('usd_wallet_invariant_violation');
        await client.query(
          'UPDATE usd_wallet_accounts SET reserved_usd = $1, updated_at = now() WHERE workspace_id = $2',
          [Math.max(0, reservedBalance - reserved), workspaceId]
        );
        await client.query(
          `UPDATE usd_wallet_reservations SET status = 'released', settled_at = now()
           WHERE id = $1`,
          [reservationId]
        );
        await client.query(
          `INSERT INTO usd_wallet_ledger
             (workspace_id, amount_usd, type, reference_id, reference_type,
              balance_before_usd, balance_after_usd, metadata)
           VALUES ($1, 0, 'release', $2, 'usd_wallet_reservation', $3, $3, $4::jsonb)`,
          [workspaceId, reservationId, balance, JSON.stringify(metadata)]
        );
        await client.query('COMMIT');
        return { ...reservation, status: 'released' };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  };
}
