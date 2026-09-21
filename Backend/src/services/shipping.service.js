import { DELIVERY_ORIGIN_ADDRESS } from "../config/delivery-pricing.config.js";
import { calculateDeliveryPricing } from "./delivery-pricing.service.js";
import { getDeliveryDistanceKm } from "./delivery-routing.service.js";

export function buildDeliveryAddress({ address, postalCode } = {}) {
  const street = String(address ?? "").trim();
  const postal = String(postalCode ?? "").replace(/\D/g, "").slice(0, 5);
  if (street.length < 5 || postal.length !== 5) return "";
  const locality = ["28921", "28922", "28923", "28924", "28925"].includes(postal) ? "Alcorcón" : "";
  return [street, postal, locality, "Madrid", "España"].filter(Boolean).join(", ");
}

function splitStreetAndNumber(address) {
  const value = String(address ?? "").trim();
  const match = /^(.*?)(?:,?\s+(\d+[a-zA-Z]?))\s*$/.exec(value);
  return match ? { street: match[1].trim(), houseNumber: match[2] } : { street: value, houseNumber: "" };
}

export function buildDeliveryGeocodeQuery({ address, postalCode } = {}) {
  const text = buildDeliveryAddress({ address, postalCode });
  if (!text) return null;
  const postal = String(postalCode).replace(/\D/g, "").slice(0, 5);
  const { street, houseNumber } = splitStreetAndNumber(address);
  return {
    text,
    street,
    houseNumber,
    postalCode: postal,
    locality: ["28921", "28922", "28923", "28924", "28925"].includes(postal) ? "Alcorcón" : "",
    region: "Madrid",
    country: "España"
  };
}

export async function calculateShippingQuote({ deliveryType = "delivery", address, postalCode, subtotal }, {
  distanceProvider = getDeliveryDistanceKm
} = {}) {
  const normalizedSubtotal = Number(Number(subtotal ?? 0).toFixed(2));
  if (deliveryType === "pickup") {
    return { available: true, deliveryType, distanceKm: 0, deliveryFee: 0, minimumOrder: 0, subtotal: normalizedSubtotal, amountMissingForMinimum: 0, zone: "pickup", message: "Recogida en Alcorcón sin coste de envío." };
  }
  const geocodeQuery = buildDeliveryGeocodeQuery({ address, postalCode });
  if (!geocodeQuery) {
    return { available: false, reason: "INVALID_ADDRESS", subtotal: normalizedSubtotal, message: "Introduce una dirección y un código postal válidos para calcular la entrega." };
  }
  const originQuery = {
    text: DELIVERY_ORIGIN_ADDRESS,
    street: "Paseo Miguel de Cervantes",
    houseNumber: "2",
    postalCode: "28922",
    locality: "Alcorcón",
    region: "Madrid",
    country: "España"
  };
  const distanceKm = await distanceProvider(originQuery, geocodeQuery);
  return { deliveryType, deliveryAddress: geocodeQuery.text, ...calculateDeliveryPricing(distanceKm, normalizedSubtotal) };
}
