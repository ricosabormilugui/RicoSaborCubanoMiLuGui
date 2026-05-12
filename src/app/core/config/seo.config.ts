import { LEGAL_BUSINESS_CONFIG } from './legal.config';

export const SEO_SITE_CONFIG = {
  siteName: 'Rico Sabor Cubano',
  titleSuffix: 'Rico Sabor Cubano',
  defaultTitle: 'Rico Sabor Cubano · Comida cubana a domicilio',
  defaultDescription: 'Pide comida cubana casera, combos, platos, tartas y dulces gourmet con entrega local o recogida. Pedido manual con confirmación por el equipo.',
  siteUrl: 'https://ricosaborcubano.com',
  locale: 'es_ES',
  twitterCard: 'summary_large_image',
  defaultImage: 'https://images.unsplash.com/photo-1543353071-873f17a7a088?w=1200',
  business: {
    name: LEGAL_BUSINESS_CONFIG.tradeName,
    legalName: LEGAL_BUSINESS_CONFIG.legalName,
    email: LEGAL_BUSINESS_CONFIG.legalEmail,
    phone: LEGAL_BUSINESS_CONFIG.phone,
    address: LEGAL_BUSINESS_CONFIG.fiscalAddress
  }
} as const;
