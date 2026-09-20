import { DELIVERY_ORIGIN_ADDRESS } from "../config/delivery-pricing.config.js";
import { calculateDeliveryPricing } from "./delivery-pricing.service.js";
import { getDrivingDistanceKm } from "./openrouteservice.provider.js";

export function buildDeliveryAddress({ address, postalCode } = {}) {
  const street = String(address ?? "").trim();
  const postal = String(postalCode ?? "").replace(/\D/g, "").slice(0, 5);
  if (street.length < 5 || postal.length !== 5) return "";
  return `${street}, ${postal}, España`;
}

export async function calculateShippingQuote({ deliveryType = "delivery", address, postalCode, subtotal }, {
  distanceProvider = getDrivingDistanceKm
} = {}) {
  const normalizedSubtotal = Number(Number(subtotal ?? 0).toFixed(2));
  if (deliveryType === "pickup") {
    return { available: true, deliveryType, distanceKm: 0, deliveryFee: 0, minimumOrder: 0, subtotal: normalizedSubtotal, amountMissingForMinimum: 0, zone: "pickup", message: "Recogida en Alcorcón sin coste de envío." };
  }
  const deliveryAddress = buildDeliveryAddress({ address, postalCode });
  if (!deliveryAddress) {
    return { available: false, reason: "INVALID_ADDRESS", subtotal: normalizedSubtotal, message: "Introduce una dirección y un código postal válidos para calcular la entrega." };
  }
  const distanceKm = await distanceProvider(DELIVERY_ORIGIN_ADDRESS, deliveryAddress);
  return { deliveryType, deliveryAddress, ...calculateDeliveryPricing(distanceKm, normalizedSubtotal) };
}
