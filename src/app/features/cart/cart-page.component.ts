import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="card">
      <h1>Carrito</h1>
      <p *ngIf="!cart.items().length">Tu carrito está vacío.</p>

      <table *ngIf="cart.items().length">
        <thead>
          <tr><th>Producto</th><th>Cant.</th><th>Precio</th><th></th></tr>
        </thead>
        <tbody>
          <tr *ngFor="let item of cart.items()">
            <td>{{ item.name }}</td>
            <td>
              <button class="btn" (click)="cart.updateQuantity(item.productId, item.quantity-1)">-</button>
              {{ item.quantity }}
              <button class="btn" (click)="cart.updateQuantity(item.productId, item.quantity+1)">+</button>
            </td>
            <td>{{ item.unitPrice * item.quantity | currency:'USD' }}</td>
            <td><button class="btn btn-danger" (click)="cart.remove(item.productId)">Quitar</button></td>
          </tr>
        </tbody>
      </table>

      <h3>Total: {{ cart.subtotal() | currency:'USD' }}</h3>
      <a routerLink="/checkout" class="btn btn-primary" *ngIf="cart.items().length">Ir al checkout</a>
    </section>
  `,
  styles: [`table{width:100%;border-collapse:collapse}th,td{padding:.6rem;border-bottom:1px solid var(--border-soft)}`]
})
export class CartPageComponent {
  constructor(public readonly cart: CartService) {}
}
