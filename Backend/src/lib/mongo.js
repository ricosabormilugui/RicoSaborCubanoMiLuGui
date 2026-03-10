import { MongoClient } from "mongodb";
import { getRequiredEnv } from "./env.js";

let mongoClient;

export async function getMongoClient() {
  if (mongoClient) return mongoClient;

  mongoClient = new MongoClient(getRequiredEnv("MONGODB_URI"));
  await mongoClient.connect();
  return mongoClient;
}

export async function getDb() {
  const client = await getMongoClient();
  return client.db(getRequiredEnv("MONGODB_DB_NAME"));
}
