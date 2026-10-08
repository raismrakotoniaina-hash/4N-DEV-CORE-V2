import express from 'express';

export default function createBillingRouter({ billingService, sessionMiddleware }) {
  const router = express.Router();

  router.use(sessionMiddleware);

  router.get('/packages', async (req, res, next) => {
    try {
      const currency = req.query.currency
        ? String(req.query.currency).toUpperCase()
        : undefined;

      const packages = await billingService.listPackages({ currency });
      return res.json({ success: true, packages });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/transactions/:id', async (req, res, next) => {
    try {
      const transaction = await billingService.getTransaction({ id: req.params.id });

      if (!transaction || transaction.workspace_id !== req.workspace.id) {
        return res.status(404).json({
          success: false,
          error: { code: 'billing_transaction_not_found', message: 'Billing transaction not found.' },
          requestId: req.requestId
        });
      }

      return res.json({ success: true, transaction });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/transactions', async (req, res, next) => {
    try {
      const { packageCode, currency, metadata } = req.body || {};

      if (!packageCode || !currency) {
        return res.status(400).json({
          success: false,
          error: { code: 'invalid_billing_request', message: 'packageCode and currency are required.' },
          requestId: req.requestId
        });
      }

      // Payment provider and reference are server-controlled.
      // Clients must never be able to redirect billing to an arbitrary provider
      // or choose a reference that could collide with another transaction.
      const transaction = await billingService.createPendingTransaction({
        workspaceId: req.workspace.id,
        packageCode,
        currency,
        paymentProvider: 'zopayo',
        metadata: metadata && typeof metadata === 'object' ? metadata : {}
      });

      return res.status(201).json({ success: true, transaction });
    } catch (error) {
      if (error.code === 'package_not_available') {
        return res.status(400).json({
          success: false,
          error: { code: error.code, message: 'The selected package is not available in this currency.' },
          requestId: req.requestId
        });
      }
      return next(error);
    }
  });

  return router;
}
