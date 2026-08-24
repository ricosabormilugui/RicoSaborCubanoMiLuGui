function parseOrigins(value, environment) {
  if (value === "*" && environment !== "production") return ["*"];
  return String(value ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter((origin) => origin && (environment !== "production" || origin !== "*"));
}

export function securityHeaders({ environment = process.env.NODE_ENV ?? "development" } = {}) {
  return (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    const secure = req.secure || req.get("x-forwarded-proto") === "https";
    if (environment === "production" && secure) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    next();
  };
}

export function cors({ origin: configuredOrigin, environment = process.env.NODE_ENV ?? "development" } = {}) {
  const origins = parseOrigins(configuredOrigin, environment);
  return (req, res, next) => {
    const origin = String(req.get("origin") ?? "").replace(/\/$/, "");
    const allowed = !origin || origins.includes("*") || origins.includes(origin);
    if (!allowed) return res.status(403).json({ message: "Origen no permitido." });
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origins.includes("*") ? "*" : origin);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-Id, Idempotency-Key");
    res.setHeader("Access-Control-Expose-Headers", "X-Request-Id, Retry-After, Idempotent-Replay");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  };
}
