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

async function getOrdersCollection() {
  const client = await getMongoClient();
  const dbName = getRequiredEnv("MONGODB_DB_NAME");
  const collectionName = process.env.MONGODB_ORDERS_COLLECTION ?? "orders";
  return client.db(dbName).collection(collectionName);
}

export async function saveOrder(order) {
  const collection = await getOrdersCollection();
  await collection.insertOne(order);
}

export async function listOrders(limit = 50) {
  const collection = await getOrdersCollection();
  return collection.find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(limit).toArray();
}

export async function updateOrderStatus(orderId, status) {
  const collection = await getOrdersCollection();
  const result = await collection.updateOne(
    { orderId },
    { $set: { status, updatedAt: new Date().toISOString() } }
  );

  return result.matchedCount > 0;
}
