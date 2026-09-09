export type ProductSeoPhase = 'loading' | 'ready' | 'not-found' | 'unavailable' | 'error';

export interface PublicProductLike {
  slug?: string | null;
  published?: boolean;
  available?: boolean;
  trackStock?: boolean;
  stock?: number;
}

export interface CatalogSeoResult {
  path: string;
  canonicalPath: string;
  robots: 'index,follow' | 'noindex,follow';
  indexable: boolean;
}

export function normalizeSeoSlug(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function productPathFromIdentifier(identifier: string | null | undefined): string {
  const slug = normalizeSeoSlug(identifier);
  return slug ? `/producto/${encodeURIComponent(slug)}` : '';
}

export function isProductOrderable(product: PublicProductLike | null | undefined): boolean {
  if (!product) return false;
  return product.available !== false && (product.trackStock !== true || Number(product.stock ?? 0) > 0);
}

export function isPublicIndexableProduct(product: PublicProductLike | null | undefined): boolean {
  if (!product || product.published === false) return false;
  if (!normalizeSeoSlug(product.slug)) return false;
  if (product.available === true) return true;
  return product.trackStock === true && Number(product.stock ?? 0) <= 0;
}

export function resolveProductCanonicalPath(input: {
  identifier?: string | null;
  product?: PublicProductLike | null;
} = {}): string {
  const productSlug = normalizeSeoSlug(input.product?.slug);
  if (productSlug) return `/producto/${encodeURIComponent(productSlug)}`;
  return productPathFromIdentifier(input.identifier);
}

export function resolveProductSeoPhase(input: {
  identifier?: string | null;
  loading?: boolean;
  product?: PublicProductLike | null;
  httpStatus?: number | null;
  loadError?: string | null;
} = {}): ProductSeoPhase {
  const requested = productPathFromIdentifier(input.identifier);
  if (!requested) return 'not-found';
  if (input.loading) return 'loading';
  if (input.product) return isPublicIndexableProduct(input.product) ? 'ready' : 'unavailable';
  if (Number(input.httpStatus) === 404) return 'not-found';
  if (input.loadError || input.httpStatus === 0 || Number(input.httpStatus) >= 500) return 'error';
  return 'not-found';
}

export function resolveProductRobots(phase: ProductSeoPhase): 'index,follow' | 'noindex,follow' {
  return phase === 'not-found' || phase === 'unavailable' ? 'noindex,follow' : 'index,follow';
}

export function resolveCatalogSeo(input: {
  routeCategory?: string | null;
  invalidCategory?: boolean;
  emptyCategory?: boolean;
  categoriesReady?: boolean;
} = {}): CatalogSeoResult {
  const slug = normalizeSeoSlug(input.routeCategory);
  if (!slug) {
    return {
      path: '/productos',
      canonicalPath: '/productos',
      robots: 'index,follow',
      indexable: true
    };
  }

  const path = `/categoria/${encodeURIComponent(slug)}`;
  if (!input.categoriesReady) {
    return { path, canonicalPath: path, robots: 'index,follow', indexable: true };
  }
  if (input.invalidCategory) {
    return { path, canonicalPath: '/productos', robots: 'noindex,follow', indexable: false };
  }
  if (input.emptyCategory) {
    return { path, canonicalPath: path, robots: 'noindex,follow', indexable: false };
  }
  return { path, canonicalPath: path, robots: 'index,follow', indexable: true };
}
