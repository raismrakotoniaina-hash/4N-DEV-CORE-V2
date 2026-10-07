import {
  parseBearerToken,
  isValidApiKeyFormat
} from '../security/api-key.js';
import { authenticateApiKey } from '../services/api-key-service.js';

export function requireApiKey({ apiKeyRecords, pepper }) {
  return (req, res, next) => {
    const secret = parseBearerToken(req.get('authorization'));

    if (!secret) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'missing_api_key',
          message: 'A Bearer API key is required.'
        },
        requestId: req.requestId
      });
    }

    if (!isValidApiKeyFormat(secret)) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'invalid_api_key',
          message: 'The API key format is invalid.'
        },
        requestId: req.requestId
      });
    }

    const record = authenticateApiKey({
      secret,
      records: apiKeyRecords,
      pepper
    });

    if (!record) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'invalid_api_key',
          message: 'The API key is invalid or revoked.'
        },
        requestId: req.requestId
      });
    }

    req.auth = {
      apiKeyId: record.id,
      workspaceId: record.workspaceId,
      keyPrefix: record.prefix
    };

    return next();
  };
}
