import { Router } from "express";
import { getOrders, patchOrderStatus } from "../controllers/admin.controller.js";
import { requireAdminAuth } from "../middleware/require-admin-auth.js";

const router = Router();

router.use(requireAdminAuth);

router.get("/orders", getOrders);
router.patch("/orders/:orderId/status", patchOrderStatus);

export default router;