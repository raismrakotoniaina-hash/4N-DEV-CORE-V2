import express from 'express';
import cors from 'cors';
import { loadConfig } from './config/env.js';
import { requestId } from './middleware/request-id.js';
import createV1Router from './routes/v1.js';
import createAuthRouter from './routes/auth.js';
import { createDbPool } from './db/client.js';
import { createDevelopersRepository } from './db/repositories/developers.js';
import { createSessionsRepository } from './db/repositories/sessions.js';
import { createApiKeyRepository } from './db/repositories/api-keys.js';
import { createCreditsRepository } from './db/repositories/credits.js';
import { createUsageRepository } from './db/repositories/usage.js';
import { createCreditsService } from './services/credits-service.js';
import { requireDeveloperSession } from './middleware/developer-session.js';
import createApiKeysRouter from './routes/api-keys.js';
import { notFound, errorHandler } from './middleware/errors.js';

const config = loadConfig();
const app = express();

app.disable('x-powered-by');
app.use(cors({
  origin: config.corsOrigin || true,
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(requestId);

app.get('/health', (_req, res) => {
  res.json({
    success: true,
    name: '4N DEV Core API',
    status: 'online',
    version: '2.0.0'
  });
});

const db = createDbPool(config.databaseUrl);
const repositories = db ? {
  developers: createDevelopersRepository(db),
  sessions: createSessionsRepository(db),
  apiKeys: createApiKeyRepository(db),
  credits: createCreditsRepository(db),
  usage: createUsageRepository(db)
} : null;

app.use('/api/auth', createAuthRouter({
  db: repositories,
  sessionSecret: config.sessionSecret,
  secureCookies: config.nodeEnv === 'production'
}));

const sessionMiddleware = requireDeveloperSession({
  sessionRepository: repositories?.sessions,
  developerRepository: repositories?.developers,
  sessionSecret: config.sessionSecret
});

app.use('/api/keys', createApiKeysRouter({
  apiKeyRepository: repositories?.apiKeys,
  apiKeyPepper: config.apiKeyPepper,
  sessionMiddleware
}));

const developmentApiKeyRecords = [];
const creditsService = db ? createCreditsService(repositories.credits, repositories.usage) : null;
app.use('/v1', createV1Router({
  apiKeyRecords: developmentApiKeyRecords,
  apiKeyPepper: config.apiKeyPepper,
  apiKeyRepository: repositories?.apiKeys,
  creditsService
}));

app.use(notFound);
app.use(errorHandler);

export { app, config };
