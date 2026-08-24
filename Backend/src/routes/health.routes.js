import { Router } from "express";
import { checkMongoHealth } from "../lib/mongo.js";

function version() {
  return String(process.env.SERVICE_VERSION ?? process.env.COMMIT_REF ?? "1.0.0").slice(0, 40);
}

function healthPayload(database) {
  return {
    status: database === "unavailable" ? "unavailable" : "ok",
    service: "backend",
    ...(database ? { database } : {}),
    timestamp: new Date().toISOString(),
    version: version()
  };
}

export function createHealthRouter({ databaseCheck = checkMongoHealth } = {}) {
  const router = Router();
  router.get("/health", (_req, res) => res.status(200).json(healthPayload()));
  router.get("/ready", async (_req, res) => {
    try {
      await databaseCheck();
      return res.status(200).json(healthPayload("ok"));
    } catch {
      return res.status(503).json(healthPayload("unavailable"));
    }
  });
  return router;
}
