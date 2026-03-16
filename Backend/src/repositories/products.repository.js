import { ObjectId } from "mongodb";
import { getDb } from "../lib/mongo.js";

function getProductsCollectionName() {
  return process.env.MONGODB_PRODUCTS_COLLECTION ?? "products";
}

let ensureProductsIndexesPromise;

async function getProductsCollection() {
  const db = await getDb();
  const collection = db.collection(getProductsCollectionName());

  if (!ensureProductsIndexesPromise) {
    ensureProductsIndexesPromise = Promise.all([
      collection.createIndex({ available: 1, order: 1 }, { name: "available_order" }),
      collection.createIndex({ category: 1, order: 1 }, { name: "category_order" })
    ]);
  }

  await ensureProductsIndexesPromise;
  return collection;
}

export async function listPublicProducts() {
  const collection = await getProductsCollection();
  return collection
    .find({ available: true })
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
  const product = {
    name: payload.name,
    description: payload.description ?? "",
    price: payload.price,
    category: payload.category,
    imageUrl: payload.imageUrl ?? "",
    available: payload.available ?? true,
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
