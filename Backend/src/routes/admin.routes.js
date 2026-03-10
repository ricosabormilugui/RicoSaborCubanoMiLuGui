import { Router } from "express";
import { listOrdersForAdmin, updateOrderStatusForAdmin } from "../controllers/orders.controller.js";
import { requireAdmin } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAdmin);
router.get("/orders", listOrdersForAdmin);
router.patch("/orders/:orderId/status", updateOrderStatusForAdmin);

export default router;
