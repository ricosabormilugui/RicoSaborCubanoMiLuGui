import { Router } from "express";
import { loginAdmin, loginCustomer, registerCustomer } from "../controllers/auth.controller.js";

const router = Router();

router.post("/register", registerCustomer);
router.post("/login", loginCustomer);
router.post("/admin/login", loginAdmin);

export default router;
