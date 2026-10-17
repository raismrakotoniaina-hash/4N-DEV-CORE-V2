import { Router } from 'express';
import { requireSameOrigin } from '../middleware/csrf.js';

export default function createDashboardRouter({ db, sessionMiddleware, corsOrigin }) {
  const router = Router();
  router.use(sessionMiddleware);
  router.use(requireSameOrigin({ allowedOrigin: corsOrigin }));

  router.get('/', async (req, res, next) => {
    try {
      if (!db) {
        return res.status(503).json({
          success: false,
          error: { code: 'database_unavailable', message: 'Dashboard data requires the Core database.' },
          requestId: req.requestId
        });
      }

      const workspaceId = req.workspace.id;
      const [accountResult, usageResult, ratesResult, customerPricingResult] = await Promise.all([
        db.query(
          `SELECT balance, reserved_balance
           FROM credit_accounts
           WHERE workspace_id = $1
           LIMIT 1`,
          [workspaceId]
        ),
        db.query(
          `SELECT
             COUNT(*)::integer AS requests,
             COALESCE(SUM(credits), 0) AS credits_used,
             COALESCE(SUM(charged_usd), SUM(credits) / 100.0, 0) AS spend_usd,
             COALESCE(SUM(input_tokens), 0) AS input_tokens,
             COALESCE(SUM(output_tokens), 0) AS output_tokens,
             CASE WHEN COUNT(*) = 0 THEN NULL
               ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'success') / COUNT(*), 1)
             END AS success_rate
           FROM usage_records
           WHERE workspace_id = $1
             AND created_at >= date_trunc('month', now())`,
          [workspaceId]
        ),
        db.query(
          `SELECT currency, usd_to_currency
           FROM display_exchange_rates
           WHERE currency IN ('EUR', 'MGA')`
        ),
        db.query(
          `SELECT public_model, service, input_price_per_1m_usd, cached_input_price_per_1m_usd, output_price_per_1m_usd, image_price_usd
           FROM customer_model_pricing
           WHERE status = 'active' AND effective_from <= now()
             AND (effective_to IS NULL OR effective_to > now())
           ORDER BY service, public_model`
        )
      ]);

      const account = accountResult.rows[0] || { balance: 0, reserved_balance: 0 };
      const usage = usageResult.rows[0] || {};
      const balance = Number(account.balance || 0);
      const reserved = Number(account.reserved_balance || 0);
      const availableUsd = Math.max(0, balance - reserved) / 100;
      const rates = Object.fromEntries(
        ratesResult.rows.map((row) => [row.currency, Number(row.usd_to_currency)])
      );
      const money = (usd, currency) => Number.isFinite(rates[currency])
        ? Number((usd * rates[currency]).toFixed(2))
        : null;

      return res.json({
        success: true,
        workspace: {
          id: workspaceId,
          name: req.workspace.name,
          plan: 'Prepaid USD',
          currency: 'USD',
          credits: Math.max(0, balance - reserved),
          balanceUsd: Number((balance / 100).toFixed(6)),
          reservedUsd: Number((reserved / 100).toFixed(6)),
          availableBalanceUsd: Number(availableUsd.toFixed(6)),
          availableBalanceEur: money(availableUsd, 'EUR'),
          availableBalanceMga: money(availableUsd, 'MGA'),
          monthlyCredits: 0
        },
        usage: {
          requests: Number(usage.requests || 0),
          creditsUsed: Number(usage.credits_used || 0),
          spendUsd: Number(usage.spend_usd || 0),
          spendEur: money(Number(usage.spend_usd || 0), 'EUR'),
          spendMga: money(Number(usage.spend_usd || 0), 'MGA'),
          inputTokens: Number(usage.input_tokens || 0),
          outputTokens: Number(usage.output_tokens || 0),
          totalTokens: Number(usage.input_tokens || 0) + Number(usage.output_tokens || 0),
          successRate: usage.success_rate === null || usage.success_rate === undefined
            ? null
            : Number(usage.success_rate)
        },
        customerPricing: customerPricingResult.rows.map((row) => ({
          model: row.public_model,
          service: row.service,
          inputPricePer1MUsd: row.input_price_per_1m_usd === null ? null : Number(row.input_price_per_1m_usd),
          cachedInputPricePer1MUsd: row.cached_input_price_per_1m_usd === null ? null : Number(row.cached_input_price_per_1m_usd),
          outputPricePer1MUsd: row.output_price_per_1m_usd === null ? null : Number(row.output_price_per_1m_usd),
          imagePriceUsd: row.image_price_usd === null ? null : Number(row.image_price_usd)
        })),
        exchangeRatesUpdated: ratesResult.rows.length > 0,
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
