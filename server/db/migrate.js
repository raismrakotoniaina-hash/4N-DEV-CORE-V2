import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { loadConfig } from '../config/env.js';

const { Client } = pg;
const config = loadConfig();

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is required for migrations.');
}

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');
const MIGRATION_LOCK_ID = 41004;

async function main() {
  const client = new Client({
    connectionString: config.databaseUrl,
    ssl: config.dbSsl
      ? { rejectUnauthorized: config.dbSslRejectUnauthorized }
      : undefined
  });

  await client.connect();

  let lockAcquired = false;

  try {
    const lockResult = await client.query(
      'SELECT pg_try_advisory_lock($1) AS acquired',
      [MIGRATION_LOCK_ID]
    );

    lockAcquired = lockResult.rows[0]?.acquired === true;

    if (!lockAcquired) {
      throw new Error('Another database migration is already running.');
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const files = (await fs.readdir(migrationsDir))
      .filter((file) => /^\d+_.+\.sql$/.test(file))
      .sort();

    const versions = new Set();

    for (const file of files) {
      const version = file.split('_')[0];

      if (versions.has(version)) {
        throw new Error(`Duplicate migration version detected: ${version}`);
      }

      versions.add(version);
    }

    for (const file of files) {
      const version = file.split('_')[0];
      const applied = await client.query(
        'SELECT 1 FROM schema_migrations WHERE version = $1',
        [version]
      );

      if (applied.rowCount > 0) continue;

      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
      console.log(`Applying migration ${file}`);

      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (version) VALUES ($1)',
        [version]
      );

      console.log(`Applied migration ${file}`);
    }

    console.log('Database migrations are up to date.');
  } finally {
    if (lockAcquired) {
      await client.query(
        'SELECT pg_advisory_unlock($1)',
        [MIGRATION_LOCK_ID]
      ).catch(() => {});
    }

    await client.end();
  }
}

main().catch((error) => {
  console.error('Database migration failed:', error);
  process.exit(1);
});
