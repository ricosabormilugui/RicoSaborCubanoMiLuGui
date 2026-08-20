export interface ProductCategoryOption {
  slug: string;
  label: string;
}

export const PRODUCT_CATEGORIES: ProductCategoryOption[] = [
  { slug: 'combos', label: 'Combos' },
  { slug: 'platos', label: 'Platos' },
  { slug: 'tartas', label: 'Tartas' },
  { slug: 'dulces-gourmet', label: 'Dulces Gourmet' },
  { slug: 'aperitivos', label: 'Aperitivos' },
  { slug: 'bebidas', label: 'Bebidas' },
  { slug: 'extras', label: 'Extras' }
] as const;

export const DEFAULT_PRODUCT_CATEGORY = 'platos';

export function normalizeCategorySlug(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getProductCategoryLabel(value: string | null | undefined): string {
  const raw = String(value ?? '').trim();
  const slug = normalizeCategorySlug(raw);
  const category = PRODUCT_CATEGORIES.find((item) => item.slug === slug);

  if (category) return category.label;
  if (!raw) return '';

  return raw
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

export function mergeCategoryOptions(values: Array<string | null | undefined> = []): ProductCategoryOption[] {
  const bySlug = new Map(PRODUCT_CATEGORIES.map((category) => [category.slug, category]));

  for (const value of values) {
    const slug = normalizeCategorySlug(value);
    if (!slug || bySlug.has(slug)) continue;
    bySlug.set(slug, { slug, label: getProductCategoryLabel(value) });
  }

  return Array.from(bySlug.values());
}
