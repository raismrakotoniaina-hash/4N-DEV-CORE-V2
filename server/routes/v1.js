import { Router } from 'express';
import { requireApiKey } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rate-limit.js';

export function createV1Router({ apiKeyRecords, apiKeyPepper, apiKeyRepository, creditsService }) {
  const router = Router();

  router.get('/models', (req, res) => {
    res.json({ success: true, data: { models: [] }, requestId: req.requestId });
  });

  const protectedApi = [
    requireApiKey({ apiKeyRecords, pepper: apiKeyPepper, repository: apiKeyRepository }),
    createRateLimiter({ windowMs: 60_000, max: 60 })
  ];

  router.get('/credits', ...protectedApi, async (req, res, next) => {
    try {
      const credits = await creditsService.getCredits(req.auth.workspaceId);
      res.json({ success: true, data: credits, requestId: req.requestId });
    } catch (error) {
      next(error);
    }
  });

  router.get('/usage', ...protectedApi, async (req, res, next) => {
    try {
      const usage = await creditsService.getUsage(req.auth.workspaceId, {
        limit: req.query.limit,
        offset: req.query.offset
      });
      res.json({ success: true, data: { records: usage }, requestId: req.requestId });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createV1Router;
