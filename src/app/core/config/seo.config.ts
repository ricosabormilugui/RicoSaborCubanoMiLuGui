import { LEGAL_BUSINESS_CONFIG } from './legal.config';
import { BRAND_CONFIG } from './brand.config';
import { environment } from '../../../environments/environment';

export const SEO_SITE_CONFIG = {
  siteName: BRAND_CONFIG.name,
  titleSuffix: BRAND_CONFIG.name,
  defaultTitle: `${BRAND_CONFIG.name} | ${BRAND_CONFIG.slogan}`,
  defaultDescription: 'Tartas personalizadas, platos cubanos y españoles, dulces y encargos para celebraciones, con entrega local o recogida.',
  siteUrl: environment.siteUrl,
  locale: 'es_ES',
  twitterCard: 'summary_large_image',
  defaultImage: '/assets/branding/logo_mixsabor_dark.png',
  business: {
    name: BRAND_CONFIG.name,
    legalName: LEGAL_BUSINESS_CONFIG.legalName,
    email: LEGAL_BUSINESS_CONFIG.legalEmail,
    phone: LEGAL_BUSINESS_CONFIG.phone,
    address: LEGAL_BUSINESS_CONFIG.fiscalAddress
  },
  hasCompleteLegalIdentity: [
    LEGAL_BUSINESS_CONFIG.legalName,
    LEGAL_BUSINESS_CONFIG.legalEmail,
    LEGAL_BUSINESS_CONFIG.phone,
    LEGAL_BUSINESS_CONFIG.fiscalAddress
  ].every((value) => value && !String(value).startsWith('PENDIENTE_CONFIGURAR_'))
} as const;
