import { Router } from "express";
import { createOrder, listMyOrders } from "../controllers/orders.controller.js";
import { getShippingQuote } from "../controllers/shipping.controller.js";
import { optionalAuth, requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/orders", optionalAuth, createOrder);
router.post("/shipping/quote", getShippingQuote);
router.get("/orders/me", requireAuth, listMyOrders);

export default router;
