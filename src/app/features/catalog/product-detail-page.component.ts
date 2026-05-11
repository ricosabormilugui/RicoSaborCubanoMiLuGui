import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { CatalogService } from '../../core/services/catalog.service';
import { NotificationService } from '../../core/services/notification.service';
import { Product } from '../../core/models/product.model';
import { findProductBySlugOrId, getProductRoute, selectBestSellers } from '../../core/models/product-filter';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="detail-page">
      <a class="back-link" routerLink="/">← Volver al catálogo</a>

      <ng-container *ngIf="product(); else notFound">
        <article class="detail-card card">
          <div class="image-panel">
            <img [src]="product()!.imageUrl || fallbackImage" [alt]="product()!.name" />
          </div>

          <div class="info-panel">
            <span class="tag" *ngIf="product()!.category">{{ product()!.category }}</span>
            <h1>{{ product()!.name }}</h1>
            <strong class="price">{{ product()!.price | currency:'EUR' }}</strong>
            <p class="description">{{ product()!.description || 'Producto casero preparado por Rico Sabor Cubano.' }}</p>

            <div class="purchase-row">
              <label class="quantity-field">
                Cantidad
                <input type="number" min="1" max="99" [ngModel]="quantity()" (ngModelChange)="setQuantity($event)" />
              </label>
              <button class="btn btn-primary" type="button" (click)="addToCart(product()!)">
                Añadir al carrito
              </button>
            </div>
          </div>
        </article>

        <section class="related" *ngIf="relatedProducts().length">
          <div class="related-head">
            <h2>Más vendidos</h2>
            <span>También te puede gustar</span>
          </div>
          <div class="mini-grid">
            <article class="mini-product" *ngFor="let item of relatedProducts()">
              <a [routerLink]="productRoute(item)">
                <img [src]="item.imageUrl || fallbackImage" [alt]="item.name" loading="lazy" />
              </a>
              <div>
                <a class="mini-name" [routerLink]="productRoute(item)">{{ item.name }}</a>
                <strong>{{ item.price | currency:'EUR' }}</strong>
                <button class="btn btn-secondary" type="button" (click)="addToCart(item, 1)">Añadir</button>
              </div>
            </article>
          </div>
        </section>
      </ng-container>

      <ng-template #notFound>
        <div class="not-found card">
          <h1>Producto no encontrado</h1>
          <p>No encontramos el producto solicitado. Puede que ya no esté disponible o que el enlace no sea correcto.</p>
          <a class="btn btn-primary" routerLink="/">Volver al catálogo</a>
        </div>
      </ng-template>
    </section>
  `,
  styles: [
    `.detail-page{display:grid;gap:.95rem;padding:.9rem 0 2.4rem}`,
    `.back-link{justify-self:start;color:var(--accent-green);font-weight:800;text-decoration:none}`,
    `.back-link:hover,.back-link:focus-visible{color:var(--text-main);outline:2px solid color-mix(in srgb,var(--accent-green) 55%,transparent);outline-offset:3px;border-radius:6px}`,
    `.detail-card{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(320px,.92fr);gap:clamp(1rem,3vw,1.8rem);padding:clamp(1rem,3vw,1.45rem);background:linear-gradient(135deg,color-mix(in srgb,var(--surface-1) 28%,var(--surface-0) 72%),var(--surface-0));border-color:color-mix(in srgb,var(--border-soft) 78%,transparent)}`,
    `.image-panel{border-radius:16px;overflow:hidden;background:color-mix(in srgb,var(--surface-1) 62%,var(--bg-elevated) 38%);border:1px solid color-mix(in srgb,var(--border-soft) 78%,transparent)}`,
    `.image-panel img{width:100%;height:100%;min-height:360px;max-height:560px;object-fit:cover;display:block}`,
    `.info-panel{display:grid;align-content:center;gap:.82rem}`,
    `.tag{justify-self:start;border:1px solid color-mix(in srgb,var(--border-soft) 78%,transparent);border-radius:999px;color:var(--text-soft);font-size:.86rem;font-weight:800;padding:.25rem .7rem;text-transform:capitalize;background:color-mix(in srgb,var(--surface-2) 38%,transparent)}`,
    `h1{margin:0;color:var(--text-main);font-size:clamp(2rem,5vw,3.35rem);line-height:1.05}`,
    `.price{color:var(--accent-green);font-size:clamp(1.6rem,4vw,2.3rem)}`,
    `.description{color:var(--text-soft);font-size:1.05rem;line-height:1.65;margin:0}`,
    `.purchase-row{display:flex;gap:.8rem;align-items:end;flex-wrap:wrap;margin-top:.35rem}`,
    `.quantity-field{display:grid;gap:.35rem;color:var(--text-soft);font-weight:800}`,
    `.quantity-field input{width:92px}`,
    `.related{border-top:1px solid color-mix(in srgb,var(--border-soft) 78%,transparent);padding-top:1.25rem}`,
    `.related-head{display:flex;align-items:end;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-bottom:.85rem}`,
    `.related h2{margin:0;color:var(--accent-red);font-size:clamp(1.45rem,4vw,2rem)}`,
    `.related-head span{color:var(--text-soft)}`,
    `.mini-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.75rem}`,
    `.mini-product{display:grid;grid-template-columns:76px 1fr;gap:.72rem;align-items:center;background:color-mix(in srgb,var(--surface-0) 86%,var(--surface-1) 14%);border:1px solid color-mix(in srgb,var(--border-soft) 76%,transparent);border-radius:15px;padding:.68rem;min-width:0;box-shadow:0 7px 16px rgba(0,0,0,.09)}`,
    `.mini-product img{width:76px;height:76px;border-radius:11px;object-fit:cover;background:var(--surface-1)}`,
    `.mini-name{display:block;margin:0 0 .2rem;font-size:.95rem;font-weight:800;color:var(--text-main);line-height:1.2;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`,
    `.mini-name:hover{color:var(--accent-green)}`,
    `.mini-product strong{display:block;color:var(--accent-green);margin-bottom:.35rem}`,
    `.mini-product .btn{padding:.4rem .58rem;font-size:.84rem}`,
    `.not-found{max-width:720px;margin:2rem auto;text-align:center}`,
    `.not-found h1{font-size:clamp(1.8rem,4vw,2.6rem)}`,
    `.not-found p{color:var(--text-soft);line-height:1.55}`,
    `.not-found .btn{display:inline-block;text-decoration:none}`,
    `@media(max-width:820px){.detail-card{grid-template-columns:1fr}.image-panel img{min-height:260px;max-height:420px}.purchase-row{align-items:stretch}.purchase-row .btn{flex:1}}`,
    `@media(max-width:640px){.detail-page{padding-top:.5rem}.image-panel img{min-height:230px}.mini-grid{display:flex;overflow-x:auto;padding-bottom:.4rem;scroll-snap-type:x mandatory}.mini-product{min-width:250px;scroll-snap-align:start}.purchase-row{display:grid}.quantity-field input{width:100%}}`
  ]
})
export class ProductDetailPageComponent {
  readonly fallbackImage = 'https://images.unsplash.com/photo-1543353071-873f17a7a088?w=900';
  readonly productParam = signal('');
  readonly quantity = signal(1);

  readonly product = computed(() => findProductBySlugOrId(this.catalog.products(), this.productParam()));
  readonly relatedProducts = computed(() => selectBestSellers(this.catalog.products(), 4, this.product()?.id));

  constructor(
    public readonly cart: CartService,
    private readonly catalog: CatalogService,
    private readonly notifications: NotificationService,
    private readonly route: ActivatedRoute
  ) {
    void this.catalog.loadProducts();
    this.route.paramMap.subscribe((params) => {
      this.productParam.set(params.get('slug') ?? '');
      this.quantity.set(1);
    });
  }

  setQuantity(value: number | string): void {
    const parsed = Number(value);
    this.quantity.set(Number.isFinite(parsed) && parsed > 0 ? Math.min(99, Math.floor(parsed)) : 1);
  }

  productRoute(product: Product): string[] {
    return getProductRoute(product);
  }

  addToCart(product: Product, amount = this.quantity()): void {
    const quantity = Math.max(1, Math.floor(amount));
    for (let index = 0; index < quantity; index += 1) {
      this.cart.add(product);
    }
    const suffix = quantity > 1 ? ` (${quantity} uds.)` : '';
    this.notifications.info('Producto añadido', `${product.name}${suffix} se agregó al carrito.`);
  }
}
