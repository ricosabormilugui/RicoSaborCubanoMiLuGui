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

export async function findOrderById(orderId) {
  const db = await getDb();
  return db.collection(getOrdersCollectionName()).findOne({ orderId });
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
