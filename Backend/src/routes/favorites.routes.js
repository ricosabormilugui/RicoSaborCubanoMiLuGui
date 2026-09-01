import { Router } from "express";
import { createFavoritesController } from "../controllers/favorites.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { createRateLimit } from "../middleware/rate-limit.middleware.js";
import { userFavoritesStore } from "../repositories/users.repository.js";
import { ADMIN_FAVORITES_UNAVAILABLE_MESSAGE } from "../config/favorites.config.js";

export function rejectNonCustomerFavorites(req, res, next) {
  if (req.auth?.role === "admin") {
    return res.status(403).json({ error: ADMIN_FAVORITES_UNAVAILABLE_MESSAGE });
  }
  if (req.auth?.role !== "customer") {
    return res.status(403).json({ error: "Customer access required" });
  }
  return next();
}

export function createFavoritesRouter(store = userFavoritesStore) {
  const router = Router();
  const controller = createFavoritesController(store);
  const writeLimit = createRateLimit({
    windowMs: 60_000,
    max: 40,
    keyGenerator: (req) => String(req.auth?.sub ?? req.ip ?? "unknown"),
    message: "Has realizado demasiados intentos. Inténtalo de nuevo más tarde."
  });

  router.use(requireAuth);
  router.use(rejectNonCustomerFavorites);
  router.use((req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    if (typeof req.auth?.sub !== "string" || !req.auth.sub.trim()) {
      return res.status(401).json({ message: "Inicia sesión para ver tus favoritos." });
    }
    next();
  });

  const handle = (fn) => (req, res, next) => Promise.resolve().then(() => fn(req, res)).catch(next);
  router.get("/", handle((req, res) => controller.get(req, res)));
  router.put("/", writeLimit, handle((req, res) => controller.put(req, res)));
  router.delete("/", writeLimit, handle((req, res) => controller.removeMany(req, res)));
  router.post("/:productId", writeLimit, handle((req, res) => controller.add(req, res)));
  router.delete("/:productId", writeLimit, handle((req, res) => controller.remove(req, res)));
  return router;
}

export default createFavoritesRouter();
