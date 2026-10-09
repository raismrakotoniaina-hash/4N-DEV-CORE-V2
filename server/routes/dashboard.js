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
      const [accountResult, usageResult] = await Promise.all([
        db.query(
          `SELECT balance, reserved_balance, monthly_limit
           FROM credit_accounts
           WHERE workspace_id = $1
           LIMIT 1`,
          [workspaceId]
        ),
        db.query(
          `SELECT
             COUNT(*)::integer AS requests,
             COALESCE(SUM(credits), 0)::integer AS credits_used,
             CASE WHEN COUNT(*) = 0 THEN NULL
               ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'success') / COUNT(*), 1)
             END AS success_rate
           FROM usage_records
           WHERE workspace_id = $1
             AND created_at >= date_trunc('month', now())`,
          [workspaceId]
        )
      ]);

      const account = accountResult.rows[0] || { balance: 0, reserved_balance: 0, monthly_limit: 0 };
      const usage = usageResult.rows[0] || { requests: 0, credits_used: 0, success_rate: null };
      const balance = Number(account.balance || 0);
      const reserved = Number(account.reserved_balance || 0);

      return res.json({
        success: true,
        workspace: {
          id: workspaceId,
          name: req.workspace.name,
          plan: 'Prepaid credits',
          credits: Math.max(0, balance - reserved),
          monthlyCredits: Number(account.monthly_limit || 0)
        },
        usage: {
          requests: Number(usage.requests || 0),
          creditsUsed: Number(usage.credits_used || 0),
          successRate: usage.success_rate === null ? null : Number(usage.success_rate)
        },
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
