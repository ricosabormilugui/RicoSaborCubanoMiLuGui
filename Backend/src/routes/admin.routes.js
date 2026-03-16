import { Router } from "express";
import {
  listOrdersForAdmin,
  updateOrderStatusForAdmin
} from "../controllers/orders.controller.js";
import {
  createProductForAdmin,
  deleteProductForAdmin,
  getProductsForAdmin,
  updateProductForAdmin
} from "../controllers/products.controller.js";
import { requireAdmin } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAdmin);

router.get("/orders", listOrdersForAdmin);
router.patch("/orders/:orderId/status", updateOrderStatusForAdmin);
router.get("/products", getProductsForAdmin);
router.post("/products", createProductForAdmin);
router.put("/products/:id", updateProductForAdmin);
router.delete("/products/:id", deleteProductForAdmin);

export default router;
