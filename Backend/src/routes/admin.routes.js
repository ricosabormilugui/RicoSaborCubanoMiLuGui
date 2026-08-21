import { Router } from "express";
import {
  listOrdersForAdmin,
  updateOrderStatusForAdmin,
  deleteOrderForAdmin,
  updateOrderPaymentForAdmin
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
import { listCustomersForAdmin } from "../controllers/admin-customers.controller.js";
import { getDashboardForAdmin } from "../controllers/admin-dashboard.controller.js";
import { getHomeContentForAdmin, updateHomeContentForAdmin } from "../controllers/home.controller.js";

const router = Router();

router.use(requireAdmin);

router.get("/dashboard", getDashboardForAdmin);
router.get("/home", getHomeContentForAdmin);
router.put("/home", updateHomeContentForAdmin);
router.get("/orders", listOrdersForAdmin);
router.patch("/orders/:orderId/status", updateOrderStatusForAdmin);
router.patch("/orders/:orderId/payment", updateOrderPaymentForAdmin);
router.delete("/orders/:orderId", deleteOrderForAdmin);
router.get("/products", getProductsForAdmin);
router.post("/products", createProductForAdmin);
router.put("/products/:id", updateProductForAdmin);
router.delete("/products/:id", deleteProductForAdmin);
router.get("/contacts", listContactsForAdmin);
router.get("/customers", listCustomersForAdmin);
router.get("/contacts/:id", getContactForAdmin);
router.post("/contacts/:id/reply", replyContactForAdmin);

export default router;
