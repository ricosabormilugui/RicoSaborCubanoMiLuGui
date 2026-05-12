import { Injectable, computed, signal } from '@angular/core';
import { CartItem } from '../models/order.model';
import { Product } from '../models/product.model';

const CART_STORAGE_KEY = 'ricosabor-cart';
const CART_SCHEMA_VERSION = 1;
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

  add(product: Product): void {
    const existing = this.state().find((item) => item.productId === product.id);
    if (existing) {
      this.updateQuantity(product.id, existing.quantity + 1);
      return;
    }

    this.setItems([
      ...this.state(),
      {
        productId: product.id,
        name: product.name,
        description: product.description,
        unitPrice: product.price,
        quantity: 1
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
      this.state().map((item) => (item.productId === productId ? { ...item, quantity: normalizedQuantity } : item))
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

    if (!productId || !name || !Number.isFinite(unitPrice) || unitPrice < 0) return null;
    if (!Number.isFinite(quantity) || quantity <= 0) return null;

    return {
      productId,
      name,
      description: raw.description ? String(raw.description) : '',
      unitPrice,
      quantity: Math.min(MAX_RESTORED_QUANTITY, quantity)
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
