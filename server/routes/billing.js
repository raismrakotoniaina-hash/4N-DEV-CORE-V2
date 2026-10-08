import express from 'express';
import { requireSameOrigin } from '../middleware/csrf.js';

const PAYMENT_PROVIDER = 'zopayo';

export default function createBillingRouter({ billingService, sessionMiddleware, zopayo, corsOrigin }) {
  const router = express.Router();
  router.use(sessionMiddleware);
  router.use(requireSameOrigin({ allowedOrigin: corsOrigin }));

  router.get('/packages', async (req, res, next) => {
    try {
      const currency = req.query.currency ? String(req.query.currency).toUpperCase() : undefined;
      return res.json({ success: true, packages: await billingService.listPackages({ currency }) });
    } catch (error) { return next(error); }
  });

  router.get('/transactions/:id', async (req, res, next) => {
    try {
      const transaction = await billingService.getTransaction({ id: req.params.id });
      if (!transaction || transaction.workspace_id !== req.workspace.id) {
        return res.status(404).json({ success: false, error: { code: 'billing_transaction_not_found', message: 'Billing transaction not found.' }, requestId: req.requestId });
      }
      return res.json({ success: true, transaction });
    } catch (error) { return next(error); }
  });

  router.post('/transactions', async (req, res, next) => {
    try {
      const { packageCode, currency, metadata } = req.body || {};
      if (!packageCode || !currency) {
        return res.status(400).json({ success: false, error: { code: 'invalid_billing_request', message: 'packageCode and currency are required.' }, requestId: req.requestId });
      }
      const transaction = await billingService.createPendingTransaction({
        workspaceId: req.workspace.id,
        packageCode,
        currency,
        paymentProvider: PAYMENT_PROVIDER,
        metadata: metadata && typeof metadata === 'object' ? metadata : {}
      });
      return res.status(201).json({ success: true, transaction });
    } catch (error) {
      if (error.code === 'package_not_available') {
        return res.status(400).json({ success: false, error: { code: error.code, message: 'The selected package is not available in this currency.' }, requestId: req.requestId });
      }
      return next(error);
    }
  });

  router.post('/transactions/:id/checkout', async (req, res, next) => {
    try {
      if (!zopayo) return res.status(503).json({ success: false, error: { code: 'payment_provider_unavailable', message: 'Payment provider is not configured.' }, requestId: req.requestId });

      const transaction = await billingService.getTransaction({ id: req.params.id });
      if (!transaction || transaction.workspace_id !== req.workspace.id) {
        return res.status(404).json({ success: false, error: { code: 'billing_transaction_not_found', message: 'Billing transaction not found.' }, requestId: req.requestId });
      }
      if (transaction.payment_provider !== PAYMENT_PROVIDER) return res.status(400).json({ success: false, error: { code: 'unsupported_payment_provider', message: 'Unsupported payment provider.' }, requestId: req.requestId });
      if (transaction.status !== 'pending') return res.status(409).json({ success: false, error: { code: 'billing_transaction_not_pending', message: 'Billing transaction is not pending.' }, requestId: req.requestId });

      const checkout = await zopayo.createPayment({
        amount: transaction.amount,
        currency: transaction.currency,
        reference: transaction.payment_reference,
        description: `4N DEV credits package ${transaction.package_id}`
      });

      await billingService.updateCheckoutMetadata({
        transactionId: transaction.id,
        checkout: { provider: PAYMENT_PROVIDER, createdAt: new Date().toISOString(), paymentUrl: checkout.paymentUrl }
      });

      return res.json({ success: true, transactionId: transaction.id, paymentUrl: checkout.paymentUrl });
    } catch (error) { return next(error); }
  });

  return router;
}
