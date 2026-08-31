import assert from "node:assert/strict";
import test from "node:test";
import { createOrder } from "../src/controllers/orders.controller.js";
import { DELIVERY_RULES } from "../src/config/shipping.config.js";

function mockResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

function basePayload(delivery) {
  return {
    customer: { fullName: "Cliente prueba", phone: "34644423790" },
    items: [{ productId: "test", name: "Producto", unitPrice: 20, quantity: 1 }],
    deliveryType: delivery.type,
    deliveryDate: delivery.date,
    deliverySlot: delivery.slot,
    delivery,
    postalCode: delivery.type === "delivery" ? "28922" : undefined
  };
}

function orderRequest(body) {
  return {
    body,
    auth: null,
    requestId: "request-order-validation",
    get(name) {
      return name.toLowerCase() === "idempotency-key" ? "order_validation_123" : undefined;
    }
  };
}

function madridDate(offsetDays = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const get = (type) => Number(parts.find((part) => part.type === type)?.value);
  const value = new Date(Date.UTC(get("year"), get("month") - 1, get("day") + offsetDays));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

function nextOpenMadridDate(offsetDays = 14) {
  for (let offset = offsetDays; offset < offsetDays + 7; offset += 1) {
    const date = madridDate(offset);
    const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    if (!DELIVERY_RULES.closedWeekdays.includes(weekday)) return date;
  }
  throw new Error("No open fulfillment day configured");
}

test("POST /orders responde 400 para un pedido del mismo día", async () => {
  const delivery = { type: "delivery", date: madridDate(), slot: "18:00-21:00", postalCode: "28922" };
  const response = mockResponse();
  await createOrder(orderRequest(basePayload(delivery)), response);
  assert.equal(response.statusCode, 400);
  const weekday = new Date(`${delivery.date}T00:00:00.000Z`).getUTCDay();
  const expectedMessage = DELIVERY_RULES.closedWeekdays.includes(weekday) ? /Esta fecha ya no está disponible/ : /Necesitamos al menos 24 horas/;
  assert.match(response.body.error, expectedMessage);
});

test("POST /orders responde 400 para una franja de domicilio no permitida", async () => {
  const delivery = { type: "delivery", date: nextOpenMadridDate(), slot: "12:00-14:00", postalCode: "28922" };
  const response = mockResponse();
  await createOrder(orderRequest(basePayload(delivery)), response);
  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /18:00-21:00/);
});

test("POST /orders rechaza una fecha pasada manipulada", async () => {
  const delivery = { type: "delivery", date: "2020-01-06", slot: "18:00-21:00", postalCode: "28922" };
  const response = mockResponse();
  await createOrder(orderRequest(basePayload(delivery)), response);
  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /Necesitamos al menos 24 horas|Esta fecha ya no está disponible/);
});
