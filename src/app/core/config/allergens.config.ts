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
  icon: AllergenId;
  iconPath: string;
  color: string;
}

export const ALLERGEN_CATALOG: readonly AllergenDefinition[] = [
  { id: 'gluten', label: 'Gluten', icon: 'gluten', iconPath: 'assets/allergens/gluten.png', color: '#C7BE4B' },
  { id: 'crustaceans', label: 'Crustáceos', icon: 'crustaceans', iconPath: 'assets/allergens/crustaceans.png', color: '#F39A4B' },
  { id: 'eggs', label: 'Huevos', icon: 'eggs', iconPath: 'assets/allergens/eggs.png', color: '#F1D85A' },
  { id: 'fish', label: 'Pescado', icon: 'fish', iconPath: 'assets/allergens/fish.png', color: '#39AEF4' },
  { id: 'peanuts', label: 'Cacahuetes', icon: 'peanuts', iconPath: 'assets/allergens/peanuts.png', color: '#A88686' },
  { id: 'milk', label: 'Lácteos', icon: 'milk', iconPath: 'assets/allergens/milk.png', color: '#8B5CF6' },
  { id: 'celery', label: 'Apio', icon: 'celery', iconPath: 'assets/allergens/celery.png', color: '#14C85A' },
  { id: 'mustard', label: 'Mostaza', icon: 'mustard', iconPath: 'assets/allergens/mustard.png', color: '#C7B116' },
  { id: 'sulphites', label: 'Sulfitos', icon: 'sulphites', iconPath: 'assets/allergens/sulphites.png', color: '#0D63C9' },
  { id: 'sesame', label: 'Sésamo', icon: 'sesame', iconPath: 'assets/allergens/sesame.png', color: '#6E5D00' },
  { id: 'molluscs', label: 'Moluscos', icon: 'molluscs', iconPath: 'assets/allergens/molluscs.png', color: '#56D9E8' },
  { id: 'soy', label: 'Soja', icon: 'soy', iconPath: 'assets/allergens/soy.png', color: '#7ED957' },
  { id: 'nuts', label: 'Frutos de cáscara', icon: 'nuts', iconPath: 'assets/allergens/nuts.png', color: '#6F4A45' },
  { id: 'lupin', label: 'Altramuces', icon: 'lupin', iconPath: 'assets/allergens/lupin.png', color: '#15AFC3' }
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

export function getAllergenColor(id: string): string {
  return ALLERGEN_BY_ID.get(id as AllergenId)?.color ?? '#888888';
}

export function getAllergenIconPath(id: string): string {
  return ALLERGEN_BY_ID.get(id as AllergenId)?.iconPath ?? '';
}
