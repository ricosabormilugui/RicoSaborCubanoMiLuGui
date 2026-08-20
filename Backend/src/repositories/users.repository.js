import { ObjectId } from "mongodb";
import { getDb } from "../lib/mongo.js";

function getUsersCollectionName() {
  return process.env.MONGODB_USERS_COLLECTION ?? "users";
}

export async function findUserByEmail(email) {
  const db = await getDb();
  return db.collection(getUsersCollectionName()).findOne({ email: email.toLowerCase() });
}

export async function createUser({ fullName, email, passwordHash, role = "customer" }) {
  const db = await getDb();
  const user = {
    fullName,
    email: email.toLowerCase(),
    passwordHash,
    role,
    createdAt: new Date().toISOString()
  };

  const result = await db.collection(getUsersCollectionName()).insertOne(user);
  return { ...user, _id: result.insertedId };
}

export async function findUserById(id) {
  const db = await getDb();
  return db.collection(getUsersCollectionName()).findOne({ _id: new ObjectId(id) });
}

export async function promoteUserToAdmin(email) {
  const db = await getDb();
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  if (!normalizedEmail) return null;

  const collection = db.collection(getUsersCollectionName());
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
