export function createProjectsRepository(db) {
  return {
    async listByWorkspace(workspaceId) {
      const result = await db.query(
        `SELECT id, name, status, created_at AS "createdAt"
         FROM projects
         WHERE workspace_id = $1
         ORDER BY created_at DESC`,
        [workspaceId]
      );
      return result.rows;
    },

    async create({ workspaceId, name }) {
      const result = await db.query(
        `INSERT INTO projects (workspace_id, name)
         VALUES ($1, $2)
         RETURNING id, name, status, created_at AS "createdAt"`,
        [workspaceId, name]
      );
      return result.rows[0];
    },

    async archive({ id, workspaceId }) {
      const result = await db.query(
        `UPDATE projects
         SET status = 'archived', updated_at = now()
         WHERE id = $1 AND workspace_id = $2 AND status = 'active'
         RETURNING id, name, status, created_at AS "createdAt"`,
        [id, workspaceId]
      );
      return result.rows[0] || null;
    }
  };
}
