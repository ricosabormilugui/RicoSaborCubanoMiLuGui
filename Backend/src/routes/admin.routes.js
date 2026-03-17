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
import {
  getContactForAdmin,
  listContactsForAdmin,
  replyContactForAdmin
} from "../controllers/admin-contacts.controller.js";

const router = Router();

router.use(requireAdmin);

router.get("/orders", listOrdersForAdmin);
router.patch("/orders/:orderId/status", updateOrderStatusForAdmin);
router.get("/products", getProductsForAdmin);
router.post("/products", createProductForAdmin);
router.put("/products/:id", updateProductForAdmin);
router.delete("/products/:id", deleteProductForAdmin);
router.get("/contacts", listContactsForAdmin);
router.get("/contacts/:id", getContactForAdmin);
router.post("/contacts/:id/reply", replyContactForAdmin);

export default router;
