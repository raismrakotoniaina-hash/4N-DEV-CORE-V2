import crypto from 'node:crypto';
import { createApiKeySecret, createStoredApiKey, hashApiKey, verifyApiKey } from '../security/api-key.js';

export function createApiKey({ name, workspaceId, pepper }) {
  const generated = createApiKeySecret();
  const record = createStoredApiKey(generated.secret, pepper, {
    id: crypto.randomUUID(),
    name,
    workspaceId
  });
  return { record, secret: generated.secret };
}

export async function persistApiKey({ name, workspaceId, pepper, repository }) {
  if (!repository) throw new Error('database_not_configured');
  const generated = createApiKeySecret();
  const keyHash = hashApiKey(generated.secret, pepper);
  const record = await repository.insert({
    workspaceId,
    name,
    keyPrefix: generated.prefix,
    keyHash
  });
  return { record, secret: generated.secret };
}

export async function authenticateApiKey({ secret, records, pepper, repository }) {
  if (repository) {
    const keyHash = hashApiKey(secret, pepper);
    const row = await repository.findActiveByHash(keyHash);
    if (!row) return null;
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      prefix: row.key_prefix,
      status: row.status,
      name: row.name
    };
  }

  if (!Array.isArray(records)) return null;
  for (const record of records) {
    if (verifyApiKey(secret, record, pepper)) return record;
  }
  return null;
}
