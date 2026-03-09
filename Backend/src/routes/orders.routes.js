import { Router } from "express";
import { createOrder, notifyWhatsApp } from "../controllers/orders.controller.js";

const router = Router();

router.post("/orders", createOrder);
router.post("/whatsapp/notify", notifyWhatsApp);

export default router;
