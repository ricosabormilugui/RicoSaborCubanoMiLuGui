import { Router } from "express";
import { createOrder, listMyOrders, notifyWhatsApp } from "../controllers/orders.controller.js";
import { optionalAuth, requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/orders", optionalAuth, createOrder);
router.get("/orders/me", requireAuth, listMyOrders);
router.post("/whatsapp/notify", notifyWhatsApp);

export default router;
