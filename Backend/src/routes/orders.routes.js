import { Router } from "express";
import { createOrder, listMyOrders, notifyWhatsApp } from "../controllers/orders.controller.js";
import { optionalAuth, requireCustomer } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/orders", optionalAuth, createOrder);
router.get("/orders/me", requireCustomer, listMyOrders);
router.post("/whatsapp/notify", notifyWhatsApp);

export default router;
