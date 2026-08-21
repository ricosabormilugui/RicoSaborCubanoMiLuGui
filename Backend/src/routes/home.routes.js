import { Router } from "express";
import { getPublicHomeContent } from "../controllers/home.controller.js";

const router = Router();

router.get("/home", getPublicHomeContent);

export default router;
