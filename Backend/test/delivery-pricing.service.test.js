import assert from "node:assert/strict";
import test from "node:test";
import { calculateDeliveryPricing } from "../src/services/delivery-pricing.service.js";

const cases = [
  ["1 km / 15 €", 1, 15, true, 2.99],
  ["5 km / 20 €", 5, 20, true, 4.99],
  ["18 km / 49 €", 18, 49, false, 1],
  ["18 km / 50 €", 18, 50, true, 10.99],
  ["23 km / 65 €", 23, 65, true, 11.99],
  ["23 km / 110 €", 23, 110, true, 8.99],
  ["23 km / 150 €", 23, 150, true, 5.99],
  ["28 km / 79 €", 28, 79, false, 1],
  ["28 km / 125 €", 28, 125, true, 9.99],
  ["28 km / 160 €", 28, 160, true, 5.99],
  ["32 km / 100 €", 32, 100, true, 15.99],
  ["32 km / 170 €", 32, 170, true, 10.99],
  ["32 km / 210 €", 32, 210, true, 6.99],
  ["38 km / 120 €", 38, 120, true, 17.99],
  ["38 km / 175 €", 38, 175, true, 12.99],
  ["38 km / 220 €", 38, 220, true, 7.99]
];

for (const [name, distanceKm, subtotal, available, expected] of cases) {
  test(name, () => {
    const quote = calculateDeliveryPricing(distanceKm, subtotal);
    assert.equal(quote.available, available);
    if (available) assert.equal(quote.deliveryFee, expected);
    else {
      assert.equal(quote.reason, "MINIMUM_ORDER_NOT_REACHED");
      assert.equal(quote.amountMissingForMinimum, expected);
    }
  });
}

test("40 km exactos están permitidos", () => {
  assert.equal(calculateDeliveryPricing(40, 120).available, true);
});

test("más de 40 km queda fuera de la zona", () => {
  const quote = calculateDeliveryPricing(40.01, 500);
  assert.equal(quote.available, false);
  assert.equal(quote.reason, "OUTSIDE_DELIVERY_AREA");
});
