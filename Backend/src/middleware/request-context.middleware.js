import { randomUUID } from "node:crypto";
import { logger } from "../lib/logger.js";

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;

function publicServerMessage(statusCode) {
  if (statusCode === 502) return "El servicio externo no está disponible.";
  if (statusCode === 503) return "El servicio no está disponible temporalmente.";
  if (statusCode === 504) return "La operación superó el tiempo de espera.";
  return "Se produjo un error interno.";
}

export function requestContext(req, res, next) {
  const incoming = String(req.get("x-request-id") ?? "").trim();
  req.requestId = SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader("X-Request-Id", req.requestId);

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode < 400 || body == null || typeof body !== "object" || Array.isArray(body)) return originalJson(body);
    if (res.statusCode >= 500 && ("error" in body || "message" in body)) {
      return originalJson({ message: publicServerMessage(res.statusCode), requestId: req.requestId });
    }
    return originalJson({ ...body, requestId: req.requestId });
  };
  next();
}

export function requestLogger({ slowRequestMs = Number(process.env.SLOW_REQUEST_THRESHOLD_MS ?? 2_000) } = {}) {
  return (req, res, next) => {
    if (!req.path.startsWith("/api") && req.path !== "/health") return next();
    const startedAt = Date.now();
    res.on("finish", () => {
      const durationMs = Date.now() - startedAt;
      const payload = {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs
      };
      if (res.statusCode >= 500) logger.error("http.request.completed", payload);
      else if (durationMs > slowRequestMs) logger.warn("http.request.slow", { ...payload, thresholdMs: slowRequestMs });
      else logger.info("http.request.completed", payload);
    });
    next();
  };
}
