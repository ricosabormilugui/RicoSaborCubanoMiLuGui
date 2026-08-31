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
import { getPaymentSettingsForAdmin, updatePaymentSettingsForAdmin } from "../controllers/payment-settings.controller.js";
import {
  createCategoryForAdmin,
  deleteCategoryForAdmin,
  getCategoriesForAdmin,
  updateCategoryForAdmin
} from "../controllers/categories.controller.js";

const router = Router();

router.use(requireAdmin);

router.get("/dashboard", getDashboardForAdmin);
router.get("/home", getHomeContentForAdmin);
router.put("/home", updateHomeContentForAdmin);
router.get("/payment-settings", getPaymentSettingsForAdmin);
router.put("/payment-settings", updatePaymentSettingsForAdmin);
router.get("/orders", listOrdersForAdmin);
router.patch("/orders/:orderId/status", updateOrderStatusForAdmin);
router.patch("/orders/:orderId/payment", updateOrderPaymentForAdmin);
router.delete("/orders/:orderId", deleteOrderForAdmin);
router.get("/products", getProductsForAdmin);
router.post("/products", createProductForAdmin);
router.put("/products/:id", updateProductForAdmin);
router.delete("/products/:id", deleteProductForAdmin);
router.get("/categories", getCategoriesForAdmin);
router.post("/categories", createCategoryForAdmin);
router.put("/categories/:id", updateCategoryForAdmin);
router.delete("/categories/:id", deleteCategoryForAdmin);
router.get("/contacts", listContactsForAdmin);
router.get("/customers", listCustomersForAdmin);
router.get("/contacts/:id", getContactForAdmin);
router.post("/contacts/:id/reply", replyContactForAdmin);

export default router;
