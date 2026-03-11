import { Router } from "express";
import {
  getCustomerSession,
  loginAdmin,
  loginCustomer,
  registerCustomer
} from "../controllers/auth.controller.js";
import { requireCustomer } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/register", registerCustomer);
router.post("/login", loginCustomer);
router.post("/admin/login", loginAdmin);
router.get("/me", requireCustomer, getCustomerSession);

export default router;