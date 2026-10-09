import { Router } from 'express';
import { requireSameOrigin } from '../middleware/csrf.js';

export default function createProjectsRouter({ projectRepository, sessionMiddleware, corsOrigin }) {
  const router = Router();
  router.use(sessionMiddleware);
  router.use(requireSameOrigin({ allowedOrigin: corsOrigin }));

  router.get('/', async (req, res, next) => {
    try {
      if (!projectRepository) {
        return res.status(503).json({
          success: false,
          error: { code: 'projects_not_configured', message: 'Projects require the Core database.' },
          requestId: req.requestId
        });
      }
      const projects = await projectRepository.listByWorkspace(req.workspace.id);
      return res.json({ success: true, projects, requestId: req.requestId });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      if (!projectRepository) {
        return res.status(503).json({
          success: false,
          error: { code: 'projects_not_configured', message: 'Projects require the Core database.' },
          requestId: req.requestId
        });
      }
      const name = String(req.body?.name || '').trim();
      if (!name || name.length > 100) {
        return res.status(400).json({
          success: false,
          error: { code: 'invalid_project_name', message: 'Project name must contain 1 to 100 characters.' },
          requestId: req.requestId
        });
      }
      const project = await projectRepository.create({ workspaceId: req.workspace.id, name });
      return res.status(201).json({ success: true, project, requestId: req.requestId });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/:id/archive', async (req, res, next) => {
    try {
      if (!projectRepository) {
        return res.status(503).json({
          success: false,
          error: { code: 'projects_not_configured', message: 'Projects require the Core database.' },
          requestId: req.requestId
        });
      }
      const project = await projectRepository.archive({ id: req.params.id, workspaceId: req.workspace.id });
      if (!project) {
        return res.status(404).json({
          success: false,
          error: { code: 'project_not_found', message: 'Project was not found or is already archived.' },
          requestId: req.requestId
        });
      }
      return res.json({ success: true, project, requestId: req.requestId });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
