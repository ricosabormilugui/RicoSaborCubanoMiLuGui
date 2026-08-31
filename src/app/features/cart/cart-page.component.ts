import { NotificationService } from '../../core/services/notification.service';
import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartItem } from '../../core/models/order.model';
import { CartService } from '../../core/services/cart.service';
import { CatalogService } from '../../core/services/catalog.service';
import { CouponDraftService } from '../../core/services/coupon.service';
import { CartLineComponent } from '../../shared/ui/cart-line.component';

@Component({
  standalone: true,
  imports: [CurrencyPipe, RouterLink, CartLineComponent],
  templateUrl: './cart-page.component.html',
  styleUrls: ['./cart-page.component.css']
})
export class CartPageComponent {
  private readonly notifications = inject(NotificationService);
  readonly coupon = inject(CouponDraftService);
  readonly couponMessage = signal('');

  constructor(
    public readonly cart: CartService,
    private readonly catalog: CatalogService
  ) {
    this.syncFromCatalog();
    void this.refreshInventory();
  }

  private syncFromCatalog(): void {
    const products = this.catalog.products();
    if (products.length) this.cart.syncInventory(products);
  }

  private async refreshInventory(): Promise<void> {
    await this.catalog.refreshAvailability();
    this.syncFromCatalog();
  }

  couponDiscount(): number {
    return this.coupon.discount(this.cart.subtotal());
  }

  orderPreview(): number {
    return Number((this.cart.subtotal() - this.couponDiscount()).toFixed(2));
  }

  setCouponCode(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.coupon.setCode(input?.value ?? '');
    this.couponMessage.set('');
  }

  applyCouponPreview(): void {
    const result = this.coupon.apply();
    this.couponMessage.set(result.message);
  }

  applyCouponWithFeedback(): void {
    this.applyCouponPreview();
    if (!this.coupon.code()) return;
    const history = { action: { label: 'Ver carrito', url: '/carrito' } };
    if (this.coupon.applied()) {
      this.notifications.success('Cupón preaplicado', 'Se validará al confirmar el pedido.', {
        saveToHistory: true,
        history: { ...history, message: 'Pendiente de la validación del servidor al confirmar el pedido.' }
      });
    } else {
      this.notifications.warning('Cupón rechazado', this.couponMessage(), { saveToHistory: true, history });
    }
  }

  removeCoupon(): void {
    this.coupon.clear();
    this.couponMessage.set('');
  }

  onRemoved(item: CartItem): void {
    this.notifications.info('Producto eliminado del carrito', item.name, {
      key: 'cart-remove:' + item.productId,
      saveToHistory: true,
      history: { action: { label: 'Ver carrito', url: '/carrito' } }
    });
  }
}
