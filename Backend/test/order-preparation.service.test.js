import assert from "node:assert/strict";
import test from "node:test";
import { getOrderPreparationNoticeHours, getProductPreparationNoticeHours } from "../src/services/order-preparation.service.js";
import { instantInBusinessTimezone, validateOrderFulfillment } from "../src/services/order-rules.service.js";

const normal = { category: "combos" };
const cake = { category: "tartas" };
const decoration = (value) => ({ groupKey: "decorations", value });

function at(date, hour, minute = 0) {
  return instantInBusinessTimezone(date, hour, minute);
}

test("clasifica 24/48/72 por categoría y grupo estructurados", () => {
  assert.equal(getProductPreparationNoticeHours(normal, [{ groupKey: "sizes", value: "Grande" }]), 24);
  assert.equal(getProductPreparationNoticeHours(cake, []), 48);
  assert.equal(getProductPreparationNoticeHours(cake, [{ groupKey: "flavors", value: "Vainilla" }]), 48);
  for (const value of ["Imagen papel fotográfico", "Topper premium y flores artificiales", "Flores naturales"]) {
    assert.equal(getProductPreparationNoticeHours(cake, [decoration(value)]), 72);
  }
});

test("un carrito mixto utiliza siempre el máximo y baja al eliminar la tarta decorada", () => {
  const normalItem = { preparationNoticeHours: 24 };
  const cakeItem = { preparationNoticeHours: 48 };
  const decoratedCake = { preparationNoticeHours: 72 };
  assert.equal(getOrderPreparationNoticeHours([normalItem, cakeItem]), 48);
  assert.equal(getOrderPreparationNoticeHours([normalItem, cakeItem, decoratedCake]), 72);
  assert.equal(getOrderPreparationNoticeHours([normalItem, cakeItem]), 48);
  assert.equal(getOrderPreparationNoticeHours([normalItem]), 24);
});

test("el backend rechaza antes de 48/72 horas y admite el umbral exacto", () => {
  const delivery48 = { type: "pickup", date: "2026-08-24", slot: "12:00-14:00" };
  assert.match(validateOrderFulfillment(delivery48, { now: at("2026-08-22", 12, 1), advanceNoticeHours: 48 }), /48 horas/);
  assert.equal(validateOrderFulfillment(delivery48, { now: at("2026-08-22", 12, 0), advanceNoticeHours: 48 }), null);
  const delivery72 = { type: "pickup", date: "2026-08-25", slot: "12:00-14:00" };
  assert.match(validateOrderFulfillment(delivery72, { now: at("2026-08-22", 12, 1), advanceNoticeHours: 72 }), /72 horas/);
  assert.equal(validateOrderFulfillment(delivery72, { now: at("2026-08-22", 12, 0), advanceNoticeHours: 72 }), null);
});
