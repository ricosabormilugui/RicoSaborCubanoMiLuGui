import { ObjectId } from "mongodb";
import { ensureIndexes, getCollection } from "../lib/mongo.js";

const FIRST_ORDER_DISCOUNT = {
  code: "PRIMER10",
  percent: 10,
  status: "available"
};

const FIRST_ORDER_COUPON = { ...FIRST_ORDER_DISCOUNT };

function getCustomersCollectionName() {
  return process.env.MONGODB_CUSTOMERS_COLLECTION ?? process.env.CUSTOMERS_COLLECTION ?? "customers";
}

let ensureCustomerIndexesPromise;

async function getCustomersCollection() {
  const collectionName = getCustomersCollectionName();
  const collection = await getCollection(collectionName);

  if (!ensureCustomerIndexesPromise) {
    ensureCustomerIndexesPromise = ensureIndexes(collection, [
      { keys: { email: 1 }, options: { name: "customers_email_unique", unique: true, sparse: true } },
      { keys: { phone: 1 }, options: { name: "customers_phone" } },
      { keys: { createdAt: -1 }, options: { name: "customers_createdAt" } },
      { keys: { marketingConsent: 1, createdAt: -1 }, options: { name: "customers_marketing_createdAt" } }
    ], { collectionName });
  }

  await ensureCustomerIndexesPromise;
  return collection;
}

export function normalizeCustomerEmail(email) {
  const normalized = String(email ?? "").trim().toLowerCase();
  return normalized || null;
}

export function normalizeCustomerPhone(phone) {
  const normalized = String(phone ?? "").replace(/\D/g, "").trim();
  return normalized || null;
}

function getCustomerLookup({ email, phone }) {
  if (email) return { email };
  if (phone) return { phone };
  return null;
}

function buildAddress(delivery = {}) {
  const address = String(delivery?.address ?? "").trim();
  const reference = String(delivery?.reference ?? "").trim();
  const postalCode = String(delivery?.postalCode ?? "").trim();

  if (!address && !reference && !postalCode) return null;

  return {
    address,
    postalCode,
    reference,
    updatedAt: new Date().toISOString()
  };
}

export async function findCustomerForCoupon({ email, phone, customerId } = {}) {
  const collection = await getCustomersCollection();
  const normalizedEmail = normalizeCustomerEmail(email);
  const normalizedPhone = normalizeCustomerPhone(phone);
  const clauses = [];

  if (customerId && ObjectId.isValid(String(customerId))) {
    clauses.push({ _id: new ObjectId(String(customerId)) });
  }
  if (normalizedEmail) clauses.push({ email: normalizedEmail });
  if (normalizedPhone) clauses.push({ phone: normalizedPhone });

  if (!clauses.length) return null;
  return collection.findOne({ $or: clauses });
}

export async function markFirstOrderCouponUsed(customerId, { orderId, code = "PRIMER10", percent = 10 } = {}) {
  if (!customerId || !ObjectId.isValid(String(customerId))) return null;

  const collection = await getCustomersCollection();
  const now = new Date().toISOString();

  return collection.findOneAndUpdate(
    { _id: new ObjectId(String(customerId)) },
    {
      $set: {
        firstOrderDiscount: {
          code,
          percent,
          status: "used",
          usedAt: now,
          orderId
        },
        firstOrderCoupon: {
          code,
          percent,
          status: "used",
          usedAt: now,
          orderId
        },
        updatedAt: now
      }
    },
    { returnDocument: "after" }
  );
}

export async function upsertCustomerFromOrder(order, { marketingConsent = false } = {}) {
  const collection = await getCustomersCollection();
  const now = new Date().toISOString();
  const email = normalizeCustomerEmail(order?.customer?.email ?? order?.customerEmailNormalized);
  const phone = normalizeCustomerPhone(order?.customer?.phone);
  const lookup = getCustomerLookup({ email, phone });

  if (!lookup) return null;

  const existing = await collection.findOne(lookup);
  const address = buildAddress(order?.delivery);
  const consentAccepted = Boolean(marketingConsent || existing?.marketingConsent);
  const set = {
    fullName: String(order?.customer?.fullName ?? existing?.fullName ?? "").trim(),
    phone: phone ?? existing?.phone ?? null,
    updatedAt: now,
    lastOrderAt: order?.createdAt ?? now
  };

  if (email) set.email = email;
  if (address) set.address = address;
  set.marketingConsent = consentAccepted;
  set.acceptsPromotions = consentAccepted;
  set.marketingConsentAt = consentAccepted ? (existing?.marketingConsentAt ?? now) : (existing?.marketingConsentAt ?? null);

  const result = await collection.findOneAndUpdate(
    lookup,
    {
      $set: set,
      $setOnInsert: {
        createdAt: now,
        source: "checkout",
        firstOrderDiscount: FIRST_ORDER_DISCOUNT,
        firstOrderCoupon: FIRST_ORDER_COUPON
      },
      $addToSet: {
        orderIds: order.orderId
      },
      $inc: {
        orderCount: 1,
        totalSpent: Number(order?.total ?? 0)
      }
    },
    { upsert: true, returnDocument: "after" }
  );

  return result;
}

export async function subscribeCustomerToNewsletter({ email, consent, source = "newsletter_form" }) {
  const collection = await getCustomersCollection();
  const normalizedEmail = normalizeCustomerEmail(email);
  if (!normalizedEmail) return null;

  const now = new Date().toISOString();
  const existing = await collection.findOne({ email: normalizedEmail });
  const alreadySubscribed = Boolean(existing?.newsletter?.subscribed);

  const result = await collection.findOneAndUpdate(
    { email: normalizedEmail },
    {
      $set: {
        email: normalizedEmail,
        marketingConsent: true,
        acceptsPromotions: true,
        marketingConsentAt: existing?.marketingConsentAt ?? now,
        newsletter: {
          subscribed: true,
          subscribedAt: existing?.newsletter?.subscribedAt ?? now,
          source
        },
        updatedAt: now
      },
      $setOnInsert: {
        createdAt: now,
        source,
        firstOrderDiscount: FIRST_ORDER_DISCOUNT,
        firstOrderCoupon: FIRST_ORDER_COUPON
      }
    },
    { upsert: true, returnDocument: "after" }
  );

  return {
    customer: result,
    duplicated: alreadySubscribed,
    discount: result?.firstOrderDiscount ?? FIRST_ORDER_DISCOUNT
  };
}

export async function upsertCustomerFromContact(contact) {
  const collection = await getCustomersCollection();
  const now = new Date().toISOString();
  const email = normalizeCustomerEmail(contact?.email);
  const phone = normalizeCustomerPhone(contact?.phone);
  const lookup = getCustomerLookup({ email, phone });

  if (!lookup) return null;

  return collection.findOneAndUpdate(
    lookup,
    {
      $set: {
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        fullName: String(contact?.name ?? "").trim(),
        lastContactAt: now,
        updatedAt: now
      },
      $setOnInsert: {
        createdAt: now,
        source: "contact_form",
        marketingConsent: false,
        acceptsPromotions: false,
        marketingConsentAt: null,
        firstOrderDiscount: FIRST_ORDER_DISCOUNT,
        firstOrderCoupon: FIRST_ORDER_COUPON
      },
      $addToSet: {
        contactIds: String(contact?._id ?? contact?.id ?? "")
      }
    },
    { upsert: true, returnDocument: "after" }
  );
}

function escapeRegex(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildCustomersQuery({ search, marketingConsent, hasOrders, couponStatus } = {}) {
  const query = {};

  if (typeof marketingConsent === "boolean") {
    query.marketingConsent = marketingConsent;
  }

  if (typeof hasOrders === "boolean") {
    query.orderCount = hasOrders ? { $gt: 0 } : { $in: [null, 0] };
  }

  if (couponStatus === "used") {
    query.$or = [{ "firstOrderDiscount.status": "used" }, { "firstOrderCoupon.status": "used" }];
  } else if (couponStatus === "not_used") {
    query.$and = [
      { $or: [{ "firstOrderDiscount.status": { $ne: "used" } }, { firstOrderDiscount: { $exists: false } }] },
      { $or: [{ "firstOrderCoupon.status": { $ne: "used" } }, { firstOrderCoupon: { $exists: false } }] }
    ];
  }

  const term = String(search ?? "").trim();
  if (term) {
    const digits = term.replace(/\D/g, "");
    const searchFields = [
      { fullName: { $regex: escapeRegex(term), $options: "i" } },
      { email: { $regex: escapeRegex(term), $options: "i" } }
    ];

    if (digits) {
      searchFields.push({ phone: { $regex: escapeRegex(digits), $options: "i" } });
    }

    const searchClause = { $or: searchFields };

    if (query.$and) {
      query.$and.push(searchClause);
    } else {
      query.$and = [searchClause];
    }
  }

  return query;
}

export async function listCustomers({ search, marketingConsent, hasOrders, couponStatus, limit = 100, page = 1 } = {}) {
  const collection = await getCustomersCollection();
  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 300));
  const safePage = Math.max(1, Number(page) || 1);
  const skip = (safePage - 1) * safeLimit;
  const query = buildCustomersQuery({ search, marketingConsent, hasOrders, couponStatus });

  const [customers, total, metrics] = await Promise.all([
    collection
      .find(query)
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .toArray(),
    collection.countDocuments(query),
    collection
      .aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalCustomers: { $sum: 1 },
            marketingCustomers: { $sum: { $cond: [{ $eq: ["$marketingConsent", true] }, 1, 0] } },
            customersWithOrders: { $sum: { $cond: [{ $gt: ["$orderCount", 0] }, 1, 0] } }
          }
        }
      ])
      .toArray()
  ]);

  return {
    customers,
    total,
    page: safePage,
    limit: safeLimit,
    metrics: metrics[0] ?? { totalCustomers: 0, marketingCustomers: 0, customersWithOrders: 0 }
  };
}


export async function getCustomerMetrics() {
  const collection = await getCustomersCollection();
  const [metrics = null] = await collection
    .aggregate([
      {
        $group: {
          _id: null,
          totalCustomers: { $sum: 1 },
          marketingCustomers: { $sum: { $cond: [{ $eq: ["$marketingConsent", true] }, 1, 0] } },
          customersWithOrders: { $sum: { $cond: [{ $gt: ["$orderCount", 0] }, 1, 0] } }
        }
      },
      { $project: { _id: 0, totalCustomers: 1, marketingCustomers: 1, customersWithOrders: 1 } }
    ])
    .toArray();

  return metrics ?? { totalCustomers: 0, marketingCustomers: 0, customersWithOrders: 0 };
}
