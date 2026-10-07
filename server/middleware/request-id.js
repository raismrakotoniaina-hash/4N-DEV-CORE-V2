import crypto from 'node:crypto';

export function requestId(req, res, next) {
  const incoming = req.get('X-Request-ID');
  const id = incoming || crypto.randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
}
