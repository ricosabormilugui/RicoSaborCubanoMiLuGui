import {
  createProduct,
  deleteProduct,
  findProductById,
  listAllProducts,
  listPublicProducts,
  updateProduct
} from "../repositories/products.repository.js";

function normalizePayload(body = {}) {
  return {
    name: body.name ? String(body.name).trim() : "",
    description: body.description ? String(body.description).trim() : "",
    price: Number(body.price),
    category: body.category ? String(body.category).trim() : "",
    imageUrl: body.imageUrl ? String(body.imageUrl).trim() : "",
    available: body.available !== undefined ? Boolean(body.available) : true,
    order: body.order !== undefined ? Number(body.order) : 0
  };
}

function validateProduct(payload, { partial = false } = {}) {
  if (!partial || payload.name !== undefined) {
    if (!payload.name || payload.name.length < 2) return "name is required";
  }

  if (!partial || payload.price !== undefined) {
    if (!Number.isFinite(payload.price) || payload.price < 0) return "price must be >= 0";
  }

  if (!partial || payload.category !== undefined) {
    if (!payload.category) return "category is required";
  }

  if (!partial || payload.order !== undefined) {
    if (!Number.isFinite(payload.order)) return "order must be numeric";
  }

  return null;
}

export async function getProducts(req, res) {
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
    const payload = normalizePayload(req.body);
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
    const payload = normalizePayload(req.body);
    const validationError = validateProduct(payload);
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
