import { DELIVERY_DISTANCE_TIERS, MAX_DELIVERY_DISTANCE_KM } from "../config/delivery-pricing.config.js";

const money = (value) => Number(Number(value).toFixed(2));

export function calculateDeliveryPricing(distanceKm, subtotal) {
  const normalizedDistance = Number(distanceKm);
  const normalizedSubtotal = money(Math.max(0, Number(subtotal) || 0));

  if (!Number.isFinite(normalizedDistance) || normalizedDistance < 0) {
    throw new TypeError("distanceKm must be a non-negative number");
  }

  if (normalizedDistance > MAX_DELIVERY_DISTANCE_KM) {
    return {
      available: false,
      reason: "OUTSIDE_DELIVERY_AREA",
      distanceKm: money(normalizedDistance),
      subtotal: normalizedSubtotal,
      message: "Esta dirección está fuera de nuestra zona de entrega estándar. Contacta con MIXSABOR para consultar disponibilidad."
    };
  }

  const tier = DELIVERY_DISTANCE_TIERS.find((candidate) => normalizedDistance <= candidate.maxKm);
  if (!tier) throw new TypeError("No delivery tier found for distance");

  const amountMissingForMinimum = money(Math.max(0, tier.minimumOrder - normalizedSubtotal));
  if (amountMissingForMinimum > 0) {
    return {
      available: false,
      reason: "MINIMUM_ORDER_NOT_REACHED",
      distanceKm: money(normalizedDistance),
      minimumOrder: tier.minimumOrder,
      subtotal: normalizedSubtotal,
      amountMissingForMinimum,
      zone: tier.zone,
      message: `Pedido mínimo para esta dirección: ${tier.minimumOrder.toFixed(2)} €. Te faltan ${amountMissingForMinimum.toFixed(2)} € para habilitar la entrega.`
    };
  }

  const discount = tier.feeBreaks?.find((candidate) => normalizedSubtotal >= candidate.minSubtotal);
  const deliveryFee = money(discount?.fee ?? tier.deliveryFee);
  return {
    available: true,
    distanceKm: money(normalizedDistance),
    deliveryFee,
    minimumOrder: tier.minimumOrder,
    subtotal: normalizedSubtotal,
    amountMissingForMinimum: 0,
    zone: tier.zone,
    message: `Entrega a domicilio · ${money(normalizedDistance).toLocaleString("es-ES")} km · ${deliveryFee.toFixed(2)} €`
  };
}
