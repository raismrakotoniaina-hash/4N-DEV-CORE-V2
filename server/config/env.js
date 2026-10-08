const BASE_REQUIRED = [
  'DATABASE_URL',
  'API_KEY_PEPPER',
  'SESSION_SECRET',
  'CORE_DOMAIN'
];

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidDomain(value) {
  return typeof value === 'string'
    && value.length <= 253
    && !value.includes('/')
    && !value.includes(' ')
    && /^[a-z0-9.-]+$/i.test(value);
}

export function loadConfig(env = process.env) {
  return {
    nodeEnv: env.NODE_ENV || 'development',
    port: Number(env.PORT || 10000),
    coreDomain: env.CORE_DOMAIN || null,
    databaseUrl: env.DATABASE_URL || null,
    dbSsl: parseBoolean(env.DB_SSL, env.NODE_ENV === 'production'),
    dbSslRejectUnauthorized: parseBoolean(env.DB_SSL_REJECT_UNAUTHORIZED, true),
    apiKeyPepper: env.API_KEY_PEPPER || null,
    sessionSecret: env.SESSION_SECRET || null,
    corsOrigin: env.CORS_ORIGIN || null,
    aiProvider: env.AI_PROVIDER || (env.NODE_ENV === 'production' ? 'none' : 'demo'),
    openaiApiKey: env.OPENAI_API_KEY || null,
    providerChatModel: env.PROVIDER_CHAT_MODEL || 'gpt-5.6-luna',
    providerCodingModel: env.PROVIDER_CODING_MODEL || 'gpt-5.6-sol',
    providerImageModel: env.PROVIDER_IMAGE_MODEL || 'gpt-image-2.5-flare',
    providerBuilderModel: env.PROVIDER_BUILDER_MODEL || 'gpt-5.6-sol',
    zopayoApiKey: env.ZOPAYO_API_KEY || null,
    zopayoSuccessUrl: env.ZOPAYO_SUCCESS_URL || null,
    zopayoErrorUrl: env.ZOPAYO_ERROR_URL || null,
    zopayoWebhookSecret: env.ZOPAYO_WEBHOOK_SECRET || null
  };
}

export function validateProductionConfig(config) {
  if (config.nodeEnv !== 'production') return;

  const missing = BASE_REQUIRED.filter((name) => {
    const key = {
      DATABASE_URL: 'databaseUrl',
      API_KEY_PEPPER: 'apiKeyPepper',
      SESSION_SECRET: 'sessionSecret',
      CORE_DOMAIN: 'coreDomain'
    }[name];
    return !config[key];
  });

  if (config.coreDomain && !isValidDomain(config.coreDomain)) {
    missing.push('CORE_DOMAIN_VALID');
  }

  if (config.aiProvider === 'openai' && !config.openaiApiKey) missing.push('OPENAI_API_KEY');
  if (!config.corsOrigin) {
    missing.push('CORS_ORIGIN');
  } else if (!isHttpsUrl(config.corsOrigin)) {
    missing.push('CORS_ORIGIN_HTTPS');
  }

  if (!['none', 'openai'].includes(config.aiProvider)) missing.push('AI_PROVIDER');
  if (!config.zopayoApiKey) missing.push('ZOPAYO_API_KEY');
  if (!config.zopayoWebhookSecret) missing.push('ZOPAYO_WEBHOOK_SECRET');
  if (!config.zopayoSuccessUrl) missing.push('ZOPAYO_SUCCESS_URL');
  if (!config.zopayoErrorUrl) missing.push('ZOPAYO_ERROR_URL');

  if (config.zopayoSuccessUrl && !isHttpsUrl(config.zopayoSuccessUrl)) {
    missing.push('ZOPAYO_SUCCESS_URL_HTTPS');
  }

  if (config.zopayoErrorUrl && !isHttpsUrl(config.zopayoErrorUrl)) {
    missing.push('ZOPAYO_ERROR_URL_HTTPS');
  }

  if (missing.length) {
    throw new Error(`Missing production configuration: ${[...new Set(missing)].join(', ')}`);
  }
}
