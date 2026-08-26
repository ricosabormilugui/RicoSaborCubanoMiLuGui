import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { ObjectId } from "mongodb";
import { signToken } from "../src/lib/auth.js";
import { parseFavoriteIds, MAX_FAVORITES, FAVORITES_LIMIT_MESSAGE } from "../src/config/favorites.config.js";
import { createFavoritesRouter } from "../src/routes/favorites.routes.js";
import { createUserFavoritesStore } from "../src/repositories/users.repository.js";

function favoritesOf(doc) {
  return Array.isArray(doc.favorites) ? doc.favorites : [];
}

function resolveExpr(doc, node) {
  if (typeof node === "number" || Array.isArray(node)) return node;
  if (typeof node === "string") return node.startsWith("$") ? doc[node.slice(1)] : node;
  if (!node || typeof node !== "object") return node;
  if ("$size" in node) {
    const value = resolveExpr(doc, node.$size);
    return Array.isArray(value) ? value.length : 0;
  }
  if ("$ifNull" in node) {
    const [inner, fallback] = node.$ifNull;
    const resolved = resolveExpr(doc, inner);
    return resolved == null ? resolveExpr(doc, fallback) : resolved;
  }
  if ("$lt" in node) return node;
  return node;
}

function evalExpr(doc, expr) {
  if (expr && typeof expr === "object" && "$lt" in expr) {
    const [left, right] = expr.$lt;
    return resolveExpr(doc, left) < resolveExpr(doc, right);
  }
  return false;
}

function matches(doc, query) {
  return Object.entries(query).every(([key, value]) => {
    if (key === "$or") return value.some((clause) => matches(doc, clause));
    if (key === "$expr") return evalExpr(doc, value);
    if (key === "_id") return String(doc._id) === String(value);
    const field = doc[key];
    if (Array.isArray(field)) return field.some((item) => String(item) === String(value));
    return String(field) === String(value);
  });
}

function applyUpdate(doc, update) {
  if (update.$set) Object.assign(doc, update.$set);
  if (update.$addToSet) {
    for (const [field, value] of Object.entries(update.$addToSet)) {
      if (!Array.isArray(doc[field])) doc[field] = [];
      if (!doc[field].includes(value)) doc[field].push(value);
    }
  }
  if (update.$pull) {
    for (const [field, value] of Object.entries(update.$pull)) {
      if (Array.isArray(doc[field])) doc[field] = doc[field].filter((item) => item !== value);
    }
  }
  if (update.$pullAll) {
    for (const [field, values] of Object.entries(update.$pullAll)) {
      const drop = new Set(values.map(String));
      if (Array.isArray(doc[field])) doc[field] = doc[field].filter((item) => !drop.has(String(item)));
    }
  }
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
      applyUpdate(doc, update);
      const projected = options.projection?.favorites ? { _id: doc._id, favorites: favoritesOf(doc) } : { ...doc };
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
    const call = (method, auth, { body, path = "" } = {}) => fetch(`${base}${path}`, {
      method,
      headers: {
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
        "Content-Type": "application/json"
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    await run({ call, collection, customer: (userId) => signToken({ sub: userId, role: "customer" }) });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("GET favoritos: autenticado obtiene los suyos y default []", async () => {
  const collection = memoryUsers();
  const userA = seedUser(collection);
  const userB = seedUser(collection, ["secret-B"]);
  await withApi(collection, async ({ call, customer }) => {
    assert.equal((await call("GET", null)).status, 401);
    assert.ok([401, 403].includes((await call("GET", "invalid")).status));
    const listed = await call("GET", customer(userA));
    assert.equal(listed.status, 200);
    assert.equal(listed.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(await listed.json(), { favorites: [] });
    assert.deepEqual(await (await call("GET", customer(userB))).json(), { favorites: ["secret-B"] });
    assert.deepEqual(await (await call("GET", customer(userA))).json(), { favorites: [] });
  });
});

test("PUT favoritos: persiste, deduplica, normaliza y no confía en userId del body", async () => {
  const collection = memoryUsers();
  const userA = seedUser(collection, ["keep"]);
  const userB = seedUser(collection, ["private-B"]);
  await withApi(collection, async ({ call, collection: users, customer }) => {
    assert.equal((await call("PUT", null, { body: { favorites: ["x"] } })).status, 401);
    const saved = await call("PUT", customer(userA), {
      body: { userId: userB, favorites: ["  p1  ", "p1", "p2", ""] }
    });
    assert.equal(saved.status, 200);
    assert.deepEqual(await saved.json(), { favorites: ["p1", "p2"] });
    assert.deepEqual(users.documents.find((doc) => String(doc._id) === userA).favorites, ["p1", "p2"]);
    assert.deepEqual(await (await call("GET", customer(userB))).json(), { favorites: ["private-B"] });
    assert.equal((await call("PUT", customer(userA), { body: { favorites: "p1" } })).status, 400);
    assert.equal((await call("PUT", customer(userA), { body: { favorites: [{ id: "p1" }] } })).status, 400);
    assert.equal((await call("PUT", customer(userA), { body: { favorites: ["x".repeat(200)] } })).status, 400);
    const tooMany = Array.from({ length: MAX_FAVORITES + 1 }, (_, index) => `id-${index}`);
    const limited = await call("PUT", customer(userA), { body: { favorites: tooMany } });
    assert.equal(limited.status, 400);
    assert.match((await limited.json()).message, /200/);
    assert.deepEqual(await (await call("GET", customer(userA))).json(), { favorites: ["p1", "p2"] });
  });
});

test("POST/DELETE atómicos: addToSet, pull y límite 200 sin truncar", async () => {
  const collection = memoryUsers();
  const userId = seedUser(collection, ["A", "B"]);
  await withApi(collection, async ({ call, customer }) => {
    const token = customer(userId);
    const added = await call("POST", token, { path: "/C" });
    assert.equal(added.status, 200);
    assert.deepEqual(await added.json(), { favorites: ["A", "B", "C"] });
    const duplicate = await call("POST", token, { path: "/C" });
    assert.equal(duplicate.status, 200);
    assert.deepEqual(await duplicate.json(), { favorites: ["A", "B", "C"] });
    const removed = await call("DELETE", token, { path: "/B" });
    assert.equal(removed.status, 200);
    assert.deepEqual(await removed.json(), { favorites: ["A", "C"] });
    const pruned = await call("DELETE", token, { body: { ids: ["A", "missing"] } });
    assert.equal(pruned.status, 200);
    assert.deepEqual(await pruned.json(), { favorites: ["C"] });
  });
});

test("límite MAX_FAVORITES: 199 add 200, rechazo del 201 y remove vuelve a 199", async () => {
  const initial = Array.from({ length: MAX_FAVORITES - 1 }, (_, index) => `id-${index}`);
  const collection = memoryUsers();
  const userId = seedUser(collection, initial);
  await withApi(collection, async ({ call, customer }) => {
    const token = customer(userId);
    const added = await call("POST", token, { path: "/id-199" });
    assert.equal(added.status, 200);
    assert.equal((await added.json()).favorites.length, MAX_FAVORITES);
    const rejected = await call("POST", token, { path: "/id-overflow" });
    assert.equal(rejected.status, 409);
    assert.equal((await rejected.json()).message, FAVORITES_LIMIT_MESSAGE);
    assert.equal((await (await call("GET", token)).json()).favorites.length, MAX_FAVORITES);
    const removed = await call("DELETE", token, { path: "/id-199" });
    assert.equal(removed.status, 200);
    assert.equal((await removed.json()).favorites.length, MAX_FAVORITES - 1);
  });
});

test("concurrencia add: dos dispositivos no se pisan", async () => {
  const collection = memoryUsers();
  const userId = seedUser(collection, ["A", "B"]);
  await withApi(collection, async ({ call, customer }) => {
    const token = customer(userId);
    const [first, second] = await Promise.all([
      call("POST", token, { path: "/C" }),
      call("POST", token, { path: "/D" })
    ]);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    const listed = await (await call("GET", token)).json();
    assert.deepEqual([...listed.favorites].sort(), ["A", "B", "C", "D"]);
  });
});

test("token admin queda explícitamente rechazado en rutas customer", async () => {
  const collection = memoryUsers();
  const userId = seedUser(collection, ["keep"]);
  await withApi(collection, async ({ call, customer }) => {
    const envAdmin = signToken({ sub: "admin:owner@example.test", role: "admin", email: "owner@example.test" });
    const promotedAdmin = signToken({ sub: userId, role: "admin" });
    for (const token of [envAdmin, promotedAdmin]) {
      assert.equal((await call("GET", token)).status, 403);
      assert.equal((await call("POST", token, { path: "/X" })).status, 403);
      assert.equal((await call("DELETE", token, { path: "/keep" })).status, 403);
      assert.equal((await call("PUT", token, { body: { favorites: ["X"] } })).status, 403);
    }
    assert.deepEqual(await (await call("GET", customer(userId))).json(), { favorites: ["keep"] });
  });
});

test("parseFavoriteIds rechaza payload inválido y no trunca en silencio", () => {
  assert.equal(parseFavoriteIds("x").error, "favorites debe ser una lista de identificadores.");
  assert.equal(parseFavoriteIds(Array.from({ length: MAX_FAVORITES + 1 }, (_, i) => String(i))).error, FAVORITES_LIMIT_MESSAGE);
  assert.deepEqual(parseFavoriteIds([" A ", "A", "B"]).ids, ["A", "B"]);
});
