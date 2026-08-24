import { logger } from "../lib/logger.js";

export function apiNotFound(req, res) {
  return res.status(404).json({ message: "Ruta API no encontrada." });
}

export function globalErrorHandler(error, req, res, _next) {
  const candidate = Number(error?.status ?? error?.statusCode ?? 500);
  const statusCode = candidate >= 400 && candidate <= 599 ? candidate : 500;
  logger.exception("http.request.failed", error, {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    statusCode
  });
  if (res.headersSent) return res.end();
  const publicMessages = {
    400: "La solicitud no es válida.",
    413: "La solicitud supera el tamaño permitido."
  };
  const message = publicMessages[statusCode] ?? (error?.expose && statusCode < 500 ? error.message : undefined);
  return res.status(statusCode).json({ message: message ?? "Se produjo un error interno." });
}
