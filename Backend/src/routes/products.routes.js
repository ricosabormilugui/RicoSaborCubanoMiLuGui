import { Router } from "express";
import { getProductById, getProducts } from "../controllers/products.controller.js";
import { getCategories } from "../controllers/categories.controller.js";

const router = Router();

router.get("/products", getProducts);
router.get("/categories", getCategories);
router.get("/products/:id", getProductById);

export default router;
