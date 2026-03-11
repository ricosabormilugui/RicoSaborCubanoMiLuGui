import { getDb } from "../lib/mongo.js";

function getOrdersCollectionName() {
  return process.env.MONGODB_ORDERS_COLLECTION ?? "orders";
}

export async function saveOrder(order) {
  const db = await getDb();
  await db.collection(getOrdersCollectionName()).insertOne(order);
}

export async function listOrders({ status, limit = 100 } = {}) {
  const db = await getDb();
  const query = status ? { status } : {};

  return db
    .collection(getOrdersCollectionName())
    .find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

export async function listOrdersForCustomer({ userId, email, limit = 100 } = {}) {
  const db = await getDb();
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  const clauses = [];

  if (userId) clauses.push({ userId });
  if (normalizedEmail) clauses.push({ customerEmailNormalized: normalizedEmail });

  if (!clauses.length) return [];

  return db
    .collection(getOrdersCollectionName())
    .find({ $or: clauses })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

export async function findOrderById(orderId) {
  const db = await getDb();
  return db.collection(getOrdersCollectionName()).findOne({ orderId });
}

export async function linkGuestOrdersByEmailToUser(email, userId) {
  const db = await getDb();
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  if (!normalizedEmail) return 0;

  const result = await db.collection(getOrdersCollectionName()).updateMany(
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
  const db = await getDb();
  const collection = db.collection(getOrdersCollectionName());
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
