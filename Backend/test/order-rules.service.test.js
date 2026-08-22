import assert from "node:assert/strict";
import test from "node:test";
import { validateOrderFulfillment } from "../src/services/order-rules.service.js";

const NOW = new Date("2026-08-22T10:00:00.000Z"); // 12:00 en Madrid

test("rechaza pedidos para el mismo día", () => {
  assert.match(validateOrderFulfillment(
    { type: "delivery", date: "2026-08-22", slot: "18:00-21:00" },
    { now: NOW }
  ), /mismo día/);
});

test("acepta una entrega con 24 horas completas de antelación", () => {
  assert.equal(validateOrderFulfillment(
    { type: "delivery", date: "2026-08-24", slot: "18:00-21:00" },
    { now: NOW }
  ), null);
});

test("rechaza una franja de recogida usada para entrega", () => {
  assert.match(validateOrderFulfillment(
    { type: "delivery", date: "2026-08-24", slot: "12:00-14:00" },
    { now: NOW }
  ), /única franja válida es 18:00-21:00/);
});

test("mantiene las franjas actuales de recogida", () => {
  for (const slot of ["12:00-14:00", "14:00-16:00", "18:00-20:00"]) {
    assert.equal(validateOrderFulfillment(
      { type: "pickup", date: "2026-08-24", slot },
      { now: NOW }
    ), null);
  }
});

test("rechaza una franja de entrega usada para recogida", () => {
  assert.match(validateOrderFulfillment(
    { type: "pickup", date: "2026-08-24", slot: "18:00-21:00" },
    { now: NOW }
  ), /recogida/);
});

test("aplica 24 horas exactas usando Europe\/Madrid", () => {
  const oneMinuteTooLate = new Date("2026-08-23T10:01:00.000Z");
  assert.match(validateOrderFulfillment(
    { type: "pickup", date: "2026-08-24", slot: "12:00-14:00" },
    { now: oneMinuteTooLate }
  ), /24 horas completas/);
  assert.equal(validateOrderFulfillment(
    { type: "pickup", date: "2026-08-24", slot: "12:00-14:00" },
    { now: new Date("2026-08-23T10:00:00.000Z") }
  ), null);
});

test("respeta el cambio de offset horario de Madrid en invierno", () => {
  assert.equal(validateOrderFulfillment(
    { type: "pickup", date: "2026-01-03", slot: "12:00-14:00" },
    { now: new Date("2026-01-02T11:00:00.000Z") }
  ), null);
});

test("aplica 48 horas a pedidos personalizados", () => {
  assert.match(validateOrderFulfillment(
    { type: "pickup", date: "2026-08-24", slot: "12:00-14:00" },
    { now: new Date("2026-08-22T10:01:00.000Z"), advanceNoticeHours: 48 }
  ), /48 horas completas/);
  assert.equal(validateOrderFulfillment(
    { type: "pickup", date: "2026-08-24", slot: "12:00-14:00" },
    { now: NOW, advanceNoticeHours: 48 }
  ), null);
});

test("rechaza días de cierre", () => {
  assert.match(validateOrderFulfillment(
    { type: "delivery", date: "2026-08-23", slot: "18:00-21:00" },
    { now: new Date("2026-08-21T10:00:00.000Z") }
  ), /No hay servicio/);
});
