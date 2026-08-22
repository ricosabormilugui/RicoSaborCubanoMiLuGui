import { readFileSync } from "node:fs";

const CONFIG = JSON.parse(readFileSync(new URL("../config/product-customization.json", import.meta.url), "utf8"));

export const PRODUCT_CUSTOMIZATION_GROUPS = CONFIG.groups;

export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function toMoneyCents(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round((amount + Number.EPSILON) * 100) : 0;
}

export function buildCustomizationOptionId(name) {
  return String(name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "opcion";
}

export function getOptionPriceModifier(option) {
  const value = Number(option?.priceModifier ?? option?.price ?? 0);
  return Number.isFinite(value) && value > 0 ? roundMoney(value) : 0;
}

export function normalizeProductCustomizationOptions(value = {}) {
  const normalizeList = (items) => {
    if (!Array.isArray(items)) return [];
    const usedIds = new Map();
    return items.map((item) => {
      const source = typeof item === "string" ? { name: item } : item;
      const name = String(source?.name ?? "").trim();
      const priceModifier = getOptionPriceModifier(source);
      const baseId = String(source?.id ?? "").trim() || buildCustomizationOptionId(name);
      const occurrence = usedIds.get(baseId) ?? 0;
      usedIds.set(baseId, occurrence + 1);
      return name ? {
        id: occurrence ? `${baseId}-${occurrence + 1}` : baseId,
        name,
        ...(priceModifier > 0 ? { priceModifier } : {})
      } : null;
    }).filter(Boolean);
  };

  const groupSettings = Object.fromEntries(PRODUCT_CUSTOMIZATION_GROUPS.map((definition) => {
    const settings = value?.groupSettings?.[definition.key];
    return [definition.key, {
      label: String(settings?.label ?? "").trim() || definition.label,
      selectionType: settings?.selectionType === "multiple" ? "multiple" : definition.selectionType,
      required: settings?.required ?? definition.required
    }];
  }));

  return {
    ...Object.fromEntries(PRODUCT_CUSTOMIZATION_GROUPS.map((definition) => [definition.key, normalizeList(value?.[definition.key])])),
    groupSettings
  };
}

export function getProductCustomizationGroups(product) {
  const options = normalizeProductCustomizationOptions(product?.customizationOptions);
  return PRODUCT_CUSTOMIZATION_GROUPS.map((definition) => ({
    ...definition,
    label: String(options.groupSettings[definition.key]?.label ?? "").trim() || definition.label,
    selectionType: options.groupSettings[definition.key]?.selectionType === "multiple" ? "multiple" : "single",
    required: options.groupSettings[definition.key]?.required ?? definition.required,
    options: options[definition.key] ?? []
  })).filter((group) => group.options.length > 0);
}

export function buildCanonicalConfigurationId(selections = []) {
  if (!selections.length) return "";
  const value = selections
    .map((selection) => `${selection.groupKey}:${selection.optionId}`)
    .sort((left, right) => left.localeCompare(right))
    .join("|");
  return Buffer.from(value, "utf8").toString("base64url");
}
