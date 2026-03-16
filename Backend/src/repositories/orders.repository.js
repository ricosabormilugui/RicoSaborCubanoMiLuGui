import { getDb } from "../lib/mongo.js";

function getOrdersCollectionName() {
  return process.env.MONGODB_ORDERS_COLLECTION ?? "orders";
}

let ensureOrderIndexesPromise;

async function getOrdersCollection() {
  const db = await getDb();
  const collection = db.collection(getOrdersCollectionName());

  if (!ensureOrderIndexesPromise) {
    ensureOrderIndexesPromise = collection.createIndex(
      { orderId: 1 },
      { name: "orderId_unique", unique: true }
    );
  }

  await ensureOrderIndexesPromise;
  return collection;
}

export async function saveOrder(order) {
  const collection = await getOrdersCollection();
  await collection.insertOne(order);
}

export async function listOrders({ status, limit = 100 } = {}) {
  const collection = await getOrdersCollection();
  const query = status ? { status } : {};

  return collection
    .find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

export async function listOrdersForCustomer({ userId, email, limit = 100 } = {}) {
  const collection = await getOrdersCollection();
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  const clauses = [];

  if (userId) clauses.push({ userId });
  if (normalizedEmail) clauses.push({ customerEmailNormalized: normalizedEmail });

  if (!clauses.length) return [];

  return collection
    .find({ $or: clauses })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

export async function findOrderById(orderId) {
  const collection = await getOrdersCollection();
  return collection.findOne({ orderId });
}

export async function linkGuestOrdersByEmailToUser(email, userId) {
  const collection = await getOrdersCollection();
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  if (!normalizedEmail) return 0;

  const result = await collection.updateMany(
    {
      customerEmailNormalized: normalizedEmail,
      accountMode: "guest",
      $or: [{ userId: { $exists: false } }, { userId: null }, { userId: "" }]
    },
    {
      $set: {
        accountMode: "registered",
        userId,
        updatedAt: new Date().toISOString(),
        linkedByEmailAt: new Date().toISOString()
      }
    }
  );

  return result.modifiedCount;
}

export async function updateOrderStatus(orderId, nextStatus, metadata = {}) {
  const collection = await getOrdersCollection();
  const now = new Date().toISOString();
  const result = await collection.findOneAndUpdate(
    { orderId },
    {
      $set: {
        status: nextStatus,
        ...metadata,
        updatedAt: now
      },
      $push: {
        statusHistory: {
          status: nextStatus,
          at: now,
          note: metadata?.statusNote ?? null,
          signature: metadata?.deliverySignature ?? null
        }
      }
    },
    { returnDocument: "after" }
  );

  return result;
}
