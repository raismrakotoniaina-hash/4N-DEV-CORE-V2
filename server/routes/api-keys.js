import { Router } from 'express';
import { createApiKey, persistApiKey } from '../services/api-key-service.js';

export function createApiKeysRouter({ apiKeyRepository, apiKeyPepper, sessionMiddleware }) {
  const router = Router();
  router.use(sessionMiddleware);

  router.post('/', async (req, res, next) => {
    try {
      const name = String(req.body?.name || '').trim() || 'API key';
      if (name.length > 80) {
        return res.status(400).json({
          success: false,
          error: { code: 'invalid_key_name', message: 'API key name must be 80 characters or fewer.' },
          requestId: req.requestId
        });
      }

      const result = await persistApiKey({
        name,
        workspaceId: req.workspace.id,
        pepper: apiKeyPepper,
        repository: apiKeyRepository
      });

      return res.status(201).json({
        success: true,
        data: {
          id: result.record.id,
          name: result.record.name,
          prefix: result.record.key_prefix,
          status: result.record.status,
          createdAt: result.record.created_at,
          secret: result.secret
        },
        requestId: req.requestId
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/revoke', async (req, res, next) => {
    try {
      const revoked = await apiKeyRepository.revoke(req.params.id, req.workspace.id);
      if (!revoked) {
        return res.status(404).json({
          success: false,
          error: { code: 'api_key_not_found', message: 'API key was not found or is already revoked.' },
          requestId: req.requestId
        });
      }

      return res.json({ success: true, data: { id: revoked.id, status: revoked.status, revokedAt: revoked.revoked_at }, requestId: req.requestId });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createApiKeysRouter;
