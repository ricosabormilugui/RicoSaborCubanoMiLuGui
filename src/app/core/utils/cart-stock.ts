import { CartItem } from '../models/order.model';
import { isProductOrderable, Product } from '../models/product.model';

export const UNLIMITED_CART_QUANTITY = 99;

export function cartBaseProductId(item: Pick<CartItem, 'productId' | 'baseProductId'>): string {
  return String(item.baseProductId ?? item.productId.split('::')[0] ?? '').trim();
}

export function tracksInventory(item: Pick<CartItem, 'trackStock'> | Pick<Product, 'trackStock'> | null | undefined): boolean {
  return item?.trackStock === true;
}

export function availableStockForLine(item: CartItem, lines: readonly CartItem[]): number | null {
  if (!tracksInventory(item)) return null;
  const stock = Math.max(0, Math.floor(Number(item.stock ?? 0)));
  const baseId = cartBaseProductId(item);
  const reservedByOthers = lines
    .filter((line) => line.productId !== item.productId && cartBaseProductId(line) === baseId)
    .reduce((sum, line) => sum + Math.max(0, Math.floor(Number(line.quantity) || 0)), 0);
  return Math.max(0, stock - reservedByOthers);
}

export function maxQuantityForLine(item: CartItem, lines: readonly CartItem[]): number {
  const minimum = Math.max(1, Math.floor(Number(item.minimumQuantity ?? 1)) || 1);
  const available = availableStockForLine(item, lines);
  if (available === null) return UNLIMITED_CART_QUANTITY;
  return Math.max(0, available);
}

export function isLineOutOfStock(item: CartItem, lines: readonly CartItem[]): boolean {
  const available = availableStockForLine(item, lines);
  return available !== null && available <= 0;
}

export function isLineOverStock(item: CartItem, lines: readonly CartItem[]): boolean {
  const available = availableStockForLine(item, lines);
  return available !== null && available > 0 && item.quantity > available;
}

export function isLineBlockingCheckout(item: CartItem, lines: readonly CartItem[]): boolean {
  if (!tracksInventory(item)) return false;
  const available = availableStockForLine(item, lines);
  if (available === null) return false;
  return available <= 0 || item.quantity > available;
}

export function cartHasStockConflicts(lines: readonly CartItem[]): boolean {
  return lines.some((item) => isLineBlockingCheckout(item, lines));
}

export function lowStockThreshold(item: Pick<CartItem, 'lowStockAlert'>): number {
  const value = Math.floor(Number(item.lowStockAlert ?? 5));
  return Number.isFinite(value) && value > 0 ? value : 5;
}

export type StockHintKind = 'none' | 'low' | 'out' | 'conflict' | 'max';

export interface StockHint {
  kind: StockHintKind;
  message: string;
}

export function stockHintForLine(item: CartItem, lines: readonly CartItem[], attemptedOverMax = false): StockHint {
  if (!tracksInventory(item)) return { kind: 'none', message: '' };

  const available = availableStockForLine(item, lines);
  if (available === null) return { kind: 'none', message: '' };

  if (available <= 0) {
    return { kind: 'out', message: 'Producto agotado' };
  }

  if (item.quantity > available) {
    return {
      kind: 'conflict',
      message: `La disponibilidad de este producto ha cambiado. Solo quedan ${available} ${unitsLabel(available)}.`
    };
  }

  if (attemptedOverMax && item.quantity >= available) {
    return {
      kind: 'max',
      message: `Solo quedan ${available} ${unitsLabel(available)} disponibles.`
    };
  }

  if (available <= 2) {
    return {
      kind: 'low',
      message: available === 1 ? 'Última unidad' : `Últimas ${available} unidades`
    };
  }

  if (available <= lowStockThreshold(item)) {
    return { kind: 'low', message: `Quedan ${available} unidades` };
  }

  return { kind: 'none', message: '' };
}

export function formatStockConflictMessage(input: {
  productName?: string;
  requested?: number;
  available?: number;
}): string {
  const name = String(input.productName ?? 'este producto').trim() || 'este producto';
  const available = Number(input.available);
  const requested = Number(input.requested);

  if (Number.isFinite(available) && available <= 0) {
    return name === 'este producto' ? 'Este producto acaba de agotarse.' : `${name} acaba de agotarse.`;
  }

  if (Number.isFinite(requested) && requested > 0 && Number.isFinite(available)) {
    return `Ya no quedan ${requested} unidades de ${name}. Disponibles: ${available}.`;
  }

  if (Number.isFinite(available)) {
    return `La disponibilidad de ${name} ha cambiado. Solo quedan ${available} ${unitsLabel(available)}.`;
  }

  return `No hay stock suficiente para ${name}.`;
}

export type LiveAddToCartKind = 'ok' | 'sold_out' | 'limited';

export function evaluateLiveAddToCart(product: Product, requested = 1): {
  allowed: boolean;
  quantity: number;
  product: Product;
  kind: LiveAddToCartKind;
  message: string;
} {
  const minimum = Math.max(1, Math.floor(Number(product.minimumQuantity ?? 1)) || 1);
  const quantity = Math.max(minimum, Math.floor(Number(requested)) || minimum);

  if (!tracksInventory(product)) {
    return { allowed: true, quantity, product, kind: 'ok', message: '' };
  }

  const stock = Math.max(0, Math.floor(Number(product.stock ?? 0)));
  if (!isProductOrderable(product) || stock <= 0) {
    return {
      allowed: false,
      quantity: 0,
      product,
      kind: 'sold_out',
      message: 'Este producto acaba de agotarse.'
    };
  }

  if (quantity > stock) {
    if (stock < minimum) {
      return {
        allowed: false,
        quantity: 0,
        product,
        kind: 'limited',
        message: `Solo quedan ${stock} unidades disponibles.`
      };
    }
    return {
      allowed: true,
      quantity: stock,
      product,
      kind: 'limited',
      message: `Solo quedan ${stock} unidades disponibles.`
    };
  }

  return { allowed: true, quantity, product, kind: 'ok', message: '' };
}

export function inventorySnapshotFromProduct(product: Product): Pick<CartItem, 'imageUrl' | 'trackStock' | 'stock' | 'lowStockAlert'> {
  return {
    imageUrl: String(product.imageUrl ?? '').trim() || undefined,
    trackStock: product.trackStock === true,
    stock: product.trackStock ? Math.max(0, Math.floor(Number(product.stock ?? 0))) : undefined,
    lowStockAlert: lowStockThreshold(product)
  };
}

export function compactCustomizationSummary(item: Pick<CartItem, 'customization'>): string {
  return (item.customization ?? [])
    .map((option) => String(option.value ?? '').trim())
    .filter(Boolean)
    .join(' · ');
}

function unitsLabel(count: number): string {
  return count === 1 ? 'unidad' : 'unidades';
}
