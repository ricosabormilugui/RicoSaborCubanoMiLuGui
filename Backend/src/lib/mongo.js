import { MongoClient } from "mongodb";
import { getRequiredEnv } from "./env.js";
import { logger } from "./logger.js";

let mongoClient;
let loggedDbConfig = false;
const loggedCollections = new Set();

function getOptionalEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return null;
}

function getMongoUri() {
  return getOptionalEnv("MONGODB_URI", "MONGO_URI") ?? getRequiredEnv("MONGODB_URI");
}

function readDbNameFromUri(uri) {
  try {
    const url = new URL(uri);
    const dbName = decodeURIComponent(url.pathname.replace(/^\//, "")).trim();
    return dbName || null;
  } catch {
    return null;
  }
}

export function getConfiguredDbName() {
  const uri = getMongoUri();
  const explicitDb = getOptionalEnv("MONGODB_DB_NAME", "MONGO_DB_NAME");
  return explicitDb ?? readDbNameFromUri(uri) ?? getRequiredEnv("MONGODB_DB_NAME");
}

function isIndexConflict(error) {
  return error?.code === 85 || error?.code === 86 || error?.codeName === "IndexOptionsConflict" || error?.codeName === "IndexKeySpecsConflict";
}

export async function getMongoClient() {
  if (mongoClient) return mongoClient;

  mongoClient = new MongoClient(getMongoUri());
  await mongoClient.connect();
  logger.info("mongo.connected", { database: getConfiguredDbName() });
  return mongoClient;
}

export async function getDb() {
  const client = await getMongoClient();
  const database = getConfiguredDbName();

  if (!loggedDbConfig) {
    logger.info("mongo.database.selected", { database });
    loggedDbConfig = true;
  }

  return client.db(database);
}

export async function getCollection(collectionName) {
  const db = await getDb();
  const database = getConfiguredDbName();

  if (!loggedCollections.has(collectionName)) {
    logger.info("mongo.collection.selected", { database, collection: collectionName });
    loggedCollections.add(collectionName);
  }

  return db.collection(collectionName);
}

export async function ensureIndexes(collection, indexes = [], { collectionName } = {}) {
  for (const index of indexes) {
    try {
      await collection.createIndex(index.keys, index.options);
    } catch (error) {
      const payload = {
        database: getConfiguredDbName(),
        collection: collectionName ?? collection.collectionName,
        index: index.options?.name,
        code: error?.code,
        codeName: error?.codeName,
        message: error?.message
      };

      if (isIndexConflict(error)) {
        logger.warn("mongo.index.skipped_conflict", payload);
        continue;
      }

      logger.error("mongo.index.failed", payload);
      throw error;
    }
  }
}
