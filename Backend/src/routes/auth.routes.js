import { Router } from "express";
import {
  getCustomerSession,
  loginAdmin,
  loginCustomer,
  promoteAdmin,
  registerCustomer,
  checkEmailRegistered,
  forgotPassword,
  resetPassword
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { passwordRecoveryRateLimit } from "../middleware/password-recovery-rate-limit.middleware.js";

const router = Router();

router.post("/register", registerCustomer);
router.post("/login", loginCustomer);
router.post("/forgot-password", passwordRecoveryRateLimit(), forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/admin/login", loginAdmin);
router.post("/admin/promote", promoteAdmin);
router.get("/me", requireAuth, getCustomerSession);
router.get("/email-exists", checkEmailRegistered);

export default router;
