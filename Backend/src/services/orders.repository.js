import { MongoClient } from "mongodb";

let mongoClient;

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

async function getMongoClient() {
  if (mongoClient) {
    return mongoClient;
  }

  mongoClient = new MongoClient(getRequiredEnv("MONGODB_URI"));
  await mongoClient.connect();
  return mongoClient;
}

export async function saveOrder(order) {
  const client = await getMongoClient();
  const dbName = getRequiredEnv("MONGODB_DB_NAME");
  const collectionName = process.env.MONGODB_ORDERS_COLLECTION ?? "orders";

  await client.db(dbName).collection(collectionName).insertOne(order);
}
