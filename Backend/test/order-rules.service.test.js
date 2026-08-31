import assert from "node:assert/strict";
import test from "node:test";
import { DELIVERY_RULES } from "../src/config/shipping.config.js";
import {
  getMinimumFulfillmentDate,
  getValidSlotsForDate,
  instantInBusinessTimezone,
  isClosedFulfillmentDate,
  isFulfillmentDateAvailable,
  reconcileFulfillmentSelection,
  validateOrderFulfillment
} from "../src/services/order-rules.service.js";

const HOURS = DELIVERY_RULES.advanceNoticeHours;

function at(date, hour, minute = 0) {
  const instant = instantInBusinessTimezone(date, hour, minute);
  if (!instant) throw new Error(`Fecha inválida ${date}`);
  return instant;
}

test("caso A: 24 horas exactas son válidas", () => {
  assert.equal(validateOrderFulfillment(
    { type: "delivery", date: "2026-08-28", slot: "18:00-21:00" },
    { now: at("2026-08-27", 18, 0) }
  ), null);
});

test("caso B: 23h 59 no cumple la antelación", () => {
  assert.match(validateOrderFulfillment(
    { type: "delivery", date: "2026-08-28", slot: "18:00-21:00" },
    { now: at("2026-08-27", 18, 1) }
  ), /Necesitamos al menos 24 horas para preparar tu pedido/);
});

test("caso C: viernes abierto no salta el sábado", () => {
  const now = at("2026-08-28", 10, 0);
  assert.equal(isClosedFulfillmentDate("2026-08-29"), false);
  assert.equal(isFulfillmentDateAvailable("2026-08-29", "delivery", { now, advanceNoticeHours: HOURS }), true);
  assert.equal(getMinimumFulfillmentDate("delivery", { now, advanceNoticeHours: HOURS }), "2026-08-29");
});

test("caso D: sábado abierto no salta el domingo si el domingo no está cerrado", () => {
  const now = at("2026-08-29", 10, 0);
  const openSunday = { now, advanceNoticeHours: HOURS, closedWeekdays: [] };
  assert.equal(isClosedFulfillmentDate("2026-08-30", { closedWeekdays: [] }), false);
  assert.equal(isFulfillmentDateAvailable("2026-08-30", "delivery", openSunday), true);
  assert.equal(getMinimumFulfillmentDate("delivery", openSunday), "2026-08-30");
});

test("caso E: domingo configurado cerrado queda deshabilitado", () => {
  assert.equal(isClosedFulfillmentDate("2026-08-30"), true);
  assert.equal(isFulfillmentDateAvailable("2026-08-30", "delivery", {
    now: at("2026-08-28", 10, 0),
    advanceNoticeHours: HOURS
  }), false);
  assert.match(validateOrderFulfillment(
    { type: "delivery", date: "2026-08-30", slot: "18:00-21:00" },
    { now: at("2026-08-28", 10, 0) }
  ), /Esta fecha ya no está disponible/);
});

test("caso F: el día siguiente sin franja posterior a +24h no está disponible", () => {
  const now = at("2026-08-28", 19, 0);
  assert.equal(isFulfillmentDateAvailable("2026-08-29", "delivery", { now, advanceNoticeHours: HOURS }), false);
  assert.deepEqual(getValidSlotsForDate("2026-08-29", "delivery", { now, advanceNoticeHours: HOURS }), []);
});

test("caso G: el sábado con una franja posterior a +24h sí es seleccionable", () => {
  const now = at("2026-08-28", 10, 0);
  assert.deepEqual(getValidSlotsForDate("2026-08-29", "delivery", { now, advanceNoticeHours: HOURS }), ["18:00-21:00"]);
  assert.equal(getMinimumFulfillmentDate("delivery", { now, advanceNoticeHours: HOURS }), "2026-08-29");
});

test("caso H: una fecha pasada enviada al validador se rechaza", () => {
  assert.match(validateOrderFulfillment(
    { type: "delivery", date: "2026-08-20", slot: "18:00-21:00" },
    { now: at("2026-08-27", 10, 0) }
  ), /Necesitamos al menos 24 horas|Esta fecha ya no está disponible/);
});

test("caso I: una franja inexistente se rechaza", () => {
  assert.match(validateOrderFulfillment(
    { type: "delivery", date: "2026-08-29", slot: "12:00-14:00" },
    { now: at("2026-08-27", 10, 0) }
  ), /única franja válida es 18:00-21:00/);
});

test("caso J: al cambiar de fecha se limpia una franja incompatible", () => {
  const now = at("2026-08-27", 10, 0);
  const next = reconcileFulfillmentSelection("2026-08-29", "18:00-21:00", "pickup", { now, advanceNoticeHours: HOURS });
  assert.equal(next.date, "2026-08-29");
  assert.equal(next.slot, "");
});

test("caso K: al cambiar delivery a pickup se recalcan fecha y franjas", () => {
  const now = at("2026-08-28", 10, 0);
  const asDelivery = reconcileFulfillmentSelection("2026-08-29", "18:00-21:00", "delivery", { now, advanceNoticeHours: HOURS });
  assert.equal(asDelivery.slot, "18:00-21:00");
  const asPickup = reconcileFulfillmentSelection("2026-08-29", "18:00-21:00", "pickup", { now, advanceNoticeHours: HOURS });
  assert.equal(asPickup.date, "2026-08-29");
  assert.equal(asPickup.slot, "");
  assert.ok(getValidSlotsForDate("2026-08-29", "pickup", { now, advanceNoticeHours: HOURS }).includes("18:00-20:00"));
});

test("transición domingo → lunes no usa días laborables", () => {
  const now = at("2026-08-30", 10, 0);
  assert.equal(getMinimumFulfillmentDate("delivery", { now, advanceNoticeHours: HOURS }), "2026-08-31");
});

test("mantiene las franjas actuales de recogida", () => {
  const now = at("2026-08-22", 10, 0);
  for (const slot of ["12:00-14:00", "14:00-16:00", "18:00-20:00"]) {
    assert.equal(validateOrderFulfillment({ type: "pickup", date: "2026-08-24", slot }, { now }), null);
  }
});

test("aplica 48 horas a pedidos personalizados", () => {
  assert.match(validateOrderFulfillment(
    { type: "pickup", date: "2026-08-24", slot: "12:00-14:00" },
    { now: at("2026-08-22", 12, 1), advanceNoticeHours: 48 }
  ), /Necesitamos al menos 48 horas/);
  assert.equal(validateOrderFulfillment(
    { type: "pickup", date: "2026-08-24", slot: "12:00-14:00" },
    { now: at("2026-08-22", 12, 0), advanceNoticeHours: 48 }
  ), null);
});

test("respeta el cambio de offset horario de Madrid en invierno", () => {
  assert.equal(validateOrderFulfillment(
    { type: "pickup", date: "2026-01-03", slot: "12:00-14:00" },
    { now: at("2026-01-02", 12, 0) }
  ), null);
});
