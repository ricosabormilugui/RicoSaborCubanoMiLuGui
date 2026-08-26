import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { ObjectId } from "mongodb";
import { signToken } from "../src/lib/auth.js";
import { parseFavoriteIds, MAX_FAVORITES } from "../src/config/favorites.config.js";
import { createFavoritesRouter } from "../src/routes/favorites.routes.js";
import { createUserFavoritesStore } from "../src/repositories/users.repository.js";

function matches(doc, query) {
  return Object.entries(query).every(([key, value]) => String(doc[key]) === String(value));
}

function memoryUsers() {
  const documents = [];
  return {
    documents,
    async findOne(query) {
      return documents.find((doc) => matches(doc, query)) ?? null;
    },
    async findOneAndUpdate(query, update, options = {}) {
      const doc = documents.find((item) => matches(item, query));
      if (!doc) return null;
      if (update.$set) Object.assign(doc, update.$set);
      const projected = options.projection?.favorites ? { _id: doc._id, favorites: doc.favorites } : { ...doc };
      return options.returnDocument === "after" ? projected : projected;
    }
  };
}

function seedUser(collection, favorites) {
  const user = { _id: new ObjectId(), email: `${collection.documents.length}@example.test` };
  if (arguments.length > 1) user.favorites = favorites;
  collection.documents.push(user);
  return String(user._id);
}

async function withApi(collection, run) {
  process.env.AUTH_TOKEN_SECRET = "favorites-tests-only-secret";
  const store = createUserFavoritesStore(async () => collection);
  const app = express();
  app.use(express.json({ limit: "16kb" }));
  app.use("/api/customer/favorites", createFavoritesRouter(store));
  app.use((error, _req, res, _next) => res.status(error.status ?? 500).json({ message: error.message }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/customer/favorites`;
    const call = (method, auth, body) => fetch(base, {
      method,
      headers: {
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
        "Content-Type": "application/json"
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    await run({ call, collection });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("GET favoritos: autenticado obtiene los suyos y default []", async () => {
  const collection = memoryUsers();
  const userA = seedUser(collection);
  const userB = seedUser(collection, ["secret-B"]);
  await withApi(collection, async ({ call }) => {
    const tokenA = signToken({ sub: userA, role: "customer" });
    const tokenB = signToken({ sub: userB, role: "customer" });
    assert.equal((await call("GET", null)).status, 401);
    assert.ok([401, 403].includes((await call("GET", "invalid")).status));
    const listed = await call("GET", tokenA);
    assert.equal(listed.status, 200);
    assert.equal(listed.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(await listed.json(), { favorites: [] });
    assert.deepEqual(await (await call("GET", tokenB)).json(), { favorites: ["secret-B"] });
    assert.deepEqual(await (await call("GET", tokenA)).json(), { favorites: [] });
  });
});

test("PUT favoritos: persiste, deduplica, normaliza y no confía en userId del body", async () => {
  const collection = memoryUsers();
  const userA = seedUser(collection, ["keep"]);
  const userB = seedUser(collection, ["private-B"]);
  await withApi(collection, async ({ call, collection: users }) => {
    const tokenA = signToken({ sub: userA, role: "customer" });
    const tokenB = signToken({ sub: userB, role: "customer" });
    assert.equal((await call("PUT", null, { favorites: ["x"] })).status, 401);
    const saved = await call("PUT", tokenA, {
      userId: userB,
      favorites: ["  p1  ", "p1", "p2", ""]
    });
    assert.equal(saved.status, 200);
    assert.deepEqual(await saved.json(), { favorites: ["p1", "p2"] });
    assert.deepEqual(users.documents.find((doc) => String(doc._id) === userA).favorites, ["p1", "p2"]);
    assert.deepEqual(await (await call("GET", tokenB)).json(), { favorites: ["private-B"] });
    assert.equal((await call("PUT", tokenA, { favorites: "p1" })).status, 400);
    assert.equal((await call("PUT", tokenA, { favorites: [{ id: "p1" }] })).status, 400);
    assert.equal((await call("PUT", tokenA, { favorites: ["x".repeat(200)] })).status, 400);
    const tooMany = Array.from({ length: MAX_FAVORITES + 1 }, (_, index) => `id-${index}`);
    const limited = await call("PUT", tokenA, { favorites: tooMany });
    assert.equal(limited.status, 400);
    assert.match((await limited.json()).message, /200/);
    assert.deepEqual(await (await call("GET", tokenA)).json(), { favorites: ["p1", "p2"] });
  });
});

test("parseFavoriteIds rechaza payload inválido y no trunca en silencio", () => {
  assert.equal(parseFavoriteIds("x").error, "favorites debe ser una lista de identificadores.");
  assert.ok(parseFavoriteIds(Array.from({ length: MAX_FAVORITES + 1 }, (_, i) => String(i))).error);
  assert.deepEqual(parseFavoriteIds([" A ", "A", "B"]).ids, ["A", "B"]);
});
