import { ObjectId } from "mongodb";
import { ensureIndexes, getCollection } from "../lib/mongo.js";

function getProductsCollectionName() {
  return process.env.MONGODB_PRODUCTS_COLLECTION ?? process.env.PRODUCTS_COLLECTION ?? "products";
}

let ensureProductsIndexesPromise;

async function getProductsCollection() {
  const collectionName = getProductsCollectionName();
  const collection = await getCollection(collectionName);

  if (!ensureProductsIndexesPromise) {
    ensureProductsIndexesPromise = ensureIndexes(collection, [
      { keys: { published: 1, order: 1 }, options: { name: "published_order" } },
      { keys: { available: 1, order: 1 }, options: { name: "available_order" } },
      { keys: { category: 1, order: 1 }, options: { name: "category_order" } }
    ], { collectionName });
  }

  await ensureProductsIndexesPromise;
  return collection;
}

function normalizeStockNumber(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}

export async function listPublicProducts() {
  const collection = await getProductsCollection();
  return collection
    .find({ published: true, available: true })
    .sort({ order: 1, createdAt: -1 })
    .toArray();
}

export async function listAllProducts() {
  const collection = await getProductsCollection();
  return collection
    .find({})
    .sort({ order: 1, createdAt: -1 })
    .toArray();
}

export async function findProductById(id) {
  const collection = await getProductsCollection();
  if (!ObjectId.isValid(id)) return null;
  return collection.findOne({ _id: new ObjectId(id) });
}

export async function createProduct(payload) {
  const collection = await getProductsCollection();
  const now = new Date().toISOString();
  const stock = normalizeStockNumber(payload.stock, 0);
  const trackStock = payload.trackStock ?? false;
  const lowStockAlert = normalizeStockNumber(payload.lowStockAlert, 5);

  const product = {
    name: payload.name,
    description: payload.description ?? "",
    price: payload.price,
    category: payload.category,
    imageUrl: payload.imageUrl ?? "",
    published: payload.published ?? true,
    trackStock,
    stock,
    lowStockAlert,
    available: payload.available ?? (trackStock ? stock > 0 : true),
    order: payload.order ?? 0,
    createdAt: now,
    updatedAt: now
  };

  const result = await collection.insertOne(product);
  return { ...product, _id: result.insertedId };
}

export async function updateProduct(id, payload) {
  const collection = await getProductsCollection();
  if (!ObjectId.isValid(id)) return null;

  const updates = {
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.description !== undefined ? { description: payload.description } : {}),
    ...(payload.price !== undefined ? { price: payload.price } : {}),
    ...(payload.category !== undefined ? { category: payload.category } : {}),
    ...(payload.imageUrl !== undefined ? { imageUrl: payload.imageUrl } : {}),
    ...(payload.published !== undefined ? { published: payload.published } : {}),
    ...(payload.trackStock !== undefined ? { trackStock: payload.trackStock } : {}),
    ...(payload.stock !== undefined ? { stock: normalizeStockNumber(payload.stock, 0) } : {}),
    ...(payload.lowStockAlert !== undefined ? { lowStockAlert: normalizeStockNumber(payload.lowStockAlert, 5) } : {}),
    ...(payload.available !== undefined ? { available: payload.available } : {}),
    ...(payload.order !== undefined ? { order: payload.order } : {}),
    updatedAt: new Date().toISOString()
  };

  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: updates },
    { returnDocument: "after" }
  );

  return result;
}

export async function deleteProduct(id) {
  const collection = await getProductsCollection();
  if (!ObjectId.isValid(id)) return false;

  const result = await collection.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount > 0;
}

export async function applyOrderStockAdjustments(items = []) {
  const collection = await getProductsCollection();

  for (const item of items) {
    const productId = String(item?.productId ?? "").trim();
    const quantity = normalizeStockNumber(item?.quantity, 0);
    if (!ObjectId.isValid(productId) || quantity <= 0) continue;

    const existing = await collection.findOne({ _id: new ObjectId(productId) });
    if (!existing || !existing.trackStock) continue;

    const nextStock = Math.max(0, normalizeStockNumber(existing.stock, 0) - quantity);
    await collection.updateOne(
      { _id: existing._id },
      {
        $set: {
          stock: nextStock,
          available: nextStock > 0,
          updatedAt: new Date().toISOString()
        }
      }
    );
  }
}
