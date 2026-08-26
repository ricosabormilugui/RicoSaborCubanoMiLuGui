import { NotificationService } from '../../core/services/notification.service';
import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { IconComponent } from '../../shared/ui/icon.component';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  templateUrl: './cart-page.component.html',
  styleUrls: ['./cart-page.component.css']
})
export class CartPageComponent {
  private readonly notifications = inject(NotificationService);
  constructor(public readonly cart: CartService) {}

  removeItem(productId: string): void {
    const item = this.cart.items().find(item => item.productId === productId);
    if (!item) return;
    this.cart.remove(productId);
    this.notifications.info('Producto eliminado del carrito', item.name, { key: 'cart-remove:' + productId, saveToHistory: true, history: { action: { label: 'Ver carrito', url: '/carrito' } } });
  }
}
