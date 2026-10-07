export function createSessionsRepository(db) {
  return {
    async create({ developerId, tokenHash, expiresAt, userAgent = null }) {
      const result = await db.query(
        'INSERT INTO sessions (developer_id, token_hash, expires_at, user_agent) VALUES ($1, $2, $3, $4) RETURNING id, developer_id, expires_at, created_at',
        [developerId, tokenHash, expiresAt, userAgent]
      );
      return result.rows[0];
    },
    async findActiveByHash(tokenHash) {
      const result = await db.query(
        'SELECT id, developer_id, expires_at FROM sessions WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now() LIMIT 1',
        [tokenHash]
      );
      return result.rows[0] || null;
    },
    async revoke(tokenHash) {
      await db.query('UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [tokenHash]);
    }
  };
}
