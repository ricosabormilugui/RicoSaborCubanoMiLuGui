import assert from "node:assert/strict";
import test from "node:test";
import {
  computePaymentExpiresAt,
  getPaymentReservationMinutes,
  isPaymentReservationExpired,
  paymentExpiresAtForOrder,
  paymentReservationMs,
  requiresPaymentDeadline,
  shouldShowPaymentDeadline
} from "../src/services/order-payment-reservation.service.js";
import { applyOrderStockAdjustments, restoreOrderStockAdjustments, OrderStockError } from "../src/repositories/products.repository.js";
import { voidOrderAndReleaseInventory } from "../src/services/order-inventory.service.js";
import { buildCustomerOrderEmail, buildOrderStatusEmail } from "../src/services/order-email.templates.js";

const PRODUCT_A = "64b000000000000000000001";
const PRODUCT_B = "64b000000000000000000002";

class FakeStockCollection {
  constructor(documents) {
    this.documents = new Map(documents.map((document) => [String(document._id), { ...document }]));
    this.updates = [];
  }

  async findOneAndUpdate(filter, pipeline, options) {
    const id = String(filter._id);
    const document = this.documents.get(id);
    if (!document) return null;
    if (filter.trackStock === true && document.trackStock !== true) return null;
    if (filter.stock?.$gte != null) {
      if (document.stock < filter.stock.$gte) return null;
      document.stock -= filter.stock.$gte;
    } else {
      const add = pipeline?.[0]?.$set?.stock?.$add?.[1] ?? 0;
      document.stock += add;
    }
    document.available = document.stock > 0;
    this.updates.push({ id, session: options?.session, stock: document.stock });
    return { ...document };
  }

  async findOne(filter) {
    return this.documents.get(String(filter._id)) ?? null;
  }
}

class FakeOrdersCollection {
  constructor(order) {
    this.order = structuredClone(order);
    this.claims = 0;
  }

  matches(filter) {
    const order = this.order;
    if (filter.orderId && filter.orderId !== order.orderId) return false;
    if (filter.inventoryReleasedAt === null && order.inventoryReleasedAt != null) return false;
    if (filter.status?.$nin?.includes(order.status)) return false;
    if (filter.paymentStatus && filter.paymentStatus !== order.paymentStatus) return false;
    if (filter.paymentExpiresAt?.$lte && String(order.paymentExpiresAt) > String(filter.paymentExpiresAt.$lte)) return false;
    if (filter.paymentExpiresAt?.$gt && !(String(order.paymentExpiresAt) > String(filter.paymentExpiresAt.$gt))) return false;
    if (filter.$and) {
      return filter.$and.every((clause) => this.matches(clause));
    }
    if (filter.$or) {
      return filter.$or.some((clause) => this.matches(clause));
    }
    return true;
  }

  async findOneAndUpdate(filter, update) {
    if (!this.matches(filter)) return null;
    const previous = structuredClone(this.order);
    Object.assign(this.order, update.$set ?? {});
    if (update.$set?.["payment.status"]) {
      this.order.payment = { ...(this.order.payment ?? {}), status: update.$set["payment.status"] };
    }
    this.claims += 1;
    return previous;
  }

  find() {
    const docs = this.matches({
      paymentStatus: this.order.paymentStatus,
      paymentExpiresAt: this.order.paymentExpiresAt,
      status: { $nin: [] },
      inventoryReleasedAt: this.order.inventoryReleasedAt
    }) ? [this.order] : [];
    return {
      project() { return this; },
      limit() { return this; },
      async toArray() { return docs.map((item) => ({ orderId: item.orderId })); }
    };
  }
}

function pendingOrder(overrides = {}) {
  return {
    orderId: "MLG-RESERVE",
    status: "nuevo",
    paymentStatus: "pending",
    payment: { method: "bizum", status: "pending" },
    paymentExpiresAt: computePaymentExpiresAt("2026-08-31T10:00:00.000Z"),
    inventoryReleasedAt: null,
    items: [{ productId: PRODUCT_A, baseProductId: PRODUCT_A, quantity: 1 }],
    customerId: "64b000000000000000000099",
    total: 10,
    ...overrides
  };
}

test("config canónica: 120 minutos y 2h exactas son elegibles", () => {
  assert.equal(getPaymentReservationMinutes(), 120);
  assert.equal(paymentReservationMs(), 120 * 60 * 1000);
  const created = "2026-08-31T10:00:00.000Z";
  const expires = computePaymentExpiresAt(created);
  assert.equal(expires, "2026-08-31T12:00:00.000Z");
  assert.equal(isPaymentReservationExpired({ payment: { method: "bizum" }, paymentExpiresAt: expires }, new Date("2026-08-31T11:59:00.000Z")), false);
  assert.equal(isPaymentReservationExpired({ payment: { method: "bizum" }, paymentExpiresAt: expires }, new Date("2026-08-31T12:00:00.000Z")), true);
});

test("O-S: métodos de pago y vencimiento", () => {
  assert.equal(requiresPaymentDeadline("bizum"), true);
  assert.equal(requiresPaymentDeadline("bank_transfer"), true);
  assert.equal(requiresPaymentDeadline("cash"), false);
  assert.equal(shouldShowPaymentDeadline({ payment: { method: "cash", status: "pending" }, paymentExpiresAt: null }), false);
  assert.equal(shouldShowPaymentDeadline({
    payment: { method: "bizum", status: "pending" },
    paymentExpiresAt: "2026-08-31T12:00:00.000Z"
  }), true);
  assert.equal(shouldShowPaymentDeadline({
    payment: { method: "bizum", status: "paid" },
    paymentExpiresAt: "2026-08-31T12:00:00.000Z"
  }), false);
});

test("F-H: nuevos pedidos pagables tienen paymentExpiresAt; efectivo no", () => {
  const createdAt = "2026-08-31T10:00:00.000Z";
  assert.equal(paymentExpiresAtForOrder("bizum", createdAt), "2026-08-31T12:00:00.000Z");
  assert.equal(paymentExpiresAtForOrder("bank_transfer", createdAt), "2026-08-31T12:00:00.000Z");
  assert.equal(paymentExpiresAtForOrder("cash", createdAt), null);
});

test("A-D: reserva al crear, segundo pedido rechazado, pagar no vuelve a descontar", async () => {
  const collection = new FakeStockCollection([{ _id: PRODUCT_A, name: "A", trackStock: true, stock: 1 }]);
  await applyOrderStockAdjustments([{ baseProductId: PRODUCT_A, quantity: 1 }], { collection, session: "tx" });
  assert.equal(collection.documents.get(PRODUCT_A).stock, 0);
  await assert.rejects(
    applyOrderStockAdjustments([{ baseProductId: PRODUCT_A, quantity: 1 }], { collection, session: "tx-b" }),
    (error) => error instanceof OrderStockError && error.details.available === 0
  );
  assert.equal(collection.documents.get(PRODUCT_A).stock, 0);
  assert.equal(collection.updates.length, 1);
});

test("H-J: expirar restaura stock una vez y no toca trackStock false", async () => {
  const products = new FakeStockCollection([
    { _id: PRODUCT_A, name: "A", trackStock: true, stock: 0 },
    { _id: PRODUCT_B, name: "B", trackStock: false, stock: 4 }
  ]);
  const orders = new FakeOrdersCollection(pendingOrder({
    items: [{ productId: PRODUCT_A, quantity: 1 }, { productId: PRODUCT_B, quantity: 2 }]
  }));
  const first = await voidOrderAndReleaseInventory("MLG-RESERVE", {
    reason: "payment_expired",
    nextPaymentStatus: "cancelled",
    extraFilter: { paymentStatus: "pending" },
    collection: orders,
    runTransaction: async (fn) => fn("tx"),
    stockRestorer: (items, options) => restoreOrderStockAdjustments(items, { collection: products, ...options }),
    couponReleaser: async () => ({}),
    customerCounterReverter: async () => ({})
  });
  assert.equal(first.status, "cancelado");
  assert.equal(products.documents.get(PRODUCT_A).stock, 1);
  assert.equal(products.documents.get(PRODUCT_B).stock, 4);
  const second = await voidOrderAndReleaseInventory("MLG-RESERVE", {
    reason: "payment_expired",
    nextPaymentStatus: "cancelled",
    collection: orders,
    runTransaction: async (fn) => fn("tx"),
    stockRestorer: (items, options) => restoreOrderStockAdjustments(items, { collection: products, ...options }),
    couponReleaser: async () => { throw new Error("no debe restaurar cupón dos veces"); },
    customerCounterReverter: async () => ({})
  });
  assert.equal(second, null);
  assert.equal(products.documents.get(PRODUCT_A).stock, 1);
  assert.equal(orders.claims, 1);
});

test("K: admin y scheduler concurrentes solo liberan una vez", async () => {
  const products = new FakeStockCollection([{ _id: PRODUCT_A, name: "A", trackStock: true, stock: 0 }]);
  const orders = new FakeOrdersCollection(pendingOrder());
  const restorer = (items, options) => restoreOrderStockAdjustments(items, { collection: products, ...options });
  const results = await Promise.all([
    voidOrderAndReleaseInventory("MLG-RESERVE", {
      reason: "admin_cancelled",
      collection: orders,
      runTransaction: async (fn) => fn("tx-a"),
      stockRestorer: restorer,
      couponReleaser: async () => ({}),
      customerCounterReverter: async () => ({})
    }),
    voidOrderAndReleaseInventory("MLG-RESERVE", {
      reason: "payment_expired",
      nextPaymentStatus: "cancelled",
      extraFilter: { paymentStatus: "pending" },
      collection: orders,
      runTransaction: async (fn) => fn("tx-b"),
      stockRestorer: restorer,
      couponReleaser: async () => ({}),
      customerCounterReverter: async () => ({})
    })
  ]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(products.documents.get(PRODUCT_A).stock, 1);
  assert.equal(orders.claims, 1);
});

test("L-N: pago y expiración no se pisan; pagado no expira; cancelado no se marca pagado", async () => {
  const paid = pendingOrder({ paymentStatus: "paid", payment: { method: "bizum", status: "paid" } });
  const orders = new FakeOrdersCollection(paid);
  const expired = await voidOrderAndReleaseInventory("MLG-RESERVE", {
    reason: "payment_expired",
    extraFilter: { paymentStatus: "pending" },
    collection: orders,
    runTransaction: async (fn) => fn("tx"),
    stockRestorer: async () => { throw new Error("no debe devolver stock de un pedido pagado"); },
    couponReleaser: async () => ({}),
    customerCounterReverter: async () => ({})
  });
  assert.equal(expired, null);

  const released = new FakeOrdersCollection(pendingOrder({
    status: "cancelado",
    inventoryReleasedAt: "2026-08-31T12:01:00.000Z"
  }));
  assert.equal(released.matches({
    orderId: "MLG-RESERVE",
    inventoryReleasedAt: null,
    status: { $nin: ["cancelado", "anulado"] }
  }), false);
});

test("E2E dominio: 1 unidad, pending reserva, expire libera", async () => {
  const products = new FakeStockCollection([{ _id: PRODUCT_A, name: "A", trackStock: true, stock: 1 }]);
  await applyOrderStockAdjustments([{ baseProductId: PRODUCT_A, quantity: 1 }], { collection: products });
  assert.equal(products.documents.get(PRODUCT_A).stock, 0);
  await assert.rejects(applyOrderStockAdjustments([{ baseProductId: PRODUCT_A, quantity: 1 }], { collection: products }));
  const orders = new FakeOrdersCollection(pendingOrder());
  await voidOrderAndReleaseInventory("MLG-RESERVE", {
    reason: "payment_expired",
    nextPaymentStatus: "cancelled",
    extraFilter: { paymentStatus: "pending" },
    collection: orders,
    runTransaction: async (fn) => fn("tx"),
    stockRestorer: (items, options) => restoreOrderStockAdjustments(items, { collection: products, ...options }),
    couponReleaser: async () => ({}),
    customerCounterReverter: async () => ({})
  });
  assert.equal(products.documents.get(PRODUCT_A).stock, 1);
  await applyOrderStockAdjustments([{ baseProductId: PRODUCT_A, quantity: 1 }], { collection: products });
  assert.equal(products.documents.get(PRODUCT_A).stock, 0);
});

test("T-V: email pending incluye límite; paid y cash no", () => {
  const expiresAt = "2026-08-31T15:00:00.000Z";
  const pending = buildCustomerOrderEmail({
    orderId: "MLG-MAIL",
    customer: { fullName: "Ana" },
    items: [{ name: "Cerveza", unitPrice: 8, quantity: 1 }],
    payment: { method: "bizum", status: "pending" },
    paymentExpiresAt: expiresAt,
    deliveryType: "pickup",
    delivery: { type: "pickup", date: "2026-09-05", slot: "12:00-14:00" }
  }, { env: { PAYMENT_BIZUM_PHONE: "+34644339404" } });
  assert.match(pending.html, /PAGO PENDIENTE/);
  assert.match(pending.html, /reservado hasta las/);
  assert.doesNotMatch(pending.html, /now \+ 2h|2 \* 60 \* 60 \* 1000/);

  const paid = buildCustomerOrderEmail({
    orderId: "MLG-MAIL",
    customer: { fullName: "Ana" },
    items: [{ name: "Cerveza", unitPrice: 8, quantity: 1 }],
    payment: { method: "bizum", status: "paid" },
    paymentExpiresAt: expiresAt,
    deliveryType: "pickup",
    delivery: { type: "pickup", date: "2026-09-05", slot: "12:00-14:00" }
  }, { env: { PAYMENT_BIZUM_PHONE: "+34644339404" } });
  assert.doesNotMatch(paid.html, /PAGO PENDIENTE/);
  assert.doesNotMatch(paid.html, /se cancelará automáticamente/);

  const cash = buildCustomerOrderEmail({
    orderId: "MLG-MAIL",
    customer: { fullName: "Ana" },
    items: [{ name: "Cerveza", unitPrice: 8, quantity: 1 }],
    payment: { method: "cash", status: "pending" },
    paymentExpiresAt: null,
    deliveryType: "pickup",
    delivery: { type: "pickup", date: "2026-09-05", slot: "12:00-14:00" }
  }, { env: {} });
  assert.doesNotMatch(cash.html, /PAGO PENDIENTE/);
  assert.doesNotMatch(cash.html, /paga en 2 horas|2 horas/);
});

test("Y: email de cancelación por impago muestra el motivo", () => {
  const email = buildOrderStatusEmail({
    orderId: "MLG-MAIL",
    customer: { fullName: "Ana" },
    status: "cancelado",
    cancellationReason: "payment_expired",
    deliveryType: "pickup",
    delivery: { type: "pickup", date: "2026-09-05", slot: "12:00-14:00" }
  }, { status: "cancelado" });
  assert.match(email.html, /no recibimos el pago dentro del plazo/);
});
