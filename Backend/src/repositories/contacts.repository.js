import { ObjectId } from "mongodb";
import { getDb } from "../lib/mongo.js";

function getContactsCollectionName() {
  return process.env.MONGODB_CONTACTS_COLLECTION ?? "contacts";
}

let ensureIndexesPromise;

async function getContactsCollection() {
  const db = await getDb();
  const collection = db.collection(getContactsCollectionName());

  if (!ensureIndexesPromise) {
    ensureIndexesPromise = Promise.all([
      collection.createIndex({ createdAt: -1 }, { name: "contacts_createdAt" }),
      collection.createIndex({ status: 1, createdAt: -1 }, { name: "contacts_status_createdAt" }),
      collection.createIndex({ phone: 1 }, { name: "contacts_phone" }),
      collection.createIndex({ email: 1 }, { name: "contacts_email" }),
      collection.createIndex({ requestId: 1 }, { name: "contacts_requestId_unique", unique: true, sparse: true })
    ]);
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
  const result = await collection.insertOne(contact);
  return { ...contact, _id: result.insertedId };
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
      query.$or = [
        { name: { $regex: term, $options: "i" } },
        { phone: { $regex: term, $options: "i" } },
        { email: { $regex: term, $options: "i" } },
        { message: { $regex: term, $options: "i" } }
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
