export const ALLERGEN_IDS = [
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'milk',
  'celery',
  'mustard',
  'sulphites',
  'sesame',
  'molluscs',
  'soy',
  'nuts',
  'lupin'
] as const;

export type AllergenId = typeof ALLERGEN_IDS[number];

export interface AllergenDefinition {
  id: AllergenId;
  label: string;
}

export const ALLERGEN_CATALOG: readonly AllergenDefinition[] = [
  { id: 'gluten', label: 'Gluten' },
  { id: 'crustaceans', label: 'Crustáceos' },
  { id: 'eggs', label: 'Huevos' },
  { id: 'fish', label: 'Pescado' },
  { id: 'peanuts', label: 'Cacahuetes' },
  { id: 'milk', label: 'Leche' },
  { id: 'celery', label: 'Apio' },
  { id: 'mustard', label: 'Mostaza' },
  { id: 'sulphites', label: 'Sulfitos' },
  { id: 'sesame', label: 'Sésamo' },
  { id: 'molluscs', label: 'Moluscos' },
  { id: 'soy', label: 'Soja' },
  { id: 'nuts', label: 'Frutos de cáscara' },
  { id: 'lupin', label: 'Altramuces' }
] as const;

export interface ProductAllergens {
  contains: AllergenId[];
  mayContain: AllergenId[];
}

export interface ProductFoodInformation {
  ingredients: string;
  allergens: ProductAllergens;
  allergenNotes: string;
}

const ALLERGEN_ID_SET = new Set<string>(ALLERGEN_IDS);
const ALLERGEN_BY_ID = new Map(ALLERGEN_CATALOG.map((item) => [item.id, item]));

export function isAllergenId(value: string): value is AllergenId {
  return ALLERGEN_ID_SET.has(value);
}

export function emptyFoodInformation(): ProductFoodInformation {
  return {
    ingredients: '',
    allergens: {
      contains: [],
      mayContain: []
    },
    allergenNotes: ''
  };
}

function normalizeAllergenList(value: unknown): AllergenId[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<AllergenId>();
  const ids: AllergenId[] = [];

  for (const item of value) {
    const id = String(item ?? '').trim().toLowerCase();
    if (!isAllergenId(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  return ids;
}

export function normalizeFoodInformation(value: unknown): ProductFoodInformation {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<ProductFoodInformation> & { allergens?: Partial<ProductAllergens> }
    : {};
  const contains = normalizeAllergenList(source.allergens?.contains);
  const containsSet = new Set(contains);

  return {
    ingredients: String(source.ingredients ?? '').trim(),
    allergens: {
      contains,
      mayContain: normalizeAllergenList(source.allergens?.mayContain).filter((id) => !containsSet.has(id))
    },
    allergenNotes: String(source.allergenNotes ?? '').trim()
  };
}

export function hasFoodInformation(value: unknown): boolean {
  const info = normalizeFoodInformation(value);
  return Boolean(
    info.ingredients
    || info.allergenNotes
    || info.allergens.contains.length
    || info.allergens.mayContain.length
  );
}

export function resolveAllergens(ids: readonly string[] | undefined): AllergenDefinition[] {
  const seen = new Set<AllergenId>();
  const resolved: AllergenDefinition[] = [];

  for (const value of ids ?? []) {
    const allergen = ALLERGEN_BY_ID.get(value as AllergenId);
    if (!allergen || seen.has(allergen.id)) continue;
    seen.add(allergen.id);
    resolved.push(allergen);
  }

  return resolved;
}

export function getAllergenLabel(id: string): string {
  return ALLERGEN_BY_ID.get(id as AllergenId)?.label ?? id;
}
