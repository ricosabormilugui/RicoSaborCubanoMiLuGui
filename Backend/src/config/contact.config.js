import { readFileSync } from "node:fs";
import { BRAND_CONFIG } from "./brand.config.js";
import { PRODUCTION_SITE_URL } from "./site.config.js";

export const CONTACT_CONFIG = Object.freeze(JSON.parse(
  readFileSync(new URL("../../../shared/contact.config.json", import.meta.url), "utf8")
));

export function getSalesEmail() {
  return String(CONTACT_CONFIG.salesEmail ?? "").trim();
}

export function getSalesReplyTo() {
  return getSalesEmail() || undefined;
}

export function getWhatsAppPhone() {
  return String(CONTACT_CONFIG.whatsappPhone ?? "").replace(/\D/g, "");
}

export function getPublicWebUrl() {
  return PRODUCTION_SITE_URL;
}

export function buildSalesMailtoUrl(orderId) {
  const email = getSalesEmail();
  if (!email) return "";
  const id = String(orderId ?? "").trim();
  const subject = id
    ? `Consulta sobre mi pedido ${id}`
    : `Consulta a ${BRAND_CONFIG.name}`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}

export function buildWhatsAppUrl(message) {
  const phone = getWhatsAppPhone();
  if (!phone) return "";
  const text = String(message ?? "").trim();
  return `https://wa.me/${phone}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function buildOrderWhatsAppUrl(orderId) {
  const id = String(orderId ?? "").trim();
  const message = id
    ? `Hola, tengo una consulta sobre mi pedido ${id}`
    : `Hola, quiero hacer una consulta a ${BRAND_CONFIG.name} sobre un producto o pedido.`;
  return buildWhatsAppUrl(message);
}
