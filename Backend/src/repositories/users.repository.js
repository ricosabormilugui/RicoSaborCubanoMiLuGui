import { ObjectId } from "mongodb";
import { ensureIndexes, getCollection } from "../lib/mongo.js";

function getUsersCollectionName() {
  return process.env.MONGODB_USERS_COLLECTION ?? "users";
}

let ensureUserIndexesPromise;

async function getUsersCollection() {
  const collectionName = getUsersCollectionName();
  const collection = await getCollection(collectionName);

  if (!ensureUserIndexesPromise) {
    ensureUserIndexesPromise = ensureIndexes(collection, [
      { keys: { passwordResetTokenHash: 1 }, options: { name: "users_password_reset_token", unique: true, sparse: true } }
    ], { collectionName });
  }

  await ensureUserIndexesPromise;
  return collection;
}

export function normalizeUserEmail(email) {
  const normalized = String(email ?? "").trim().toLowerCase();
  return normalized || null;
}

export async function findUserByEmail(email) {
  const normalizedEmail = normalizeUserEmail(email);
  if (!normalizedEmail) return null;
  const collection = await getUsersCollection();
  return collection.findOne({ email: normalizedEmail });
}

export async function createUser({ fullName, email, passwordHash, role = "customer" }) {
  const collection = await getUsersCollection();
  const user = {
    fullName: String(fullName ?? "").trim(),
    email: normalizeUserEmail(email),
    passwordHash,
    role,
    createdAt: new Date().toISOString()
  };

  const result = await collection.insertOne(user);
  return { ...user, _id: result.insertedId };
}

export async function findUserById(id) {
  const collection = await getUsersCollection();
  return collection.findOne({ _id: new ObjectId(id) });
}

export async function promoteUserToAdmin(email) {
  const normalizedEmail = normalizeUserEmail(email);
  if (!normalizedEmail) return null;

  const collection = await getUsersCollection();
  const result = await collection.findOneAndUpdate(
    { email: normalizedEmail },
    {
      $set: {
        role: "admin",
        updatedAt: new Date().toISOString()
      }
    },
    { returnDocument: "after" }
  );

  return result;
}

export async function storePasswordResetToken(userId, { tokenHash, expiresAt, requestedAt }) {
  const collection = await getUsersCollection();
  return collection.findOneAndUpdate(
    { _id: new ObjectId(String(userId)), role: "customer" },
    {
      $set: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: expiresAt,
        passwordResetRequestedAt: requestedAt,
        updatedAt: requestedAt.toISOString()
      }
    },
    { returnDocument: "after" }
  );
}

export async function clearPasswordResetToken(userId, tokenHash) {
  const collection = await getUsersCollection();
  return collection.updateOne(
    { _id: new ObjectId(String(userId)), passwordResetTokenHash: tokenHash },
    {
      $unset: {
        passwordResetTokenHash: "",
        passwordResetExpiresAt: "",
        passwordResetRequestedAt: ""
      }
    }
  );
}

export async function resetPasswordWithTokenHash(tokenHash, passwordHash, now = new Date()) {
  const collection = await getUsersCollection();
  return collection.findOneAndUpdate(
    {
      role: "customer",
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: now }
    },
    {
      $set: {
        passwordHash,
        passwordChangedAt: now,
        updatedAt: now.toISOString()
      },
      $unset: {
        passwordResetTokenHash: "",
        passwordResetExpiresAt: "",
        passwordResetRequestedAt: ""
      }
    },
    { returnDocument: "after" }
  );
}
