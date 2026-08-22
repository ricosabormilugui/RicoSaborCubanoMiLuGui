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
  notes:
    "Los pedidos personalizados o bajo encargo pueden requerir pago anticipado y confirmación previa de disponibilidad."
};

export const SHIPPING_ZONES = [
  { id: "alcorcon", name: "Alcorcón", postalCodes: ["28921", "28922", "28923", "28924", "28925"], cost: 2.9, minimumOrder: 12, freeShippingFrom: 40, description: "Zona local. Reparto cercano desde Alcorcón." },
  { id: "sur-oeste-cercano", name: "Sur-oeste cercano", postalCodes: ["28931", "28932", "28933", "28934", "28935", "28911", "28912", "28913", "28914", "28915"], cost: 4.9, minimumOrder: 18, freeShippingFrom: 55, description: "Municipios cercanos con reparto viable desde Alcorcón." },
  { id: "zona-sur-madrid", name: "Zona sur de Madrid", postalCodes: ["28901", "28902", "28903", "28904", "28905", "28906", "28907", "28941", "28942", "28943", "28944", "28945", "28946", "28947"], cost: 5.9, minimumOrder: 25, freeShippingFrom: 70, description: "Reparto en zona sur con coste medio por desplazamiento." },
  { id: "parla-pinto", name: "Parla / Pinto", postalCodes: ["28981", "28982", "28320"], cost: 6.9, minimumOrder: 30, freeShippingFrom: 85, description: "Zona sur ampliada con reparto bajo planificación." },
  { id: "madrid-suroeste-capital", name: "Madrid capital suroeste", postalCodes: ["28011", "28024", "28025", "28026", "28044", "28047", "28054"], cost: 6.9, minimumOrder: 30, freeShippingFrom: 85, description: "Barrios de Madrid capital relativamente cercanos a Alcorcón." },
  { id: "madrid-capital-resto", name: "Madrid capital resto", postalCodes: ["28001", "28002", "28003", "28004", "28005", "28006", "28007", "28008", "28009", "28010", "28012", "28013", "28014", "28015", "28016", "28017", "28018", "28019", "28020", "28021", "28022", "28023", "28027", "28028", "28029", "28030", "28031", "28032", "28033", "28034", "28035", "28036", "28037", "28038", "28039", "28040", "28041", "28042", "28043", "28045", "28046", "28048", "28049", "28050", "28051", "28052", "28053", "28055"], cost: 8.9, minimumOrder: 35, freeShippingFrom: 100, description: "Madrid capital fuera de la zona suroeste cercana." }
];

export function normalizePostalCode(value) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 5);
}

export function findShippingZone(postalCode) {
  const normalized = normalizePostalCode(postalCode);
  return SHIPPING_ZONES.find((zone) => zone.postalCodes.includes(normalized));
}

export function calculateShippingQuote(deliveryType, postalCode, subtotal) {
  if (deliveryType === "pickup") {
    return { deliveryType, cost: 0, freeShippingApplied: true, available: true, message: "Recogida en Alcorcón sin coste de envío." };
  }
  const normalizedPostalCode = normalizePostalCode(postalCode);
  if (normalizedPostalCode.length !== 5) {
    return { deliveryType, postalCode: normalizedPostalCode, cost: 0, freeShippingApplied: false, available: false, message: "Introduce un código postal válido de 5 dígitos para calcular el envío." };
  }
  const zone = findShippingZone(normalizedPostalCode);
  if (!zone) {
    return { deliveryType, postalCode: normalizedPostalCode, cost: 0, freeShippingApplied: false, available: false, message: "Todavía no repartimos en ese código postal. Elige recogida en Alcorcón o contacta con nosotros." };
  }
  if (zone.minimumOrder && subtotal < zone.minimumOrder) {
    return { deliveryType, postalCode: normalizedPostalCode, zoneId: zone.id, zoneName: zone.name, cost: zone.cost, minimumOrder: zone.minimumOrder, freeShippingFrom: zone.freeShippingFrom, freeShippingApplied: false, available: false, message: `Pedido mínimo para ${zone.name}: ${zone.minimumOrder.toFixed(2)} €.` };
  }
  const freeShippingApplied = Boolean(zone.freeShippingFrom && subtotal >= zone.freeShippingFrom);
  const cost = freeShippingApplied ? 0 : zone.cost;
  return { deliveryType, postalCode: normalizedPostalCode, zoneId: zone.id, zoneName: zone.name, cost, minimumOrder: zone.minimumOrder, freeShippingFrom: zone.freeShippingFrom, freeShippingApplied, available: true, message: freeShippingApplied ? `Envío gratis aplicado en ${zone.name}.` : `Envío a ${zone.name}: ${zone.cost.toFixed(2)} €${zone.freeShippingFrom ? ` · gratis desde ${zone.freeShippingFrom.toFixed(2)} €` : ""}.` };
}
