import { logger } from "../lib/logger.js";
import {
  createProduct,
  deleteProduct,
  findProductById,
  listAllProducts,
  listPublicProducts,
  updateProduct
} from "../repositories/products.repository.js";
import { normalizeCategorySlug } from "../config/product-categories.config.js";


function normalizeImages(value, imageUrl = "") {
  const values = Array.isArray(value) ? value : [];
  return Array.from(new Set([imageUrl, ...values].map((item) => String(item ?? "").trim()).filter(Boolean)));
}

function normalizeIngredients(value) {
  if (Array.isArray(value)) return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  return String(value ?? "").split(/\n|,/).map((item) => item.trim()).filter(Boolean);
}

function normalizeReviews(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    author: String(item?.author ?? "").trim(),
    rating: Math.max(1, Math.min(5, Number(item?.rating ?? 5))),
    comment: String(item?.comment ?? "").trim(),
    ...(item?.date ? { date: String(item.date) } : {})
  })).filter((item) => item.author && item.comment);
}

function normalizeCustomizationOptions(value = {}) {
  const normalizeList = (items) => Array.isArray(items)
    ? items.map((item) => {
      if (typeof item === "string") return { name: item.trim() };
      const price = Number(item?.price ?? 0);
      return { name: String(item?.name ?? "").trim(), ...(Number.isFinite(price) && price > 0 ? { price } : {}) };
    }).filter((item) => item.name)
    : [];

  return {
    themes: normalizeList(value.themes),
    colors: normalizeList(value.colors),
    sizes: normalizeList(value.sizes),
    fillings: normalizeList(value.fillings),
    toppings: normalizeList(value.toppings)
  };
}

function buildPayload(body = {}, { partial = false } = {}) {
  const payload = {};

  if (!partial || body.name !== undefined) payload.name = String(body.name ?? "").trim();
  if (!partial || body.description !== undefined) payload.description = String(body.description ?? "").trim();
  if (!partial || body.price !== undefined) payload.price = Number(body.price);
  if (!partial || body.category !== undefined) payload.category = normalizeCategorySlug(body.category);
  if (!partial || body.imageUrl !== undefined) payload.imageUrl = String(body.imageUrl ?? "").trim();
  if (!partial || body.images !== undefined) payload.images = normalizeImages(body.images, payload.imageUrl);
  if (!partial || body.ingredients !== undefined) payload.ingredients = normalizeIngredients(body.ingredients);
  if (!partial || body.reviews !== undefined) payload.reviews = normalizeReviews(body.reviews);
  if (!partial || body.customizationOptions !== undefined) payload.customizationOptions = normalizeCustomizationOptions(body.customizationOptions);
  if (!partial || body.published !== undefined) payload.published = Boolean(body.published);
  if (!partial || body.trackStock !== undefined) payload.trackStock = Boolean(body.trackStock);
  if (!partial || body.stock !== undefined) payload.stock = Number(body.stock ?? 0);
  if (!partial || body.lowStockAlert !== undefined) payload.lowStockAlert = Number(body.lowStockAlert ?? 5);
  if (!partial || body.available !== undefined) payload.available = Boolean(body.available);
  if (!partial || body.order !== undefined) payload.order = Number(body.order ?? 0);

  return payload;
}

function validateProduct(payload, { partial = false } = {}) {
  if ((!partial || payload.name !== undefined) && (!payload.name || payload.name.length < 2)) {
    return "name is required";
  }

  if ((!partial || payload.price !== undefined) && (!Number.isFinite(payload.price) || payload.price < 0)) {
    return "price must be >= 0";
  }

  if ((!partial || payload.category !== undefined) && !payload.category) {
    return "category is required";
  }

  if ((!partial || payload.order !== undefined) && !Number.isFinite(payload.order)) {
    return "order must be numeric";
  }

  if ((!partial || payload.stock !== undefined) && (!Number.isFinite(payload.stock) || payload.stock < 0)) {
    return "stock must be >= 0";
  }

  if ((!partial || payload.lowStockAlert !== undefined) && (!Number.isFinite(payload.lowStockAlert) || payload.lowStockAlert < 0)) {
    return "lowStockAlert must be >= 0";
  }

  return null;
}

export async function getProducts(_req, res) {
  try {
    const products = await listPublicProducts();
    return res.status(200).json({ products });
  } catch (error) {
    logger.error("products.public.failed", { error: error.message ?? "Unexpected error" });
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}

export async function getProductsForAdmin(_req, res) {
  try {
    const products = await listAllProducts();
    return res.status(200).json({ products });
  } catch (error) {
    logger.error("products.admin.list.failed", { error: error.message ?? "Unexpected error" });
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}

export async function getProductById(req, res) {
  try {
    const product = await findProductById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    return res.status(200).json({ product });
  } catch (error) {
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}

export async function createProductForAdmin(req, res) {
  try {
    const payload = buildPayload(req.body);
    const validationError = validateProduct(payload);
    if (validationError) return res.status(400).json({ error: validationError });

    const product = await createProduct(payload);
    return res.status(201).json({ product });
  } catch (error) {
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}

export async function updateProductForAdmin(req, res) {
  try {
    const payload = buildPayload(req.body, { partial: true });
    const validationError = validateProduct(payload, { partial: true });
    if (validationError) return res.status(400).json({ error: validationError });

    const product = await updateProduct(req.params.id, payload);
    if (!product) return res.status(404).json({ error: "Product not found" });

    return res.status(200).json({ product });
  } catch (error) {
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}

export async function deleteProductForAdmin(req, res) {
  try {
    const deleted = await deleteProduct(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Product not found" });

    return res.status(200).json({ deleted: true });
  } catch (error) {
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}

