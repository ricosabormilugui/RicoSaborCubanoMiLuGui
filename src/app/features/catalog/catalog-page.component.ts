import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { CatalogService } from '../../core/services/catalog.service';
import { NotificationService } from '../../core/services/notification.service';
import { Product } from '../../core/models/product.model';
import { filterProducts, getProductRoute, selectBestSellers } from '../../core/models/product-filter';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="hero">
      <h1>¿Qué quieres comer hoy?</h1>
      <p>Cocina cubana y platos caseros listos para pedir.</p>

      <div class="quick-categories" aria-label="Categorías rápidas">
        <button class="cat-pill" type="button" [class.active]="category() === ''" (click)="setCategory('')">Todos</button>
        <button class="cat-pill" type="button" [class.active]="category() === 'combos'" (click)="setCategory('combos')">Combos</button>
        <button class="cat-pill" type="button" [class.active]="category() === 'platos'" (click)="setCategory('platos')">Platos</button>
        <button class="cat-pill" type="button" [class.active]="category() === 'bebidas'" (click)="setCategory('bebidas')">Bebidas</button>
        <button class="cat-pill" type="button" [class.active]="category() === 'extras'" (click)="setCategory('extras')">Extras</button>
      </div>

      <div class="filters">
        <input [ngModel]="query()" (ngModelChange)="setQuery($event)" placeholder="Buscar por nombre, descripción o categoría..." aria-label="Buscar productos" />
        <select [ngModel]="category()" (ngModelChange)="setCategory($event)" aria-label="Filtrar por categoría">
          <option value="">Todas las categorías</option>
          <option value="combos">Combos</option>
          <option value="platos">Platos</option>
          <option value="bebidas">Bebidas</option>
          <option value="extras">Extras</option>
        </select>
      </div>
    </section>

    <section class="products-wrap">
      <div class="section-head">
        <div>
          <h2 class="section-title">Catálogo</h2>
          <p class="results-count" *ngIf="filteredProducts().length">{{ filteredProducts().length }} producto(s) disponibles</p>
        </div>
        <span class="section-note">Entra al detalle para ver ingredientes y descripción completa.</span>
      </div>

      <div class="empty-state" *ngIf="!filteredProducts().length">No se encontraron productos.</div>

      <div class="grid" *ngIf="filteredProducts().length">
        <article class="product" *ngFor="let product of filteredProducts()">
          <a class="image-link" [routerLink]="productRoute(product)" [attr.aria-label]="'Ver detalle de ' + product.name">
            <img [src]="product.imageUrl || fallbackImage" [alt]="product.name" loading="lazy" />
          </a>
          <div class="content">
            <span class="tag" *ngIf="product.category">{{ product.category }}</span>
            <a class="product-name" [routerLink]="productRoute(product)">{{ product.name }}</a>
            <strong>{{ product.price | currency:'EUR' }}</strong>
            <div class="actions">
              <button class="btn btn-primary" type="button" (click)="addToCart(product)">+ Añadir</button>
              <a class="btn btn-secondary details-link" [routerLink]="productRoute(product)">Ver producto</a>
            </div>
          </div>
        </article>
      </div>
    </section>

    <section class="best-sellers" *ngIf="bestSellers().length">
      <div class="best-sellers-head">
        <h2 class="section-title">Más vendidos</h2>
        <span>Favoritos de nuestros clientes</span>
      </div>
      <div class="mini-grid">
        <article class="mini-product" *ngFor="let product of bestSellers()">
          <a [routerLink]="productRoute(product)">
            <img [src]="product.imageUrl || fallbackImage" [alt]="product.name" loading="lazy" />
          </a>
          <div>
            <a class="mini-name" [routerLink]="productRoute(product)">{{ product.name }}</a>
            <strong>{{ product.price | currency:'EUR' }}</strong>
            <button class="btn btn-secondary" type="button" (click)="addToCart(product)">Añadir</button>
          </div>
        </article>
      </div>
    </section>
  `,
  styles: [
    `.hero{padding:clamp(1.15rem,3vw,1.75rem) 0 1.15rem;text-align:center}`,
    `.hero h1{margin:0;color:var(--accent-green);font-size:clamp(2rem,5vw,3rem);line-height:1.05}`,
    `.hero p{color:var(--text-soft);margin:.35rem 0 .85rem}`,
    `.quick-categories{display:flex;gap:.5rem;flex-wrap:wrap;justify-content:center;margin-bottom:.8rem}`,
    `.cat-pill{border:1px solid color-mix(in srgb,var(--border-soft) 80%,transparent);border-radius:999px;padding:.42rem .86rem;font-weight:700;background:color-mix(in srgb,var(--surface-1) 62%,var(--bg-elevated) 38%);color:var(--text-main);cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.08)}`,
    `.cat-pill:hover,.cat-pill:focus-visible,.cat-pill.active{background:color-mix(in srgb,var(--surface-2) 84%,var(--bg-elevated) 16%);border-color:color-mix(in srgb,var(--accent-green) 45%,var(--border-soft));outline:2px solid color-mix(in srgb, var(--accent-green) 42%, transparent);outline-offset:2px}`,
    `.filters{display:flex;gap:.7rem;flex-wrap:wrap;justify-content:center;align-items:center}`,
    `.filters input,.filters select{min-width:min(100%,260px);box-shadow:0 6px 16px rgba(0,0,0,.08)}`,
    `.products-wrap{padding-bottom:1.8rem}`,
    `.section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:.9rem;flex-wrap:wrap;margin-bottom:.9rem}`,
    `.section-title{color:var(--accent-red);font-size:clamp(1.55rem,4vw,2.05rem);margin:.25rem 0 .2rem;line-height:1.1}`,
    `.section-note{margin:0;color:var(--text-soft);font-size:.93rem;max-width:360px;text-align:right}`,
    `.results-count{margin:0;color:var(--text-soft);font-size:.95rem}`,
    `.empty-state{border:1px dashed var(--border-soft);background:color-mix(in srgb,var(--surface-0) 82%,var(--bg-elevated) 18%);color:var(--text-main);border-radius:16px;padding:1.35rem;text-align:center;font-weight:700}`,
    `.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:clamp(.85rem,2vw,1.15rem);align-items:stretch}`,
    `.product{background:linear-gradient(180deg,color-mix(in srgb,var(--surface-1) 38%,var(--surface-0) 62%),color-mix(in srgb,var(--surface-0) 92%,var(--bg-elevated) 8%));border:1px solid color-mix(in srgb,var(--border-soft) 72%,transparent);border-radius:18px;overflow:hidden;display:flex;flex-direction:column;min-height:100%;box-shadow:0 8px 18px rgba(0,0,0,.10);transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease,background .18s ease}`,
    `.product:hover{transform:translateY(-3px);border-color:color-mix(in srgb,var(--accent-green) 36%,var(--border-soft));box-shadow:0 14px 28px rgba(0,0,0,.16)}`,
    `.image-link{display:block;background:color-mix(in srgb,var(--surface-1) 58%,var(--bg-elevated) 42%);overflow:hidden}`,
    `.product img{width:100%;aspect-ratio:4/3;height:auto;object-fit:cover;display:block;transition:transform .24s ease}`,
    `.product:hover img,.image-link:focus-visible img{transform:scale(1.035)}`,
    `.content{padding:.95rem;display:grid;gap:.52rem;flex:1}`,
    `.tag{justify-self:start;border:1px solid color-mix(in srgb,var(--border-soft) 78%,transparent);border-radius:999px;color:var(--text-soft);font-size:.76rem;font-weight:800;padding:.18rem .58rem;text-transform:capitalize;background:color-mix(in srgb,var(--surface-2) 42%,transparent)}`,
    `.product-name{min-height:2.55em;color:var(--text-main);font-size:1.04rem;font-weight:800;line-height:1.28;text-decoration:none;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}`,
    `.product-name:hover,.product-name:focus-visible{color:var(--accent-green);outline:none}`,
    `.content strong{font-size:1.24rem;color:var(--accent-green);line-height:1.1}`,
    `.actions{display:grid;grid-template-columns:1fr 1fr;gap:.48rem;margin-top:auto;padding-top:.18rem}`,
    `.actions .btn{min-height:38px;padding:.48rem .62rem;font-size:.9rem;display:inline-grid;place-items:center}`,
    `.actions .btn:hover,.actions .btn:focus-visible{filter:brightness(1.06);outline:2px solid color-mix(in srgb,var(--accent-green) 42%,transparent);outline-offset:2px}`,
    `.details-link{text-align:center;text-decoration:none}`,
    `.best-sellers{border-top:1px solid color-mix(in srgb,var(--border-soft) 78%,transparent);padding:1.25rem 0 2.25rem}`,
    `.best-sellers-head{display:flex;align-items:flex-end;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-bottom:.8rem}`,
    `.best-sellers-head span{color:var(--text-soft);font-size:.93rem}`,
    `.mini-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.8rem}`,
    `.mini-product{display:grid;grid-template-columns:74px 1fr;gap:.72rem;align-items:center;background:color-mix(in srgb,var(--surface-0) 86%,var(--surface-1) 14%);border:1px solid color-mix(in srgb,var(--border-soft) 76%,transparent);border-radius:15px;padding:.68rem;min-width:0;box-shadow:0 7px 16px rgba(0,0,0,.09);transition:transform .18s ease,border-color .18s ease}`,
    `.mini-product:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--accent-green) 32%,var(--border-soft))}`,
    `.mini-product img{width:74px;height:74px;border-radius:11px;object-fit:cover;background:var(--surface-1)}`,
    `.mini-name{display:block;margin:0 0 .22rem;font-size:.95rem;font-weight:800;color:var(--text-main);line-height:1.2;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`,
    `.mini-name:hover{color:var(--accent-green)}`,
    `.mini-product strong{display:block;color:var(--accent-green);margin-bottom:.35rem}`,
    `.mini-product .btn{padding:.4rem .58rem;font-size:.84rem}`,
    `@media(max-width:780px){.section-head{align-items:flex-start}.section-note{text-align:left;font-size:.9rem;max-width:100%}.actions{grid-template-columns:1fr}}`,
    `@media(max-width:640px){.hero{padding-top:.9rem}.filters{display:grid}.filters input,.filters select{width:100%;min-width:0}.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:.72rem}.content{padding:.72rem;gap:.45rem}.product-name{font-size:.94rem}.content strong{font-size:1.08rem}.actions .btn{font-size:.84rem;min-height:36px;padding:.42rem .45rem}.mini-grid{display:flex;overflow-x:auto;padding-bottom:.4rem;scroll-snap-type:x mandatory}.mini-product{min-width:245px;scroll-snap-align:start}}`,
    `@media(max-width:420px){.grid{grid-template-columns:1fr}.actions{grid-template-columns:1fr 1fr}}`
  ]
})
export class CatalogPageComponent {
  readonly query = signal('');
  readonly category = signal('');
  readonly fallbackImage = 'https://images.unsplash.com/photo-1543353071-873f17a7a088?w=700';

  readonly filteredProducts = computed(() => filterProducts(this.catalog.products(), {
    query: this.query(),
    category: this.category()
  }));

  readonly bestSellers = computed(() => selectBestSellers(this.catalog.products(), 4));

  constructor(
    public readonly cart: CartService,
    private readonly catalog: CatalogService,
    private readonly notifications: NotificationService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {
    void this.catalog.loadProducts();
    this.route.queryParamMap.subscribe((params) => {
      this.query.set((params.get('q') ?? '').trim());
    });
  }

  setQuery(value: string): void {
    const normalized = value ?? '';
    this.query.set(normalized);
    this.updateSearchParam(normalized);
  }

  setCategory(value: string): void {
    this.category.set(value ?? '');
  }

  productRoute(product: Product): string[] {
    return getProductRoute(product);
  }

  addToCart(product: Product): void {
    this.cart.add(product);
    this.notifications.info('Producto añadido', `${product.name} se agregó al carrito.`);
  }

  private updateSearchParam(value: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: value.trim() || null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }
}
