export const SHIPPING_ZONES = [
  {
    id: "malaga-centro",
    name: "Málaga centro",
    postalCodes: ["29001", "29002", "29005", "29007", "29008", "29009", "29012", "29013", "29015", "29016"],
    cost: 3.5,
    minimumOrder: 12,
    freeShippingFrom: 45,
    description: "Reparto urbano cercano."
  },
  {
    id: "malaga-capital",
    name: "Málaga capital",
    postalCodes: ["29003", "29004", "29006", "29010", "29011", "29014", "29017", "29018"],
    cost: 4.9,
    minimumOrder: 18,
    freeShippingFrom: 60,
    description: "Resto de códigos postales principales de Málaga capital."
  },
  {
    id: "area-metropolitana",
    name: "Área metropolitana",
    postalCodes: ["29190", "29191", "29192", "29590", "29720"],
    cost: 6.5,
    minimumOrder: 25,
    freeShippingFrom: 80,
    description: "Primera configuración para zonas cercanas. Ajustar antes de producción."
  }
];

export function normalizePostalCode(value) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 5);
}

export function findShippingZone(postalCode) {
  return SHIPPING_ZONES.find((zone) => zone.postalCodes.includes(postalCode));
}

export function calculateShippingQuote(deliveryType, postalCode, subtotal) {
  if (deliveryType === "pickup") {
    return {
      deliveryType,
      cost: 0,
      freeShippingApplied: true,
      available: true,
      message: "Recogida en local sin coste de envío."
    };
  }

  const normalizedPostalCode = normalizePostalCode(postalCode);
  if (normalizedPostalCode.length !== 5) {
    return {
      deliveryType,
      postalCode: normalizedPostalCode,
      cost: 0,
      freeShippingApplied: false,
      available: false,
      message: "Introduce un código postal válido de 5 dígitos para calcular el envío."
    };
  }

  const zone = findShippingZone(normalizedPostalCode);
  if (!zone) {
    return {
      deliveryType,
      postalCode: normalizedPostalCode,
      cost: 0,
      freeShippingApplied: false,
      available: false,
      message: "Todavía no repartimos en ese código postal. Elige recogida o contacta con nosotros."
    };
  }

  if (zone.minimumOrder && subtotal < zone.minimumOrder) {
    return {
      deliveryType,
      postalCode: normalizedPostalCode,
      zoneId: zone.id,
      zoneName: zone.name,
      cost: zone.cost,
      minimumOrder: zone.minimumOrder,
      freeShippingFrom: zone.freeShippingFrom,
      freeShippingApplied: false,
      available: false,
      message: `Pedido mínimo para ${zone.name}: ${zone.minimumOrder.toFixed(2)} €.`
    };
  }

  const freeShippingApplied = Boolean(zone.freeShippingFrom && subtotal >= zone.freeShippingFrom);
  const cost = freeShippingApplied ? 0 : zone.cost;

  return {
    deliveryType,
    postalCode: normalizedPostalCode,
    zoneId: zone.id,
    zoneName: zone.name,
    cost,
    minimumOrder: zone.minimumOrder,
    freeShippingFrom: zone.freeShippingFrom,
    freeShippingApplied,
    available: true,
    message: freeShippingApplied
      ? `Envío gratis aplicado en ${zone.name}.`
      : `Envío a ${zone.name}: ${zone.cost.toFixed(2)} €${zone.freeShippingFrom ? ` · gratis desde ${zone.freeShippingFrom.toFixed(2)} €` : ""}.`
  };
}
