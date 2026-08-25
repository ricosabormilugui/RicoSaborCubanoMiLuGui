import "dotenv/config";
import { closeMongoConnection, getCollection, getConfiguredDbName } from "../src/lib/mongo.js";
import { getProductsCollectionName } from "../src/repositories/products.repository.js";

async function diagnoseProductSlugs() {
  const collectionName = getProductsCollectionName();
  const collection = await getCollection(collectionName);
  const [total, withSlug] = await Promise.all([
    collection.countDocuments({}),
    collection.countDocuments({ slug: { $type: "string", $gt: "" } })
  ]);

  console.log(JSON.stringify({
    database: getConfiguredDbName(),
    collection: collectionName,
    total,
    withSlug,
    withoutSlug: total - withSlug
  }, null, 2));
}

try {
  await diagnoseProductSlugs();
} finally {
  await closeMongoConnection();
}
