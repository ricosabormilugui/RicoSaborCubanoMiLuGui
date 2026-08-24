import { Router } from "express";
import { subscribeNewsletter } from "../controllers/newsletter.controller.js";
import { createRateLimit, identityRateKey } from "../middleware/rate-limit.middleware.js";

const router = Router();

router.post("/newsletter", createRateLimit({ windowMs: 15 * 60_000, max: 10, keyGenerator: identityRateKey }), subscribeNewsletter);

export default router;
