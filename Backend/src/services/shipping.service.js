import { DELIVERY_ORIGIN_ADDRESS } from "../config/delivery-pricing.config.js";
import { calculateDeliveryPricing } from "./delivery-pricing.service.js";
import { getDeliveryDistanceKm } from "./delivery-routing.service.js";

const ALCORCON_POSTAL_CODES = new Set(["28921", "28922", "28923", "28924", "28925"]);

function normalizeDeliveryLocation({ postalCode, city, locality, province, region, country } = {}) {
  const postal = String(postalCode ?? "").replace(/\D/g, "").slice(0, 5);
  return {
    postal,
    locality: String(city ?? locality ?? (ALCORCON_POSTAL_CODES.has(postal) ? "Alcorcón" : "")).trim(),
    region: String(province ?? region ?? "Madrid").trim(),
    country: String(country ?? "España").trim() || "España"
  };
}

function locationParts(locality, region, country) {
  const values = [locality, region, country].filter(Boolean);
  return values.filter((value, index) => values.findIndex((candidate) => candidate.localeCompare(value, "es", { sensitivity: "base" }) === 0) === index);
}

export function buildDeliveryAddress(input = {}) {
  const { address } = input;
  const street = String(address ?? "").trim();
  const { postal, locality, region, country } = normalizeDeliveryLocation(input);
  if (street.length < 5 || postal.length !== 5) return "";
  return [street, postal, ...locationParts(locality, region, country)].filter(Boolean).join(", ");
}

export function splitStreetAndNumber(address) {
  const value = String(address ?? "").trim();
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  const primary = parts.length > 1 && /^\d+[a-zA-Z]?$/.test(parts[1])
    ? `${parts[0]} ${parts[1]}`
    : (parts[0] ?? value);
  const match = /^(.*\D)\s+(\d+[a-zA-Z]?)$/.exec(primary);
  return match ? { street: match[1].trim(), houseNumber: match[2] } : { street: value, houseNumber: "" };
}

export function buildDeliveryGeocodeQuery(input = {}) {
  const { address } = input;
  if (!buildDeliveryAddress(input)) return null;
  const { postal, locality, region, country } = normalizeDeliveryLocation(input);
  const { street, houseNumber } = splitStreetAndNumber(address);
  const primaryAddress = [street, houseNumber].filter(Boolean).join(" ");
  return {
    text: [primaryAddress, postal, ...locationParts(locality, region, country)].filter(Boolean).join(", "),
    street,
    houseNumber,
    postalCode: postal,
    locality,
    region,
    country
  };
}

export async function calculateShippingQuote({ deliveryType = "delivery", address, postalCode, city, locality, province, region, country, subtotal }, {
  distanceProvider = getDeliveryDistanceKm
} = {}) {
  const normalizedSubtotal = Number(Number(subtotal ?? 0).toFixed(2));
  if (deliveryType === "pickup") {
    return { available: true, deliveryType, distanceKm: 0, deliveryFee: 0, minimumOrder: 0, subtotal: normalizedSubtotal, amountMissingForMinimum: 0, zone: "pickup", message: "Recogida en Alcorcón sin coste de envío." };
  }
  const deliveryInput = { address, postalCode, city, locality, province, region, country };
  const geocodeQuery = buildDeliveryGeocodeQuery(deliveryInput);
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
  return { deliveryType, deliveryAddress: buildDeliveryAddress(deliveryInput), ...calculateDeliveryPricing(distanceKm, normalizedSubtotal) };
}
