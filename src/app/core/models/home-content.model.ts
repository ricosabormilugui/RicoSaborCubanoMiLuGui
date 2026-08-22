import { PRODUCT_CATEGORIES } from '../config/product-categories.config';
import { normalizeCategorySlug } from '../config/product-categories.config';

export interface HomeContent {
  heroImageUrl: string;
  cubanImageUrl: string;
  cakesImageUrl: string;
  spanishImageUrl: string;
  categoryImages: Record<string, string>;
}

export function emptyHomeContent(): HomeContent {
  return {
    heroImageUrl: '',
    cubanImageUrl: '',
    cakesImageUrl: '',
    spanishImageUrl: '',
    categoryImages: Object.fromEntries(PRODUCT_CATEGORIES.map((category) => [category.slug, '']))
  };
}

export function normalizeHomeContent(value: Partial<HomeContent> | null | undefined): HomeContent {
  const fallback = emptyHomeContent();
  const categoryImages = value?.categoryImages && typeof value.categoryImages === 'object'
    ? value.categoryImages
    : {};

  return {
    heroImageUrl: String(value?.heroImageUrl ?? '').trim(),
    cubanImageUrl: String(value?.cubanImageUrl ?? '').trim(),
    cakesImageUrl: String(value?.cakesImageUrl ?? '').trim(),
    spanishImageUrl: String(value?.spanishImageUrl ?? '').trim(),
    categoryImages: Object.fromEntries(
      Object.entries({ ...fallback.categoryImages, ...categoryImages })
        .map(([key, url]) => [normalizeCategorySlug(key), String(url ?? '').trim()])
        .filter(([key]) => Boolean(key))
    )
  };
}
