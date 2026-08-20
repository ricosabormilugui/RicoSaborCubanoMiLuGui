import express from "express";
import { getContactEndpointStatus, sendContact } from "../controllers/contact.controller.js";
import { contactRateLimit } from "../middleware/contact-rate-limit.middleware.js";

const router = express.Router();

router.get("/contact", getContactEndpointStatus);
router.post("/contact", contactRateLimit({ windowMs: 15 * 60_000, max: 20 }), sendContact);

export default router;
