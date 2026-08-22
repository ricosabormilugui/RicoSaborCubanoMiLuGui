import { DELIVERY_RULES } from "../config/shipping.config.js";

function getZonedParts(value, timeZone = DELIVERY_RULES.timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(value);
  const numberPart = (type) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: numberPart("year"),
    month: numberPart("month"),
    day: numberPart("day"),
    hour: numberPart("hour"),
    minute: numberPart("minute"),
    second: numberPart("second")
  };
}

function parseDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ""));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return { year, month, day };
}

function formatDateInTimeZone(value) {
  const parts = getZonedParts(value);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function zonedDateTimeToInstant(date, hour, minute) {
  const intendedUtc = Date.UTC(date.year, date.month - 1, date.day, hour, minute, 0);
  let instant = new Date(intendedUtc);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const actual = getZonedParts(instant);
    const representedUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    instant = new Date(instant.getTime() + intendedUtc - representedUtc);
  }
  return instant;
}

export function getSlotsForDeliveryType(deliveryType) {
  return DELIVERY_RULES.slots[deliveryType] ?? [];
}

export function validateOrderFulfillment(delivery, { advanceNoticeHours = DELIVERY_RULES.advanceNoticeHours, now = new Date() } = {}) {
  if (delivery?.type !== "delivery" && delivery?.type !== "pickup") {
    return "El tipo de entrega debe ser delivery o pickup.";
  }
  if (!delivery?.date || !delivery?.slot) {
    return "La fecha y la franja horaria son obligatorias.";
  }
  const parsedDate = parseDateOnly(delivery.date);
  if (!parsedDate) return "La fecha seleccionada no es válida.";
  if (DELIVERY_RULES.closedWeekdays.includes(new Date(Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day)).getUTCDay())) {
    return "No hay servicio en la fecha seleccionada.";
  }
  if (!getSlotsForDeliveryType(delivery.type).includes(delivery.slot)) {
    return delivery.type === "delivery"
      ? `Para entrega a domicilio la única franja válida es ${DELIVERY_RULES.slots.delivery[0]}.`
      : "La franja seleccionada no está disponible para recogida en tienda.";
  }
  const slotStart = /^(\d{2}):(\d{2})-/.exec(delivery.slot);
  if (!slotStart) return "La franja horaria no es válida.";
  if (!DELIVERY_RULES.sameDayDelivery && delivery.date <= formatDateInTimeZone(now)) {
    return "No se admiten pedidos para el mismo día.";
  }
  const fulfillmentAt = zonedDateTimeToInstant(parsedDate, Number(slotStart[1]), Number(slotStart[2]));
  if (fulfillmentAt.getTime() < now.getTime() + advanceNoticeHours * 60 * 60 * 1000) {
    return `El pedido requiere al menos ${advanceNoticeHours} horas completas de antelación.`;
  }
  return null;
}
