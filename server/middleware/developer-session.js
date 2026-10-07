import { hashSessionToken, readSessionCookie } from '../security/session.js';

export function requireDeveloperSession({ sessionRepository, developerRepository, sessionSecret }) {
  return async (req, res, next) => {
    try {
      if (!sessionRepository || !developerRepository || !sessionSecret) {
        return res.status(503).json({
          success: false,
          error: { code: 'developer_auth_not_configured', message: 'Developer authentication is not configured.' },
          requestId: req.requestId
        });
      }

      const token = readSessionCookie(req);
      if (!token) {
        return res.status(401).json({
          success: false,
          error: { code: 'unauthenticated', message: 'A developer session is required.' },
          requestId: req.requestId
        });
      }

      const session = await sessionRepository.findActiveByHash(hashSessionToken(token, sessionSecret));
      if (!session) {
        return res.status(401).json({
          success: false,
          error: { code: 'unauthenticated', message: 'The developer session is invalid or expired.' },
          requestId: req.requestId
        });
      }

      const developer = await developerRepository.findById(session.developer_id);
      if (!developer || developer.status !== 'active') {
        return res.status(401).json({
          success: false,
          error: { code: 'unauthenticated', message: 'The developer account is unavailable.' },
          requestId: req.requestId
        });
      }

      const workspace = await developerRepository.findWorkspaceByOwner(developer.id);
      if (!workspace) {
        return res.status(403).json({
          success: false,
          error: { code: 'workspace_not_found', message: 'No active developer workspace was found.' },
          requestId: req.requestId
        });
      }

      req.developer = developer;
      req.workspace = workspace;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
