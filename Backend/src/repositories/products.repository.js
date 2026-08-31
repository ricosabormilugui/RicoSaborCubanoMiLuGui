import { ObjectId } from "mongodb";
import { ensureIndexes, getCollection } from "../lib/mongo.js";
import { allocateUniqueProductSlug, normalizeProductSlug } from "../utils/product-slug.js";

export function getProductsCollectionName() {
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
      { keys: { category: 1, order: 1 }, options: { name: "category_order" } },
      {
        keys: { slug: 1 },
        options: {
          name: "product_slug_unique",
          unique: true,
          partialFilterExpression: { slug: { $type: "string", $gt: "" } }
        }
      }
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

export function buildIndexableProductQuery() {
  return {
    published: true,
    $or: [
      { available: true },
      { trackStock: true, stock: { $lte: 0 } }
    ]
  };
}

export async function listIndexableProducts() {
  const collection = await getProductsCollection();
  return collection
    .find(buildIndexableProductQuery())
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

export async function findProductById(id, { session } = {}) {
  const collection = await getProductsCollection();
  if (!ObjectId.isValid(id)) return null;
  return collection.findOne({ _id: new ObjectId(id) }, { session });
}

export async function findPublicProductByIdentifier(identifier) {
  const collection = await getProductsCollection();
  const normalizedSlug = normalizeProductSlug(identifier);
  const identifiers = normalizedSlug ? [{ slug: normalizedSlug }] : [];
  if (ObjectId.isValid(identifier)) identifiers.push({ _id: new ObjectId(identifier) });
  if (!identifiers.length) return null;

  return collection.findOne({
    $and: [buildIndexableProductQuery(), { $or: identifiers }]
  });
}

export async function listRelatedPublicProducts(product, limit = 4) {
  const collection = await getProductsCollection();
  const candidates = await collection
    .find({ published: true, available: true, _id: { $ne: product._id } })
    .sort({ order: 1, createdAt: -1 })
    .limit(Math.max(limit * 3, limit))
    .toArray();

  return candidates
    .sort((left, right) => Number(right.category === product.category) - Number(left.category === product.category))
    .slice(0, limit);
}

async function uniqueSlugFor(collection, value, excludeId) {
  return allocateUniqueProductSlug(value, async (slug) => Boolean(await collection.findOne({
    slug,
    ...(excludeId ? { _id: { $ne: excludeId } } : {})
  }, { projection: { _id: 1 } })));
}

export async function createProduct(payload) {
  const collection = await getProductsCollection();
  const now = new Date().toISOString();
  const stock = normalizeStockNumber(payload.stock, 0);
  const trackStock = payload.trackStock ?? false;
  const lowStockAlert = normalizeStockNumber(payload.lowStockAlert, 5);

  const product = {
    name: payload.name,
    slug: await uniqueSlugFor(collection, payload.name),
    description: payload.description ?? "",
    price: payload.price,
    category: payload.category,
    imageUrl: payload.imageUrl ?? "",
    images: payload.images ?? [],
    ingredients: payload.ingredients ?? [],
    reviews: payload.reviews ?? [],
    customizationOptions: payload.customizationOptions ?? {},
    published: payload.published ?? true,
    trackStock,
    stock,
    lowStockAlert,
    minimumQuantity: Math.max(1, normalizeStockNumber(payload.minimumQuantity, 1)),
    unitLabel: payload.unitLabel ?? "",
    available: payload.available ?? (trackStock ? stock > 0 : true),
    order: payload.order ?? 0,
    createdAt: now,
    updatedAt: now
  };

  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      const result = await collection.insertOne(product);
      return { ...product, _id: result.insertedId };
    } catch (error) {
      if (error?.code !== 11000) throw error;
      product.slug = await uniqueSlugFor(collection, payload.name);
    }
  }
  throw new Error("Unable to allocate a unique product slug");
}

export async function updateProduct(id, payload) {
  const collection = await getProductsCollection();
  if (!ObjectId.isValid(id)) return null;
  const objectId = new ObjectId(id);
  const existing = await collection.findOne({ _id: objectId }, { projection: { name: 1, slug: 1 } });
  if (!existing) return null;
  const shouldAssignSlug = !normalizeProductSlug(existing.slug);

  const updates = {
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.description !== undefined ? { description: payload.description } : {}),
    ...(payload.price !== undefined ? { price: payload.price } : {}),
    ...(payload.category !== undefined ? { category: payload.category } : {}),
    ...(payload.imageUrl !== undefined ? { imageUrl: payload.imageUrl } : {}),
    ...(payload.images !== undefined ? { images: payload.images } : {}),
    ...(payload.ingredients !== undefined ? { ingredients: payload.ingredients } : {}),
    ...(payload.reviews !== undefined ? { reviews: payload.reviews } : {}),
    ...(payload.customizationOptions !== undefined ? { customizationOptions: payload.customizationOptions } : {}),
    ...(payload.published !== undefined ? { published: payload.published } : {}),
    ...(payload.trackStock !== undefined ? { trackStock: payload.trackStock } : {}),
    ...(payload.stock !== undefined ? { stock: normalizeStockNumber(payload.stock, 0) } : {}),
    ...(payload.lowStockAlert !== undefined ? { lowStockAlert: normalizeStockNumber(payload.lowStockAlert, 5) } : {}),
    ...(payload.minimumQuantity !== undefined ? { minimumQuantity: Math.max(1, normalizeStockNumber(payload.minimumQuantity, 1)) } : {}),
    ...(payload.unitLabel !== undefined ? { unitLabel: payload.unitLabel } : {}),
    ...(payload.available !== undefined ? { available: payload.available } : {}),
    ...(payload.order !== undefined ? { order: payload.order } : {}),
    ...(shouldAssignSlug ? { slug: await uniqueSlugFor(collection, payload.name ?? existing.name, objectId) } : {}),
    updatedAt: new Date().toISOString()
  };

  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      return await collection.findOneAndUpdate(
        { _id: objectId },
        { $set: updates },
        { returnDocument: "after" }
      );
    } catch (error) {
      if (!shouldAssignSlug || error?.code !== 11000) throw error;
      updates.slug = await uniqueSlugFor(collection, payload.name ?? existing.name, objectId);
    }
  }
  throw new Error("Unable to allocate a unique product slug");
}

export async function deleteProduct(id) {
  const collection = await getProductsCollection();
  if (!ObjectId.isValid(id)) return false;

  const result = await collection.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount > 0;
}

export class OrderStockError extends Error {
  constructor(message, { productId, available, productName } = {}) {
    super(message);
    this.name = "OrderStockError";
    this.code = "ORDER_STOCK_CONFLICT";
    this.status = 409;
    this.productId = productId;
    const stock = Number(available);
    this.details = {
      productId,
      ...(Number.isFinite(stock) ? { available: stock } : {}),
      ...(productName ? { productName } : {})
    };
  }
}

export function groupOrderStockRequirements(items = []) {
  const requirements = new Map();
  for (const item of items) {
    const productId = String(item?.baseProductId ?? item?.productId ?? "").split("::")[0].trim();
    const quantity = normalizeStockNumber(item?.quantity, 0);
    if (!ObjectId.isValid(productId) || quantity <= 0) continue;
    requirements.set(productId, (requirements.get(productId) ?? 0) + quantity);
  }
  return [...requirements.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

export async function applyOrderStockAdjustments(items = [], { session, collection: providedCollection } = {}) {
  const collection = providedCollection ?? await getProductsCollection();

  for (const { productId, quantity } of groupOrderStockRequirements(items)) {
    const objectId = new ObjectId(productId);
    const now = new Date().toISOString();
    const updated = await collection.findOneAndUpdate(
      { _id: objectId, trackStock: true, stock: { $gte: quantity } },
      [
        { $set: { stock: { $subtract: [{ $ifNull: ["$stock", 0] }, quantity] }, updatedAt: now } },
        { $set: { available: { $gt: ["$stock", 0] } } }
      ],
      { returnDocument: "after", session }
    );

    if (updated) continue;

    const existing = await collection.findOne({ _id: objectId }, { session });
    if (!existing) {
      throw new OrderStockError("Uno de los productos ya no existe.", { productId });
    }
    if (!existing.trackStock) continue;
    throw new OrderStockError(`No hay stock suficiente para ${existing.name ?? "uno de los productos"}.`, {
      productId,
      available: Number(existing.stock ?? 0),
      productName: existing.name
    });
  }
}

export async function restoreOrderStockAdjustments(items = [], { session, collection: providedCollection } = {}) {
  const collection = providedCollection ?? await getProductsCollection();

  for (const { productId, quantity } of groupOrderStockRequirements(items)) {
    const objectId = new ObjectId(productId);
    const now = new Date().toISOString();
    const existing = await collection.findOne({ _id: objectId }, { session });
    if (!existing || existing.trackStock !== true) continue;

    await collection.findOneAndUpdate(
      { _id: objectId, trackStock: true },
      [
        { $set: { stock: { $add: [{ $ifNull: ["$stock", 0] }, quantity] }, updatedAt: now } },
        { $set: { available: { $gt: ["$stock", 0] } } }
      ],
      { returnDocument: "after", session }
    );
  }
}
