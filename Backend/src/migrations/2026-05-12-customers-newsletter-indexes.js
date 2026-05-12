import "dotenv/config";
import { getDb, getMongoClient } from "../lib/mongo.js";

async function run() {
  const db = await getDb();
  const collectionName = process.env.MONGODB_CUSTOMERS_COLLECTION ?? "customers";
  const customers = db.collection(collectionName);

  await Promise.all([
    customers.createIndex(
      { email: 1 },
      {
        name: "customers_email_unique",
        unique: true,
        sparse: true
      }
    ),
    customers.createIndex({ phone: 1 }, { name: "customers_phone" }),
    customers.createIndex({ createdAt: -1 }, { name: "customers_createdAt" }),
    customers.createIndex({ marketingConsent: 1, createdAt: -1 }, { name: "customers_marketing_createdAt" })
  ]);

  console.log(`Customers/newsletter indexes ensured on ${collectionName}`);
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const client = await getMongoClient().catch(() => null);
    await client?.close();
  });
