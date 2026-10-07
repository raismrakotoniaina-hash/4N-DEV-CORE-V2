const required = [];

export function loadConfig(env = process.env) {
  return {
    nodeEnv: env.NODE_ENV || 'development',
    port: Number(env.PORT || 10000),
    databaseUrl: env.DATABASE_URL || null,
    apiKeyPepper: env.API_KEY_PEPPER || null,
    sessionSecret: env.SESSION_SECRET || null,
    corsOrigin: env.CORS_ORIGIN || null,
  };
}

export function validateProductionConfig(config) {
  const missing = required.filter((name) => !config[name]);
  if (missing.length) {
    throw new Error(`Missing production configuration: ${missing.join(', ')}`);
  }
}
