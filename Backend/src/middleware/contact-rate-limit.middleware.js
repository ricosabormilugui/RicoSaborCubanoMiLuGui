const buckets = new Map();

export function contactRateLimit({ windowMs = 15 * 60_000, max = 20 } = {}) {
  return (req, res, next) => {
    const key = `${req.ip || 'unknown'}:${req.headers['user-agent'] || 'na'}`;
    const now = Date.now();
    const bucket = buckets.get(key) ?? { count: 0, resetAt: now + windowMs };

    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.count += 1;
    buckets.set(key, bucket);

    if (bucket.count > max) {
      return res.status(429).json({ ok: false, error: 'Too many contact requests. Try later.' });
    }

    return next();
  };
}
