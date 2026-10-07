import crypto from 'node:crypto';
import {
  createApiKeySecret,
  createStoredApiKey,
  verifyApiKey
} from '../security/api-key.js';

export function createApiKey({ name, workspaceId, pepper }) {
  const generated = createApiKeySecret();
  const record = createStoredApiKey(generated.secret, pepper, {
    id: crypto.randomUUID(),
    name,
    workspaceId
  });

  return { record, secret: generated.secret };
}

export function authenticateApiKey({ secret, records, pepper }) {
  if (!Array.isArray(records)) return null;
  for (const record of records) {
    if (verifyApiKey(secret, record, pepper)) return record;
  }
  return null;
}
