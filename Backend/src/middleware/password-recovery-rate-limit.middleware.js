import {
  PASSWORD_RECOVERY_GENERIC_MESSAGE,
  PASSWORD_RESET_RATE_MAX_PER_EMAIL,
  PASSWORD_RESET_RATE_MAX_PER_IP,
  PASSWORD_RESET_RATE_WINDOW_MINUTES
} from "../config/password-recovery.config.js";
import { normalizeUserEmail } from "../repositories/users.repository.js";

function consume(buckets, key, now, windowMs, max) {
  if (buckets.size >= 10_000) {
    for (const [storedKey, storedBucket] of buckets) {
      if (now >= storedBucket.resetAt) buckets.delete(storedKey);
    }
  }

  const safeKey = buckets.size >= 10_000 && !buckets.has(key) ? "overflow" : key;
  const current = buckets.get(safeKey);
  const bucket = !current || now >= current.resetAt
    ? { count: 0, resetAt: now + windowMs }
    : current;

  bucket.count += 1;
  buckets.set(safeKey, bucket);
  return bucket.count <= max;
}

export function passwordRecoveryRateLimit({
  windowMs = PASSWORD_RESET_RATE_WINDOW_MINUTES * 60_000,
  maxPerEmail = PASSWORD_RESET_RATE_MAX_PER_EMAIL,
  maxPerIp = PASSWORD_RESET_RATE_MAX_PER_IP,
  now = () => Date.now()
} = {}) {
  const emailBuckets = new Map();
  const ipBuckets = new Map();

  return (req, res, next) => {
    const timestamp = now();
    const email = normalizeUserEmail(req.body?.email) ?? "invalid";
    const ip = String(req.ip ?? req.socket?.remoteAddress ?? "unknown");
    const emailAllowed = consume(emailBuckets, email, timestamp, windowMs, maxPerEmail);
    const ipAllowed = consume(ipBuckets, ip, timestamp, windowMs, maxPerIp);

    if (!emailAllowed || !ipAllowed) {
      return res.status(202).json({ message: PASSWORD_RECOVERY_GENERIC_MESSAGE });
    }

    return next();
  };
}
