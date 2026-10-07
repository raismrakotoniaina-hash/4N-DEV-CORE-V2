import crypto from 'node:crypto';

const PREFIX = '4ndev_sk_';
const SECRET_BYTES = 32;

export function parseBearerToken(headerValue) {
  if (typeof headerValue !== 'string') return null;
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export function isValidApiKeyFormat(value) {
  return typeof value === 'string'
    && value.startsWith(PREFIX)
    && value.length >= PREFIX.length + 32;
}

export function hashApiKey(secret, pepper) {
  if (!secret || !pepper) throw new Error('API key hashing requires a pepper');
  return crypto.createHmac('sha256', pepper).update(secret, 'utf8').digest('hex');
}

export function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function createApiKeySecret() {
  const secret = PREFIX + crypto.randomBytes(SECRET_BYTES).toString('base64url');
  return { secret, prefix: secret.slice(0, PREFIX.length + 8) };
}

export function createStoredApiKey(secret, pepper, metadata = {}) {
  return {
    id: metadata.id ?? crypto.randomUUID(),
    name: metadata.name ?? 'API key',
    workspaceId: metadata.workspaceId ?? null,
    prefix: secret.slice(0, PREFIX.length + 8),
    keyHash: hashApiKey(secret, pepper),
    status: 'active',
    createdAt: new Date().toISOString()
  };
}

export function verifyApiKey(secret, record, pepper) {
  if (!isValidApiKeyFormat(secret) || !record || record.status !== 'active') return false;
  return safeEqualHex(hashApiKey(secret, pepper), record.keyHash);
}
