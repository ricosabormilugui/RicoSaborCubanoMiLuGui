import { getProductCategoryLabel, normalizeCategorySlug } from '../config/product-categories.config';
import { Product } from './product.model';

export interface ProductFilters {
  query?: string | null;
  category?: string | null;
}

function normalizeSearchValue(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function matchesProductSearch(product: Partial<Product>, query: string | null | undefined): boolean {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return true;

  return [product.name, product.description, product.category, getProductCategoryLabel(product.category)]
    .map(normalizeSearchValue)
    .some((value) => value.includes(normalizedQuery));
}

export function filterProducts(products: Product[], filters: ProductFilters): Product[] {
  const category = normalizeCategorySlug(filters.category);
  const query = filters.query;

  return products
    .filter((product) => (category ? normalizeCategorySlug(product.category) === category : true))
    .filter((product) => matchesProductSearch(product, query));
}

export function selectBestSellers(products: Product[], limit = 4, excludeId?: string): Product[] {
  return products
    .filter((product) => product.id !== excludeId && product.available !== false && product.published !== false)
    .slice()
    .sort((a, b) => {
      const scoreA = getBestSellerScore(a);
      const scoreB = getBestSellerScore(b);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER);
    })
    .slice(0, limit);
}

export function getProductRoute(product: Product): string[] {
  return ['/producto', normalizeCategorySlug(product.slug) || product.id];
}

export function findProductBySlugOrId(products: Product[], value: string | null | undefined): Product | undefined {
  const normalized = normalizeSearchValue(value);
  if (!normalized) return undefined;

  return products.find((product) =>
    normalizeSearchValue(product.id) === normalized || normalizeSearchValue(product.slug) === normalized
  );
}

function getBestSellerScore(product: Product): number {
  const salesScore = product.salesCount ?? product.soldCount ?? 0;
  const featuredScore = product.isBestSeller || product.featured ? 1_000_000 : 0;
  return featuredScore + salesScore;
}
