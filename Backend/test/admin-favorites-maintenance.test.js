import test from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import {
  cleanupAdminFavorites,
  describeAdminFavoriteAccounts,
  diagnoseAdminFavorites,
  summarizeAdminFavorites
} from "../src/services/admin-favorites-maintenance.service.js";

function memoryUsers(documents) {
  return {
    documents,
    find(query) {
      const matched = documents.filter((doc) => doc.role === query.role);
      return {
        project() {
          return {
            async toArray() {
              return matched.map((doc) => ({ _id: doc._id, email: doc.email, role: doc.role, favorites: doc.favorites }));
            }
          };
        }
      };
    },
    async updateMany(query, update) {
      const matched = documents.filter((doc) => doc.role === query.role);
      for (const doc of matched) {
        if (update.$set) Object.assign(doc, update.$set);
      }
      return { matchedCount: matched.length, modifiedCount: matched.length };
    }
  };
}

test("K-L: cleanup solo vacía role=admin y no toca customers", async () => {
  const adminA = { _id: new ObjectId(), email: "ventas@milugui.com", role: "admin", favorites: ["p1", "p2"] };
  const adminB = { _id: new ObjectId(), email: "owner@example.test", role: "admin", favorites: [] };
  const customer = { _id: new ObjectId(), email: "cliente@example.test", role: "customer", favorites: ["keep-me"] };
  const collection = memoryUsers([adminA, adminB, customer]);

  const diagnosis = await diagnoseAdminFavorites(collection);
  assert.equal(diagnosis.admins, 2);
  assert.equal(diagnosis.adminsWithFavorites, 1);
  assert.equal(diagnosis.totalFavoriteIds, 2);
  assert.equal(diagnosis.accounts.find((account) => account.email === "ventas@milugui.com").favoritesCount, 2);

  const result = await cleanupAdminFavorites(collection);
  assert.equal(result.matchedAdmins, 2);
  assert.equal(result.modifiedAdmins, 2);
  assert.deepEqual(adminA.favorites, []);
  assert.deepEqual(adminB.favorites, []);
  assert.deepEqual(customer.favorites, ["keep-me"]);
  assert.equal(customer.role, "customer");

  const described = describeAdminFavoriteAccounts([adminA, adminB]);
  assert.equal(summarizeAdminFavorites(described).adminsWithFavorites, 0);
});
