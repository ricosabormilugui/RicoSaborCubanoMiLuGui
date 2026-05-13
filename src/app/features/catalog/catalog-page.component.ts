import { CommonModule } from '@angular/common';
import { Component, computed, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { CatalogService } from '../../core/services/catalog.service';
import { NotificationService } from '../../core/services/notification.service';
import { Product } from '../../core/models/product.model';
import { filterProducts, getProductRoute, selectBestSellers } from '../../core/models/product-filter';
import { getProductCategoryLabel, mergeCategoryOptions, normalizeCategorySlug } from '../../core/config/product-categories.config';
import { SeoService } from '../../core/services/seo.service';

type CatalogSort = 'featured' | 'price-asc' | 'price-desc' | 'name-asc';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="hero">
      <h1>Productos</h1>
      <p>Catálogo completo de cocina cubana y platos caseros listos para pedir.</p>

      <div class="quick-categories" aria-label="Categorías rápidas">
        <button class="cat-pill" type="button" [class.active]="category() === ''" (click)="setCategory('')">Todos</button>
        <button
          class="cat-pill"
          type="button"
          *ngFor="let option of categoryOptions()"
          [class.active]="category() === option.slug"
          (click)="setCategory(option.slug)">
          {{ option.label }}
        </button>
      </div>

      <div class="filters" aria-label="Filtros del catálogo">
        <label class="filter-field filter-search">
          <span>Buscar</span>
          <input [ngModel]="query()" (ngModelChange)="setQuery($event)" placeholder="Buscar por nombre..." aria-label="Buscar productos por nombre" />
        </label>

        <label class="filter-field">
          <span>Categoría</span>
          <select [ngModel]="category()" (ngModelChange)="setCategory($event)" aria-label="Filtrar por categoría">
            <option value="">Todas las categorías</option>
            <option *ngFor="let option of categoryOptions()" [value]="option.slug">{{ option.label }}</option>
          </select>
        </label>

        <label class="filter-field compact-field">
          <span>Precio mín.</span>
          <input type="number" min="0" step="0.5" inputmode="decimal" [ngModel]="minPrice()" (ngModelChange)="setMinPrice($event)" placeholder="0" aria-label="Precio mínimo" />
        </label>

        <label class="filter-field compact-field">
          <span>Precio máx.</span>
          <input type="number" min="0" step="0.5" inputmode="decimal" [ngModel]="maxPrice()" (ngModelChange)="setMaxPrice($event)" placeholder="50" aria-label="Precio máximo" />
        </label>

        <label class="filter-field">
          <span>Ordenar</span>
          <select [ngModel]="sortBy()" (ngModelChange)="setSortBy($event)" aria-label="Ordenar productos">
            <option value="featured">Destacados</option>
            <option value="price-asc">Precio: menor a mayor</option>
            <option value="price-desc">Precio: mayor a menor</option>
            <option value="name-asc">Nombre A-Z</option>
          </select>
        </label>

        <button class="filter-reset" type="button" (click)="clearFilters()" [disabled]="!hasActiveFilters()">Limpiar</button>
      </div>
    </section>

    <section class="products-wrap" [attr.aria-busy]="isInitialLoading()">
      <div class="section-head">
        <div>
          <h2 class="section-title">Catálogo completo</h2>
          <p class="results-count" *ngIf="filteredProducts().length">{{ filteredProducts().length }} producto(s) disponibles</p>
        </div>
        <span class="section-note">Entra al detalle para ver ingredientes y descripción completa.</span>
      </div>

      <div class="empty-state" *ngIf="!isInitialLoading() && !filteredProducts().length">
        <strong>No se encontraron productos.</strong>
        <span>Prueba con otro nombre, categoría, precio u ordenación.</span>
        <button class="filter-reset" type="button" (click)="clearFilters()" *ngIf="hasActiveFilters()">Limpiar filtros</button>
      </div>

      <div class="grid skeleton-grid" *ngIf="isInitialLoading()" aria-label="Cargando productos">
        <article class="product skeleton-card" *ngFor="let item of skeletonCards">
          <div class="skeleton-media"></div>
          <div class="content">
            <span class="skeleton-line skeleton-tag"></span>
            <span class="skeleton-line skeleton-name"></span>
            <span class="skeleton-line skeleton-price"></span>
            <div class="actions">
              <span class="skeleton-button"></span>
              <span class="skeleton-button"></span>
            </div>
          </div>
        </article>
      </div>

      <div class="grid" *ngIf="!isInitialLoading() && filteredProducts().length">
        <article class="product" *ngFor="let product of filteredProducts()">
          <a class="image-link" [routerLink]="productRoute(product)" [attr.aria-label]="'Ver detalle de ' + product.name">
            <img [src]="product.imageUrl || fallbackImage" [alt]="productImageAlt(product)" width="700" height="520" loading="lazy" decoding="async" />
          </a>
          <div class="content">
            <span class="tag" *ngIf="product.category">{{ categoryLabel(product.category) }}</span>
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
            <img [src]="product.imageUrl || fallbackImage" [alt]="productImageAlt(product)" width="148" height="148" loading="lazy" decoding="async" />
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
    `.hero{padding:clamp(1.15rem,3vw,1.75rem) 0 1.15rem;text-align:center;max-width:100%;overflow:hidden}`,
    `.hero h1{margin:0;color:var(--accent-green);font-size:clamp(2rem,5vw,3rem);line-height:1.05}`,
    `.hero p{color:var(--text-soft);margin:.35rem 0 .85rem}`,
    `.quick-categories{display:flex;gap:.5rem;flex-wrap:wrap;justify-content:center;margin-bottom:.8rem;max-width:100%}`,
    `.cat-pill{border:1px solid color-mix(in srgb,var(--border-soft) 80%,transparent);border-radius:999px;padding:.42rem .86rem;font-weight:700;background:color-mix(in srgb,var(--surface-1) 62%,var(--bg-elevated) 38%);color:var(--text-main);cursor:pointer;box-shadow:0 4px 12px var(--shadow-soft)}`,
    `.cat-pill:hover,.cat-pill:focus-visible,.cat-pill.active{background:color-mix(in srgb,var(--surface-2) 84%,var(--bg-elevated) 16%);border-color:color-mix(in srgb,var(--accent-green) 45%,var(--border-soft));outline:2px solid color-mix(in srgb, var(--accent-green) 42%, transparent);outline-offset:2px}`,
    `.filters{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:.7rem;align-items:end;width:100%;max-width:1080px;margin:0 auto;text-align:left}`,
    `.filter-field{display:grid;gap:.28rem;min-width:0;color:var(--text-main);font-size:.82rem;font-weight:800}`,
    `.filter-field span{color:var(--text-soft)}`,
    `.filter-search{grid-column:span 2}`,
    `.compact-field{grid-column:span 1}`,
    `.filters input,.filters select{width:100%;min-width:0;box-shadow:0 6px 16px var(--shadow-soft)}`,
    `.filter-reset{min-height:44px;border:1px solid color-mix(in srgb,var(--border-soft) 80%,transparent);border-radius:10px;padding:.58rem .72rem;background:color-mix(in srgb,var(--surface-2) 52%,transparent);color:var(--text-main);font-weight:900;cursor:pointer;box-shadow:0 6px 16px var(--shadow-soft)}`,
    `.filter-reset:disabled{opacity:.55;cursor:not-allowed}`,
    `.filter-reset:not(:disabled):hover,.filter-reset:not(:disabled):focus-visible{outline:2px solid color-mix(in srgb,var(--accent-green) 42%,transparent);outline-offset:2px;filter:brightness(1.05)}`,
    `.products-wrap{padding-bottom:1.8rem}`,
    `.section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:.9rem;flex-wrap:wrap;margin-bottom:.9rem}`,
    `.section-title{color:var(--accent-red);font-size:clamp(1.55rem,4vw,2.05rem);margin:.25rem 0 .2rem;line-height:1.1}`,
    `.section-note{margin:0;color:var(--text-soft);font-size:.93rem;max-width:360px;text-align:right}`,
    `.results-count{margin:0;color:var(--text-soft);font-size:.95rem}`,
    `.empty-state{display:grid;justify-items:center;gap:.5rem;border:1px dashed var(--border-soft);background:color-mix(in srgb,var(--surface-0) 82%,var(--bg-elevated) 18%);color:var(--text-main);border-radius:16px;padding:1.35rem;text-align:center;font-weight:700}`,
    `.empty-state span{color:var(--text-soft);font-weight:700}`,
    `.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:clamp(.85rem,2vw,1.15rem);align-items:stretch;width:100%;min-width:0}`,
    `.product{background:linear-gradient(180deg,color-mix(in srgb,var(--surface-1) 38%,var(--surface-0) 62%),color-mix(in srgb,var(--surface-0) 92%,var(--bg-elevated) 8%));border:1px solid color-mix(in srgb,var(--border-soft) 72%,transparent);border-radius:18px;overflow:hidden;display:flex;flex-direction:column;min-height:100%;min-width:0;box-shadow:0 8px 18px var(--shadow-soft);transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease,background .18s ease}`,
    `.product:hover{transform:translateY(-3px);border-color:color-mix(in srgb,var(--accent-green) 36%,var(--border-soft));box-shadow:0 14px 28px var(--shadow-soft)}`,
    `.skeleton-card{pointer-events:none;min-height:100%;animation:pulseCard 1.35s ease-in-out infinite}`,
    `.image-link{display:block;background:color-mix(in srgb,var(--surface-1) 58%,var(--bg-elevated) 42%);overflow:hidden}`,
    `.product img{width:100%;aspect-ratio:4/3;height:auto;object-fit:cover;display:block;transition:transform .24s ease}`,
    `.product:hover img,.image-link:focus-visible img{transform:scale(1.035)}`,
    `.skeleton-media{aspect-ratio:4/3;background:linear-gradient(90deg,color-mix(in srgb,var(--surface-1) 72%,transparent),color-mix(in srgb,var(--surface-2) 50%,transparent),color-mix(in srgb,var(--surface-1) 72%,transparent));background-size:220% 100%;animation:shimmer 1.35s linear infinite}`,
    `.skeleton-line,.skeleton-button{display:block;border-radius:999px;background:linear-gradient(90deg,color-mix(in srgb,var(--surface-1) 72%,transparent),color-mix(in srgb,var(--surface-2) 50%,transparent),color-mix(in srgb,var(--surface-1) 72%,transparent));background-size:220% 100%;animation:shimmer 1.35s linear infinite}`,
    `.skeleton-tag{width:34%;height:20px}`,
    `.skeleton-name{width:78%;height:42px;border-radius:12px}`,
    `.skeleton-price{width:46%;height:24px}`,
    `.skeleton-button{height:38px;border-radius:10px}`,
    `.content{padding:.95rem;display:grid;gap:.52rem;flex:1;min-width:0}`,
    `.tag{justify-self:start;border:1px solid color-mix(in srgb,var(--border-soft) 78%,transparent);border-radius:999px;color:var(--text-soft);font-size:.76rem;font-weight:800;padding:.18rem .58rem;text-transform:capitalize;background:color-mix(in srgb,var(--surface-2) 42%,transparent)}`,
    `.product-name{min-height:2.55em;color:var(--text-main);font-size:1.04rem;font-weight:800;line-height:1.28;text-decoration:none;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}`,
    `.product-name:hover,.product-name:focus-visible{color:var(--accent-green);outline:none}`,
    `.content strong{font-size:1.24rem;color:var(--accent-green);line-height:1.1}`,
    `.actions{display:grid;grid-template-columns:1fr 1fr;gap:.48rem;margin-top:auto;padding-top:.18rem}`,
    `.actions .btn{min-height:38px;padding:.48rem .62rem;font-size:.9rem;display:inline-grid;place-items:center;min-width:0;white-space:normal;line-height:1.15}`,
    `.actions .btn:hover,.actions .btn:focus-visible{filter:brightness(1.06);outline:2px solid color-mix(in srgb,var(--accent-green) 42%,transparent);outline-offset:2px}`,
    `.details-link{text-align:center;text-decoration:none}`,
    `.best-sellers{border-top:1px solid color-mix(in srgb,var(--border-soft) 78%,transparent);padding:1.25rem 0 2.25rem}`,
    `.best-sellers-head{display:flex;align-items:flex-end;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-bottom:.8rem}`,
    `.best-sellers-head span{color:var(--text-soft);font-size:.93rem}`,
    `.mini-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:.8rem;width:100%;max-width:100%;min-width:0;overflow:hidden}`,
    `.mini-product{display:grid;grid-template-columns:74px minmax(0,1fr);gap:.72rem;align-items:center;background:color-mix(in srgb,var(--surface-0) 86%,var(--surface-1) 14%);border:1px solid color-mix(in srgb,var(--border-soft) 76%,transparent);border-radius:15px;padding:.68rem;width:100%;max-width:100%;min-width:0;overflow:hidden;box-shadow:0 7px 16px var(--shadow-soft);transition:transform .18s ease,border-color .18s ease}`,
    `.mini-product:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--accent-green) 32%,var(--border-soft))}`,
    `.mini-product img{width:74px;height:74px;min-width:74px;border-radius:11px;object-fit:cover;background:var(--surface-1)}`,
    `.mini-product>div{display:grid;gap:.22rem;min-width:0;max-width:100%;align-content:center}`,
    `.mini-name{display:-webkit-box;max-width:100%;margin:0 0 .08rem;font-size:.95rem;font-weight:800;color:var(--text-main);line-height:1.2;text-decoration:none;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}`,
    `.mini-name:hover{color:var(--accent-green)}`,
    `.mini-product strong{display:block;color:var(--accent-green);line-height:1.1}`,
    `.mini-product .btn{justify-self:start;min-height:34px;padding:.4rem .58rem;font-size:.84rem;white-space:normal;line-height:1.1}`,
    `@keyframes shimmer{0%{background-position:220% 0}100%{background-position:-220% 0}}`,
    `@keyframes pulseCard{0%,100%{opacity:.86}50%{opacity:1}}`,
    `@media(max-width:980px){.filters{grid-template-columns:repeat(2,minmax(0,1fr));max-width:720px}.filter-search{grid-column:1/-1}.compact-field{grid-column:span 1}.filter-reset{grid-column:1/-1}}`,
    `@media(max-width:780px){.section-head{align-items:flex-start}.section-note{text-align:left;font-size:.9rem;max-width:100%}.actions{grid-template-columns:1fr}}`,
    `@media(max-width:640px){.hero{padding-top:.9rem}.filters{display:grid;grid-template-columns:minmax(0,1fr);gap:.58rem}.filter-search,.compact-field,.filter-reset{grid-column:auto}.filters input,.filters select{width:100%;min-width:0}.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:.72rem}.content{padding:.72rem;gap:.45rem}.product-name{font-size:.94rem}.content strong{font-size:1.08rem}.actions .btn{font-size:.84rem;min-height:36px;padding:.42rem .45rem}.mini-grid{display:flex;gap:.72rem;overflow-x:auto;overflow-y:hidden;overscroll-behavior-inline:contain;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;padding:0 .05rem .5rem}.mini-product{flex:0 0 min(82vw,270px);width:min(82vw,270px);max-width:270px;grid-template-columns:70px minmax(0,1fr);scroll-snap-align:start;scroll-snap-stop:always}.mini-product img{width:70px;height:70px;min-width:70px}.mini-product .btn{width:max-content;max-width:100%}}`,
    `@media(max-width:420px){.grid{grid-template-columns:1fr}.actions{grid-template-columns:1fr 1fr}}`
  ]
})
export class CatalogPageComponent {
  readonly query = signal('');
  readonly category = signal('');
  readonly minPrice = signal('');
  readonly maxPrice = signal('');
  readonly sortBy = signal<CatalogSort>('featured');
  readonly fallbackImage = 'https://images.unsplash.com/photo-1543353071-873f17a7a088?w=700';
  readonly skeletonCards = Array.from({ length: 6 });

  readonly isInitialLoading = computed(() => this.catalog.loading() && !this.catalog.products().length);

  readonly filteredProducts = computed(() => sortProducts(
    filterProducts(this.catalog.products(), {
      query: this.query(),
      category: this.category()
    }).filter((product) => matchesPriceRange(product, this.minPrice(), this.maxPrice())),
    this.sortBy()
  ));

  readonly hasActiveFilters = computed(() => Boolean(
    this.query().trim() || this.category() || this.minPrice() || this.maxPrice() || this.sortBy() !== 'featured'
  ));

  readonly bestSellers = computed(() => selectBestSellers(this.catalog.products(), 4));
  readonly categoryOptions = computed(() => mergeCategoryOptions(this.catalog.products().map((product) => product.category)));

  constructor(
    public readonly cart: CartService,
    private readonly catalog: CatalogService,
    private readonly notifications: NotificationService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly seo: SeoService
  ) {
    void this.catalog.loadProducts();
    this.route.paramMap.subscribe((params) => {
      const routeCategory = normalizeCategorySlug(params.get('category'));
      if (routeCategory) {
        this.category.set(routeCategory);
      }
    });
    this.route.queryParamMap.subscribe((params) => {
      this.query.set((params.get('q') ?? '').trim());
      this.minPrice.set(normalizePriceFilter(params.get('minPrice') ?? params.get('min')));
      this.maxPrice.set(normalizePriceFilter(params.get('maxPrice') ?? params.get('max')));
      this.sortBy.set(normalizeSort(params.get('sort')));
      if (!this.route.snapshot.paramMap.get('category')) {
        this.category.set(normalizeCategorySlug(params.get('category') ?? params.get('c')));
      }
    });

    effect(() => this.updateSeo());
  }

  setQuery(value: string): void {
    const normalized = value ?? '';
    this.query.set(normalized);
    this.updateSearchParam(normalized);
  }

  setCategory(value: string): void {
    const normalized = normalizeCategorySlug(value);
    this.category.set(normalized);
    this.updateCategoryParam(normalized);
  }

  setMinPrice(value: string | number): void {
    this.minPrice.set(normalizePriceFilter(value));
    this.updateCatalogParams();
  }

  setMaxPrice(value: string | number): void {
    this.maxPrice.set(normalizePriceFilter(value));
    this.updateCatalogParams();
  }

  setSortBy(value: string): void {
    this.sortBy.set(normalizeSort(value));
    this.updateCatalogParams();
  }

  clearFilters(): void {
    this.query.set('');
    this.category.set('');
    this.minPrice.set('');
    this.maxPrice.set('');
    this.sortBy.set('featured');
    this.updateCatalogParams();
  }

  categoryLabel(value: string): string {
    return getProductCategoryLabel(value);
  }

  productImageAlt(product: Product): string {
    const category = this.categoryLabel(product.category);
    return `${product.name}${category ? ` de la categoría ${category}` : ''} en Rico Sabor Cubano`;
  }

  private updateSeo(): void {
    const category = this.category();
    const categoryLabel = category ? this.categoryLabel(category) : '';
    const path = category ? `/productos?category=${encodeURIComponent(category)}` : '/productos';
    const title = category
      ? `${categoryLabel} de comida cubana`
      : 'Productos de comida cubana a domicilio y recogida';
    const description = category
      ? `Compra ${categoryLabel.toLowerCase()} de Rico Sabor Cubano con pedido manual, entrega local o recogida y confirmación por el equipo.`
      : `Explora el catálogo completo de Rico Sabor Cubano con buscador, filtros por categoría y platos caseros para añadir al carrito.`;

    this.seo.setPageMeta({
      title,
      description,
      path,
      canonicalPath: path,
      type: 'website'
    });

    this.seo.setJsonLd('breadcrumb', this.seo.buildBreadcrumbSchema([
      { name: 'Inicio', path: '/' },
      { name: 'Productos', path: '/productos' },
      ...(category ? [{ name: categoryLabel, path }] : [])
    ]));
    this.seo.removeJsonLd('product');
  }

  productRoute(product: Product): string[] {
    return getProductRoute(product);
  }

  addToCart(product: Product): void {
    this.cart.add(product);
    this.notifications.info('Producto añadido', `${product.name} se agregó al carrito.`);
  }

  private updateSearchParam(_value: string): void {
    this.updateCatalogParams();
  }

  private updateCategoryParam(_value: string): void {
    this.updateCatalogParams();
  }

  private updateCatalogParams(): void {
    void this.router.navigate(['/productos'], {
      queryParams: {
        ...(this.query().trim() ? { q: this.query().trim() } : {}),
        ...(this.category() ? { category: this.category() } : {}),
        ...(this.minPrice() ? { minPrice: this.minPrice() } : {}),
        ...(this.maxPrice() ? { maxPrice: this.maxPrice() } : {}),
        ...(this.sortBy() !== 'featured' ? { sort: this.sortBy() } : {})
      },
      replaceUrl: true
    });
  }
}


function normalizePriceFilter(value: string | number | null | undefined): string {
  const raw = String(value ?? '').replace(',', '.').trim();
  if (!raw) return '';
  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric < 0) return '';
  return String(numeric);
}

function normalizeSort(value: string | null | undefined): CatalogSort {
  return value === 'price-asc' || value === 'price-desc' || value === 'name-asc' ? value : 'featured';
}

function matchesPriceRange(product: Product, minValue: string, maxValue: string): boolean {
  const price = Number(product.price ?? 0);
  const min = minValue ? Number(minValue) : Number.NEGATIVE_INFINITY;
  const max = maxValue ? Number(maxValue) : Number.POSITIVE_INFINITY;
  return price >= min && price <= max;
}

function sortProducts(products: Product[], sortBy: CatalogSort): Product[] {
  return products.slice().sort((a, b) => {
    if (sortBy === 'price-asc') return Number(a.price ?? 0) - Number(b.price ?? 0);
    if (sortBy === 'price-desc') return Number(b.price ?? 0) - Number(a.price ?? 0);
    if (sortBy === 'name-asc') return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });

    const featuredA = a.featured || a.isBestSeller ? 0 : 1;
    const featuredB = b.featured || b.isBestSeller ? 0 : 1;
    if (featuredA !== featuredB) return featuredA - featuredB;
    return (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER);
  });
}
