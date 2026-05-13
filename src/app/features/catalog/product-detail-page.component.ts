import { CommonModule } from '@angular/common';
import { Component, computed, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { CatalogService } from '../../core/services/catalog.service';
import { NotificationService } from '../../core/services/notification.service';
import { Product } from '../../core/models/product.model';
import { findProductBySlugOrId, getProductRoute, selectBestSellers } from '../../core/models/product-filter';
import { getProductCategoryLabel, normalizeCategorySlug } from '../../core/config/product-categories.config';
import { SEO_SITE_CONFIG } from '../../core/config/seo.config';
import { SeoService } from '../../core/services/seo.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="detail-page" [attr.aria-busy]="isLoadingDetail()">
      <a class="back-link" routerLink="/productos">← Volver a productos</a>

      <article class="detail-card card detail-skeleton" *ngIf="isLoadingDetail(); else productState" aria-label="Cargando producto">
        <div class="image-panel skeleton-block"></div>
        <div class="info-panel">
          <span class="skeleton-line skeleton-tag"></span>
          <span class="skeleton-line skeleton-title"></span>
          <span class="skeleton-line skeleton-price"></span>
          <span class="skeleton-line skeleton-copy"></span>
          <span class="skeleton-line skeleton-copy short"></span>
          <div class="purchase-row">
            <span class="skeleton-input"></span>
            <span class="skeleton-cta"></span>
          </div>
        </div>
      </article>

      <ng-template #productState>
        <ng-container *ngIf="product(); else notFound">
          <article class="detail-card card">
            <div class="image-panel">
              <img
                [src]="product()!.imageUrl || fallbackImage"
                [alt]="productImageAlt(product()!)"
                width="900"
                height="700"
                decoding="async"
                fetchpriority="high"
              />
            </div>

            <div class="info-panel">
              <span class="tag" *ngIf="product()!.category">{{ categoryLabel(product()!.category) }}</span>
              <h1>{{ product()!.name }}</h1>
              <strong class="price">{{ product()!.price | currency:'EUR' }}</strong>
              <p class="description">{{ product()!.description || 'Producto casero preparado por Rico Sabor Cubano.' }}</p>

              <div class="purchase-row">
                <label class="quantity-field">
                  Cantidad
                  <input type="number" min="1" max="99" inputmode="numeric" [ngModel]="quantity()" (ngModelChange)="setQuantity($event)" />
                </label>
                <button class="btn btn-primary add-button" type="button" (click)="addToCart(product()!)">
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
                <a class="mini-image" [routerLink]="productRoute(item)" [attr.aria-label]="'Ver detalle de ' + item.name">
                  <img [src]="item.imageUrl || fallbackImage" [alt]="productImageAlt(item)" width="152" height="152" loading="lazy" decoding="async" />
                </a>
                <div class="mini-content">
                  <a class="mini-name" [routerLink]="productRoute(item)">{{ item.name }}</a>
                  <strong>{{ item.price | currency:'EUR' }}</strong>
                  <button class="btn btn-secondary" type="button" (click)="addToCart(item, 1)">Añadir</button>
                </div>
              </article>
            </div>
          </section>
        </ng-container>
      </ng-template>

      <ng-template #notFound>
        <div class="not-found card">
          <h1>Producto no encontrado</h1>
          <p>No encontramos el producto solicitado. Puede que ya no esté disponible o que el enlace no sea correcto.</p>
          <a class="btn btn-primary" routerLink="/productos">Volver a productos</a>
        </div>
      </ng-template>
    </section>
  `,
  styles: [
    `.detail-page{display:grid;gap:clamp(.85rem,2.5vw,1.2rem);width:100%;max-width:100%;min-width:0;overflow-x:clip;padding:clamp(.55rem,2vw,.95rem) 0 2.4rem}`,
    `.back-link{justify-self:start;display:inline-flex;align-items:center;min-height:40px;color:var(--accent-green);font-weight:800;text-decoration:none;overflow-wrap:anywhere}`,
    `.back-link:hover,.back-link:focus-visible{color:var(--text-main);outline:2px solid color-mix(in srgb,var(--accent-green) 55%,transparent);outline-offset:3px;border-radius:6px}`,
    `.detail-card{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:clamp(1rem,3vw,1.8rem);width:100%;max-width:100%;min-width:0;padding:clamp(.85rem,2.8vw,1.45rem);overflow:hidden;background:linear-gradient(135deg,color-mix(in srgb,var(--surface-1) 28%,var(--surface-0) 72%),var(--surface-0));border-color:color-mix(in srgb,var(--border-soft) 78%,transparent)}`,
    `.image-panel{min-width:0;border-radius:clamp(12px,2vw,16px);overflow:hidden;background:color-mix(in srgb,var(--surface-1) 62%,var(--bg-elevated) 38%);border:1px solid color-mix(in srgb,var(--border-soft) 78%,transparent);aspect-ratio:4/3;align-self:start}`,
    `.image-panel img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .28s ease}`,
    `.detail-card:hover .image-panel img{transform:scale(1.018)}`,
    `.info-panel{display:grid;align-content:center;gap:clamp(.65rem,2vw,.9rem);min-width:0;max-width:100%}`,
    `.tag{justify-self:start;max-width:100%;border:1px solid color-mix(in srgb,var(--border-soft) 78%,transparent);border-radius:999px;color:var(--text-soft);font-size:.86rem;font-weight:800;padding:.25rem .7rem;text-transform:capitalize;background:color-mix(in srgb,var(--surface-2) 38%,transparent);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`,
    `h1{margin:0;color:var(--text-main);font-size:clamp(1.75rem,5vw,3.35rem);line-height:1.08;overflow-wrap:anywhere;hyphens:auto}`,
    `.price{color:var(--accent-green);font-size:clamp(1.45rem,4vw,2.3rem);line-height:1.1}`,
    `.description{color:var(--text-soft);font-size:clamp(.98rem,2.2vw,1.05rem);line-height:1.62;margin:0;overflow-wrap:anywhere}`,
    `.purchase-row{display:grid;grid-template-columns:minmax(84px,112px) minmax(0,1fr);gap:.8rem;align-items:end;margin-top:.25rem;max-width:520px}`,
    `.quantity-field{display:grid;gap:.35rem;min-width:0;color:var(--text-soft);font-weight:800}`,
    `.quantity-field input{width:100%;min-width:0;min-height:44px}`,
    `.add-button{min-height:44px;width:100%;white-space:normal}`,
    `.related{min-width:0;max-width:100%;overflow:hidden;border-top:1px solid color-mix(in srgb,var(--border-soft) 78%,transparent);padding-top:1.25rem}`,
    `.related-head{display:flex;align-items:flex-end;justify-content:space-between;gap:.75rem;flex-wrap:wrap;margin-bottom:.85rem;min-width:0}`,
    `.related h2{margin:0;color:var(--accent-red);font-size:clamp(1.45rem,4vw,2rem);line-height:1.1}`,
    `.related-head span{color:var(--text-soft);font-size:.95rem}`,
    `.mini-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:.75rem;width:100%;max-width:100%;min-width:0;overflow:hidden}`,
    `.mini-product{display:grid;grid-template-columns:76px minmax(0,1fr);gap:.72rem;align-items:center;width:100%;max-width:100%;min-width:0;overflow:hidden;background:color-mix(in srgb,var(--surface-0) 86%,var(--surface-1) 14%);border:1px solid color-mix(in srgb,var(--border-soft) 76%,transparent);border-radius:15px;padding:.68rem;box-shadow:0 7px 16px var(--shadow-soft);transition:transform .18s ease,border-color .18s ease}`,
    `.mini-product:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--accent-green) 32%,var(--border-soft))}`,
    `.mini-image{display:block;width:76px;height:76px;border-radius:11px;overflow:hidden;background:var(--surface-1)}`,
    `.mini-product img{width:100%;height:100%;object-fit:cover;display:block}`,
    `.mini-content{display:grid;gap:.22rem;align-content:center;min-width:0;max-width:100%}`,
    `.mini-name{display:-webkit-box;max-width:100%;margin:0 0 .08rem;font-size:.95rem;font-weight:800;color:var(--text-main);line-height:1.2;text-decoration:none;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}`,
    `.mini-name:hover,.mini-name:focus-visible{color:var(--accent-green);outline:none}`,
    `.mini-product strong{display:block;color:var(--accent-green);line-height:1.1}`,
    `.mini-product .btn{justify-self:start;min-height:34px;padding:.4rem .58rem;font-size:.84rem;white-space:normal;line-height:1.1}`,
    `.not-found{width:min(100%,720px);margin:clamp(1rem,4vw,2rem) auto;text-align:center;overflow:hidden}`,
    `.not-found h1{font-size:clamp(1.8rem,4vw,2.6rem)}`,
    `.not-found p{color:var(--text-soft);line-height:1.55;overflow-wrap:anywhere}`,
    `.not-found .btn{display:inline-block;text-decoration:none;min-height:44px}`,
    `.detail-skeleton{pointer-events:none}`,
    `.skeleton-block,.skeleton-line,.skeleton-input,.skeleton-cta{display:block;border-radius:12px;background:linear-gradient(90deg,color-mix(in srgb,var(--surface-1) 72%,transparent),color-mix(in srgb,var(--surface-2) 50%,transparent),color-mix(in srgb,var(--surface-1) 72%,transparent));background-size:220% 100%;animation:shimmer 1.35s linear infinite}`,
    `.skeleton-tag{width:min(42%,150px);height:28px;border-radius:999px}`,
    `.skeleton-title{width:90%;height:clamp(54px,9vw,92px)}`,
    `.skeleton-price{width:min(45%,180px);height:38px}`,
    `.skeleton-copy{width:100%;height:22px}`,
    `.skeleton-copy.short{width:72%}`,
    `.skeleton-input{height:44px}`,
    `.skeleton-cta{height:44px}`,
    `@keyframes shimmer{0%{background-position:220% 0}100%{background-position:-220% 0}}`,
    `@media(max-width:920px){.detail-card{grid-template-columns:1fr}.info-panel{align-content:start}.image-panel{max-height:480px}.purchase-row{max-width:100%}}`,
    `@media(max-width:640px){.detail-page{gap:.8rem;padding-top:.35rem;overflow-x:hidden}.detail-card{border-radius:14px;padding:.75rem;gap:.85rem}.image-panel{aspect-ratio:1/0.78;max-height:none}.purchase-row{grid-template-columns:1fr}.quantity-field input,.add-button{min-height:46px}.mini-grid{display:flex;gap:.72rem;overflow-x:auto;overflow-y:hidden;overscroll-behavior-inline:contain;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;padding:0 .05rem .5rem}.mini-product{flex:0 0 min(82vw,270px);width:min(82vw,270px);max-width:270px;grid-template-columns:70px minmax(0,1fr);scroll-snap-align:start;scroll-snap-stop:always}.mini-image{width:70px;height:70px}.mini-product .btn{width:max-content;max-width:100%}.related-head{align-items:flex-start}.related-head span{font-size:.9rem}}`,
    `@media(max-width:380px){.mini-product{grid-template-columns:64px minmax(0,1fr)}.mini-image{width:64px;height:64px}.mini-product .btn{width:100%}}`,
    `@media(prefers-reduced-motion:reduce){.image-panel img,.mini-product,.skeleton-block,.skeleton-line,.skeleton-input,.skeleton-cta{transition:none;animation:none}.detail-card:hover .image-panel img,.mini-product:hover{transform:none}}`
  ]
})
export class ProductDetailPageComponent {
  readonly fallbackImage = 'https://images.unsplash.com/photo-1543353071-873f17a7a088?w=900';
  readonly productParam = signal('');
  readonly quantity = signal(1);

  readonly product = computed(() => findProductBySlugOrId(this.catalog.products(), this.productParam()));
  readonly isLoadingDetail = computed(() => this.catalog.loading() && !this.product());
  readonly relatedProducts = computed(() => selectBestSellers(this.catalog.products(), 4, this.product()?.id));

  constructor(
    public readonly cart: CartService,
    private readonly catalog: CatalogService,
    private readonly notifications: NotificationService,
    private readonly route: ActivatedRoute,
    private readonly seo: SeoService
  ) {
    void this.catalog.loadProducts();
    this.route.paramMap.subscribe((params) => {
      this.productParam.set(params.get('slug') ?? '');
      this.quantity.set(1);
    });

    effect(() => this.updateSeo());
  }

  setQuantity(value: number | string): void {
    const parsed = Number(value);
    this.quantity.set(Number.isFinite(parsed) && parsed > 0 ? Math.min(99, Math.floor(parsed)) : 1);
  }

  productRoute(product: Product): string[] {
    return getProductRoute(product);
  }

  private updateSeo(): void {
    const product = this.product();

    if (!product) {
      this.seo.setPageMeta({
        title: 'Producto no encontrado',
        description: 'No encontramos el producto solicitado en el catálogo de Rico Sabor Cubano.',
        path: '/producto/no-encontrado',
        canonicalPath: '/productos',
        robots: 'noindex,follow'
      });
      this.seo.removeJsonLd('product');
      return;
    }

    const route = this.productRoute(product).join('/').replace('//', '/');
    const categoryLabel = this.categoryLabel(product.category);
    const description = product.description || `${product.name} de Rico Sabor Cubano. Producto casero disponible para pedido manual con entrega local o recogida.`;
    const image = product.imageUrl || SEO_SITE_CONFIG.defaultImage;

    this.seo.setPageMeta({
      title: `${product.name} · ${categoryLabel}`,
      description,
      path: route,
      canonicalPath: route,
      image,
      type: 'product',
      price: Number(product.price ?? 0),
      currency: 'EUR',
      availability: product.available === false ? 'out of stock' : 'in stock'
    });

    this.seo.setJsonLd('breadcrumb', this.seo.buildBreadcrumbSchema([
      { name: 'Inicio', path: '/' },
      { name: 'Productos', path: '/productos' },
      { name: categoryLabel, path: `/productos?category=${encodeURIComponent(normalizeCategorySlug(product.category))}` },
      { name: product.name, path: route }
    ]));

    this.seo.setJsonLd('product', {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description,
      image: [this.seo.absoluteUrl(image)],
      category: categoryLabel,
      sku: product.id,
      offers: {
        '@type': 'Offer',
        price: Number(product.price ?? 0).toFixed(2),
        priceCurrency: 'EUR',
        availability: product.available === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
        url: this.seo.absoluteUrl(route),
        seller: {
          '@type': 'Organization',
          name: SEO_SITE_CONFIG.siteName
        }
      }
    });
  }

  categoryLabel(value: string): string {
    return getProductCategoryLabel(value);
  }

  productImageAlt(product: Product): string {
    const category = this.categoryLabel(product.category);
    return `${product.name}${category ? ` de la categoría ${category}` : ''} en Rico Sabor Cubano`;
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
