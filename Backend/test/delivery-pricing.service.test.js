import assert from "node:assert/strict";
import test from "node:test";
import { calculateDeliveryPricing } from "../src/services/delivery-pricing.service.js";
import { calculateShippingQuote } from "../src/services/shipping.service.js";

const cases = [
  [1, 20, 2.99], [1, 45, 0],
  [5, 30, 4.99], [5, 45, 3.99], [5, 60, 0],
  [9, 30, 6.99], [9, 55, 5.99], [9, 70, 4.99], [9, 80, 0],
  [18, 40, 12.99], [18, 80, 9.99], [18, 110, 6.99], [18, 130, 0],
  [23, 60, 15.99], [23, 90, 11.99], [23, 120, 7.99], [23, 150, 0],
  [28, 50, 18.99], [28, 95, 13.99], [28, 135, 8.99], [28, 180, 0],
  [32, 80, 22.99], [32, 120, 15.99], [32, 170, 9.99], [32, 220, 0],
  [38, 100, 26.99], [38, 140, 17.99], [38, 200, 10.99], [38, 250, 0]
];

for (const [distanceKm, subtotal, expectedFee] of cases) {
  test(`${distanceKm} km / ${subtotal} € → ${expectedFee} €`, () => {
    const quote = calculateDeliveryPricing(distanceKm, subtotal);
    assert.equal(quote.available, true);
    assert.equal(quote.deliveryFee, expectedFee);
    assert.equal(quote.minimumOrder, 15);
    assert.equal(quote.amountMissingForFreeShipping, Math.max(0, quote.freeShippingThreshold - subtotal));
  });
}

test("subtotal 14,99 € devuelve mínimo general de 15 € en cualquier zona", () => {
  for (const distanceKm of [1, 18, 28, 40]) {
    const quote = calculateDeliveryPricing(distanceKm, 14.99);
    assert.equal(quote.available, false);
    assert.equal(quote.reason, "MINIMUM_ORDER_NOT_REACHED");
    assert.equal(quote.minimumOrder, 15);
    assert.equal(quote.amountMissingForMinimum, 0.01);
  }
});

test("40 km exactos están permitidos", () => {
  assert.equal(calculateDeliveryPricing(40, 15).available, true);
});

test("más de 40 km queda fuera de la zona", () => {
  const quote = calculateDeliveryPricing(40.01, 500);
  assert.equal(quote.available, false);
  assert.equal(quote.reason, "OUTSIDE_DELIVERY_AREA");
});

test("quote de 27,4 km / 125 € expone el contrato comercial completo", async () => {
  const quote = await calculateShippingQuote({ address: "Calle Liverpool 6", postalCode: "28922", subtotal: 125 }, {
    distanceProvider: async () => 27.4
  });
  assert.equal(quote.available, true);
  assert.equal(quote.distanceKm, 27.4);
  assert.equal(quote.zone, "25-30");
  assert.equal(quote.subtotal, 125);
  assert.equal(quote.minimumOrder, 15);
  assert.equal(quote.baseDeliveryFee, 18.99);
  assert.equal(quote.deliveryFee, 8.99);
  assert.equal(quote.freeShippingThreshold, 180);
  assert.equal(quote.amountMissingForFreeShipping, 55);
});
