import express from 'express';
import cors from 'cors';
import { loadConfig, validateProductionConfig } from './config/env.js';
import { requestId } from './middleware/request-id.js';
import { accessLog } from './middleware/access-log.js';
import createV1Router from './routes/v1.js';
import createAuthRouter from './routes/auth.js';
import createDashboardRouter from './routes/dashboard.js';
import createProjectsRouter from './routes/projects.js';
import { requireDeveloperSession } from './middleware/developer-session.js';
import { createProjectsRepository } from './db/repositories/projects.js';
import { createDbPool } from './db/client.js';
import { createDevelopersRepository } from './db/repositories/developers.js';
import { createSessionsRepository } from './db/repositories/sessions.js';
import { createApiKeyRepository } from './db/repositories/api-keys.js';
import { createCreditsRepository } from './db/repositories/credits.js';
import { createUsageRepository } from './db/repositories/usage.js';
import { createPricingRepository } from './db/repositories/pricing.js';
import { createBillingRepository } from './db/repositories/billing.js';
import { createCreditsService } from './services/credits-service.js';
import { createBillingService } from './services/billing-service.js';
import { createAiService } from './services/ai-service.js';
import { createProvider } from './providers/index.js';
import createApiKeysRouter from './routes/api-keys.js';
import createBillingRouter from './routes/billing.js';
import { createZopayoProvider } from './payments/zopayo.js';
import { notFound, errorHandler } from './middleware/errors.js';

const config = loadConfig();
validateProductionConfig(config);

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(cors({
  origin: config.corsOrigin || true,
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));
app.use(requestId);
app.use(accessLog);

app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    name: '4N DEV Core API',
    status: 'online',
    version: '2.0.0'
  });
});

app.get('/ready', async (_req, res) => {
  if (!db) {
    return res.status(503).json({
      success: false,
      status: 'not_ready',
      reason: 'database_not_configured'
    });
  }

  try {
    await db.query('SELECT 1');
    return res.status(200).json({
      success: true,
      status: 'ready',
      database: 'ok'
    });
  } catch (_error) {
    return res.status(503).json({
      success: false,
      status: 'not_ready',
      database: 'error'
    });
  }
});

const db = createDbPool(config.databaseUrl, {
  ssl: config.dbSsl
    ? { rejectUnauthorized: config.dbSslRejectUnauthorized }
    : undefined
});

const repositories = db ? {
  developers: createDevelopersRepository(db),
  sessions: createSessionsRepository(db),
  apiKeys: createApiKeyRepository(db),
  credits: createCreditsRepository(db),
  usage: createUsageRepository(db),
  pricing: createPricingRepository(db),
  billing: createBillingRepository(db),
  projects: createProjectsRepository(db)
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

app.use('/api/dashboard', createDashboardRouter({ db, sessionMiddleware, corsOrigin: config.corsOrigin }));
app.use('/api/projects', createProjectsRouter({ projectRepository: repositories?.projects, sessionMiddleware, corsOrigin: config.corsOrigin }));

app.use('/api/keys', createApiKeysRouter({
  apiKeyRepository: repositories?.apiKeys,
  apiKeyPepper: config.apiKeyPepper,
  sessionMiddleware,
  corsOrigin: config.corsOrigin,
  zopayoWebhookSecret: config.zopayoWebhookSecret
}));

const creditsService = db
  ? createCreditsService(repositories.credits, repositories.usage, repositories.pricing)
  : null;

const billingService = db
  ? createBillingService(repositories.billing)
  : null;

const zopayo = createZopayoProvider(config);

app.use('/api/billing', createBillingRouter({
  billingService,
  sessionMiddleware,
  zopayo,
  corsOrigin: config.corsOrigin
}));

const modelCatalog = [
  { id: '4n-chat', service: 'chat', status: 'active' },
  { id: '4n-code', service: 'coding', status: 'active' },
  { id: '4n-image', service: 'image', status: 'active' }
];

const providerModelCatalog = {
  '4n-chat': config.providerChatModel,
  '4n-code': config.providerCodingModel,
  '4n-image': config.providerImageModel,
  '4n-builder': config.providerBuilderModel
};

const provider = createProvider(config);

const aiService = provider && creditsService
  ? createAiService({
      provider,
      creditsService,
      modelCatalog,
      providerModelCatalog
    })
  : null;

app.use('/v1', createV1Router({
  apiKeyRecords: [],
  apiKeyPepper: config.apiKeyPepper,
  apiKeyRepository: repositories?.apiKeys,
  creditsService,
  aiService,
  modelCatalog
}));

app.use(notFound);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(JSON.stringify({
    type: 'server_started',
    name: '4N DEV Core API',
    port: config.port,
    environment: config.nodeEnv
  }));
});

function shutdown(signal) {
  console.log(JSON.stringify({
    type: 'server_shutdown',
    signal
  }));

  server.close(async () => {
    if (db) {
      await db.end();
    }

    process.exit(0);
  });

  setTimeout(() => {
    console.error(JSON.stringify({
      type: 'server_shutdown_timeout'
    }));
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { app, config, server };
