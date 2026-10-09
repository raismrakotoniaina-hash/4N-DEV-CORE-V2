import crypto from 'node:crypto';

export function requestId(req, res, next) {
  // Always generate a server-owned ID. A caller-controlled ID must not be
  // able to collide with a previous billing reservation and bypass settlement.
  const clientRequestId = req.get('X-Request-ID');
  if (typeof clientRequestId === 'string' && clientRequestId.trim()) {
    req.clientRequestId = clientRequestId.trim().slice(0, 128);
  }

  const id = crypto.randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
}
