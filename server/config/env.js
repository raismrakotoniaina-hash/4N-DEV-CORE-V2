const required = [];

export function loadConfig(env = process.env) {
  return {
    nodeEnv: env.NODE_ENV || 'development',
    port: Number(env.PORT || 10000),
    databaseUrl: env.DATABASE_URL || null,
    apiKeyPepper: env.API_KEY_PEPPER || null,
    sessionSecret: env.SESSION_SECRET || null,
    corsOrigin: env.CORS_ORIGIN || null,
    aiProvider: env.AI_PROVIDER || (env.NODE_ENV === 'production' ? 'none' : 'demo'),
    openaiApiKey: env.OPENAI_API_KEY || null,

    // Private provider routing. These values are never returned by the public API.
    providerChatModel: env.PROVIDER_CHAT_MODEL || 'gpt-5.6-luna',
    providerCodingModel: env.PROVIDER_CODING_MODEL || 'gpt-5.6-sol',
    providerImageModel: env.PROVIDER_IMAGE_MODEL || 'gpt-image-2.5-flare',
    providerBuilderModel: env.PROVIDER_BUILDER_MODEL || 'gpt-5.6-sol'
  };
}

export function validateProductionConfig(config) {
  const missing = required.filter((name) => !config[name]);
  if (missing.length) {
    throw new Error(`Missing production configuration: ${missing.join(', ')}`);
  }
}
