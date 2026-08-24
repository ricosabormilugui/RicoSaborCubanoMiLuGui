import { Router } from "express";
import { getSitemap } from "../controllers/sitemap.controller.js";

const router = Router();

router.get("/sitemap.xml", getSitemap);

export default router;
