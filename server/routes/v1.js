import { Router } from 'express';
import { requireApiKey } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rate-limit.js';

function unavailable(message = 'Core service is not configured.') {
  const error = new Error(message);
  error.code = 'provider_unavailable';
  error.status = 503;
  error.expose = true;
  return error;
}

export function createV1Router({ apiKeyRecords, apiKeyPepper, apiKeyRepository, creditsService, aiService, modelCatalog = [] }) {
  const router = Router();

  router.get('/models', (req, res) => {
    res.json({
      success: true,
      request_id: req.requestId,
      service: 'models',
      data: { models: modelCatalog }
    });
  });

  const protectedApi = [
    requireApiKey({ apiKeyRecords, pepper: apiKeyPepper, repository: apiKeyRepository }),
    createRateLimiter({ windowMs: 60_000, max: 60 })
  ];

  router.get('/credits', ...protectedApi, async (req, res, next) => {
    try {
      if (!creditsService) throw unavailable('Credit service is not configured.');
      const credits = await creditsService.getCredits(req.auth.workspaceId);
      res.json({
        success: true,
        request_id: req.requestId,
        service: 'credits',
        data: credits
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/usage', ...protectedApi, async (req, res, next) => {
    try {
      if (!creditsService) throw unavailable('Usage service is not configured.');
      const usage = await creditsService.getUsage(req.auth.workspaceId, {
        limit: req.query.limit,
        offset: req.query.offset
      });
      res.json({
        success: true,
        request_id: req.requestId,
        service: 'usage',
        data: { items: usage, next_cursor: null }
      });
    } catch (error) {
      next(error);
    }
  });

  async function runService(service, handler, req, res, next) {
    try {
      if (!aiService) throw unavailable('AI service is not configured.');
      const result = await handler(req, req.body || {});
      res.json({
        success: true,
        request_id: req.requestId,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  router.post('/chat', ...protectedApi, (req, res, next) =>
    runService('chat', (request, body) => aiService.chat(request, body), req, res, next)
  );

  router.post('/coding', ...protectedApi, (req, res, next) =>
    runService('coding', (request, body) => aiService.coding(request, body), req, res, next)
  );

  router.post('/image', ...protectedApi, (req, res, next) =>
    runService('image', (request, body) => aiService.image(request, body), req, res, next)
  );

  return router;
}

export default createV1Router;
