import { Router } from 'express';

const router = Router();

router.get('/models', (_req, res) => {
  res.json({
    success: true,
    request_id: _req.requestId,
    service: 'models',
    data: { models: [] },
  });
});

router.get('/credits', (_req, res) => {
  res.status(501).json({
    success: false,
    request_id: _req.requestId,
    error: { code: 'not_implemented', message: 'Credits service is not connected yet.' },
  });
});

router.get('/usage', (_req, res) => {
  res.status(501).json({
    success: false,
    request_id: _req.requestId,
    error: { code: 'not_implemented', message: 'Usage service is not connected yet.' },
  });
});

export default router;
