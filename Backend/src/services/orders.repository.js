import { MongoClient } from "mongodb";

let mongoClient;

function getFirstEnv(names) {
  for (const name of names) {
    const value = process.env[name];
    if (value) {
      return value;
    }
  }

  throw new Error(`Missing environment variable: ${names.join(" or ")}`);
}

function validateMongoUri(uri) {
  if (uri.includes("<") || uri.includes(">")) {
    throw new Error("Mongo URI appears to be a template. Replace placeholders in MONGODB_URI/MONGO_URI.");
  }
}

async function getMongoClient() {
  if (mongoClient) {
    return mongoClient;
  }

  const mongoUri = getFirstEnv(["MONGODB_URI", "MONGO_URI"]);
  validateMongoUri(mongoUri);

  mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  return mongoClient;
}

async function getOrdersCollection() {
  const client = await getMongoClient();
  const dbName = getFirstEnv(["MONGODB_DB_NAME", "MONGO_DB_NAME"]);
  const collectionName = process.env.MONGODB_ORDERS_COLLECTION ?? process.env.ORDERS_COLLECTION ?? "orders";
  return client.db(dbName).collection(collectionName);
}

export async function saveOrder(order) {
  const collection = await getOrdersCollection();
  await collection.insertOne(order);
}

export async function listOrders(limit = 50) {
  const collection = await getOrdersCollection();
  return collection
    .find({}, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

export async function updateOrderStatus(orderId, status) {
  const collection = await getOrdersCollection();
  const result = await collection.updateOne(
    { orderId },
    { $set: { status, updatedAt: new Date().toISOString() } }
  );

  return result.matchedCount > 0;
}