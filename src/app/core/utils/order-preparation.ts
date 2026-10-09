import { DELIVERY_RULES } from '../config/shipping.config';
import type { CartCustomizationSelection, CartItem } from '../models/order.model';
import type { Product } from '../models/product.model';

function normalizedCategory(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase('es-ES');
}

export function isCakeProduct(product: Pick<Product, 'category'> | null | undefined): boolean {
  const category = normalizedCategory(product?.category);
  return DELIVERY_RULES.cakeCategoryIds.some((item) => normalizedCategory(item) === category);
}

export function hasSelectedCakeDecoration(selections: readonly CartCustomizationSelection[] | undefined): boolean {
  return Boolean(selections?.some((selection) => String(selection.groupKey ?? '').trim() === DELIVERY_RULES.decorationGroupKey));
}

export function productPreparationNoticeHours(
  product: Pick<Product, 'category'>,
  selections: readonly CartCustomizationSelection[] | undefined
): number {
  if (!isCakeProduct(product)) return DELIVERY_RULES.advanceNoticeHours;
  return hasSelectedCakeDecoration(selections)
    ? DELIVERY_RULES.decoratedCakeAdvanceNoticeHours
    : DELIVERY_RULES.cakeAdvanceNoticeHours;
}

export function cartPreparationNoticeHours(items: readonly CartItem[]): number {
  return items.reduce(
    (hours, item) => Math.max(hours, Number(item.preparationNoticeHours) || DELIVERY_RULES.advanceNoticeHours),
    DELIVERY_RULES.advanceNoticeHours
  );
}
