import { Router } from 'express';
import { requireApiKey } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rate-limit.js';

export function createV1Router({ apiKeyRecords, apiKeyPepper }) {
  const router = Router();

  router.get('/models', (req, res) => {
    res.json({ success: true, data: { models: [] }, requestId: req.requestId });
  });

  const protectedApi = [
    requireApiKey({ apiKeyRecords, pepper: apiKeyPepper }),
    createRateLimiter({ windowMs: 60_000, max: 60 })
  ];

  router.get('/credits', ...protectedApi, (req, res) => {
    res.status(501).json({
      success: false,
      error: { code: 'not_implemented', message: 'Credits service is not connected to the production database yet.' },
      requestId: req.requestId
    });
  });

  router.get('/usage', ...protectedApi, (req, res) => {
    res.status(501).json({
      success: false,
      error: { code: 'not_implemented', message: 'Usage service is not connected to the production database yet.' },
      requestId: req.requestId
    });
  });

  return router;
}
