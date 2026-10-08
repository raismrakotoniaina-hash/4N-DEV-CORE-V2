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
import { createPricingRepository } from './db/repositories/pricing.js';
import { createBillingRepository } from './db/repositories/billing.js';
import { createCreditsService } from './services/credits-service.js';
import { createBillingService } from './services/billing-service.js';
import { createAiService } from './services/ai-service.js';
import { createProvider } from './providers/index.js';
import { requireDeveloperSession } from './middleware/developer-session.js';
import createApiKeysRouter from './routes/api-keys.js';
import createBillingRouter from './routes/billing.js';
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
  usage: createUsageRepository(db),
  pricing: createPricingRepository(db),
  billing: createBillingRepository(db)
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

const creditsService = db
  ? createCreditsService(repositories.credits, repositories.usage, repositories.pricing)
  : null;

const billingService = db
  ? createBillingService(repositories.billing)
  : null;

app.use('/api/billing', createBillingRouter({
  billingService,
  sessionMiddleware
}));

// Stable public 4N DEV model IDs. Provider model IDs stay private inside Core.
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
  ? createAiService({ provider, creditsService, modelCatalog, providerModelCatalog })
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

export { app, config };
