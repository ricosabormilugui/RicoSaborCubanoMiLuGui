import { ObjectId } from "mongodb";
import { PRODUCT_CATEGORIES, getProductCategoryLabel, normalizeCategorySlug } from "../config/product-categories.config.js";
import { ensureIndexes, getCollection } from "../lib/mongo.js";
import { getProductsCollectionName } from "./products.repository.js";

function getCategoriesCollectionName() {
  return process.env.MONGODB_CATEGORIES_COLLECTION ?? "product_categories";
}

let initializationPromise;
let ensureCategoryIndexesPromise;

async function getCategoriesCollection() {
  const collectionName = getCategoriesCollectionName();
  const collection = await getCollection(collectionName);

  if (!ensureCategoryIndexesPromise) {
    ensureCategoryIndexesPromise = ensureIndexes(collection, [
      { keys: { slug: 1 }, options: { name: "category_slug_unique", unique: true } },
      { keys: { normalizedName: 1 }, options: { name: "category_name_unique", unique: true } },
      { keys: { order: 1, label: 1 }, options: { name: "category_order_label" } }
    ], { collectionName });
  }
  await ensureCategoryIndexesPromise;

  return collection;
}

async function initializeCategories() {
  const categories = await getCategoriesCollection();
  const products = await getCollection(getProductsCollectionName());
  const metadata = await getCollection(`${getCategoriesCollectionName()}_meta`);
  const now = new Date().toISOString();
  const productCategoryValues = await products.distinct("category");
  const initialized = await metadata.findOne({ _id: "bootstrap" });
  const seeds = new Map(initialized
    ? []
    : PRODUCT_CATEGORIES.map((category, index) => [category.slug, { ...category, order: index }]));

  for (const value of productCategoryValues) {
    const slug = normalizeCategorySlug(value);
    if (!slug || seeds.has(slug)) continue;
    seeds.set(slug, { slug, label: getProductCategoryLabel(value), order: seeds.size });
  }

  if (seeds.size) {
    await categories.bulkWrite(Array.from(seeds.values()).map((category) => ({
      updateOne: {
        filter: { slug: category.slug },
        update: {
          $setOnInsert: {
            slug: category.slug,
            label: category.label,
            normalizedName: normalizeCategorySlug(category.label),
            order: category.order,
            createdAt: now,
            updatedAt: now
          }
        },
        upsert: true
      }
    })), { ordered: false });
  }

  if (!initialized) {
    await metadata.updateOne(
      { _id: "bootstrap" },
      { $setOnInsert: { initializedAt: now } },
      { upsert: true }
    );
  }
}

async function ensureCategoriesInitialized() {
  if (!initializationPromise) {
    initializationPromise = initializeCategories().catch((error) => {
      initializationPromise = undefined;
      throw error;
    });
  }
  return initializationPromise;
}

function toCategoryRecord(document, productCount) {
  return {
    _id: String(document._id),
    slug: document.slug,
    label: document.label,
    order: Number(document.order ?? 0),
    ...(productCount !== undefined ? { productCount } : {})
  };
}

async function getProductCountsBySlug({ publicOnly = false } = {}) {
  const products = await getCollection(getProductsCollectionName());
  const counts = await products.aggregate([
    { $match: {
      category: { $type: "string", $ne: "" },
      ...(publicOnly ? { published: true, available: true } : {})
    } },
    { $group: { _id: "$category", count: { $sum: 1 } } }
  ]).toArray();

  const bySlug = new Map();
  for (const item of counts) {
    const slug = normalizeCategorySlug(item._id);
    if (!slug) continue;
    bySlug.set(slug, (bySlug.get(slug) ?? 0) + Number(item.count ?? 0));
  }
  return bySlug;
}

export async function listCategories({ includeProductCount = false, publicOnly = false } = {}) {
  await ensureCategoriesInitialized();
  const collection = await getCategoriesCollection();
  const documents = await collection.find({}).sort({ order: 1, label: 1 }).toArray();
  const counts = includeProductCount ? await getProductCountsBySlug({ publicOnly }) : null;
  return documents.map((document) => toCategoryRecord(document, counts?.get(document.slug) ?? (counts ? 0 : undefined)));
}

export async function findCategoryById(id) {
  await ensureCategoriesInitialized();
  if (!ObjectId.isValid(id)) return null;
  const collection = await getCategoriesCollection();
  return collection.findOne({ _id: new ObjectId(id) });
}

export async function findCategoryBySlug(slug) {
  await ensureCategoriesInitialized();
  const collection = await getCategoriesCollection();
  return collection.findOne({ slug: normalizeCategorySlug(slug) });
}

export async function findCategoryByNormalizedName(name) {
  await ensureCategoriesInitialized();
  const collection = await getCategoriesCollection();
  return collection.findOne({ normalizedName: normalizeCategorySlug(name) });
}

export async function categoryExists(slug) {
  return Boolean(await findCategoryBySlug(slug));
}

export async function createCategory({ label, slug }) {
  await ensureCategoriesInitialized();
  const collection = await getCategoriesCollection();
  const now = new Date().toISOString();
  const last = await collection.find({}).sort({ order: -1 }).limit(1).next();
  const category = {
    label,
    slug,
    normalizedName: normalizeCategorySlug(label),
    order: Number(last?.order ?? -1) + 1,
    createdAt: now,
    updatedAt: now
  };
  const result = await collection.insertOne(category);
  return toCategoryRecord({ ...category, _id: result.insertedId }, 0);
}

export async function updateCategoryLabel(id, label) {
  await ensureCategoriesInitialized();
  if (!ObjectId.isValid(id)) return null;
  const collection = await getCategoriesCollection();
  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { label, normalizedName: normalizeCategorySlug(label), updatedAt: new Date().toISOString() } },
    { returnDocument: "after" }
  );
  return result ? toCategoryRecord(result) : null;
}

export async function countProductsForCategory(slug) {
  const products = await getCollection(getProductsCollectionName());
  const rawValues = (await products.distinct("category"))
    .filter((value) => normalizeCategorySlug(value) === normalizeCategorySlug(slug));
  if (!rawValues.length) return 0;
  return products.countDocuments({ category: { $in: rawValues } });
}

export async function deleteCategoryById(id) {
  if (!ObjectId.isValid(id)) return false;
  const collection = await getCategoriesCollection();
  const result = await collection.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount > 0;
}
