const BASE_REQUIRED = [
  'DATABASE_URL',
  'API_KEY_PEPPER',
  'SESSION_SECRET'
];

export function loadConfig(env = process.env) {
  return {
    nodeEnv: env.NODE_ENV || 'development',
    port: Number(env.PORT || 10000),
    databaseUrl: env.DATABASE_URL || null,
    apiKeyPepper: env.API_KEY_PEPPER || null,
    sessionSecret: env.SESSION_SECRET || null,
    corsOrigin: env.CORS_ORIGIN || null,

    // AI provider secrets stay server-side and are never returned by the API.
    aiProvider: env.AI_PROVIDER || (env.NODE_ENV === 'production' ? 'none' : 'demo'),
    openaiApiKey: env.OPENAI_API_KEY || null,

    // Private provider routing. Public clients only see stable 4N model IDs.
    providerChatModel: env.PROVIDER_CHAT_MODEL || 'gpt-5.6-luna',
    providerCodingModel: env.PROVIDER_CODING_MODEL || 'gpt-5.6-sol',
    providerImageModel: env.PROVIDER_IMAGE_MODEL || 'gpt-image-2.5-flare',
    providerBuilderModel: env.PROVIDER_BUILDER_MODEL || 'gpt-5.6-sol',

    // Zopayo payment configuration. Secrets remain server-side.
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
      SESSION_SECRET: 'sessionSecret'
    }[name];
    return !config[key];
  });

  if (config.aiProvider === 'openai' && !config.openaiApiKey) {
    missing.push('OPENAI_API_KEY');
  }

  if (!config.corsOrigin) missing.push('CORS_ORIGIN');

  if (!['none', 'openai'].includes(config.aiProvider)) {
    missing.push('AI_PROVIDER');
  }

  if (!config.zopayoApiKey) missing.push('ZOPAYO_API_KEY');
  if (!config.zopayoSuccessUrl) missing.push('ZOPAYO_SUCCESS_URL');
  if (!config.zopayoErrorUrl) missing.push('ZOPAYO_ERROR_URL');

  if (missing.length) {
    throw new Error(`Missing production configuration: ${[...new Set(missing)].join(', ')}`);
  }
}
