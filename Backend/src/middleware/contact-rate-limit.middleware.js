import { createRateLimit, identityRateKey } from "./rate-limit.middleware.js";

export function contactRateLimit({ windowMs = 15 * 60_000, max = 10, now } = {}) {
  return createRateLimit({ windowMs, max, now, keyGenerator: identityRateKey });
}
