import { readFileSync } from "node:fs";

const ORDER_RULES = JSON.parse(
  readFileSync(new URL("./order-rules.json", import.meta.url), "utf8")
);

export const DELIVERY_RULES = {
  originPostalCode: "28922",
  timeZone: ORDER_RULES.timeZone,
  sameDayDelivery: ORDER_RULES.sameDayDelivery,
  advanceNoticeHours: ORDER_RULES.advanceNoticeHours,
  personalizedAdvanceNoticeHours: ORDER_RULES.personalizedAdvanceNoticeHours,
  closedWeekdays: ORDER_RULES.closedWeekdays,
  slots: ORDER_RULES.slots,
  cashAllowedForAdvancePaymentOrders: false,
  paymentReservationMinutes: Number(ORDER_RULES.paymentReservationMinutes) || 120,
  notes:
    "Los pedidos personalizados o bajo encargo pueden requerir pago anticipado y confirmación previa de disponibilidad."
};

export function normalizePostalCode(value) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 5);
}
