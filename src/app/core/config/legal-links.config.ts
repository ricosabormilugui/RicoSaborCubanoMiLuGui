export interface LegalLink {
  slug: string;
  title: string;
}

export const LEGAL_NAV_LINKS: LegalLink[] = [
  { slug: 'aviso-legal', title: 'Aviso legal' },
  { slug: 'privacidad', title: 'Política de privacidad' },
  { slug: 'cookies', title: 'Política de cookies' },
  { slug: 'condiciones-compra', title: 'Condiciones de compra' },
  { slug: 'envios', title: 'Política de envíos' },
  { slug: 'devoluciones-cancelaciones', title: 'Política de devoluciones/cancelaciones' }
] as const;
