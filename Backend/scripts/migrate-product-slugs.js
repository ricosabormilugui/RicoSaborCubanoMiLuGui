import "dotenv/config";
import { closeMongoConnection, getCollection } from "../src/lib/mongo.js";
import { getProductsCollectionName } from "../src/repositories/products.repository.js";
import { planProductSlugMigration } from "../src/utils/product-slug.js";

const dryRun = process.argv.includes("--dry-run");

async function migrateProductSlugs() {
  const collection = await getCollection(getProductsCollectionName());
  const products = await collection
    .find({}, { projection: { _id: 1, name: 1, slug: 1 } })
    .sort({ _id: 1 })
    .toArray();
  let changed = 0;
  const plan = await planProductSlugMigration(products);

  for (const { product, current, slug, changed: needsChange } of plan) {
    if (!needsChange) continue;
    changed += 1;
    if (!dryRun) await collection.updateOne({ _id: product._id }, { $set: { slug } });
    console.log(`${dryRun ? "[dry-run] " : ""}${product._id}: ${current || "<sin slug>"} -> ${slug}`);
  }

  if (!dryRun) {
    await collection.createIndex(
      { slug: 1 },
      { name: "product_slug_unique", unique: true, partialFilterExpression: { slug: { $type: "string", $gt: "" } } }
    );
  }
  console.log(`${dryRun ? "Simulación" : "Migración"} completada: ${changed} de ${products.length} productos requieren cambio.`);
}

try {
  await migrateProductSlugs();
} finally {
  await closeMongoConnection();
}
