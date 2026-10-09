import { DELIVERY_RULES } from "../config/shipping.config.js";

function normalizedCategory(value) {
  return String(value ?? "").trim().toLocaleLowerCase("es-ES");
}

export function isCakeProduct(product) {
  const category = normalizedCategory(product?.category);
  return DELIVERY_RULES.cakeCategoryIds.some((item) => normalizedCategory(item) === category);
}

export function hasSelectedCakeDecoration(selections = []) {
  return selections.some((selection) => String(selection?.groupKey ?? "").trim() === DELIVERY_RULES.decorationGroupKey);
}

export function getProductPreparationNoticeHours(product, canonicalSelections = []) {
  if (!isCakeProduct(product)) return DELIVERY_RULES.advanceNoticeHours;
  return hasSelectedCakeDecoration(canonicalSelections)
    ? DELIVERY_RULES.decoratedCakeAdvanceNoticeHours
    : DELIVERY_RULES.cakeAdvanceNoticeHours;
}

export function getOrderPreparationNoticeHours(canonicalItems = []) {
  return canonicalItems.reduce(
    (hours, item) => Math.max(hours, Number(item?.preparationNoticeHours) || DELIVERY_RULES.advanceNoticeHours),
    DELIVERY_RULES.advanceNoticeHours
  );
}
