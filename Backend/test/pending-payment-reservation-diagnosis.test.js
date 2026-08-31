import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  describePendingReservation,
  isHistoricalPendingWithoutExpiry
} from "../src/services/pending-payment-reservation-diagnosis.service.js";
import { paymentExpiresAtForOrder } from "../src/services/order-payment-reservation.service.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(resolve(root, path), "utf8");

test("I: el diagnóstico encuentra pending antiguos sin expiry", () => {
  const now = new Date("2026-08-31T15:00:00.000Z");
  const historical = {
    orderId: "MLG-OLD",
    createdAt: "2026-08-28T10:00:00.000Z",
    paymentMethod: "bizum",
    paymentStatus: "pending",
    status: "nuevo",
    paymentExpiresAt: null,
    inventoryReleasedAt: null
  };
  assert.equal(isHistoricalPendingWithoutExpiry(historical), true);
  const described = describePendingReservation(historical, now);
  assert.equal(described.orderId, "MLG-OLD");
  assert.equal(described.holdsInventory, true);
  assert.equal(described.ageMinutes, 3 * 24 * 60 + 5 * 60);
  assert.equal(isHistoricalPendingWithoutExpiry({
    ...historical,
    paymentExpiresAt: "2026-08-28T12:00:00.000Z"
  }), false);
  assert.equal(isHistoricalPendingWithoutExpiry({
    ...historical,
    paymentMethod: "cash",
    payment: { method: "cash", status: "pending" }
  }), false);
});

test("J: diagnóstico y script no alteran pedidos", () => {
  const script = read("scripts/diagnose-pending-payment-reservations.js");
  const service = read("src/services/pending-payment-reservation-diagnosis.service.js");
  const packageJson = read("package.json");
  assert.match(packageJson, /diagnose:pending-payment-reservations/);
  assert.match(script, /diagnose-only/);
  assert.doesNotMatch(script, /updateOne|updateMany|findOneAndUpdate|deleteOne|deleteMany|bulkWrite/);
  assert.doesNotMatch(service, /updateOne|updateMany|findOneAndUpdate|deleteOne|deleteMany|bulkWrite/);
  assert.equal(paymentExpiresAtForOrder("bizum", "2026-08-28T10:00:00.000Z"), "2026-08-28T12:00:00.000Z");
});

test("el sweep registra expirados y no aborta por un pedido defectuoso", () => {
  const job = read("src/services/order-expiration.job.js");
  const controller = read("src/controllers/orders.controller.js");
  assert.match(job, /order\.payment_reservation\.sweep_completed/);
  assert.match(job, /candidates: candidates\.length/);
  assert.match(job, /expired: expired\.length/);
  assert.match(job, /expire_failed/);
  assert.match(controller, /paymentExpiresAtForOrder/);
});
