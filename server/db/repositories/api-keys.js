export function createApiKeyRepository(db) {
  return {
    async findActiveByHash(keyHash) {
      if (!db) return null;

      const result = await db.query(
        `SELECT id, workspace_id, name, key_prefix, key_hash, status, created_at
         FROM api_keys
         WHERE key_hash = $1 AND status = 'active'
         LIMIT 1`,
        [keyHash]
      );

      return result.rows[0] || null;
    },

    async listByWorkspace(workspaceId) {
      if (!db) return [];
      const result = await db.query(
        `SELECT id, name, key_prefix, status, created_at, revoked_at
         FROM api_keys WHERE workspace_id = $1 ORDER BY created_at DESC`,
        [workspaceId]
      );
      return result.rows;
    },

    async insert({ workspaceId, name, keyPrefix, keyHash }) {
      if (!db) throw new Error('database_not_configured');

      const result = await db.query(
        `INSERT INTO api_keys (workspace_id, name, key_prefix, key_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING id, workspace_id, name, key_prefix, key_hash, status, created_at`,
        [workspaceId, name, keyPrefix, keyHash]
      );

      return result.rows[0];
    },

    async revoke(id, workspaceId) {
      if (!db) throw new Error('database_not_configured');

      const result = await db.query(
        `UPDATE api_keys
         SET status = 'revoked', revoked_at = now()
         WHERE id = $1 AND workspace_id = $2 AND status = 'active'
         RETURNING id, status, revoked_at`,
        [id, workspaceId]
      );

      return result.rows[0] || null;
    }
  };
}
