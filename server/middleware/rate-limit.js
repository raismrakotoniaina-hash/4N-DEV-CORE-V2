const buckets = new Map();

function cleanupExpired(now) {
  for (const [identity, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(identity);
  }
}

export function createRateLimiter({ windowMs = 60_000, max = 60, key = null } = {}) {
  return (req, res, next) => {
    const identity = key ? key(req) : req.auth?.apiKeyId || req.ip || 'anonymous';
    const now = Date.now();
    let bucket = buckets.get(identity);

    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(identity, bucket);
    }

    bucket.count += 1;
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      return res.status(429).json({
        success: false,
        error: { code: 'rate_limit_exceeded', message: 'Rate limit exceeded. Please retry later.' },
        requestId: req.requestId
      });
    }

    if (buckets.size > 10_000) cleanupExpired(now);
    return next();
  };
}
