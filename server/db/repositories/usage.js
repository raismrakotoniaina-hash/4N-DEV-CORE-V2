export function createUsageRepository(db) {
  return {
    async listByWorkspace(workspaceId, { limit = 100, offset = 0 } = {}) {
      const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
      const safeOffset = Math.max(Number(offset) || 0, 0);
      const result = await db.query(
        `SELECT
           id,
           api_key_id,
           service,
           model,
           public_model,
           provider,
           provider_model,
           credits,
           request_id,
           status,
           input_tokens,
           output_tokens,
           total_tokens,
           provider_cost_usd,
           margin_multiplier,
           charged_usd,
           reservation_credits,
           refunded_credits,
           created_at
         FROM usage_records
         WHERE workspace_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [workspaceId, safeLimit, safeOffset]
      );
      return result.rows;
    }
  };
}
