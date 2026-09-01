import "dotenv/config";
import { closeMongoConnection, getCollection, getConfiguredDbName } from "../src/lib/mongo.js";
import { cleanupAdminFavorites } from "../src/services/admin-favorites-maintenance.service.js";

function getUsersCollectionName() {
  return process.env.MONGODB_USERS_COLLECTION ?? "users";
}

try {
  const collectionName = getUsersCollectionName();
  const collection = await getCollection(collectionName);
  const result = await cleanupAdminFavorites(collection);
  console.log(JSON.stringify({
    database: getConfiguredDbName(),
    collection: collectionName,
    strategy: "empty-admin-favorites-only",
    note: "Solo se vacía users.favorites[] donde role=admin. Los customers no se tocan.",
    ...result
  }, null, 2));
} finally {
  await closeMongoConnection();
}
