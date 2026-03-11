import { verifyAuthToken } from "../utils/auth-token.js";

export function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  const payload = verifyAuthToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (payload.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  req.user = payload;
  return next();
}
