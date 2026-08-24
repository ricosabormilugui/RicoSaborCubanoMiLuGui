export function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function getOptionalEnv(name, fallback = undefined, env = process.env) {
  const value = env[name];
  return value && String(value).trim() ? String(value).trim() : fallback;
}

export function getIntegerEnv(name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER, env = process.env } = {}) {
  const raw = getOptionalEnv(name, undefined, env);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Invalid numeric environment variable: ${name}`);
  }
  return value;
}

function validateHttpUrl(name, value) {
  if (!value) return;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid URL environment variable: ${name}`);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error(`Invalid URL environment variable: ${name}`);
}

export function validateRuntimeEnv(env = process.env) {
  const environment = getOptionalEnv("NODE_ENV", "development", env);
  const appEnvironment = getOptionalEnv(
    "APP_ENV",
    environment === "production" ? "production" : "development",
    env
  ).toLowerCase();
  if (!["development", "test", "staging", "production"].includes(appEnvironment)) {
    throw new Error("APP_ENV must be development, test, staging or production");
  }
  if (appEnvironment === "staging" && environment !== "production") {
    throw new Error("Staging must run with NODE_ENV=production");
  }

  const mongoUri = getOptionalEnv("MONGODB_URI", getOptionalEnv("MONGO_URI", undefined, env), env);
  if (!mongoUri) throw new Error("Missing required environment variable: MONGODB_URI");
  if (/[<>]/.test(mongoUri)) throw new Error("MONGODB_URI contains template placeholders");
  if (!/^mongodb(?:\+srv)?:\/\//i.test(mongoUri)) throw new Error("MONGODB_URI must use mongodb:// or mongodb+srv://");

  const authSecret = getOptionalEnv("AUTH_TOKEN_SECRET", getOptionalEnv("AUTH_JWT_SECRET", undefined, env), env);
  if (!authSecret || authSecret.length < 32) throw new Error("AUTH_TOKEN_SECRET must contain at least 32 characters");

  const frontendUrl = getOptionalEnv("FRONTEND_URL", undefined, env);
  validateHttpUrl("FRONTEND_URL", frontendUrl);
  const corsOrigin = getOptionalEnv("CORS_ORIGIN", frontendUrl, env);
  const corsOrigins = String(corsOrigin ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);
  if (environment === "production" && (!corsOrigins.length || corsOrigins.includes("*"))) {
    throw new Error("CORS_ORIGIN or FRONTEND_URL is required in production and cannot be wildcard");
  }
  for (const origin of corsOrigins) {
    if (origin !== "*") validateHttpUrl("CORS_ORIGIN", origin);
  }

  const resend = ["RESEND_API_KEY", "NOTIFY_EMAIL_FROM", "NOTIFY_EMAIL_TO"];
  const configuredEmailValues = resend.filter((name) => getOptionalEnv(name, undefined, env));
  if (configuredEmailValues.length > 0 && configuredEmailValues.length !== resend.length) {
    throw new Error("Email configuration is incomplete: RESEND_API_KEY, NOTIFY_EMAIL_FROM and NOTIFY_EMAIL_TO must be set together");
  }

  const stagingEmailTo = getOptionalEnv("STAGING_EMAIL_TO", undefined, env);
  const database = getOptionalEnv("MONGODB_DB_NAME", getOptionalEnv("MONGO_DB_NAME", "from-uri", env), env);
  if (appEnvironment === "staging") {
    if (!/(?:staging|stage|qa)/i.test(database)) {
      throw new Error("Staging MONGODB_DB_NAME must explicitly contain staging, stage or qa");
    }
    if (configuredEmailValues.length !== resend.length || !stagingEmailTo) {
      throw new Error("Staging requires complete Resend configuration and STAGING_EMAIL_TO");
    }
  }
  if (appEnvironment === "production" && stagingEmailTo) {
    throw new Error("STAGING_EMAIL_TO cannot be configured when APP_ENV=production");
  }

  const payment = [
    "PAYMENT_BIZUM_PHONE",
    "PAYMENT_BANK_IBAN",
    "PAYMENT_BANK_HOLDER",
    "PAYMENT_CASH_INSTRUCTIONS"
  ];
  const missingPaymentValues = payment.filter((name) => !getOptionalEnv(name, undefined, env));
  if (environment === "production" && missingPaymentValues.length > 0) {
    throw new Error(`Payment configuration is incomplete: ${missingPaymentValues.join(", ")}`);
  }

  const bodyLimit = getOptionalEnv("JSON_BODY_LIMIT", "1mb", env);
  if (!/^\d+(?:kb|mb)$/i.test(bodyLimit)) throw new Error("JSON_BODY_LIMIT must use kb or mb");

  return {
    environment,
    appEnvironment,
    port: getIntegerEnv("PORT", 3001, { min: 1, max: 65_535, env }),
    database,
    corsOrigin: corsOrigin ?? "development-only",
    bodyLimit,
    emailEnabled: configuredEmailValues.length === resend.length,
    mongoTimeoutMs: getIntegerEnv("MONGODB_SERVER_SELECTION_TIMEOUT_MS", 5_000, { min: 500, max: 60_000, env }),
    mongoConnectTimeoutMs: getIntegerEnv("MONGODB_CONNECT_TIMEOUT_MS", 10_000, { min: 500, max: 120_000, env }),
    mongoMaxPoolSize: getIntegerEnv("MONGODB_MAX_POOL_SIZE", 20, { min: 1, max: 200, env }),
    externalTimeoutMs: getIntegerEnv("EXTERNAL_HTTP_TIMEOUT_MS", 8_000, { min: 500, max: 60_000, env }),
    resendTimeoutMs: getIntegerEnv("RESEND_TIMEOUT_MS", 8_000, { min: 500, max: 60_000, env }),
    slowRequestMs: getIntegerEnv("SLOW_REQUEST_THRESHOLD_MS", 2_000, { min: 100, max: 120_000, env }),
    httpRequestTimeoutMs: getIntegerEnv("HTTP_REQUEST_TIMEOUT_MS", 30_000, { min: 1_000, max: 300_000, env }),
    httpHeadersTimeoutMs: getIntegerEnv("HTTP_HEADERS_TIMEOUT_MS", 15_000, { min: 1_000, max: 120_000, env }),
    shutdownTimeoutMs: getIntegerEnv("SHUTDOWN_TIMEOUT_MS", 10_000, { min: 1_000, max: 120_000, env })
  };
}
