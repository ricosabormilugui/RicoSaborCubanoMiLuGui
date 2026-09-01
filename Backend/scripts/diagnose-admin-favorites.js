import "dotenv/config";
import { closeMongoConnection, getCollection, getConfiguredDbName } from "../src/lib/mongo.js";
import { diagnoseAdminFavorites } from "../src/services/admin-favorites-maintenance.service.js";

function getUsersCollectionName() {
  return process.env.MONGODB_USERS_COLLECTION ?? "users";
}

try {
  const collectionName = getUsersCollectionName();
  const collection = await getCollection(collectionName);
  const report = await diagnoseAdminFavorites(collection);
  console.log(JSON.stringify({
    database: getConfiguredDbName(),
    collection: collectionName,
    strategy: "diagnose-only",
    note: "No se modifican usuarios. Para vaciar favorites[] de role=admin usar npm run cleanup:admin-favorites.",
    ...report
  }, null, 2));
} finally {
  await closeMongoConnection();
}
