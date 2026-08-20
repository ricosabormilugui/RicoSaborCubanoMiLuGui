import { Injectable, computed, signal } from '@angular/core';
import { CartCustomizationSelection, CartItem } from '../models/order.model';
import { Product } from '../models/product.model';

const CART_STORAGE_KEY = 'ricosabor-cart';
const CART_SCHEMA_VERSION = 2;
const MAX_RESTORED_QUANTITY = 99;

interface StoredCartState {
  version: typeof CART_SCHEMA_VERSION;
  items: CartItem[];
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private lastPersistedValue = '';
  private readonly state = signal<CartItem[]>(this.restoreCart());

  readonly items = computed(() => this.state());
  readonly subtotal = computed(() => this.items().reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
  readonly totalItems = computed(() => this.items().reduce((sum, item) => sum + item.quantity, 0));

  add(product: Product, customization: CartCustomizationSelection[] = [], unitPrice = product.price, amount = 1): void {
    const productId = buildCartProductId(product.id, customization);
    const existing = this.state().find((item) => item.productId === productId);
    const addedQuantity = normalizePositiveInteger(amount, 1);
    const minimumQuantity = normalizePositiveInteger(product.minimumQuantity, 1);
    if (existing) {
      this.setItems(this.state().map((item) => (item.productId === productId ? {
        ...item,
        quantity: Math.max(minimumQuantity, existing.quantity + addedQuantity),
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
        name: product.name,
        description: product.description,
        unitPrice,
        quantity: Math.max(minimumQuantity, addedQuantity),
        minimumQuantity,
        unitLabel: String(product.unitLabel ?? '').trim() || undefined,
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
      const isSupportedCart = !isLegacyCart && parsed.version === CART_SCHEMA_VERSION;
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
    const productId = String(raw.productId ?? '').trim();
    const name = String(raw.name ?? '').trim();
    const unitPrice = Number(raw.unitPrice);
    const quantity = Math.floor(Number(raw.quantity));
    const minimumQuantity = normalizePositiveInteger(raw.minimumQuantity, 1);

    if (!productId || !name || !Number.isFinite(unitPrice) || unitPrice < 0) return null;
    if (!Number.isFinite(quantity) || quantity <= 0) return null;

    return {
      productId,
      name,
      description: raw.description ? String(raw.description) : '',
      unitPrice,
      quantity: Math.max(minimumQuantity, Math.min(MAX_RESTORED_QUANTITY, quantity)),
      minimumQuantity,
      unitLabel: String(raw.unitLabel ?? '').trim() || undefined,
      baseProductId: raw.baseProductId ? String(raw.baseProductId) : undefined,
      customization: normalizeCustomization(raw.customization)
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
    .map((item) => {
      const source = item as Partial<CartCustomizationSelection>;
      const label = String(source.label ?? '').trim();
      const optionValue = String(source.value ?? '').trim();
      const price = Number(source.price ?? 0);
      return label && optionValue ? { label, value: optionValue, ...(Number.isFinite(price) && price > 0 ? { price } : {}) } : null;
    })
    .filter((item): item is CartCustomizationSelection => Boolean(item));
  return items.length ? items : undefined;
}

function buildCartProductId(productId: string, customization: CartCustomizationSelection[]): string {
  if (!customization.length) return productId;
  const suffix = customization
    .map((item) => `${item.label}:${item.value}:${item.price ?? 0}`)
    .join('|');
  return `${productId}::${globalThis.btoa(unescape(encodeURIComponent(suffix))).replace(/=+$/g, '')}`;
}
