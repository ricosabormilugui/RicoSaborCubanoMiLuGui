import { BRAND_CONFIG } from './brand.config';

const BUSINESS_PHONE = '34614272838';
const DEFAULT_CONTACT_MESSAGE = `Hola, quiero hacer una consulta a ${BRAND_CONFIG.name} sobre un producto o pedido.`;

export function buildWhatsAppContactUrl(message = DEFAULT_CONTACT_MESSAGE): string {
  const text = String(message ?? '').trim();
  return `https://wa.me/${BUSINESS_PHONE}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
