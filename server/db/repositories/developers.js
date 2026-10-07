export function createDevelopersRepository(db) {
  return {
    async findByEmail(email) {
      const result = await db.query(
        'SELECT id, email, full_name, password_hash, status FROM developers WHERE email = $1 LIMIT 1',
        [email]
      );
      return result.rows[0] || null;
    },
    async findById(id) {
      const result = await db.query(
        'SELECT id, email, full_name, status, created_at FROM developers WHERE id = $1 LIMIT 1',
        [id]
      );
      return result.rows[0] || null;
    },
    async createWithWorkspace({ email, fullName, passwordHash, workspaceName, workspaceSlug, initialCredits = 0 }) {
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        const developer = await client.query(
          'INSERT INTO developers (email, full_name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, full_name, status, created_at',
          [email, fullName, passwordHash]
        );
        const workspace = await client.query(
          'INSERT INTO workspaces (name, slug, owner_developer_id) VALUES ($1, $2, $3) RETURNING id, name, slug, status',
          [workspaceName, workspaceSlug, developer.rows[0].id]
        );
        await client.query(
          'INSERT INTO credit_accounts (workspace_id, balance, monthly_limit) VALUES ($1, $2, $3)',
          [workspace.rows[0].id, initialCredits, initialCredits]
        );
        await client.query('COMMIT');
        return { developer: developer.rows[0], workspace: workspace.rows[0] };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  };
}
