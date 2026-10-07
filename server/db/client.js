import pg from 'pg';

const { Pool } = pg;

export function createDbPool(databaseUrl) {
  if (!databaseUrl) return null;

  return new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
  });
}
