import { createHash } from "node:crypto";

function compactBuckets(buckets, now, maxBuckets) {
  if (buckets.size < maxBuckets) return;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

export function identityRateKey(req) {
  const ip = String(req.ip ?? req.socket?.remoteAddress ?? "unknown");
  const identity = String(req.body?.email ?? "anonymous").trim().toLowerCase();
  const digest = createHash("sha256").update(identity).digest("hex").slice(0, 16);
  return `${ip}:${digest}`;
}

export function createRateLimit({
  windowMs = 15 * 60_000,
  max = 10,
  maxBuckets = 10_000,
  keyGenerator = (req) => String(req.ip ?? req.socket?.remoteAddress ?? "unknown"),
  message = "Has realizado demasiados intentos. Inténtalo de nuevo más tarde.",
  now = () => Date.now()
} = {}) {
  const buckets = new Map();
  return (req, res, next) => {
    const timestamp = now();
    compactBuckets(buckets, timestamp, maxBuckets);
    const requestedKey = keyGenerator(req);
    const key = buckets.size >= maxBuckets && !buckets.has(requestedKey) ? "overflow" : requestedKey;
    const current = buckets.get(key);
    const bucket = !current || timestamp >= current.resetAt
      ? { count: 0, resetAt: timestamp + windowMs }
      : current;
    bucket.count += 1;
    buckets.set(key, bucket);
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
    if (bucket.count > max) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((bucket.resetAt - timestamp) / 1000))));
      return res.status(429).json({ message });
    }
    next();
  };
}
