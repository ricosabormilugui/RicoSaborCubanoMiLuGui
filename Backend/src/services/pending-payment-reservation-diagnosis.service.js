import { VOID_ORDER_STATUSES } from "./order-inventory.service.js";
import { requiresPaymentDeadline } from "./order-payment-reservation.service.js";

function paymentStatusOf(order) {
  return order?.payment?.status ?? order?.paymentStatus ?? "pending";
}

function paymentMethodOf(order) {
  return String(order?.payment?.method ?? order?.paymentMethod ?? "").trim();
}

export function hasPaymentExpiresAt(order) {
  return typeof order?.paymentExpiresAt === "string" && order.paymentExpiresAt.trim().length > 0;
}

export function holdsInventoryReservation(order) {
  return !VOID_ORDER_STATUSES.includes(order?.status) && order?.inventoryReleasedAt == null;
}

export function isHistoricalPendingWithoutExpiry(order) {
  return paymentStatusOf(order) === "pending"
    && requiresPaymentDeadline(paymentMethodOf(order))
    && !hasPaymentExpiresAt(order);
}

export function describePendingReservation(order, now = new Date()) {
  const createdAt = order?.createdAt ?? null;
  const createdMs = createdAt ? new Date(createdAt).getTime() : NaN;
  const ageMinutes = Number.isFinite(createdMs)
    ? Math.max(0, Math.round((now.getTime() - createdMs) / 60_000))
    : null;

  return {
    orderId: order?.orderId ?? null,
    createdAt,
    paymentMethod: paymentMethodOf(order),
    paymentStatus: paymentStatusOf(order),
    status: order?.status ?? null,
    paymentExpiresAt: hasPaymentExpiresAt(order) ? order.paymentExpiresAt : null,
    holdsInventory: holdsInventoryReservation(order),
    ageMinutes
  };
}

export function historicalOrdersCollectionName() {
  return process.env.MONGODB_ORDERS_COLLECTION ?? process.env.ORDERS_COLLECTION ?? "orders";
}

export const HISTORICAL_PENDING_FILTER = {
  $and: [
    {
      $or: [
        { paymentStatus: "pending" },
        { "payment.status": "pending" }
      ]
    },
    {
      $or: [
        { paymentMethod: { $in: ["bizum", "bank_transfer"] } },
        { "payment.method": { $in: ["bizum", "bank_transfer"] } }
      ]
    },
    {
      $or: [
        { paymentExpiresAt: null },
        { paymentExpiresAt: { $exists: false } },
        { paymentExpiresAt: "" }
      ]
    }
  ]
};
