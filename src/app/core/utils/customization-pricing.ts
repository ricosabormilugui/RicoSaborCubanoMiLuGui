import customizationConfig from '../../../../Backend/src/config/product-customization.json';
import type { CartCustomizationSelection } from '../models/order.model';
import type {
  Product,
  ProductCustomizationGroupKey,
  ProductCustomizationGroupSettings,
  ProductCustomizationOption,
  ProductCustomizationOptions,
  ProductCustomizationSelectionType
} from '../models/product.model';

export type ProductCustomizationGroup = {
  key: ProductCustomizationGroupKey;
  label: string;
  selectionType: ProductCustomizationSelectionType;
  required: boolean;
  options: ProductCustomizationOption[];
};

export type ProductCustomizationSelectionState = Partial<Record<ProductCustomizationGroupKey, ProductCustomizationOption[]>>;

const GROUP_DEFINITIONS = customizationConfig.groups as Array<{
  key: ProductCustomizationGroupKey;
  label: string;
  selectionType: ProductCustomizationSelectionType;
  required: boolean;
}>;

export function roundMoney(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function getPriceModifier(option: Pick<ProductCustomizationOption, 'priceModifier' | 'price'>): number {
  const value = Number(option.priceModifier ?? option.price ?? 0);
  return Number.isFinite(value) && value > 0 ? roundMoney(value) : 0;
}

export function buildCustomizationOptionId(name: string): string {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'opcion';
}

export function getCustomizationGroupKeyByLabel(label: string): ProductCustomizationGroupKey | undefined {
  const normalized = String(label ?? '').trim().toLocaleLowerCase('es-ES');
  return GROUP_DEFINITIONS.find((definition) => definition.label.toLocaleLowerCase('es-ES') === normalized)?.key;
}

export function normalizeCustomizationOptions(value: unknown): ProductCustomizationOptions {
  const source = (value && typeof value === 'object' ? value : {}) as ProductCustomizationOptions;
  const normalizeList = (items: unknown): ProductCustomizationOption[] => {
    if (!Array.isArray(items)) return [];
    const usedIds = new Map<string, number>();
    return items.map((item): ProductCustomizationOption | null => {
      const raw = typeof item === 'string' ? { name: item } : item as Partial<ProductCustomizationOption>;
      const name = String(raw.name ?? '').trim();
      const priceModifier = getPriceModifier(raw);
      const baseId = String(raw.id ?? '').trim() || buildCustomizationOptionId(name);
      const occurrence = usedIds.get(baseId) ?? 0;
      usedIds.set(baseId, occurrence + 1);
      return name ? {
        id: occurrence ? `${baseId}-${occurrence + 1}` : baseId,
        name,
        ...(priceModifier > 0 ? { priceModifier } : {})
      } : null;
    }).filter((item): item is ProductCustomizationOption => Boolean(item));
  };

  const groupSettings = Object.fromEntries(GROUP_DEFINITIONS.map((definition) => {
    const settings = source.groupSettings?.[definition.key];
    return [definition.key, {
      label: String(settings?.label ?? '').trim() || definition.label,
      selectionType: settings?.selectionType === 'multiple' ? 'multiple' : definition.selectionType,
      required: settings?.required ?? definition.required
    } satisfies ProductCustomizationGroupSettings];
  })) as Record<ProductCustomizationGroupKey, ProductCustomizationGroupSettings>;

  return {
    themes: normalizeList(source.themes),
    colors: normalizeList(source.colors),
    sizes: normalizeList(source.sizes),
    flavors: normalizeList(source.flavors),
    fillings: normalizeList(source.fillings),
    toppings: normalizeList(source.toppings),
    decorations: normalizeList(source.decorations),
    groupSettings
  };
}

export function getCustomizationGroups(product: Pick<Product, 'customizationOptions'>): ProductCustomizationGroup[] {
  const options = normalizeCustomizationOptions(product.customizationOptions);
  return GROUP_DEFINITIONS.map((definition) => {
    const settings = options.groupSettings?.[definition.key];
    const selectionType: ProductCustomizationSelectionType = settings?.selectionType === 'multiple' ? 'multiple' : 'single';
    return {
      key: definition.key,
      label: String(settings?.label ?? '').trim() || definition.label,
      selectionType,
      required: settings?.required ?? definition.required,
      options: options[definition.key] ?? []
    };
  }).filter((group) => group.options.length > 0);
}

export function calculateCustomizationExtra(selections: Iterable<ProductCustomizationOption | CartCustomizationSelection>): number {
  let cents = 0;
  for (const selection of selections) cents += Math.round(getPriceModifier(selection) * 100);
  return cents / 100;
}

export function calculateFinalUnitPrice(basePrice: number, selections: Iterable<ProductCustomizationOption | CartCustomizationSelection>): number {
  return roundMoney(Number(basePrice ?? 0) + calculateCustomizationExtra(selections));
}

export function flattenCustomizationSelections(state: ProductCustomizationSelectionState): ProductCustomizationOption[] {
  return Object.values(state).flatMap((items) => items ?? []);
}

export function buildCartCustomizationSelections(product: Product, state: ProductCustomizationSelectionState): CartCustomizationSelection[] {
  return getCustomizationGroups(product).flatMap((group) => (state[group.key] ?? []).map((option) => {
    const priceModifier = getPriceModifier(option);
    return {
      groupKey: group.key,
      optionId: String(option.id ?? '').trim() || buildCustomizationOptionId(option.name),
      label: group.label,
      value: option.name,
      ...(priceModifier > 0 ? { priceModifier } : {})
    };
  }));
}

export function hasAllRequiredCustomizations(groups: ProductCustomizationGroup[], state: ProductCustomizationSelectionState): boolean {
  return groups.every((group) => !group.required || (state[group.key]?.length ?? 0) > 0);
}

export function defaultGroupSettings(): Record<ProductCustomizationGroupKey, Required<ProductCustomizationGroupSettings>> {
  return Object.fromEntries(GROUP_DEFINITIONS.map((definition) => [definition.key, {
    label: definition.label,
    selectionType: definition.selectionType,
    required: definition.required
  }])) as Record<ProductCustomizationGroupKey, Required<ProductCustomizationGroupSettings>>;
}

export function readGroupSettings(options: ProductCustomizationOptions | undefined): Record<ProductCustomizationGroupKey, Required<ProductCustomizationGroupSettings>> {
  const defaults = defaultGroupSettings();
  for (const definition of GROUP_DEFINITIONS) {
    const settings = options?.groupSettings?.[definition.key];
    defaults[definition.key] = {
      label: String(settings?.label ?? '').trim() || definition.label,
      selectionType: settings?.selectionType === 'multiple' ? 'multiple' : 'single',
      required: settings?.required ?? definition.required
    };
  }
  return defaults;
}
