import crypto from 'node:crypto';
import express from 'express';
import { requireSameOrigin } from '../middleware/csrf.js';

const PAYMENT_PROVIDER = 'zopayo';

function secretsMatch(received, expected) {
  if (!received || !expected) return false;

  const receivedBuffer = Buffer.from(String(received));
  const expectedBuffer = Buffer.from(String(expected));

  if (receivedBuffer.length !== expectedBuffer.length) return false;

  return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

export default function createBillingRouter({
  billingService,
  sessionMiddleware,
  zopayo,
  corsOrigin,
  zopayoWebhookSecret
}) {
  const router = express.Router();

  // Zopayo calls this endpoint directly. It must not require a developer session
  // or same-origin browser headers.
  router.post('/webhook', async (req, res, next) => {
    try {
      if (!zopayo || !zopayoWebhookSecret) {
        return res.status(503).json({
          success: false,
          error: { code: 'payment_webhook_unavailable', message: 'Payment webhook is not configured.' },
          requestId: req.requestId
        });
      }

      const receivedSecret = req.get('x-webhook-secret');
      if (!secretsMatch(receivedSecret, zopayoWebhookSecret)) {
        return res.status(401).json({
          success: false,
          error: { code: 'invalid_webhook_secret', message: 'Webhook authentication failed.' },
          requestId: req.requestId
        });
      }

      const parsed = zopayo.parseWebhook(req.body);

      if (!parsed.transactionId || !parsed.merchantReference) {
        return res.status(400).json({
          success: false,
          error: { code: 'invalid_webhook_payload', message: 'Required webhook fields are missing.' },
          requestId: req.requestId
        });
      }

      const transaction = await billingService.getTransaction({
        paymentProvider: PAYMENT_PROVIDER,
        paymentReference: parsed.merchantReference
      });

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: { code: 'billing_transaction_not_found', message: 'Billing transaction not found.' },
          requestId: req.requestId
        });
      }

      if (transaction.status === 'completed') {
        return res.status(200).json({
          success: true,
          status: 'already_completed'
        });
      }

      if (transaction.status !== 'pending') {
        return res.status(409).json({
          success: false,
          error: { code: 'billing_transaction_not_pending', message: 'Billing transaction is not pending.' },
          requestId: req.requestId
        });
      }

      if (!zopayo.amountMatches(parsed.amountPaid, transaction.amount)) {
        return res.status(400).json({
          success: false,
          error: { code: 'webhook_amount_mismatch', message: 'Webhook amount does not match the billing transaction.' },
          requestId: req.requestId
        });
      }

      if (parsed.status === 'FAILED') {
        await billingService.updateStatus({
          transactionId: transaction.id,
          status: 'failed',
          metadata: {
            paymentProvider: PAYMENT_PROVIDER,
            providerTransactionId: parsed.transactionId,
            providerReference: parsed.reference || null,
            merchantReference: parsed.merchantReference,
            webhookStatus: parsed.status
          }
        });

        return res.status(200).json({
          success: true,
          status: 'failed'
        });
      }

      if (parsed.status !== 'COMPLETED') {
        return res.status(200).json({
          success: true,
          status: 'ignored'
        });
      }

      const completed = await billingService.completeTransaction({
        transactionId: transaction.id,
        providerTransactionId: parsed.transactionId,
        paymentReference: parsed.merchantReference,
        paymentMetadata: {
          paymentProvider: PAYMENT_PROVIDER,
          providerReference: parsed.reference || null,
          merchantReference: parsed.merchantReference,
          webhookStatus: parsed.status,
          providerStatus: parsed.raw?.statut_zopayo || null,
          amountPaid: parsed.amountPaid,
          paymentDate: parsed.raw?.date_paiement || null
        }
      });

      return res.status(200).json({
        success: true,
        status: 'completed',
        transactionId: completed.id
      });
    } catch (error) {
      return next(error);
    }
  });

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
