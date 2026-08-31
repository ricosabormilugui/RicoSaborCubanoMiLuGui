import "dotenv/config";
import { createApp } from "./app.js";
import { validateRuntimeEnv } from "./lib/env.js";
import { closeMongoConnection } from "./lib/mongo.js";
import { logger } from "./lib/logger.js";
import { startPaymentExpirationJob } from "./services/order-expiration.job.js";

let server;
let shuttingDown = false;
let stopPaymentExpirationJob;

async function shutdown(reason, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.warn("service.shutdown.started", { reason });
  stopPaymentExpirationJob?.();
  const forceTimer = setTimeout(() => {
    logger.error("service.shutdown.forced", { reason });
    process.exit(1);
  }, Number(process.env.SHUTDOWN_TIMEOUT_MS ?? 10_000));
  forceTimer.unref();
  if (server) await new Promise((resolve) => server.close(resolve));
  await closeMongoConnection().catch((error) => logger.exception("mongo.close.failed", error));
  clearTimeout(forceTimer);
  logger.info("service.shutdown.completed", { reason });
  process.exit(exitCode);
}

try {
  const runtime = validateRuntimeEnv();
  const app = createApp({ environment: runtime.environment });
  server = app.listen(runtime.port, () => {
    logger.info("service.started", {
      environment: runtime.environment,
      port: runtime.port,
      database: runtime.database,
      emailEnabled: runtime.emailEnabled,
      bodyLimit: runtime.bodyLimit,
      corsConfigured: runtime.corsOrigin !== "development-only"
    });
    stopPaymentExpirationJob = startPaymentExpirationJob();
  });
  server.requestTimeout = runtime.httpRequestTimeoutMs;
  server.headersTimeout = runtime.httpHeadersTimeoutMs;
} catch (error) {
  logger.exception("service.startup.failed", error);
  process.exitCode = 1;
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (error) => {
  logger.exception("process.unhandled_rejection", error);
  void shutdown("unhandledRejection", 1);
});
process.on("uncaughtException", (error) => {
  logger.exception("process.uncaught_exception", error);
  void shutdown("uncaughtException", 1);
});
