import { Router } from "express";
import { createOrder, notifyWhatsApp } from "../controllers/orders.controller.js";
import { optionalAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/orders", optionalAuth, createOrder);
router.post("/whatsapp/notify", notifyWhatsApp);

export default router;
