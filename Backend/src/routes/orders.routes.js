import { Router } from "express";
import { createOrder, listMyOrders } from "../controllers/orders.controller.js";
import { optionalAuth, requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/orders", optionalAuth, createOrder);
router.get("/orders/me", requireAuth, listMyOrders);

export default router;
