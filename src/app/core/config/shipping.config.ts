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
  notes: string;
};

export type ShippingZone = {
  id: string;
  name: string;
  postalCodes: string[];
  cost: number;
  minimumOrder: number;
  freeShippingFrom: number;
  description: string;
};

export type ShippingQuote = {
  deliveryType: DeliveryType;
  postalCode?: string;
  zoneId?: string;
  zoneName?: string;
  cost: number;
  minimumOrder?: number;
  freeShippingFrom?: number;
  freeShippingApplied: boolean;
  available: boolean;
  message: string;
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
  notes: 'Los pedidos personalizados o bajo encargo pueden requerir pago anticipado y confirmación previa de disponibilidad.'
};

type DateParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

export type FulfillmentValidation =
  | { valid: true; fulfillmentAt: Date }
  | { valid: false; error: 'invalid-date' | 'closed-day' | 'invalid-slot' | 'same-day' | 'insufficient-notice'; message: string };

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

function formatDateOnly(date: Date): string {
  const parts = getZonedParts(date, DELIVERY_RULES.timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function getSlotsForDeliveryType(deliveryType: DeliveryType): readonly string[] {
  return DELIVERY_RULES.slots[deliveryType];
}

export function validateFulfillmentSelection(
  deliveryDate: string,
  deliverySlot: string,
  deliveryType: DeliveryType,
  advanceNoticeHours: number,
  now = new Date()
): FulfillmentValidation {
  const parsedDate = parseDateOnly(deliveryDate);
  if (!parsedDate) return { valid: false, error: 'invalid-date', message: 'Selecciona una fecha válida.' };
  if (DELIVERY_RULES.closedWeekdays.includes(new Date(Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day)).getUTCDay())) {
    return { valid: false, error: 'closed-day', message: 'No hay servicio en la fecha seleccionada.' };
  }
  if (!getSlotsForDeliveryType(deliveryType).includes(deliverySlot)) {
    return { valid: false, error: 'invalid-slot', message: 'La franja no está disponible para el tipo de entrega seleccionado.' };
  }
  const slotStart = /^(\d{2}):(\d{2})-/.exec(deliverySlot);
  if (!slotStart) return { valid: false, error: 'invalid-slot', message: 'La franja horaria no es válida.' };
  const fulfillmentAt = zonedDateTimeToInstant(parsedDate, Number(slotStart[1]), Number(slotStart[2]));
  const todayInMadrid = formatDateOnly(now);
  if (!DELIVERY_RULES.sameDayDelivery && deliveryDate <= todayInMadrid) {
    return { valid: false, error: 'same-day', message: 'Los pedidos para el mismo día no están disponibles.' };
  }
  const minimumAt = now.getTime() + advanceNoticeHours * 60 * 60 * 1000;
  if (fulfillmentAt.getTime() < minimumAt) {
    return { valid: false, error: 'insufficient-notice', message: `El pedido requiere al menos ${advanceNoticeHours} horas completas de antelación.` };
  }
  return { valid: true, fulfillmentAt };
}

export function getMinimumFulfillmentDate(deliveryType: DeliveryType, advanceNoticeHours: number, now = new Date()): string {
  const madridToday = getZonedParts(now, DELIVERY_RULES.timeZone);
  for (let offset = 1; offset <= 60; offset += 1) {
    const candidate = new Date(Date.UTC(madridToday.year, madridToday.month - 1, madridToday.day + offset));
    const date = `${candidate.getUTCFullYear()}-${String(candidate.getUTCMonth() + 1).padStart(2, '0')}-${String(candidate.getUTCDate()).padStart(2, '0')}`;
    if (getSlotsForDeliveryType(deliveryType).some((slot) => validateFulfillmentSelection(date, slot, deliveryType, advanceNoticeHours, now).valid)) return date;
  }
  return '';
}

export const SHIPPING_ZONES: ShippingZone[] = [
  { id: 'alcorcon', name: 'Alcorcón', postalCodes: ['28921', '28922', '28923', '28924', '28925'], cost: 2.9, minimumOrder: 12, freeShippingFrom: 40, description: 'Zona local. Reparto cercano desde Alcorcón.' },
  { id: 'sur-oeste-cercano', name: 'Sur-oeste cercano', postalCodes: ['28931', '28932', '28933', '28934', '28935', '28911', '28912', '28913', '28914', '28915'], cost: 4.9, minimumOrder: 18, freeShippingFrom: 55, description: 'Municipios cercanos con reparto viable desde Alcorcón.' },
  { id: 'zona-sur-madrid', name: 'Zona sur de Madrid', postalCodes: ['28901', '28902', '28903', '28904', '28905', '28906', '28907', '28941', '28942', '28943', '28944', '28945', '28946', '28947'], cost: 5.9, minimumOrder: 25, freeShippingFrom: 70, description: 'Reparto en zona sur con coste medio por desplazamiento.' },
  { id: 'parla-pinto', name: 'Parla / Pinto', postalCodes: ['28981', '28982', '28320'], cost: 6.9, minimumOrder: 30, freeShippingFrom: 85, description: 'Zona sur ampliada con reparto bajo planificación.' },
  { id: 'madrid-suroeste-capital', name: 'Madrid capital suroeste', postalCodes: ['28011', '28024', '28025', '28026', '28044', '28047', '28054'], cost: 6.9, minimumOrder: 30, freeShippingFrom: 85, description: 'Barrios de Madrid capital relativamente cercanos a Alcorcón.' },
  { id: 'madrid-capital-resto', name: 'Madrid capital resto', postalCodes: ['28001', '28002', '28003', '28004', '28005', '28006', '28007', '28008', '28009', '28010', '28012', '28013', '28014', '28015', '28016', '28017', '28018', '28019', '28020', '28021', '28022', '28023', '28027', '28028', '28029', '28030', '28031', '28032', '28033', '28034', '28035', '28036', '28037', '28038', '28039', '28040', '28041', '28042', '28043', '28045', '28046', '28048', '28049', '28050', '28051', '28052', '28053', '28055'], cost: 8.9, minimumOrder: 35, freeShippingFrom: 100, description: 'Madrid capital fuera de la zona suroeste cercana.' }
];

export function normalizePostalCode(value: string | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '').slice(0, 5);
}

export function findShippingZone(postalCode: string | null | undefined): ShippingZone | undefined {
  const normalized = normalizePostalCode(postalCode);
  return SHIPPING_ZONES.find((zone) => zone.postalCodes.includes(normalized));
}

export function calculateShippingQuote(deliveryType: DeliveryType, postalCode: string | null | undefined, subtotal: number): ShippingQuote {
  if (deliveryType === 'pickup') {
    return { deliveryType, cost: 0, freeShippingApplied: true, available: true, message: 'Recogida en Alcorcón sin coste de envío.' };
  }

  const normalizedPostalCode = normalizePostalCode(postalCode);
  if (normalizedPostalCode.length !== 5) {
    return { deliveryType, postalCode: normalizedPostalCode, cost: 0, freeShippingApplied: false, available: false, message: 'Introduce un código postal válido de 5 dígitos para calcular el envío.' };
  }

  const zone = findShippingZone(normalizedPostalCode);
  if (!zone) {
    return { deliveryType, postalCode: normalizedPostalCode, cost: 0, freeShippingApplied: false, available: false, message: 'Todavía no repartimos en ese código postal. Elige recogida en Alcorcón o contacta con nosotros.' };
  }

  if (zone.minimumOrder && subtotal < zone.minimumOrder) {
    return { deliveryType, postalCode: normalizedPostalCode, zoneId: zone.id, zoneName: zone.name, cost: zone.cost, minimumOrder: zone.minimumOrder, freeShippingFrom: zone.freeShippingFrom, freeShippingApplied: false, available: false, message: `Pedido mínimo para ${zone.name}: ${zone.minimumOrder.toFixed(2)} €.` };
  }

  const freeShippingApplied = Boolean(zone.freeShippingFrom && subtotal >= zone.freeShippingFrom);
  const cost = freeShippingApplied ? 0 : zone.cost;
  return { deliveryType, postalCode: normalizedPostalCode, zoneId: zone.id, zoneName: zone.name, cost, minimumOrder: zone.minimumOrder, freeShippingFrom: zone.freeShippingFrom, freeShippingApplied, available: true, message: freeShippingApplied ? `Envío gratis aplicado en ${zone.name}.` : `Envío a ${zone.name}: ${zone.cost.toFixed(2)} €${zone.freeShippingFrom ? ` · gratis desde ${zone.freeShippingFrom.toFixed(2)} €` : ''}.` };
}
