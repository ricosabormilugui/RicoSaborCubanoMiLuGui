import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { notificationsRepository, parseNotificationQuery } from "../repositories/notifications.repository.js";

export function createNotificationsRouter(repository = notificationsRepository) {
  const router = Router();
  router.use(requireAuth);
  router.use((req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    if (typeof req.auth?.sub !== "string" || !req.auth.sub.trim()) return res.status(401).json({ message: "Inicia sesión para ver tus notificaciones." });
    next();
  });
  const handle = fn => (req, res, next) => Promise.resolve().then(() => fn(req, res)).catch(next);
  const missing = res => res.status(404).json({ message: "Notificación no encontrada." });
  router.get("/", handle(async (req, res) => res.json(await repository.list(req.auth.sub, parseNotificationQuery(req.query)))));
  router.get("/unread-count", handle(async (req, res) => res.json({ unreadCount: await repository.count(req.auth.sub) })));
  router.patch("/read-all", handle(async (req, res) => res.json({ updated: await repository.readAll(req.auth.sub) })));
  router.patch("/:id/read", handle(async (req, res) => {
    const notification = await repository.read(req.auth.sub, req.params.id);
    return notification ? res.json({ notification }) : missing(res);
  }));
  router.delete("/:id", handle(async (req, res) => (await repository.remove(req.auth.sub, req.params.id)) ? res.status(204).end() : missing(res)));
  return router;
}
export default createNotificationsRouter();
