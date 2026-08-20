import { ObjectId } from "mongodb";
import { ensureIndexes, getCollection } from "../lib/mongo.js";

function getContactsCollectionName() {
  return process.env.MONGODB_CONTACTS_COLLECTION ?? process.env.CONTACTS_COLLECTION ?? "contacts";
}

let ensureIndexesPromise;

async function getContactsCollection() {
  const collectionName = getContactsCollectionName();
  const collection = await getCollection(collectionName);

  if (!ensureIndexesPromise) {
    ensureIndexesPromise = ensureIndexes(collection, [
      { keys: { createdAt: -1 }, options: { name: "contacts_createdAt" } },
      { keys: { status: 1, createdAt: -1 }, options: { name: "contacts_status_createdAt" } },
      { keys: { phone: 1 }, options: { name: "contacts_phone" } },
      { keys: { email: 1 }, options: { name: "contacts_email" } },
      { keys: { requestId: 1 }, options: { name: "contacts_requestId_unique", unique: true, sparse: true } }
    ], { collectionName });
  }

  await ensureIndexesPromise;
  return collection;
}

function toObjectId(id) {
  if (!ObjectId.isValid(id)) return null;
  return new ObjectId(id);
}

export async function createContact(contact) {
  const collection = await getContactsCollection();
  const normalized = {
    ...contact,
    email: String(contact.email ?? "").trim().toLowerCase()
  };
  const result = await collection.insertOne(normalized);
  return { ...normalized, _id: result.insertedId };
}

function escapeRegex(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listContacts({ status, search, limit = 100 } = {}) {
  const collection = await getContactsCollection();
  const query = {};

  if (status) {
    query.status = status;
  }

  if (search) {
    const term = String(search).trim();
    if (term) {
      const safeTerm = escapeRegex(term);
      query.$or = [
        { name: { $regex: safeTerm, $options: "i" } },
        { phone: { $regex: safeTerm, $options: "i" } },
        { email: { $regex: safeTerm, $options: "i" } },
        { message: { $regex: safeTerm, $options: "i" } }
      ];
    }
  }

  return collection
    .find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}


export async function findContactByRequestId(requestId) {
  const normalized = String(requestId ?? "").trim();
  if (!normalized) return null;

  const collection = await getContactsCollection();
  return collection.findOne({ requestId: normalized });
}


export async function findRecentDuplicateContact({ email, message, withinMs = 2 * 60_000 } = {}) {
  const normalizedEmail = String(email ?? '').trim().toLowerCase();
  const normalizedMessage = String(message ?? '').trim();
  if (!normalizedEmail || !normalizedMessage) return null;

  const cutoff = new Date(Date.now() - withinMs).toISOString();
  const collection = await getContactsCollection();
  return collection.findOne({
    email: normalizedEmail,
    message: normalizedMessage,
    createdAt: { $gte: cutoff }
  });
}

export async function updateContactLastNotifications(id, lastNotifications) {
  const objectId = toObjectId(id);
  if (!objectId) return null;

  const collection = await getContactsCollection();
  return collection.findOneAndUpdate(
    { _id: objectId },
    {
      $set: {
        lastNotifications,
        updatedAt: new Date().toISOString()
      }
    },
    { returnDocument: 'after' }
  );
}

export async function findContactById(id) {
  const objectId = toObjectId(id);
  if (!objectId) return null;

  const collection = await getContactsCollection();
  return collection.findOne({ _id: objectId });
}

export async function markContactAsRead(id) {
  const objectId = toObjectId(id);
  if (!objectId) return null;

  const collection = await getContactsCollection();
  return collection.findOneAndUpdate(
    { _id: objectId, status: "nuevo" },
    {
      $set: {
        status: "leido",
        updatedAt: new Date().toISOString()
      }
    },
    { returnDocument: "after" }
  );
}

export async function addContactReply(id, message) {
  const objectId = toObjectId(id);
  if (!objectId) return null;

  const collection = await getContactsCollection();
  return collection.findOneAndUpdate(
    { _id: objectId },
    {
      $set: {
        status: "respondido",
        updatedAt: new Date().toISOString()
      },
      $push: {
        messages: message
      }
    },
    { returnDocument: "after" }
  );
}

export async function appendContactNotifications(id, notifications = []) {
  const objectId = toObjectId(id);
  if (!objectId || !notifications.length) return null;

  const collection = await getContactsCollection();
  return collection.findOneAndUpdate(
    { _id: objectId },
    {
      $set: {
        updatedAt: new Date().toISOString()
      },
      $push: {
        notifications: {
          $each: notifications
        }
      }
    },
    { returnDocument: "after" }
  );
}
