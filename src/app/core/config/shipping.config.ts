import type { DeliveryType } from '../models/order.model';
import orderRules from '../../../../Backend/src/config/order-rules.json';

export type DeliveryRules = {
  originPostalCode: string;
  timeZone: string;
  sameDayDelivery: boolean;
  advanceNoticeHours: number;
  personalizedAdvanceNoticeHours: number;
  closedWeekdays: number[];
  slots: Record<DeliveryType, readonly string[]>;
  cashAllowedForAdvancePaymentOrders: boolean;
  paymentReservationMinutes: number;
  notes: string;
};

export const DELIVERY_RULES: DeliveryRules = {
  originPostalCode: '28922',
  timeZone: orderRules.timeZone,
  sameDayDelivery: orderRules.sameDayDelivery,
  advanceNoticeHours: orderRules.advanceNoticeHours,
  personalizedAdvanceNoticeHours: orderRules.personalizedAdvanceNoticeHours,
  closedWeekdays: orderRules.closedWeekdays,
  slots: orderRules.slots,
  cashAllowedForAdvancePaymentOrders: false,
  paymentReservationMinutes: Number(orderRules.paymentReservationMinutes) || 120,
  notes: 'Los pedidos personalizados o bajo encargo pueden requerir pago anticipado y confirmación previa de disponibilidad.'
};

type DateParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

export type FulfillmentValidation =
  | { valid: true; fulfillmentAt: Date }
  | { valid: false; error: 'invalid-date' | 'closed-day' | 'invalid-slot' | 'insufficient-notice'; message: string };

export type FulfillmentRuleOptions = {
  closedWeekdays?: readonly number[];
};

function getZonedParts(value: Date, timeZone: string): DateParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(value);
  const numberPart = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: numberPart('year'),
    month: numberPart('month'),
    day: numberPart('day'),
    hour: numberPart('hour'),
    minute: numberPart('minute'),
    second: numberPart('second')
  };
}

function parseDateOnly(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return { year, month, day };
}

function zonedDateTimeToInstant(date: { year: number; month: number; day: number }, hour: number, minute: number): Date {
  const intendedUtc = Date.UTC(date.year, date.month - 1, date.day, hour, minute, 0);
  let instant = new Date(intendedUtc);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const actual = getZonedParts(instant, DELIVERY_RULES.timeZone);
    const representedUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    instant = new Date(instant.getTime() + intendedUtc - representedUtc);
  }
  return instant;
}

function calendarWeekday(date: { year: number; month: number; day: number }): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

function closedWeekdaysFrom(options?: FulfillmentRuleOptions): readonly number[] {
  return options?.closedWeekdays ?? DELIVERY_RULES.closedWeekdays;
}

export function noticeHoursMessage(hours: number): string {
  return `Necesitamos al menos ${hours} horas para preparar tu pedido.`;
}

export function instantInBusinessTimezone(dateOnly: string, hour: number, minute: number): Date | null {
  const parsed = parseDateOnly(dateOnly);
  if (!parsed) return null;
  return zonedDateTimeToInstant(parsed, hour, minute);
}

export function getSlotsForDeliveryType(deliveryType: DeliveryType | null | undefined): readonly string[] {
  if (deliveryType !== 'delivery' && deliveryType !== 'pickup') return [];
  return DELIVERY_RULES.slots[deliveryType] ?? [];
}

export function parseDeliverySlotStart(deliverySlot: string | null | undefined): { hour: number; minute: number } | null {
  const raw = String(deliverySlot ?? '').trim();
  if (!raw) return null;
  const match = /^(\d{2}):(\d{2})-/.exec(raw);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export function isClosedFulfillmentDate(deliveryDate: string, options?: FulfillmentRuleOptions): boolean {
  const parsedDate = parseDateOnly(deliveryDate);
  if (!parsedDate) return false;
  return closedWeekdaysFrom(options).includes(calendarWeekday(parsedDate));
}

export function validateFulfillmentSelection(
  deliveryDate: string,
  deliverySlot: string | null | undefined,
  deliveryType: DeliveryType,
  advanceNoticeHours: number,
  now = new Date(),
  options?: FulfillmentRuleOptions
): FulfillmentValidation {
  const parsedDate = parseDateOnly(deliveryDate);
  if (!parsedDate) return { valid: false, error: 'invalid-date', message: 'Selecciona una fecha válida.' };
  if (isClosedFulfillmentDate(deliveryDate, options)) {
    return { valid: false, error: 'closed-day', message: 'Esta fecha ya no está disponible. Elige otra fecha.' };
  }
  const selectedSlot = String(deliverySlot ?? '').trim();
  if (!selectedSlot) {
    return { valid: false, error: 'invalid-slot', message: 'Selecciona una franja horaria.' };
  }
  if (!getSlotsForDeliveryType(deliveryType).includes(selectedSlot)) {
    return { valid: false, error: 'invalid-slot', message: 'La franja no está disponible para el tipo de entrega seleccionado.' };
  }
  const slotStart = parseDeliverySlotStart(selectedSlot);
  if (!slotStart) return { valid: false, error: 'invalid-slot', message: 'La franja horaria no es válida.' };
  const fulfillmentAt = zonedDateTimeToInstant(parsedDate, slotStart.hour, slotStart.minute);
  const earliestAllowed = now.getTime() + advanceNoticeHours * 60 * 60 * 1000;
  if (fulfillmentAt.getTime() < earliestAllowed) {
    return { valid: false, error: 'insufficient-notice', message: noticeHoursMessage(advanceNoticeHours) };
  }
  return { valid: true, fulfillmentAt };
}

export function getValidSlotsForDate(
  deliveryDate: string,
  deliveryType: DeliveryType,
  advanceNoticeHours: number,
  now = new Date(),
  options?: FulfillmentRuleOptions
): string[] {
  return getSlotsForDeliveryType(deliveryType).filter((slot) =>
    validateFulfillmentSelection(deliveryDate, slot, deliveryType, advanceNoticeHours, now, options).valid
  );
}

export function isFulfillmentDateAvailable(
  deliveryDate: string,
  deliveryType: DeliveryType,
  advanceNoticeHours: number,
  now = new Date(),
  options?: FulfillmentRuleOptions
): boolean {
  return getValidSlotsForDate(deliveryDate, deliveryType, advanceNoticeHours, now, options).length > 0;
}

export function explainUnavailableDate(
  deliveryDate: string,
  deliveryType: DeliveryType,
  advanceNoticeHours: number,
  now = new Date(),
  options?: FulfillmentRuleOptions
): string {
  if (isClosedFulfillmentDate(deliveryDate, options)) return 'Esta fecha ya no está disponible. Elige otra fecha.';
  if (getSlotsForDeliveryType(deliveryType).length && !isFulfillmentDateAvailable(deliveryDate, deliveryType, advanceNoticeHours, now, options)) {
    return noticeHoursMessage(advanceNoticeHours);
  }
  return 'No quedan horarios disponibles para este día.';
}

export function reconcileFulfillmentSelection(
  deliveryDate: string,
  deliverySlot: string | null | undefined,
  deliveryType: DeliveryType,
  advanceNoticeHours: number,
  now = new Date(),
  options?: FulfillmentRuleOptions
): { date: string; slot: string } {
  if (!deliveryDate) return { date: '', slot: '' };
  const validSlots = getValidSlotsForDate(deliveryDate, deliveryType, advanceNoticeHours, now, options);
  if (!validSlots.length) return { date: '', slot: '' };
  const selectedSlot = String(deliverySlot ?? '').trim();
  if (selectedSlot && validSlots.includes(selectedSlot)) return { date: deliveryDate, slot: selectedSlot };
  return { date: deliveryDate, slot: validSlots.length === 1 ? validSlots[0] : '' };
}

export function getMinimumFulfillmentDate(
  deliveryType: DeliveryType,
  advanceNoticeHours: number,
  now = new Date(),
  options?: FulfillmentRuleOptions
): string {
  const madridToday = getZonedParts(now, DELIVERY_RULES.timeZone);
  for (let offset = 0; offset <= 60; offset += 1) {
    const candidate = new Date(Date.UTC(madridToday.year, madridToday.month - 1, madridToday.day + offset));
    const date = `${candidate.getUTCFullYear()}-${String(candidate.getUTCMonth() + 1).padStart(2, '0')}-${String(candidate.getUTCDate()).padStart(2, '0')}`;
    if (isFulfillmentDateAvailable(date, deliveryType, advanceNoticeHours, now, options)) return date;
  }
  return '';
}

export function getMaximumFulfillmentDate(now = new Date()): string {
  const madridToday = getZonedParts(now, DELIVERY_RULES.timeZone);
  const candidate = new Date(Date.UTC(madridToday.year, madridToday.month - 1, madridToday.day + 60));
  return `${candidate.getUTCFullYear()}-${String(candidate.getUTCMonth() + 1).padStart(2, '0')}-${String(candidate.getUTCDate()).padStart(2, '0')}`;
}

export function normalizePostalCode(value: string | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '').slice(0, 5);
}

export function formatPaymentDeadline(value: string | Date | null | undefined, timeZone = DELIVERY_RULES.timeZone): string {
  if (value == null) return '';
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return '';
  const date = instant.toLocaleDateString('es-ES', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const time = instant.toLocaleTimeString('es-ES', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });
  return `${date} · ${time}`;
}

export function formatPaymentDeadlineTime(value: string | Date | null | undefined, timeZone = DELIVERY_RULES.timeZone): string {
  if (value == null) return '';
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return '';
  return instant.toLocaleTimeString('es-ES', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });
}
