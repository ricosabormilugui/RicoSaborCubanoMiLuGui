import {
  createProduct,
  deleteProduct,
  findProductById,
  listAllProducts,
  listPublicProducts,
  updateProduct
} from "../repositories/products.repository.js";

function buildPayload(body = {}, { partial = false } = {}) {
  const payload = {};

  if (!partial || body.name !== undefined) payload.name = String(body.name ?? "").trim();
  if (!partial || body.description !== undefined) payload.description = String(body.description ?? "").trim();
  if (!partial || body.price !== undefined) payload.price = Number(body.price);
  if (!partial || body.category !== undefined) payload.category = String(body.category ?? "").trim();
  if (!partial || body.imageUrl !== undefined) payload.imageUrl = String(body.imageUrl ?? "").trim();
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
    return res.status(500).json({ error: error.message ?? "Unexpected error" });
  }
}

export async function getProductsForAdmin(_req, res) {
  try {
    const products = await listAllProducts();
    return res.status(200).json({ products });
  } catch (error) {
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

