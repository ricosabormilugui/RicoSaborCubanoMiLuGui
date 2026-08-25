import { Router } from "express";
import { getProductByIdentifier, getProducts } from "../controllers/products.controller.js";
import { getCategories } from "../controllers/categories.controller.js";

const router = Router();

router.get("/products", getProducts);
router.get("/categories", getCategories);
router.get("/products/:identifier", getProductByIdentifier);

export default router;
