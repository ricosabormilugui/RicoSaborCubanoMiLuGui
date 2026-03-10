import { Injectable, computed, signal } from '@angular/core';
import { CartItem } from '../models/order.model';
import { Product } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly state = signal<CartItem[]>([]);
  readonly items = computed(() => this.state());
  readonly subtotal = computed(() => this.items().reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
  readonly totalItems = computed(() => this.items().reduce((sum, item) => sum + item.quantity, 0));

  add(product: Product): void {
    const existing = this.state().find((item) => item.productId === product.id);
    if (existing) {
      this.updateQuantity(product.id, existing.quantity + 1);
      return;
    }
    this.state.update((items) => [
      ...items,
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
    if (quantity <= 0) {
      this.remove(productId);
      return;
    }
    this.state.update((items) =>
      items.map((item) => (item.productId === productId ? { ...item, quantity } : item))
    );
  }

  remove(productId: string): void {
    this.state.update((items) => items.filter((item) => item.productId !== productId));
  }

  clear(): void {
    this.state.set([]);
  }
}
