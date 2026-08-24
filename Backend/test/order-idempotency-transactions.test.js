import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOrderRequestFingerprint,
  executeIdempotentOrderCreation,
  IdempotencyConflictError,
  validateIdempotencyKey
} from "../src/services/order-idempotency.service.js";
import {
  applyOrderStockAdjustments,
  groupOrderStockRequirements,
  OrderStockError
} from "../src/repositories/products.repository.js";
import { commitOrderUnitOfWork } from "../src/services/order-unit-of-work.service.js";
import { notifyPersistedOrder } from "../src/controllers/orders.controller.js";

const PRODUCT_A = "64b000000000000000000001";
const PRODUCT_B = "64b000000000000000000002";

function createIdempotencyHarness() {
  const orders = new Map();
  let inserts = 0;
  const findExisting = async (key) => orders.get(key) ?? null;
  const runInTransaction = async (operation) => operation({ id: "session" });
  const execute = (key, fingerprint) => executeIdempotentOrderCreation({
    idempotencyKey: key,
    requestFingerprint: fingerprint,
    findExisting,
    runInTransaction,
    createWithinTransaction: async () => {
      await Promise.resolve();
      if (orders.has(key)) throw Object.assign(new Error("duplicate key"), { code: 11000 });
      inserts += 1;
      const order = { orderId: `MLG-${inserts}`, idempotencyKey: key, requestFingerprint: fingerprint };
      orders.set(key, order);
      return order;
    }
  });
  return { execute, orders, get inserts() { return inserts; } };
}

test("idempotencia caso 1: una clave nueva crea exactamente un pedido", async () => {
  const harness = createIdempotencyHarness();
  const result = await harness.execute("order_12345678", "fingerprint-a");
  assert.equal(result.replay, false);
  assert.equal(result.order.orderId, "MLG-1");
  assert.equal(harness.inserts, 1);
});

test("idempotencia caso 2: misma clave y payload devuelve el mismo pedido", async () => {
  const harness = createIdempotencyHarness();
  const first = await harness.execute("order_12345678", "fingerprint-a");
  const replay = await harness.execute("order_12345678", "fingerprint-a");
  assert.equal(replay.replay, true);
  assert.equal(replay.order.orderId, first.order.orderId);
  assert.equal(harness.inserts, 1);
});

test("idempotencia caso 3: misma clave con payload diferente produce conflicto", async () => {
  const harness = createIdempotencyHarness();
  await harness.execute("order_12345678", "fingerprint-a");
  await assert.rejects(
    harness.execute("order_12345678", "fingerprint-b"),
    (error) => error instanceof IdempotencyConflictError && error.status === 409
  );
  assert.equal(harness.inserts, 1);
});

test("idempotencia caso 4: dos requests simultáneos crean un solo pedido", async () => {
  const harness = createIdempotencyHarness();
  const results = await Promise.all([
    harness.execute("order_concurrente", "fingerprint-a"),
    harness.execute("order_concurrente", "fingerprint-a")
  ]);
  assert.equal(harness.inserts, 1);
  assert.equal(new Set(results.map((result) => result.order.orderId)).size, 1);
  assert.equal(results.filter((result) => result.replay).length, 1);
});

test("idempotencia caso 5: retry tras timeout recupera el pedido persistido", async () => {
  const harness = createIdempotencyHarness();
  await harness.execute("order_timeout_retry", "fingerprint-a");
  const retry = await harness.execute("order_timeout_retry", "fingerprint-a");
  assert.equal(retry.replay, true);
  assert.equal(retry.order.orderId, "MLG-1");
  assert.equal(harness.inserts, 1);
});

test("la clave tiene formato acotado y el fingerprint ignora precios cliente", () => {
  assert.equal(validateIdempotencyKey("order_01HABCDEFG"), "order_01HABCDEFG");
  assert.throws(() => validateIdempotencyKey(""), /entre 8 y 128/);
  assert.throws(() => validateIdempotencyKey(`order_${"x".repeat(200)}`), /entre 8 y 128/);
  assert.throws(() => validateIdempotencyKey("order con espacios"), /entre 8 y 128/);

  const payload = {
    customer: { fullName: "Cliente", phone: "+34 600 000 000", email: "QA@EXAMPLE.TEST" },
    items: [{ productId: PRODUCT_A, quantity: 1, unitPrice: 99, basePrice: 99 }],
    delivery: { type: "pickup", date: "2026-09-01", slot: "10:00-12:00" },
    payment: { method: "cash" }
  };
  const first = buildOrderRequestFingerprint(payload, null);
  const changedPrice = buildOrderRequestFingerprint({
    ...payload,
    items: [{ ...payload.items[0], unitPrice: 1, basePrice: 1 }]
  }, null);
  const changedQuantity = buildOrderRequestFingerprint({
    ...payload,
    items: [{ ...payload.items[0], quantity: 2 }]
  }, null);
  assert.equal(first, changedPrice);
  assert.notEqual(first, changedQuantity);
});

class FakeStockCollection {
  constructor(documents) {
    this.documents = new Map(documents.map((document) => [String(document._id), { ...document }]));
    this.updates = [];
  }

  async findOneAndUpdate(filter, _pipeline, options) {
    const id = String(filter._id);
    const document = this.documents.get(id);
    if (!document || document.trackStock !== true || document.stock < filter.stock.$gte) return null;
    document.stock -= filter.stock.$gte;
    document.available = document.stock > 0;
    this.updates.push({ id, quantity: filter.stock.$gte, session: options.session });
    return { ...document };
  }

  async findOne(filter) {
    return this.documents.get(String(filter._id)) ?? null;
  }
}

test("stock caso 6: stock suficiente se descuenta de forma condicionada", async () => {
  const collection = new FakeStockCollection([{ _id: PRODUCT_A, name: "A", trackStock: true, stock: 3 }]);
  await applyOrderStockAdjustments([{ baseProductId: PRODUCT_A, quantity: 2 }], { collection, session: "tx" });
  assert.equal(collection.documents.get(PRODUCT_A).stock, 1);
  assert.equal(collection.updates[0].session, "tx");
});

test("stock caso 7: stock insuficiente no modifica producto ni crea ajuste", async () => {
  const collection = new FakeStockCollection([{ _id: PRODUCT_A, name: "A", trackStock: true, stock: 1 }]);
  await assert.rejects(
    applyOrderStockAdjustments([{ baseProductId: PRODUCT_A, quantity: 2 }], { collection, session: "tx" }),
    (error) => error instanceof OrderStockError && error.status === 409
  );
  assert.equal(collection.documents.get(PRODUCT_A).stock, 1);
  assert.equal(collection.updates.length, 0);
});

test("stock caso 8: dos pedidos concurrentes compiten por la última unidad", async () => {
  const collection = new FakeStockCollection([{ _id: PRODUCT_A, name: "A", trackStock: true, stock: 1 }]);
  const results = await Promise.allSettled([
    applyOrderStockAdjustments([{ baseProductId: PRODUCT_A, quantity: 1 }], { collection, session: "tx-a" }),
    applyOrderStockAdjustments([{ baseProductId: PRODUCT_A, quantity: 1 }], { collection, session: "tx-b" })
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal(collection.documents.get(PRODUCT_A).stock, 0);
});

test("stock caso 9: configuraciones distintas agregan cantidad por producto base", () => {
  const requirements = groupOrderStockRequirements([
    { productId: `${PRODUCT_A}::config-x`, baseProductId: PRODUCT_A, quantity: 1 },
    { productId: `${PRODUCT_A}::config-y`, baseProductId: PRODUCT_A, quantity: 2 },
    { productId: PRODUCT_B, baseProductId: PRODUCT_B, quantity: 4 }
  ]);
  assert.deepEqual(requirements, [
    { productId: PRODUCT_A, quantity: 3 },
    { productId: PRODUCT_B, quantity: 4 }
  ]);
});

async function fakeTransactionalState(initialState, operation) {
  const state = structuredClone(initialState);
  const working = structuredClone(initialState);
  try {
    const result = await operation(working);
    return { state: working, result };
  } catch (error) {
    return { state, error };
  }
}

test("cupón caso 10: pedido, consumo y stock se ejecutan en la misma unidad", async () => {
  const outcome = await fakeTransactionalState({ couponUses: 0, stock: 2, orders: [] }, async (state) => {
    const order = { orderId: "MLG-1", items: [{ baseProductId: PRODUCT_A, quantity: 1 }] };
    return commitOrderUnitOfWork(order, {
      session: "tx",
      coupon: { valid: true, code: "PRIMER10", percent: 10 },
      customerUpserter: async (_order, options) => { assert.equal(options.session, "tx"); return { _id: PRODUCT_B }; },
      couponConsumer: async (_customerId, _coupon, options) => { assert.equal(options.session, "tx"); state.couponUses += 1; return {}; },
      stockAdjuster: async (_items, options) => { assert.equal(options.session, "tx"); state.stock -= 1; },
      orderSaver: async (saved, options) => { assert.equal(options.session, "tx"); state.orders.push(saved.orderId); }
    });
  });
  assert.deepEqual(outcome.state, { couponUses: 1, stock: 1, orders: ["MLG-1"] });
});

test("cupón caso 11: un fallo posterior aborta todos los cambios de la unidad", async () => {
  const initial = { couponUses: 0, stock: 1, orders: [] };
  const outcome = await fakeTransactionalState(initial, async (state) => {
    await commitOrderUnitOfWork({ orderId: "MLG-1", items: [] }, {
      session: "tx",
      coupon: { valid: true, code: "PRIMER10", percent: 10 },
      customerUpserter: async () => ({ _id: PRODUCT_B }),
      couponConsumer: async () => { state.couponUses += 1; return {}; },
      stockAdjuster: async () => { state.stock -= 1; throw new Error("stock failure"); },
      orderSaver: async (saved) => { state.orders.push(saved.orderId); }
    });
  });
  assert.match(outcome.error.message, /stock failure/);
  assert.deepEqual(outcome.state, initial);
});

test("cupón caso 12: replay no vuelve a ejecutar la unidad de trabajo", async () => {
  const harness = createIdempotencyHarness();
  let unitCalls = 0;
  const first = await harness.execute("order_coupon_replay", "fingerprint-a");
  if (!first.replay) unitCalls += 1;
  const replay = await harness.execute("order_coupon_replay", "fingerprint-a");
  if (!replay.replay) unitCalls += 1;
  assert.equal(unitCalls, 1);
  assert.equal(harness.inserts, 1);
});

test("email caso 13: tras crear pedido se registra envío correcto", async () => {
  const events = [];
  const result = await notifyPersistedOrder({ orderId: "MLG-1" }, {
    requestId: "request-email-ok",
    emailSender: async () => { events.push("email"); },
    notificationAppender: async () => { events.push("audit"); }
  });
  assert.deepEqual(events, ["email", "audit"]);
  assert.equal(result.notifications.email.sent, true);
});

test("email caso 14: fallo no elimina pedido ni idempotencia", async () => {
  const persisted = { orderId: "MLG-1", idempotencyKey: "order_email_failure" };
  const result = await notifyPersistedOrder(persisted, {
    requestId: "request-email-fail",
    emailSender: async () => { throw new Error("provider unavailable"); },
    notificationAppender: async () => undefined
  });
  assert.equal(persisted.orderId, "MLG-1");
  assert.equal(persisted.idempotencyKey, "order_email_failure");
  assert.deepEqual(result.warnings, ["email-not-sent"]);
});

test("email caso 15: replay tras fallo no reenvía ni crea pedido", async () => {
  const harness = createIdempotencyHarness();
  let emailCalls = 0;
  const process = async () => {
    const creation = await harness.execute("order_email_replay", "fingerprint-a");
    if (!creation.replay) {
      await notifyPersistedOrder(creation.order, {
        emailSender: async () => { emailCalls += 1; throw new Error("provider unavailable"); },
        notificationAppender: async () => undefined
      });
    }
    return creation;
  };
  await process();
  const replay = await process();
  assert.equal(replay.replay, true);
  assert.equal(harness.inserts, 1);
  assert.equal(emailCalls, 1);
});
