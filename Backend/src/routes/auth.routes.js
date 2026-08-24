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
import { createRateLimit, identityRateKey } from "../middleware/rate-limit.middleware.js";

const router = Router();

router.post("/register", registerCustomer);
const loginRateLimit = createRateLimit({ windowMs: 15 * 60_000, max: 10, keyGenerator: identityRateKey });

router.post("/login", loginRateLimit, loginCustomer);
router.post("/forgot-password", passwordRecoveryRateLimit(), forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/admin/login", loginRateLimit, loginAdmin);
router.post("/admin/promote", promoteAdmin);
router.get("/me", requireAuth, getCustomerSession);
router.get("/email-exists", checkEmailRegistered);

export default router;
