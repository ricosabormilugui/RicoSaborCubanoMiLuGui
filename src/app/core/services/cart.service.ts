import { Injectable, OnDestroy, computed, linkedSignal } from '@angular/core';
import { ActiveIdentityService, GUEST_IDENTITY, StorageIdentity, getStorageKey } from './active-identity.service';
import { CartCustomizationSelection, CartItem } from '../models/order.model';
import { isProductCustomizable, Product } from '../models/product.model';
import {
  availableStockForLine,
  cartHasStockConflicts,
  inventorySnapshotFromProduct,
  isLineBlockingCheckout,
  maxQuantityForLine,
  stockHintForLine,
  tracksInventory,
  UNLIMITED_CART_QUANTITY
} from '../utils/cart-stock';
import { buildCustomizationOptionId, calculateFinalUnitPrice, getCustomizationGroupKeyByLabel, getPriceModifier, roundMoney } from '../utils/customization-pricing';

const CART_SCHEMA_VERSION = 3;
const SUPPORTED_CART_SCHEMA_VERSIONS = new Set([2, CART_SCHEMA_VERSION]);
const MAX_RESTORED_QUANTITY = UNLIMITED_CART_QUANTITY;

interface StoredCartState {
  version: number;
  items: CartItem[];
}

@Injectable({ providedIn: 'root' })
export class CartService implements OnDestroy {
  private lastPersistedValue = '';
  private readonly state = linkedSignal<CartItem[]>(() => {
    this.identity.session();
    this.lastPersistedValue = '';
    return this.restoreCart();
  });
  private readonly onStorage = (event: StorageEvent): void => {
    if (event.key === this.identity.storageKey('cart') || event.key === null) this.state.set(this.restoreCart());
  };
  constructor(private readonly identity: ActiveIdentityService) { globalThis.addEventListener?.('storage', this.onStorage); }
  ngOnDestroy(): void { globalThis.removeEventListener?.('storage', this.onStorage); }

  readonly items = computed(() => this.state());
  readonly subtotal = computed(() => roundMoney(this.items().reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)));
  readonly totalItems = computed(() => this.items().reduce((sum, item) => sum + item.quantity, 0));
  readonly hasStockConflicts = computed(() => cartHasStockConflicts(this.items()));

  add(product: Product, customization: CartCustomizationSelection[] = [], amount = 1): void {
    const configurationId = buildConfigurationId(customization);
    const productId = configurationId ? `${product.id}::${configurationId}` : product.id;
    const inventory = inventorySnapshotFromProduct(product);
    const existing = this.state().find((item) => item.productId === productId);
    const addedQuantity = normalizePositiveInteger(amount, 1);
    const minimumQuantity = normalizePositiveInteger(product.minimumQuantity, 1);
    const basePrice = roundMoney(Number(product.price ?? 0));
    const unitPrice = calculateFinalUnitPrice(basePrice, customization);
    if (existing) {
      const next = { ...existing, ...inventory, basePrice, unitPrice, customization: customization.length ? customization : undefined, requiresAdvancePayment: isProductCustomizable(product), minimumQuantity, unitLabel: String(product.unitLabel ?? '').trim() || undefined };
      const capped = this.clampQuantity(existing.quantity + addedQuantity, next, this.state());
      this.setItems(this.state().map((item) => (item.productId === productId ? { ...next, quantity: Math.max(minimumQuantity, capped) } : item)));
      return;
    }

    const draft: CartItem = {
      productId,
      baseProductId: product.id,
      configurationId: configurationId || undefined,
      name: product.name,
      description: product.description,
      imageUrl: inventory.imageUrl,
      unitPrice,
      basePrice,
      quantity: Math.max(minimumQuantity, addedQuantity),
      minimumQuantity,
      unitLabel: String(product.unitLabel ?? '').trim() || undefined,
      requiresAdvancePayment: isProductCustomizable(product),
      customization: customization.length ? customization : undefined,
      trackStock: inventory.trackStock,
      stock: inventory.stock,
      lowStockAlert: inventory.lowStockAlert
    };
    draft.quantity = Math.max(minimumQuantity, this.clampQuantity(draft.quantity, draft, [...this.state(), draft]));

    this.setItems([...this.state(), draft]);
  }

  updateQuantity(productId: string, quantity: number): void {
    const normalizedQuantity = Math.floor(Number(quantity));
    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
      this.remove(productId);
      return;
    }

    const items = this.state();
    this.setItems(
      items.map((item) => {
        if (item.productId !== productId) return item;
        const minimum = normalizePositiveInteger(item.minimumQuantity, 1);
        return { ...item, quantity: Math.max(minimum, this.clampQuantity(normalizedQuantity, item, items)) };
      })
    );
  }

  increment(productId: string): { applied: boolean; available: number | null } {
    const items = this.state();
    const item = items.find((entry) => itemMatches(entry, productId));
    if (!item) return { applied: false, available: null };
    if (item.unavailable) return { applied: false, available: 0 };
    if (isLineBlockingCheckout(item, items) && (availableStockForLine(item, items) ?? 0) <= 0) {
      return { applied: false, available: 0 };
    }
    const available = availableStockForLine(item, items);
    const next = item.quantity + 1;
    if (available !== null && next > available) return { applied: false, available };
    this.updateQuantity(productId, next);
    return { applied: true, available };
  }

  decrement(productId: string): boolean {
    const item = this.state().find((entry) => itemMatches(entry, productId));
    if (!item) return false;
    const minimum = normalizePositiveInteger(item.minimumQuantity, 1);
    if (item.quantity <= minimum) return false;
    this.updateQuantity(productId, item.quantity - 1);
    return true;
  }

  adjustToAvailable(productId: string): boolean {
    const items = this.state();
    const item = items.find((entry) => itemMatches(entry, productId));
    if (!item) return false;
    const available = availableStockForLine(item, items);
    if (available === null || available <= 0) return false;
    const minimum = normalizePositiveInteger(item.minimumQuantity, 1);
    this.updateQuantity(productId, Math.max(minimum, available));
    return true;
  }

  syncInventory(products: readonly Product[], options?: { pruneMissing?: boolean }): void {
    const pruneMissing = options?.pruneMissing === true;
    if (!products.length && !pruneMissing) return;
    const byId = new Map(products.map((product) => [product.id, product]));
    this.setItems(this.state().map((item) => {
      const product = byId.get(cartBaseId(item));
      if (!product) {
        return pruneMissing ? { ...item, unavailable: true } : item;
      }
      const snapshot = inventorySnapshotFromProduct(product);
      const unavailable = product.available === false || product.published === false;
      return {
        ...item,
        imageUrl: snapshot.imageUrl || item.imageUrl,
        trackStock: snapshot.trackStock,
        stock: snapshot.trackStock ? snapshot.stock : undefined,
        lowStockAlert: snapshot.lowStockAlert,
        name: String(product.name ?? item.name),
        unavailable
      };
    }));
  }

  applyRemoteStock(productId: string, available: number): void {
    const baseId = String(productId ?? '').split('::')[0].trim();
    const stock = Math.max(0, Math.floor(Number(available)));
    if (!baseId || !Number.isFinite(stock)) return;
    this.setItems(this.state().map((item) => (
      cartBaseId(item) === baseId
        ? { ...item, trackStock: true, stock }
        : item
    )));
  }

  canDecrement(item: CartItem): boolean {
    return item.quantity > normalizePositiveInteger(item.minimumQuantity, 1);
  }

  canIncrement(item: CartItem): boolean {
    if (item.unavailable) return false;
    const available = availableStockForLine(item, this.items());
    if (available === null) return item.quantity < UNLIMITED_CART_QUANTITY;
    return available > 0 && item.quantity < available;
  }

  stockHint(item: CartItem, attemptedOverMax = false) {
    return stockHintForLine(item, this.items(), attemptedOverMax);
  }

  maxQuantity(item: CartItem): number {
    return maxQuantityForLine(item, this.items());
  }

  tracksStock(item: CartItem): boolean {
    return tracksInventory(item);
  }

  remove(productId: string): void {
    this.setItems(this.state().filter((item) => item.productId !== productId));
  }

  clear(): void {
    this.setItems([]);
  }

  readIdentityCart(identity: StorageIdentity): CartItem[] {
    return this.readCart(getStorageKey('cart', identity));
  }

  adoptGuestCart(): boolean {
    const identity = this.identity.identity();
    if (identity?.type !== 'user') return true;

    const guestItems = this.readIdentityCart(GUEST_IDENTITY);
    if (!guestItems.length) return true;

    const merged = this.normalizeItems([...this.state(), ...guestItems]);
    if (!this.writeCart(getStorageKey('cart', identity), merged)) return false;

    this.state.set(merged);
    this.lastPersistedValue = this.serializeCart(merged);
    this.clearIdentityCart(GUEST_IDENTITY);
    return true;
  }

  clearIdentityCart(identity: StorageIdentity): void {
    try {
      globalThis.localStorage?.removeItem(getStorageKey('cart', identity));
    } catch {
      // Guest leftovers are only removed after the destination persist already succeeded.
    }
    if (this.identitiesMatch(this.identity.identity(), identity)) {
      this.state.set([]);
      this.lastPersistedValue = this.serializeCart([]);
    }
  }

  private identitiesMatch(left: StorageIdentity | null, right: StorageIdentity): boolean {
    if (!left) return false;
    if (left.type === 'guest' || right.type === 'guest') return left.type === right.type;
    return left.userId === right.userId;
  }

  private setItems(items: CartItem[]): void {
    this.state(); // Resolve a changed identity before mutating or comparing persisted values.
    if (!this.identity.storageKey('cart')) return;
    this.state.set(items);
    this.persistCart(items);
  }

  private restoreCart(): CartItem[] {
    try {
      const key = this.identity.storageKey('cart');
      if (!key) return [];
      const normalized = this.readCart(key);
      const serialized = this.serializeCart(normalized);
      this.lastPersistedValue = serialized;
      return normalized;
    } catch {
      return [];
    }
  }

  private readCart(key: string): CartItem[] {
    try {
      const raw = globalThis.localStorage?.getItem(key);
      if (!raw) return [];

      const parsed = JSON.parse(raw) as Partial<StoredCartState> | CartItem[];
      const isLegacyCart = Array.isArray(parsed);
      const isSupportedCart = !isLegacyCart && SUPPORTED_CART_SCHEMA_VERSIONS.has(Number(parsed.version));
      if (!isLegacyCart && !isSupportedCart) return [];

      const items = isLegacyCart ? parsed : parsed.items;
      const normalized = this.normalizeItems(items ?? []);
      const serialized = this.serializeCart(normalized);

      if (serialized !== raw) {
        globalThis.localStorage?.setItem(key, serialized);
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
          quantity: Math.min(MAX_RESTORED_QUANTITY, existing.quantity + normalized.quantity),
          unavailable: existing.unavailable === true || normalized.unavailable === true
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
      imageUrl: String(raw.imageUrl ?? '').trim() || undefined,
      unitPrice,
      basePrice,
      quantity: Math.max(minimumQuantity, Math.min(MAX_RESTORED_QUANTITY, quantity)),
      minimumQuantity,
      unitLabel: String(raw.unitLabel ?? '').trim() || undefined,
      baseProductId,
      configurationId: configurationId || undefined,
      requiresAdvancePayment: Boolean(raw.requiresAdvancePayment) || Boolean(customization?.length),
      customization,
      trackStock: raw.trackStock === true,
      stock: raw.trackStock === true ? Math.max(0, Math.floor(Number(raw.stock ?? 0))) : undefined,
      lowStockAlert: Number.isFinite(Number(raw.lowStockAlert)) ? Math.max(0, Math.floor(Number(raw.lowStockAlert))) : undefined,
      unavailable: raw.unavailable === true
    };
  }

  private clampQuantity(quantity: number, item: CartItem, lines: CartItem[]): number {
    const available = availableStockForLine({ ...item, quantity }, lines);
    if (available === null) return Math.min(MAX_RESTORED_QUANTITY, quantity);
    return Math.min(quantity, available);
  }

  private persistCart(items: CartItem[]): boolean {
    const key = this.identity.storageKey('cart');
    return key ? this.writeCart(key, items) : false;
  }

  private writeCart(key: string, items: CartItem[]): boolean {
    try {
      const serialized = this.serializeCart(items);
      if (serialized === this.lastPersistedValue && key === this.identity.storageKey('cart')) return true;
      const storage = globalThis.localStorage;
      if (!storage) return false;
      storage.setItem(key, serialized);
      if (key === this.identity.storageKey('cart')) this.lastPersistedValue = serialized;
      return true;
    } catch {
      return false;
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

function itemMatches(item: CartItem, productId: string): boolean {
  return item.productId === productId;
}

function cartBaseId(item: CartItem): string {
  return String(item.baseProductId ?? item.productId.split('::')[0] ?? '').trim();
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
