import { Router } from 'express';
import { createRateLimiter } from '../middleware/rate-limit.js';
import { hashPassword, verifyPassword } from '../security/password.js';
import {
  createSessionToken,
  hashSessionToken,
  sessionCookie,
  expiredSessionCookie,
  readSessionCookie,
  SESSION_COOKIE
} from '../security/session.js';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function makeWorkspaceSlug(name, email) {
  const base = (name || email.split('@')[0] || 'developer')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'developer';
  return `${base}-${cryptoSuffix()}`;
}

function cryptoSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

function publicDeveloper(developer, workspace) {
  return {
    id: developer.id,
    email: developer.email,
    fullName: developer.full_name,
    status: developer.status,
    createdAt: developer.created_at,
    workspace: workspace ? {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      status: workspace.status
    } : null
  };
}

function authError(res, req) {
  return res.status(401).json({
    success: false,
    error: { code: 'invalid_credentials', message: 'Email or password is incorrect.' },
    requestId: req.requestId
  });
}

export function createAuthRouter({ db, sessionSecret, secureCookies = false }) {
  const router = Router();

  if (!db) {
    router.use((_req, res) => res.status(503).json({
      success: false,
      error: { code: 'database_unavailable', message: 'Developer authentication requires the production database.' }
    }));
    return router;
  }

  if (!sessionSecret) {
    router.use((_req, res) => res.status(503).json({
      success: false,
      error: { code: 'session_secret_missing', message: 'Developer authentication is not configured.' }
    }));
    return router;
  }

  const developers = db.developers;
  const sessions = db.sessions;

  const authRateLimit = createRateLimiter({ windowMs: 15 * 60_000, max: 10, key: (req) => `auth:${req.ip || 'anonymous'}` });

  router.post('/register', authRateLimit, async (req, res, next) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const fullName = normalizeName(req.body?.fullName);
      const password = String(req.body?.password || '');

      if (!email || !email.includes('@') || !fullName || password.length < 8) {
        return res.status(400).json({
          success: false,
          error: { code: 'invalid_registration', message: 'Full name, valid email and a password of at least 8 characters are required.' },
          requestId: req.requestId
        });
      }

      const existing = await developers.findByEmail(email);
      if (existing) {
        return res.status(409).json({
          success: false,
          error: { code: 'email_already_registered', message: 'An account already exists for this email.' },
          requestId: req.requestId
        });
      }

      const passwordHash = await hashPassword(password);
      const workspaceName = `${fullName}'s workspace`;
      const workspaceSlug = makeWorkspaceSlug(fullName, email);
      const created = await developers.createWithWorkspace({
        email,
        fullName,
        passwordHash,
        workspaceName,
        workspaceSlug,
        initialCredits: 0
      });

      const token = createSessionToken();
      const tokenHash = hashSessionToken(token, sessionSecret);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await sessions.create({
        developerId: created.developer.id,
        tokenHash,
        expiresAt,
        userAgent: req.get('user-agent') || null
      });

      res.setHeader('Set-Cookie', sessionCookie(token, { secure: secureCookies }));
      return res.status(201).json({
        success: true,
        data: { developer: publicDeveloper(created.developer, created.workspace) },
        requestId: req.requestId
      });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          error: { code: 'email_or_workspace_already_exists', message: 'The account could not be created because a unique value already exists.' },
          requestId: req.requestId
        });
      }
      if (error.message === 'password_too_short') {
        return res.status(400).json({
          success: false,
          error: { code: 'password_too_short', message: 'Password must contain at least 8 characters.' },
          requestId: req.requestId
        });
      }
      next(error);
    }
  });

  router.post('/login', authRateLimit, async (req, res, next) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const password = String(req.body?.password || '');
      const developer = await developers.findByEmail(email);

      if (!developer || developer.status !== 'active' || !(await verifyPassword(password, developer.password_hash))) {
        return authError(res, req);
      }

      const workspace = await developers.findWorkspaceByOwner(developer.id);
      const token = createSessionToken();
      const tokenHash = hashSessionToken(token, sessionSecret);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await sessions.create({
        developerId: developer.id,
        tokenHash,
        expiresAt,
        userAgent: req.get('user-agent') || null
      });

      res.setHeader('Set-Cookie', sessionCookie(token, { secure: secureCookies }));
      return res.json({
        success: true,
        data: { developer: publicDeveloper(developer, workspace) },
        requestId: req.requestId
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/me', async (req, res, next) => {
    try {
      const token = readSessionCookie(req);
      if (!token) return authError(res, req);

      const tokenHash = hashSessionToken(token, sessionSecret);
      const session = await sessions.findActiveByHash(tokenHash);
      if (!session) return authError(res, req);

      const developer = await developers.findById(session.developer_id);
      if (!developer || developer.status !== 'active') return authError(res, req);

      const workspace = await developers.findWorkspaceByOwner(developer.id);
      return res.json({
        success: true,
        data: { developer: publicDeveloper(developer, workspace) },
        requestId: req.requestId
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/logout', async (req, res, next) => {
    try {
      const token = readSessionCookie(req);
      if (token) {
        await sessions.revoke(hashSessionToken(token, sessionSecret));
      }
      res.setHeader('Set-Cookie', expiredSessionCookie());
      return res.json({ success: true, data: { loggedOut: true }, requestId: req.requestId });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createAuthRouter;
