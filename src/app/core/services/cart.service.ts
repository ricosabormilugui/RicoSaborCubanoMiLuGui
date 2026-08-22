import { Injectable, computed, signal } from '@angular/core';
import { CartCustomizationSelection, CartItem } from '../models/order.model';
import { isProductCustomizable, Product } from '../models/product.model';
import { buildCustomizationOptionId, calculateFinalUnitPrice, getCustomizationGroupKeyByLabel, getPriceModifier, roundMoney } from '../utils/customization-pricing';

const CART_STORAGE_KEY = 'ricosabor-cart';
const CART_SCHEMA_VERSION = 3;
const SUPPORTED_CART_SCHEMA_VERSIONS = new Set([2, CART_SCHEMA_VERSION]);
const MAX_RESTORED_QUANTITY = 99;

interface StoredCartState {
  version: number;
  items: CartItem[];
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private lastPersistedValue = '';
  private readonly state = signal<CartItem[]>(this.restoreCart());

  readonly items = computed(() => this.state());
  readonly subtotal = computed(() => roundMoney(this.items().reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)));
  readonly totalItems = computed(() => this.items().reduce((sum, item) => sum + item.quantity, 0));

  add(product: Product, customization: CartCustomizationSelection[] = [], amount = 1): void {
    const configurationId = buildConfigurationId(customization);
    const productId = configurationId ? `${product.id}::${configurationId}` : product.id;
    const existing = this.state().find((item) => item.productId === productId);
    const addedQuantity = normalizePositiveInteger(amount, 1);
    const minimumQuantity = normalizePositiveInteger(product.minimumQuantity, 1);
    const basePrice = roundMoney(Number(product.price ?? 0));
    const unitPrice = calculateFinalUnitPrice(basePrice, customization);
    if (existing) {
      this.setItems(this.state().map((item) => (item.productId === productId ? {
        ...item,
        quantity: Math.max(minimumQuantity, existing.quantity + addedQuantity),
        basePrice,
        unitPrice,
        customization: customization.length ? customization : undefined,
        requiresAdvancePayment: isProductCustomizable(product),
        minimumQuantity,
        unitLabel: String(product.unitLabel ?? '').trim() || undefined
      } : item)));
      return;
    }

    this.setItems([
      ...this.state(),
      {
        productId,
        baseProductId: product.id,
        configurationId: configurationId || undefined,
        name: product.name,
        description: product.description,
        unitPrice,
        basePrice,
        quantity: Math.max(minimumQuantity, addedQuantity),
        minimumQuantity,
        unitLabel: String(product.unitLabel ?? '').trim() || undefined,
        requiresAdvancePayment: isProductCustomizable(product),
        customization: customization.length ? customization : undefined
      }
    ]);
  }

  updateQuantity(productId: string, quantity: number): void {
    const normalizedQuantity = Math.floor(Number(quantity));
    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
      this.remove(productId);
      return;
    }

    this.setItems(
      this.state().map((item) => (item.productId === productId
        ? { ...item, quantity: Math.max(normalizePositiveInteger(item.minimumQuantity, 1), normalizedQuantity) }
        : item))
    );
  }

  remove(productId: string): void {
    this.setItems(this.state().filter((item) => item.productId !== productId));
  }

  clear(): void {
    this.setItems([]);
  }

  private setItems(items: CartItem[]): void {
    this.state.set(items);
    this.persistCart(items);
  }

  private restoreCart(): CartItem[] {
    try {
      const raw = globalThis.localStorage?.getItem(CART_STORAGE_KEY);
      if (!raw) return [];

      const parsed = JSON.parse(raw) as Partial<StoredCartState> | CartItem[];
      const isLegacyCart = Array.isArray(parsed);
      const isSupportedCart = !isLegacyCart && SUPPORTED_CART_SCHEMA_VERSIONS.has(Number(parsed.version));
      if (!isLegacyCart && !isSupportedCart) return [];

      const items = isLegacyCart ? parsed : parsed.items;
      const normalized = this.normalizeItems(items ?? []);
      const serialized = this.serializeCart(normalized);
      this.lastPersistedValue = serialized;

      if (serialized !== raw) {
        globalThis.localStorage?.setItem(CART_STORAGE_KEY, serialized);
      }

      return normalized;
    } catch {
      return [];
    }
  }

  private normalizeItems(items: unknown): CartItem[] {
    if (!Array.isArray(items)) return [];

    const byProductId = new Map<string, CartItem>();
    for (const item of items) {
      const normalized = this.normalizeItem(item);
      if (!normalized) continue;

      const existing = byProductId.get(normalized.productId);
      if (existing) {
        byProductId.set(normalized.productId, {
          ...existing,
          quantity: Math.min(MAX_RESTORED_QUANTITY, existing.quantity + normalized.quantity)
        });
        continue;
      }

      byProductId.set(normalized.productId, normalized);
    }

    return Array.from(byProductId.values());
  }

  private normalizeItem(value: unknown): CartItem | null {
    if (!value || typeof value !== 'object') return null;

    const raw = value as Partial<CartItem>;
    const storedProductId = String(raw.productId ?? '').trim();
    const name = String(raw.name ?? '').trim();
    const unitPrice = Number(raw.unitPrice);
    const quantity = Math.floor(Number(raw.quantity));
    const minimumQuantity = normalizePositiveInteger(raw.minimumQuantity, 1);
    const customization = normalizeCustomization(raw.customization);
    const modifiersTotal = (customization ?? []).reduce((sum, item) => sum + getPriceModifier(item), 0);
    const basePriceValue = Number(raw.basePrice ?? unitPrice - modifiersTotal);
    const basePrice = Number.isFinite(basePriceValue) && basePriceValue >= 0 ? roundMoney(basePriceValue) : unitPrice;
    const baseProductId = raw.baseProductId ? String(raw.baseProductId) : storedProductId.split('::')[0];
    const configurationId = buildConfigurationId(customization ?? []);
    const productId = configurationId ? `${baseProductId}::${configurationId}` : baseProductId;

    if (!storedProductId || !baseProductId || !name || !Number.isFinite(unitPrice) || unitPrice < 0) return null;
    if (!Number.isFinite(quantity) || quantity <= 0) return null;

    return {
      productId,
      name,
      description: raw.description ? String(raw.description) : '',
      unitPrice,
      basePrice,
      quantity: Math.max(minimumQuantity, Math.min(MAX_RESTORED_QUANTITY, quantity)),
      minimumQuantity,
      unitLabel: String(raw.unitLabel ?? '').trim() || undefined,
      baseProductId,
      configurationId: configurationId || undefined,
      requiresAdvancePayment: Boolean(raw.requiresAdvancePayment) || Boolean(customization?.length),
      customization
    };
  }

  private persistCart(items: CartItem[]): void {
    try {
      const serialized = this.serializeCart(items);
      if (serialized === this.lastPersistedValue) return;

      globalThis.localStorage?.setItem(CART_STORAGE_KEY, serialized);
      this.lastPersistedValue = serialized;
    } catch {
      // Ignore storage failures so cart interactions continue to work.
    }
  }

  private serializeCart(items: CartItem[]): string {
    return JSON.stringify({
      version: CART_SCHEMA_VERSION,
      items
    } satisfies StoredCartState);
  }
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  const quantity = Math.floor(Number(value));
  return Number.isFinite(quantity) && quantity > 0 ? quantity : fallback;
}


function normalizeCustomization(value: unknown): CartCustomizationSelection[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map((item): CartCustomizationSelection | null => {
      const source = item as Partial<CartCustomizationSelection>;
      const label = String(source.label ?? '').trim();
      const optionValue = String(source.value ?? '').trim();
      const priceModifier = getPriceModifier(source);
      const groupKey = String(source.groupKey ?? '').trim() || getCustomizationGroupKeyByLabel(label) || '';
      const optionId = String(source.optionId ?? '').trim() || buildCustomizationOptionId(optionValue);
      return label && optionValue ? {
        ...(groupKey ? { groupKey } : {}),
        ...(optionId ? { optionId } : {}),
        label,
        value: optionValue,
        ...(priceModifier > 0 ? { priceModifier } : {})
      } : null;
    })
    .filter((item): item is CartCustomizationSelection => Boolean(item));
  return items.length ? items : undefined;
}

function buildConfigurationId(customization: CartCustomizationSelection[]): string {
  if (!customization.length) return '';
  const suffix = customization
    .map((item) => `${item.groupKey ?? item.label}:${item.optionId ?? item.value}`)
    .sort((a, b) => a.localeCompare(b))
    .join('|');
  return globalThis.btoa(unescape(encodeURIComponent(suffix)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}
