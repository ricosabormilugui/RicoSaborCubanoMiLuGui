import { verifyToken } from "../lib/auth.js";

function readBearerToken(req) {
  const authHeader = req.headers.authorization ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length).trim();
}

export function optionalAuth(req, _res, next) {
  const token = readBearerToken(req);
  if (!token) {
    req.auth = null;
    return next();
  }

  try {
    req.auth = verifyToken(token);
  } catch {
    req.auth = null;
  }

  return next();
}

export function requireAdmin(req, res, next) {
  const token = readBearerToken(req);
  if (!token) return res.status(401).json({ error: "Missing admin token" });

  try {
    const payload = verifyToken(token);
    if (!payload || payload.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    req.auth = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ error: error.message ?? "Invalid token" });
  }
}
