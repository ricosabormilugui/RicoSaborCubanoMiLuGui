import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="cart-card card">
      <h1>Carrito</h1>
      <p class="empty-cart" *ngIf="!cart.items().length">Tu carrito está vacío.</p>

      <div class="cart-list" *ngIf="cart.items().length" aria-label="Productos en el carrito">
        <div class="cart-head" aria-hidden="true">
          <span>Producto</span>
          <span>Cant.</span>
          <span>Precio</span>
          <span></span>
        </div>

        <article class="cart-item" *ngFor="let item of cart.items()">
          <div class="item-main">
            <span class="mobile-label">Producto</span>
            <strong class="item-name">{{ item.name }}</strong>
          </div>

          <div class="quantity-cell">
            <span class="mobile-label">Cantidad</span>
            <div class="quantity-controls" [attr.aria-label]="'Cantidad de ' + item.name">
              <button class="qty-btn" type="button" (click)="cart.updateQuantity(item.productId, item.quantity-1)" [attr.aria-label]="'Reducir cantidad de ' + item.name">−</button>
              <span class="qty-value">{{ item.quantity }}</span>
              <button class="qty-btn" type="button" (click)="cart.updateQuantity(item.productId, item.quantity+1)" [attr.aria-label]="'Aumentar cantidad de ' + item.name">+</button>
            </div>
          </div>

          <div class="price-cell">
            <span class="mobile-label">Precio</span>
            <strong>{{ item.unitPrice * item.quantity | currency:'USD' }}</strong>
          </div>

          <div class="remove-cell">
            <button class="btn btn-danger remove-btn" type="button" (click)="cart.remove(item.productId)">Quitar</button>
          </div>
        </article>
      </div>

      <div class="cart-footer" *ngIf="cart.items().length">
        <div class="total-row">
          <span>Total</span>
          <strong>{{ cart.subtotal() | currency:'USD' }}</strong>
        </div>
        <a routerLink="/checkout" class="btn btn-primary checkout-btn">Ir al checkout</a>
      </div>
    </section>
  `,
  styles: [
    `.cart-card{display:grid;gap:1rem;width:100%;max-width:100%;min-width:0;overflow:hidden}`,
    `h1{margin:0;color:var(--text-main);font-size:clamp(1.8rem,6vw,2.5rem);line-height:1.1;overflow-wrap:anywhere}`,
    `.empty-cart{margin:0;color:var(--text-soft);font-weight:700}`,
    `.cart-list{display:grid;gap:.75rem;width:100%;max-width:100%;min-width:0;overflow:hidden}`,
    `.cart-head{display:none}`,
    `.cart-item{display:grid;gap:.72rem;width:100%;max-width:100%;min-width:0;overflow:hidden;border:1px solid color-mix(in srgb,var(--border-soft) 78%,transparent);border-radius:14px;padding:.78rem;background:color-mix(in srgb,var(--surface-0) 86%,var(--surface-1) 14%)}`,
    `.item-main,.quantity-cell,.price-cell,.remove-cell{min-width:0;max-width:100%}`,
    `.item-main,.quantity-cell,.price-cell{display:grid;gap:.28rem}`,
    `.mobile-label{color:var(--text-soft);font-size:.78rem;font-weight:900;text-transform:uppercase;letter-spacing:.03em}`,
    `.item-name{display:-webkit-box;max-width:100%;color:var(--text-main);line-height:1.25;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}`,
    `.quantity-controls{display:inline-grid;grid-template-columns:38px minmax(2.25rem,auto) 38px;align-items:center;justify-self:start;min-width:0;border:1px solid var(--border-soft);border-radius:12px;overflow:hidden;background:var(--surface-1)}`,
    `.qty-btn{width:38px;height:38px;border:0;background:transparent;color:var(--text-main);font-size:1.05rem;font-weight:900;cursor:pointer}`,
    `.qty-btn:hover,.qty-btn:focus-visible{background:var(--hover-surface);outline:2px solid color-mix(in srgb,var(--accent-green) 40%,transparent);outline-offset:-2px}`,
    `.qty-value{min-width:2.25rem;text-align:center;color:var(--text-main);font-weight:900}`,
    `.price-cell strong{color:var(--accent-green);font-size:1.05rem;overflow-wrap:anywhere}`,
    `.remove-btn{width:100%;min-height:40px;white-space:normal;line-height:1.15}`,
    `.cart-footer{display:grid;gap:.85rem;min-width:0;border-top:1px solid var(--border-soft);padding-top:1rem}`,
    `.total-row{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;min-width:0;color:var(--text-main);font-size:1.1rem}`,
    `.total-row span{font-weight:900}`,
    `.total-row strong{color:var(--accent-green);font-size:clamp(1.25rem,6vw,1.55rem);text-align:right;overflow-wrap:anywhere}`,
    `.checkout-btn{display:inline-grid;place-items:center;width:100%;max-width:100%;min-height:46px;text-align:center;text-decoration:none;white-space:normal;line-height:1.15}`,
    `@media(min-width:720px){.cart-card{gap:1.1rem}.cart-list{gap:0;border:1px solid var(--border-soft);border-radius:14px;overflow:hidden}.cart-head,.cart-item{display:grid;grid-template-columns:minmax(0,1fr) minmax(150px,.42fr) minmax(120px,.32fr) minmax(110px,.26fr);gap:.85rem;align-items:center}.cart-head{padding:.72rem .85rem;background:color-mix(in srgb,var(--surface-2) 42%,transparent);color:var(--text-soft);font-weight:900}.cart-item{border:0;border-radius:0;border-top:1px solid var(--border-soft);background:var(--surface-0);padding:.85rem}.cart-item:first-of-type{border-top:0}.mobile-label{display:none}.remove-btn{width:auto;justify-self:end}.cart-footer{grid-template-columns:minmax(0,1fr) auto;align-items:center}.total-row{justify-content:flex-end}.checkout-btn{width:auto;min-width:190px}}`,
    `@media(max-width:360px){.cart-card{padding:.85rem}.cart-item{padding:.68rem}.quantity-controls{grid-template-columns:34px minmax(2rem,auto) 34px}.qty-btn{width:34px;height:36px}.remove-btn,.checkout-btn{min-height:44px}}`
  ]
})
export class CartPageComponent {
  constructor(public readonly cart: CartService) {}
}
