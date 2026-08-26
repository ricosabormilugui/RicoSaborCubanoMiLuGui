import { ObjectId } from "mongodb";
import { ensureIndexes, getCollection } from "../lib/mongo.js";

export const NOTIFICATION_TYPES = ["order", "account", "system", "promotion", "warning", "info"];
export const notificationIndexes = [
  { keys: { userId: 1, createdAt: -1, _id: -1 }, options: { name: "notifications_user_date" } },
  { keys: { userId: 1, read: 1, createdAt: -1, _id: -1 }, options: { name: "notifications_user_read" } },
  { keys: { userId: 1, type: 1, createdAt: -1, _id: -1 }, options: { name: "notifications_user_type" } },
  { keys: { userId: 1, eventKey: 1 }, options: { name: "notifications_event_unique", unique: true } }
];
let ready;
export async function prepareNotifications() {
  const collection = await getCollection("notifications");
  ready ??= (async () => {
    await ensureIndexes(collection, notificationIndexes);
    const indexes = await collection.indexes();
    const unique = indexes.find(index => index.name === "notifications_event_unique");
    if (!unique?.unique || unique.key?.userId !== 1 || unique.key?.eventKey !== 1) throw new Error("Required notification event index is not active");
  })().catch(error => { ready = undefined; throw error; });
  await ready;
  return collection;
}

function publicNotification(doc) {
  if (!doc) return null;
  const { _id, type, title, message, read, createdAt, readAt, action, entity } = doc;
  return { id: String(_id), type, title, message, read, createdAt, readAt, action, entity };
}
function invalidQuery() { return Object.assign(new Error("Filtros o paginación no válidos."), { status: 400, expose: true }); }
export function parseNotificationQuery(query = {}) {
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw invalidQuery();
  if (query.read !== undefined && !["true", "false"].includes(query.read)) throw invalidQuery();
  if (query.type !== undefined && !NOTIFICATION_TYPES.includes(query.type)) throw invalidQuery();
  let cursor;
  if (query.cursor !== undefined) {
    try {
      if (typeof query.cursor !== "string" || query.cursor.length > 256) throw invalidQuery();
      cursor = JSON.parse(Buffer.from(query.cursor, "base64url").toString());
      if (!/^[a-f0-9]{24}$/i.test(cursor.id) || new Date(cursor.at).toISOString() !== cursor.at) throw invalidQuery();
    } catch { throw invalidQuery(); }
  }
  return { limit, read: query.read === undefined ? undefined : query.read === "true", type: query.type, cursor };
}

// All operations require an owner, including lookup by an otherwise valid ObjectId.
export function createNotificationsRepository(collectionProvider = prepareNotifications) {
  function owner(userId) {
    if (typeof userId !== "string" || !userId.trim()) throw Object.assign(new Error("Sesión requerida."), { status: 401 });
    return { userId };
  }
  function ownedId(userId, id) {
    const scope = owner(userId);
    return typeof id === "string" && /^[a-f0-9]{24}$/i.test(id) ? { ...scope, _id: new ObjectId(id) } : null;
  }
  return {
    async list(userId, { limit = 20, read, type, cursor } = {}) {
      const filter = { ...owner(userId), ...(read === undefined ? {} : { read }), ...(type ? { type } : {}) };
      if (cursor) filter.$or = [{ createdAt: { $lt: cursor.at } }, { createdAt: cursor.at, _id: { $lt: new ObjectId(cursor.id) } }];
      const collection = await collectionProvider();
      const docs = await collection.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).toArray();
      const hasMore = docs.length > limit;
      const items = docs.slice(0, limit);
      const last = items.at(-1);
      return { notifications: items.map(publicNotification), nextCursor: hasMore ? Buffer.from(JSON.stringify({ at: last.createdAt, id: String(last._id) })).toString("base64url") : null };
    },
    async count(userId) {
      const filter = { ...owner(userId), read: false };
      return (await collectionProvider()).countDocuments(filter);
    },
    async read(userId, id) {
      const filter = ownedId(userId, id);
      if (!filter) return null;
      const collection = await collectionProvider();
      await collection.updateOne({ ...filter, read: false }, { $set: { read: true, readAt: new Date().toISOString() } });
      return publicNotification(await collection.findOne(filter));
    },
    async readAll(userId) {
      const filter = { ...owner(userId), read: false };
      return (await (await collectionProvider()).updateMany(filter, { $set: { read: true, readAt: new Date().toISOString() } })).modifiedCount;
    },
    async remove(userId, id) {
      const filter = ownedId(userId, id);
      return filter ? (await (await collectionProvider()).deleteOne(filter)).deletedCount > 0 : false;
    },
    async create(data, { session } = {}) {
      const scope = owner(data.userId);
      if (!NOTIFICATION_TYPES.includes(data.type) || !data.eventKey || !data.title || !data.message) throw new Error("Invalid server notification");
      const collection = await collectionProvider();
      const document = { ...scope, eventKey: data.eventKey, type: data.type, title: data.title.slice(0, 120), message: data.message.slice(0, 500), read: false, readAt: null, createdAt: data.createdAt ?? new Date().toISOString(), action: data.action ?? null, entity: data.entity ?? null };
      await collection.updateOne({ ...scope, eventKey: data.eventKey }, { $setOnInsert: document }, { upsert: true, session });
    }
  };
}
export const notificationsRepository = createNotificationsRepository();
