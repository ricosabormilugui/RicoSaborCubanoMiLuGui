import { DELIVERY_RULES } from "../config/shipping.config.js";

const PAYMENT_METHODS_WITH_DEADLINE = new Set(["bizum", "bank_transfer"]);

export function getPaymentReservationMinutes() {
  const minutes = Number(DELIVERY_RULES.paymentReservationMinutes);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 120;
}

export function paymentReservationMs() {
  return getPaymentReservationMinutes() * 60_000;
}

export function requiresPaymentDeadline(method) {
  return PAYMENT_METHODS_WITH_DEADLINE.has(String(method ?? "").trim());
}

export function paymentExpiresAtForOrder(method, createdAt, now = new Date()) {
  return requiresPaymentDeadline(method) ? computePaymentExpiresAt(createdAt, now) : null;
}

export function computePaymentExpiresAt(createdAt, now = new Date()) {
  const origin = createdAt ? new Date(createdAt) : now;
  const originMs = Number.isNaN(origin.getTime()) ? now.getTime() : origin.getTime();
  return new Date(originMs + paymentReservationMs()).toISOString();
}

export function isPaymentReservationExpired(order, now = new Date()) {
  if (!requiresPaymentDeadline(order?.payment?.method ?? order?.paymentMethod)) return false;
  const expiresAt = order?.paymentExpiresAt;
  if (!expiresAt) return false;
  const expires = new Date(expiresAt);
  if (Number.isNaN(expires.getTime())) return false;
  return now.getTime() >= expires.getTime();
}

export function shouldShowPaymentDeadline(order) {
  const status = order?.payment?.status ?? order?.paymentStatus ?? "pending";
  return Boolean(order?.paymentExpiresAt) && status === "pending" && requiresPaymentDeadline(order?.payment?.method ?? order?.paymentMethod);
}

export function formatPaymentDeadline(value, timeZone = DELIVERY_RULES.timeZone) {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return "";
  const date = instant.toLocaleDateString("es-ES", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  const time = instant.toLocaleTimeString("es-ES", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  return `${date} · ${time}`;
}

export function formatPaymentDeadlineTime(value, timeZone = DELIVERY_RULES.timeZone) {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return "";
  return instant.toLocaleTimeString("es-ES", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
}
