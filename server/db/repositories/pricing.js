export function createPricingRepository(db) {
  return {
    async getActivePricing({ provider, providerModel, service }) {
      if (!db) throw new Error('database_not_configured');

      const result = await db.query(
        `SELECT
           id,
           provider,
           provider_model,
           service,
           input_cost_per_1m_usd,
           output_cost_per_1m_usd,
           image_cost_usd,
           margin_multiplier,
           effective_from,
           effective_to,
           status
         FROM provider_pricing
         WHERE provider = $1
           AND provider_model = $2
           AND service = $3
           AND status = 'active'
           AND effective_from <= now()
           AND (effective_to IS NULL OR effective_to > now())
         ORDER BY effective_from DESC
         LIMIT 1`,
        [provider, providerModel, service]
      );

      return result.rows[0] || null;
    }
  };
}
