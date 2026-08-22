import { findProductById } from "../repositories/products.repository.js";
import {
  buildCanonicalConfigurationId,
  buildCustomizationOptionId,
  getOptionPriceModifier,
  getProductCustomizationGroups,
  toMoneyCents
} from "./product-customization.service.js";

export class OrderPricingError extends Error {
  constructor(message) {
    super(message);
    this.name = "OrderPricingError";
  }
}

function normalizedText(value) {
  return String(value ?? "").trim().toLocaleLowerCase("es-ES");
}

function resolveBaseProductId(item) {
  return String(item?.baseProductId ?? item?.productId ?? "").split("::")[0].trim();
}

function normalizeQuantity(value, minimumQuantity) {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < minimumQuantity || quantity > 99) {
    throw new OrderPricingError(`La cantidad debe ser un entero entre ${minimumQuantity} y 99.`);
  }
  return quantity;
}

function matchSelectionGroup(selection, groups) {
  const key = String(selection?.groupKey ?? "").trim();
  if (key) return groups.find((group) => group.key === key);
  const label = normalizedText(selection?.label);
  return groups.find((group) => normalizedText(group.label) === label);
}

function matchSelectionOption(selection, group) {
  const optionId = String(selection?.optionId ?? "").trim();
  const value = normalizedText(selection?.value);
  if (optionId) return group.options.find((option) => option.id === optionId && (!value || normalizedText(option.name) === value));
  return group.options.find((option) => normalizedText(option.name) === value);
}

function canonicalizeSelections(product, incomingSelections) {
  const groups = getProductCustomizationGroups(product);
  const selections = Array.isArray(incomingSelections) ? incomingSelections : [];
  if (!groups.length) {
    if (selections.length) throw new OrderPricingError(`El producto ${product.name} no admite personalizaciones.`);
    return [];
  }

  const byGroup = new Map(groups.map((group) => [group.key, []]));
  for (const selection of selections) {
    const group = matchSelectionGroup(selection, groups);
    if (!group) throw new OrderPricingError(`Se recibió un grupo de personalización inexistente para ${product.name}.`);
    const option = matchSelectionOption(selection, group);
    if (!option) throw new OrderPricingError(`La opción ${String(selection?.value ?? "").trim() || "indicada"} no existe para ${group.label}.`);
    const groupSelections = byGroup.get(group.key);
    if (groupSelections.some((item) => item.optionId === option.id)) {
      throw new OrderPricingError(`La opción ${option.name} está repetida.`);
    }
    if (group.selectionType === "single" && groupSelections.length > 0) {
      throw new OrderPricingError(`Solo puede elegirse una opción en ${group.label}.`);
    }
    const priceModifier = getOptionPriceModifier(option);
    groupSelections.push({
      groupKey: group.key,
      optionId: option.id || buildCustomizationOptionId(option.name),
      label: group.label,
      value: option.name,
      ...(priceModifier > 0 ? { priceModifier } : {})
    });
  }

  for (const group of groups) {
    if (group.required && byGroup.get(group.key).length === 0) {
      throw new OrderPricingError(`Debes seleccionar una opción para ${group.label}.`);
    }
  }
  return groups.flatMap((group) => byGroup.get(group.key));
}

export async function calculateCanonicalOrderItems(items, { productFinder = findProductById } = {}) {
  if (!Array.isArray(items) || items.length === 0) throw new OrderPricingError("El pedido no contiene productos.");
  const cache = new Map();
  const canonicalItems = [];

  for (const item of items) {
    const baseProductId = resolveBaseProductId(item);
    if (!baseProductId) throw new OrderPricingError("Falta el identificador de un producto.");
    let product = cache.get(baseProductId);
    if (!product) {
      product = await productFinder(baseProductId);
      if (product) cache.set(baseProductId, product);
    }
    if (!product) throw new OrderPricingError("Uno de los productos ya no existe.");
    if (product.published === false || product.available === false) throw new OrderPricingError(`El producto ${product.name} ya no está disponible.`);
    const productPrice = Number(product.price);
    if (!Number.isFinite(productPrice) || productPrice < 0) throw new OrderPricingError(`El producto ${product.name} no tiene un precio válido.`);

    const minimumQuantity = Math.max(1, Math.floor(Number(product.minimumQuantity ?? 1)) || 1);
    const quantity = normalizeQuantity(item?.quantity, minimumQuantity);
    const customizationGroups = getProductCustomizationGroups(product);
    const customization = canonicalizeSelections(product, item?.customization);
    const basePriceCents = toMoneyCents(productPrice);
    const extrasCents = customization.reduce((sum, selection) => sum + toMoneyCents(selection.priceModifier), 0);
    const unitPrice = (basePriceCents + extrasCents) / 100;
    const configurationId = buildCanonicalConfigurationId(customization);

    canonicalItems.push({
      productId: configurationId ? `${baseProductId}::${configurationId}` : baseProductId,
      baseProductId,
      configurationId: configurationId || undefined,
      name: String(product.name ?? "Producto"),
      description: String(product.description ?? ""),
      basePrice: basePriceCents / 100,
      unitPrice,
      quantity,
      minimumQuantity,
      unitLabel: String(product.unitLabel ?? "").trim() || undefined,
      customization: customization.length ? customization : undefined,
      requiresAdvancePayment: customizationGroups.length > 0 || /tarta|personaliz/i.test(String(product.category ?? ""))
    });
  }
  return canonicalItems;
}
