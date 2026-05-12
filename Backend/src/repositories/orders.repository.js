import { ensureIndexes, getCollection } from "../lib/mongo.js";

function getOrdersCollectionName() {
  return process.env.MONGODB_ORDERS_COLLECTION ?? process.env.ORDERS_COLLECTION ?? "orders";
}

let ensureOrderIndexesPromise;

async function getOrdersCollection() {
  const collectionName = getOrdersCollectionName();
  const collection = await getCollection(collectionName);

  if (!ensureOrderIndexesPromise) {
    ensureOrderIndexesPromise = ensureIndexes(collection, [
      { keys: { orderId: 1 }, options: { name: "orderId_unique", unique: true } },
      { keys: { createdAt: -1 }, options: { name: "orders_createdAt" } },
      { keys: { status: 1, createdAt: -1 }, options: { name: "orders_status_createdAt" } },
      { keys: { paymentStatus: 1, createdAt: -1 }, options: { name: "orders_paymentStatus_createdAt" } }
    ], { collectionName });
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

export async function findPreviousValidOrderForCustomer({ email, phone, customerId } = {}) {
  const collection = await getOrdersCollection();
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  const normalizedPhone = String(phone ?? "").replace(/\D/g, "").trim();
  const clauses = [];

  if (normalizedEmail) clauses.push({ customerEmailNormalized: normalizedEmail });
  if (normalizedEmail) clauses.push({ "customer.email": normalizedEmail });
  if (normalizedPhone) clauses.push({ "customer.phone": normalizedPhone });
  if (customerId) clauses.push({ customerId: String(customerId) });

  if (!clauses.length) return null;

  return collection.findOne({
    $or: clauses,
    status: { $nin: ["cancelado", "anulado"] }
  });
}

export async function findCouponRedemption({ code, email, phone, customerId } = {}) {
  const collection = await getOrdersCollection();
  const normalizedCode = String(code ?? "").trim().toUpperCase();
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  const normalizedPhone = String(phone ?? "").replace(/\D/g, "").trim();
  const clauses = [];

  if (!normalizedCode) return null;
  if (normalizedEmail) clauses.push({ customerEmailNormalized: normalizedEmail });
  if (normalizedEmail) clauses.push({ "customer.email": normalizedEmail });
  if (normalizedPhone) clauses.push({ "customer.phone": normalizedPhone });
  if (customerId) clauses.push({ customerId: String(customerId) });

  if (!clauses.length) return null;

  return collection.findOne({
    $and: [
      {
        $or: [
          { couponCode: normalizedCode },
          { "promotions.firstOrderDiscount.code": normalizedCode }
        ]
      },
      {
        $or: [
          { discountAmount: { $gt: 0 } },
          { "promotions.firstOrderDiscount.status": "used" }
        ]
      },
      { $or: clauses }
    ]
  });
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

export async function appendOrderNotifications(orderId, notifications = []) {
  if (!Array.isArray(notifications) || !notifications.length) {
    return;
  }

  const collection = await getOrdersCollection();
  await collection.updateOne(
    { orderId },
    {
      $push: {
        notifications: {
          $each: notifications
        }
      },
      $set: {
        updatedAt: new Date().toISOString()
      }
    }
  );
}


const ACTIVE_ORDER_STATUSES = ["nuevo", "confirmado", "preparando", "listo", "enviado"];
const VOID_ORDER_STATUSES = ["cancelado", "anulado"];

function getStartOfMonthIso(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString();
}

function getDaysAgoIso(days, date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - Math.max(0, Number(days) - 1));
  return start.toISOString();
}

function normalizeFacetArray(result, key) {
  return Array.isArray(result?.[key]) ? result[key] : [];
}

export async function getAdminDashboardMetrics({ days = 14 } = {}) {
  const collection = await getOrdersCollection();
  const now = new Date();
  const monthStart = getStartOfMonthIso(now);
  const chartStart = getDaysAgoIso(days, now);

  const [result = {}] = await collection
    .aggregate([
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                pendingOrders: { $sum: { $cond: [{ $in: ["$status", ACTIVE_ORDER_STATUSES] }, 1, 0] } },
                pendingPaymentOrders: {
                  $sum: {
                    $cond: [
                      { $eq: [{ $ifNull: ["$payment.status", "$paymentStatus"] }, "pending"] },
                      1,
                      0
                    ]
                  }
                },
                totalSales: {
                  $sum: {
                    $cond: [
                      { $not: [{ $in: ["$status", VOID_ORDER_STATUSES] }] },
                      { $ifNull: ["$total", 0] },
                      0
                    ]
                  }
                },
                monthSales: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $not: [{ $in: ["$status", VOID_ORDER_STATUSES] }] },
                          { $gte: ["$createdAt", monthStart] }
                        ]
                      },
                      { $ifNull: ["$total", 0] },
                      0
                    ]
                  }
                },
                validOrders: { $sum: { $cond: [{ $not: [{ $in: ["$status", VOID_ORDER_STATUSES] }] }, 1, 0] } }
              }
            },
            {
              $project: {
                _id: 0,
                totalOrders: 1,
                pendingOrders: 1,
                pendingPaymentOrders: 1,
                totalSales: { $round: ["$totalSales", 2] },
                monthSales: { $round: ["$monthSales", 2] },
                averageTicket: {
                  $round: [
                    { $cond: [{ $gt: ["$validOrders", 0] }, { $divide: ["$totalSales", "$validOrders"] }, 0] },
                    2
                  ]
                }
              }
            }
          ],
          ordersByStatus: [
            { $group: { _id: "$status", count: { $sum: 1 } } },
            { $project: { _id: 0, status: { $ifNull: ["$_id", "sin_estado"] }, count: 1 } },
            { $sort: { count: -1 } }
          ],
          paymentMethods: [
            { $match: { status: { $nin: VOID_ORDER_STATUSES } } },
            { $group: { _id: { $ifNull: ["$payment.method", "$paymentMethod"] }, count: { $sum: 1 }, sales: { $sum: { $ifNull: ["$total", 0] } } } },
            { $project: { _id: 0, method: { $ifNull: ["$_id", "sin_metodo"] }, count: 1, sales: { $round: ["$sales", 2] } } },
            { $sort: { count: -1 } }
          ],
          shippingZones: [
            { $match: { status: { $nin: VOID_ORDER_STATUSES } } },
            {
              $group: {
                _id: {
                  $cond: [
                    { $eq: ["$deliveryType", "pickup"] },
                    "Recogida",
                    { $ifNull: ["$shipping.zoneName", "Sin zona"] }
                  ]
                },
                count: { $sum: 1 },
                sales: { $sum: { $ifNull: ["$total", 0] } }
              }
            },
            { $project: { _id: 0, zone: "$_id", count: 1, sales: { $round: ["$sales", 2] } } },
            { $sort: { count: -1 } },
            { $limit: 8 }
          ],
          topProducts: [
            { $match: { status: { $nin: VOID_ORDER_STATUSES } } },
            { $unwind: "$items" },
            {
              $group: {
                _id: { $ifNull: ["$items.name", "$items.productId"] },
                quantity: { $sum: { $ifNull: ["$items.quantity", 0] } },
                sales: { $sum: { $multiply: [{ $ifNull: ["$items.unitPrice", 0] }, { $ifNull: ["$items.quantity", 0] }] } }
              }
            },
            { $match: { _id: { $ne: null } } },
            { $project: { _id: 0, name: "$_id", quantity: 1, sales: { $round: ["$sales", 2] } } },
            { $sort: { quantity: -1, sales: -1 } },
            { $limit: 6 }
          ],
          topCategories: [
            { $match: { status: { $nin: VOID_ORDER_STATUSES } } },
            { $unwind: "$items" },
            {
              $project: {
                category: { $ifNull: ["$items.categoryName", { $ifNull: ["$items.category", "$items.productCategory"] }] },
                quantity: { $ifNull: ["$items.quantity", 0] },
                lineSales: { $multiply: [{ $ifNull: ["$items.unitPrice", 0] }, { $ifNull: ["$items.quantity", 0] }] }
              }
            },
            { $match: { category: { $type: "string", $ne: "" } } },
            { $group: { _id: "$category", quantity: { $sum: "$quantity" }, sales: { $sum: "$lineSales" } } },
            { $project: { _id: 0, category: "$_id", quantity: 1, sales: { $round: ["$sales", 2] } } },
            { $sort: { quantity: -1, sales: -1 } },
            { $limit: 6 }
          ],
          salesByDay: [
            { $match: { status: { $nin: VOID_ORDER_STATUSES }, createdAt: { $gte: chartStart } } },
            { $project: { day: { $substr: ["$createdAt", 0, 10] }, total: { $ifNull: ["$total", 0] } } },
            { $group: { _id: "$day", sales: { $sum: "$total" }, orders: { $sum: 1 } } },
            { $project: { _id: 0, day: "$_id", sales: { $round: ["$sales", 2] }, orders: 1 } },
            { $sort: { day: 1 } }
          ]
        }
      }
    ])
    .toArray();

  return {
    summary: normalizeFacetArray(result, "summary")[0] ?? {
      totalOrders: 0,
      pendingOrders: 0,
      pendingPaymentOrders: 0,
      totalSales: 0,
      monthSales: 0,
      averageTicket: 0
    },
    ordersByStatus: normalizeFacetArray(result, "ordersByStatus"),
    paymentMethods: normalizeFacetArray(result, "paymentMethods"),
    shippingZones: normalizeFacetArray(result, "shippingZones"),
    topProducts: normalizeFacetArray(result, "topProducts"),
    topCategories: normalizeFacetArray(result, "topCategories"),
    salesByDay: normalizeFacetArray(result, "salesByDay")
  };
}
