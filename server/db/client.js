import pg from 'pg';

const { Pool } = pg;

export function createDbPool(databaseUrl, options = {}) {
  if (!databaseUrl) return null;

  const pool = new Pool({
    connectionString: databaseUrl,
    max: Number(options.max ?? 10),
    idleTimeoutMillis: Number(options.idleTimeoutMillis ?? 30_000),
    connectionTimeoutMillis: Number(options.connectionTimeoutMillis ?? 5_000),
    allowExitOnIdle: false,
    ssl: options.ssl ?? undefined
  });

  pool.on('error', (error) => {
    console.error('PostgreSQL pool error:', error);
  });

  return pool;
}
