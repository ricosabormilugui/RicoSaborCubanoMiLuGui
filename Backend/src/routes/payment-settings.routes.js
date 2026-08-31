import { Router } from "express";
import { getPublicPaymentSettings } from "../controllers/payment-settings.controller.js";

const router = Router();

router.get("/payment-settings", getPublicPaymentSettings);

export default router;
