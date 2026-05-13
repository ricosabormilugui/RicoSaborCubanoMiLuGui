import { CommonModule } from '@angular/common';
import { Component, computed, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { CartCustomizationSelection } from '../../core/models/order.model';
import { CatalogService } from '../../core/services/catalog.service';
import { NotificationService } from '../../core/services/notification.service';
import { Product, ProductCustomizationOption } from '../../core/models/product.model';
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
            <div class="gallery-panel">
              <div class="image-panel">
                <img [src]="selectedImage() || productImages(product()!)[0] || fallbackImage" [alt]="productImageAlt(product()!)" width="900" height="700" decoding="async" fetchpriority="high" />
              </div>
              <div class="thumb-row" *ngIf="productImages(product()!).length > 1" aria-label="Galería de imágenes">
                <button class="thumb-btn" type="button" *ngFor="let image of productImages(product()!)" [class.active]="(selectedImage() || productImages(product()!)[0]) === image" (click)="selectImage(image)">
                  <img [src]="image" [alt]="productImageAlt(product()!)" width="120" height="90" loading="lazy" decoding="async" />
                </button>
              </div>
            </div>

            <div class="info-panel">
              <span class="tag" *ngIf="product()!.category">{{ categoryLabel(product()!.category) }}</span>
              <h1>{{ product()!.name }}</h1>
              <strong class="price">{{ customizedTotal(product()!) | currency:'EUR' }}</strong>
              <span class="base-price" *ngIf="customizationExtraTotal()">Base {{ product()!.price | currency:'EUR' }} + extras {{ customizationExtraTotal() | currency:'EUR' }}</span>
              <p class="description">{{ product()!.description || 'Producto casero preparado por Rico Sabor Cubano.' }}</p>

              <section class="cake-config" *ngIf="isCustomCake(product()!) && customizationGroups(product()!).length">
                <h2>Personaliza tu tarta</h2>
                <p>Elige las opciones de tu encargo. Los extras actualizan el precio final.</p>
                <div class="option-group" *ngFor="let group of customizationGroups(product()!)">
                  <span>{{ group.label }}</span>
                  <div class="option-list">
                    <button type="button" class="option-chip" *ngFor="let option of group.options" [class.active]="selectedCustomization()[group.key]?.name === option.name" (click)="selectCustomization(group.key, option)">
                      {{ option.name }} <small *ngIf="option.price">+{{ option.price | currency:'EUR' }}</small>
                    </button>
                  </div>
                </div>
                <small class="field-error" *ngIf="customizationError()">{{ customizationError() }}</small>
              </section>

              <div class="purchase-row">
                <label class="quantity-field">
                  Cantidad
                  <input type="number" min="1" max="99" inputmode="numeric" [ngModel]="quantity()" (ngModelChange)="setQuantity($event)" />
                </label>
                <button class="btn btn-primary add-button" type="button" (click)="addToCart(product()!)">Añadir al carrito</button>
              </div>
            </div>
          </article>

          <section class="detail-sections">
            <article class="info-card card">
              <h2>Descripción</h2>
              <p>{{ product()!.description || 'Producto artesanal preparado por Rico Sabor Cubano.' }}</p>
            </article>
            <article class="info-card card" *ngIf="productIngredients(product()!).length">
              <h2>Ingredientes</h2>
              <ul><li *ngFor="let ingredient of productIngredients(product()!)">{{ ingredient }}</li></ul>
            </article>
            <article class="info-card card reviews-card" *ngIf="productReviews(product()!).length">
              <div class="reviews-head"><h2>Opiniones de clientes</h2><strong>{{ averageRating(product()!) | number:'1.1-1' }} ★</strong></div>
              <div class="review-list">
                <div class="review" *ngFor="let review of productReviews(product()!)">
                  <strong>{{ review.author }}</strong><span class="stars">{{ stars(review.rating) }}</span><p>{{ review.comment }}</p><small *ngIf="review.date">{{ review.date | date:'dd/MM/yyyy' }}</small>
                </div>
              </div>
            </article>
          </section>

          <section class="related" *ngIf="relatedProducts().length">
            <div class="related-head"><h2>Más vendidos</h2><span>También te puede gustar</span></div>
            <div class="mini-grid">
              <article class="mini-product" *ngFor="let item of relatedProducts()">
                <a class="mini-image" [routerLink]="productRoute(item)" [attr.aria-label]="'Ver detalle de ' + item.name"><img [src]="productImages(item)[0] || fallbackImage" [alt]="productImageAlt(item)" width="152" height="152" loading="lazy" decoding="async" /></a>
                <div class="mini-content"><a class="mini-name" [routerLink]="productRoute(item)">{{ item.name }}</a><strong>{{ item.price | currency:'EUR' }}</strong><button class="btn btn-secondary" type="button" (click)="addToCart(item, 1)">Añadir</button></div>
              </article>
            </div>
          </section>
        </ng-container>
      </ng-template>

      <ng-template #notFound><div class="not-found card"><h1>Producto no encontrado</h1><p>No encontramos el producto solicitado. Puede que ya no esté disponible o que el enlace no sea correcto.</p><a class="btn btn-primary" routerLink="/productos">Volver a productos</a></div></ng-template>
    </section>
  `,
  styles: [
    `.detail-page{display:grid;gap:clamp(.85rem,2.5vw,1.2rem);width:100%;max-width:100%;min-width:0;overflow-x:clip;padding:clamp(.55rem,2vw,.95rem) 0 2.4rem}`,
    `.back-link{justify-self:start;display:inline-flex;align-items:center;min-height:40px;color:var(--accent-green);font-weight:800;text-decoration:none;overflow-wrap:anywhere}`,
    `.detail-card{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:clamp(1rem,3vw,1.8rem);width:100%;max-width:100%;min-width:0;padding:clamp(.85rem,2.8vw,1.45rem);overflow:hidden;background:linear-gradient(135deg,color-mix(in srgb,var(--surface-1) 28%,var(--surface-0) 72%),var(--surface-0))}`,
    `.gallery-panel,.info-panel{display:grid;gap:.75rem;min-width:0;align-self:start}`,
    `.image-panel{min-width:0;border-radius:clamp(12px,2vw,16px);overflow:hidden;background:var(--surface-1);border:1px solid var(--border-soft);aspect-ratio:4/3}`,
    `.image-panel img{width:100%;height:100%;object-fit:cover;display:block}`,
    `.thumb-row,.mini-grid{display:flex;gap:.6rem;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;padding-bottom:.35rem}`,
    `.thumb-btn{flex:0 0 82px;width:82px;height:64px;border:2px solid transparent;border-radius:12px;overflow:hidden;padding:0;background:var(--surface-1);cursor:pointer;scroll-snap-align:start}.thumb-btn.active{border-color:var(--accent-green)}.thumb-btn img{width:100%;height:100%;object-fit:cover;display:block}`,
    `.tag{justify-self:start;border:1px solid var(--border-soft);border-radius:999px;color:var(--text-soft);font-size:.86rem;font-weight:800;padding:.25rem .7rem;background:color-mix(in srgb,var(--surface-2) 38%,transparent)}`,
    `h1{margin:0;color:var(--text-main);font-size:clamp(1.75rem,5vw,3.35rem);line-height:1.08;overflow-wrap:anywhere}`,
    `.price{color:var(--accent-green);font-size:clamp(1.45rem,4vw,2.3rem);line-height:1.1}.base-price{color:var(--text-soft);font-weight:800}`,
    `.description,.cake-config p,.info-card p,.info-card li{color:var(--text-soft);line-height:1.62;margin:0;overflow-wrap:anywhere}`,
    `.cake-config{display:grid;gap:.7rem;border:1px solid color-mix(in srgb,var(--accent-green) 28%,var(--border-soft));border-radius:16px;padding:.85rem;background:color-mix(in srgb,var(--surface-1) 42%,transparent)}`,
    `.cake-config h2,.info-card h2,.related h2{margin:0;color:var(--accent-red);font-size:clamp(1.2rem,3vw,1.65rem)}`,
    `.option-group{display:grid;gap:.4rem;min-width:0}.option-group>span{font-weight:900}.option-list{display:flex;flex-wrap:wrap;gap:.45rem}.option-chip{border:1px solid var(--border-soft);border-radius:999px;padding:.45rem .7rem;background:var(--surface-0);color:var(--text-main);font-weight:800;cursor:pointer;white-space:normal}.option-chip.active{border-color:var(--accent-green);background:color-mix(in srgb,var(--accent-green) 16%,var(--surface-1))}.option-chip small{color:var(--accent-green)}`,
    `.field-error{color:var(--error-text);font-weight:800}`,
    `.purchase-row{display:grid;grid-template-columns:minmax(84px,112px) minmax(0,1fr);gap:.8rem;align-items:end;max-width:520px}.quantity-field{display:grid;gap:.35rem;min-width:0;color:var(--text-soft);font-weight:800}.quantity-field input{width:100%;min-width:0;min-height:44px}.add-button{min-height:44px;width:100%;white-space:normal}`,
    `.detail-sections{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:.85rem;min-width:0}.info-card{display:grid;gap:.55rem;min-width:0}.info-card ul{margin:0;padding-left:1.2rem}`,
    `.reviews-head{display:flex;justify-content:space-between;gap:1rem;align-items:center}.reviews-head strong,.stars{color:var(--accent-green)}.review-list{display:grid;gap:.65rem}.review{display:grid;gap:.2rem;border-top:1px solid var(--border-soft);padding-top:.65rem}`,
    `.related{min-width:0;max-width:100%;overflow:hidden;border-top:1px solid var(--border-soft);padding-top:1.25rem}.related-head{display:flex;align-items:flex-end;justify-content:space-between;gap:.75rem;flex-wrap:wrap;margin-bottom:.85rem}.related-head span{color:var(--text-soft)}`,
    `.mini-product{display:grid;grid-template-columns:76px minmax(0,1fr);gap:.72rem;align-items:center;flex:0 0 min(82vw,270px);width:min(82vw,270px);max-width:270px;min-width:0;overflow:hidden;background:var(--surface-0);border:1px solid var(--border-soft);border-radius:15px;padding:.68rem;box-shadow:0 7px 16px var(--shadow-soft);scroll-snap-align:start}.mini-image{display:block;width:76px;height:76px;border-radius:11px;overflow:hidden;background:var(--surface-1)}.mini-image img{width:100%;height:100%;object-fit:cover}.mini-content{display:grid;gap:.22rem;min-width:0}.mini-name{display:-webkit-box;max-width:100%;font-weight:800;color:var(--text-main);line-height:1.2;text-decoration:none;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}.mini-product strong{color:var(--accent-green)}.mini-product .btn{justify-self:start;min-height:34px;padding:.4rem .58rem;font-size:.84rem}`,
    `.not-found{width:min(100%,720px);margin:clamp(1rem,4vw,2rem) auto;text-align:center;overflow:hidden}`,
    `.skeleton-block,.skeleton-line,.skeleton-input,.skeleton-cta{display:block;border-radius:12px;background:linear-gradient(90deg,color-mix(in srgb,var(--surface-1) 72%,transparent),color-mix(in srgb,var(--surface-2) 50%,transparent),color-mix(in srgb,var(--surface-1) 72%,transparent));background-size:220% 100%;animation:shimmer 1.35s linear infinite}.skeleton-tag{width:min(42%,150px);height:28px;border-radius:999px}.skeleton-title{width:90%;height:clamp(54px,9vw,92px)}.skeleton-price{width:min(45%,180px);height:38px}.skeleton-copy{width:100%;height:22px}.skeleton-copy.short{width:72%}.skeleton-input,.skeleton-cta{height:44px}`,
    `@keyframes shimmer{0%{background-position:220% 0}100%{background-position:-220% 0}}`,
    `@media(max-width:920px){.detail-card{grid-template-columns:1fr}.purchase-row{max-width:100%}}`,
    `@media(max-width:640px){.detail-card{border-radius:14px;padding:.75rem}.purchase-row{grid-template-columns:1fr}.mini-product{grid-template-columns:70px minmax(0,1fr)}.mini-image{width:70px;height:70px}}`
  ]
})
export class ProductDetailPageComponent {
  readonly fallbackImage = 'https://images.unsplash.com/photo-1543353071-873f17a7a088?w=900';
  readonly productParam = signal('');
  readonly quantity = signal(1);
  readonly selectedImage = signal('');
  readonly selectedCustomization = signal<Record<string, ProductCustomizationOption>>({});
  readonly customizationError = signal('');

  readonly product = computed(() => findProductBySlugOrId(this.catalog.products(), this.productParam()));
  readonly isLoadingDetail = computed(() => this.catalog.loading() && !this.product());
  readonly relatedProducts = computed(() => selectBestSellers(this.catalog.products(), 4, this.product()?.id));

  constructor(public readonly cart: CartService, private readonly catalog: CatalogService, private readonly notifications: NotificationService, private readonly route: ActivatedRoute, private readonly seo: SeoService) {
    void this.catalog.loadProducts();
    this.route.paramMap.subscribe((params) => { this.productParam.set(params.get('slug') ?? ''); this.quantity.set(1); this.selectedImage.set(''); this.selectedCustomization.set({}); this.customizationError.set(''); });
    effect(() => this.updateSeo());
  }

  selectImage(image: string): void { this.selectedImage.set(image); }
  setQuantity(value: number | string): void { const parsed = Number(value); this.quantity.set(Number.isFinite(parsed) && parsed > 0 ? Math.min(99, Math.floor(parsed)) : 1); }
  productRoute(product: Product): string[] { return getProductRoute(product); }
  categoryLabel(value: string): string { return getProductCategoryLabel(value); }
  productImageAlt(product: Product): string { const category = this.categoryLabel(product.category); return `${product.name}${category ? ` de la categoría ${category}` : ''} en Rico Sabor Cubano`; }
  productImages(product: Product): string[] { return Array.from(new Set([product.imageUrl, ...(product.images ?? [])].map((image) => String(image ?? '').trim()).filter(Boolean))); }
  productIngredients(product: Product): string[] { return Array.isArray(product.ingredients) ? product.ingredients.filter(Boolean) : []; }
  productReviews(product: Product) { return Array.isArray(product.reviews) ? product.reviews : []; }
  averageRating(product: Product): number { const reviews = this.productReviews(product); return reviews.length ? reviews.reduce((sum, review) => sum + Number(review.rating ?? 0), 0) / reviews.length : 0; }
  stars(rating: number): string { const value = Math.max(0, Math.min(5, Math.round(Number(rating ?? 0)))); return '★★★★★'.slice(0, value) + '☆☆☆☆☆'.slice(value); }
  isCustomCake(product: Product): boolean { const category = normalizeCategorySlug(product.category); return category.includes('tarta') || category.includes('personaliz'); }
  customizationGroups(product: Product): Array<{ key: string; label: string; options: ProductCustomizationOption[] }> { const options = product.customizationOptions ?? {}; return [{ key: 'themes', label: 'Temática', options: options.themes ?? [] }, { key: 'colors', label: 'Color', options: options.colors ?? [] }, { key: 'sizes', label: 'Tamaño / porciones', options: options.sizes ?? [] }, { key: 'fillings', label: 'Relleno', options: options.fillings ?? [] }, { key: 'toppings', label: 'Cobertura', options: options.toppings ?? [] }].filter((group) => group.options.length); }
  selectCustomization(key: string, option: ProductCustomizationOption): void { this.selectedCustomization.set({ ...this.selectedCustomization(), [key]: option }); this.customizationError.set(''); }
  customizationExtraTotal(): number { return Object.values(this.selectedCustomization()).reduce((sum, option) => sum + Number(option.price ?? 0), 0); }
  customizedTotal(product: Product): number { return Number((Number(product.price ?? 0) + this.customizationExtraTotal()).toFixed(2)); }
  private selectedCustomizationItems(product: Product): CartCustomizationSelection[] { const labels = new Map(this.customizationGroups(product).map((group) => [group.key, group.label])); return Object.entries(this.selectedCustomization()).map(([key, option]) => ({ label: labels.get(key) ?? key, value: option.name, price: option.price })); }

  addToCart(product: Product, amount = this.quantity()): void {
    const groups = this.customizationGroups(product);
    if (this.isCustomCake(product) && groups.some((group) => !this.selectedCustomization()[group.key])) { this.customizationError.set('Selecciona todas las opciones de personalización antes de añadir la tarta.'); return; }
    const quantity = Math.max(1, Math.floor(amount));
    const customization = this.selectedCustomizationItems(product);
    const unitPrice = this.customizedTotal(product);
    for (let index = 0; index < quantity; index += 1) this.cart.add(product, customization, unitPrice);
    const suffix = quantity > 1 ? ` (${quantity} uds.)` : '';
    this.notifications.info('Producto añadido', `${product.name}${suffix} se agregó al carrito.`);
  }

  private updateSeo(): void {
    const product = this.product();
    if (!product) { this.seo.setPageMeta({ title: 'Producto no encontrado', description: 'No encontramos el producto solicitado en el catálogo de Rico Sabor Cubano.', path: '/producto/no-encontrado', canonicalPath: '/productos', robots: 'noindex,follow' }); this.seo.removeJsonLd('product'); return; }
    const route = this.productRoute(product).join('/').replace('//', '/');
    const categoryLabel = this.categoryLabel(product.category);
    const description = product.description || `${product.name} de Rico Sabor Cubano. Producto casero disponible para pedido manual con entrega local o recogida.`;
    const images = this.productImages(product);
    const image = images[0] || SEO_SITE_CONFIG.defaultImage;
    this.seo.setPageMeta({ title: `${product.name} · ${categoryLabel}`, description, path: route, canonicalPath: route, image, type: 'product', price: Number(product.price ?? 0), currency: 'EUR', availability: product.available === false ? 'out of stock' : 'in stock' });
    this.seo.setJsonLd('breadcrumb', this.seo.buildBreadcrumbSchema([{ name: 'Inicio', path: '/' }, { name: 'Productos', path: '/productos' }, { name: categoryLabel, path: `/productos?category=${encodeURIComponent(normalizeCategorySlug(product.category))}` }, { name: product.name, path: route }]));
    this.seo.setJsonLd('product', { '@context': 'https://schema.org', '@type': 'Product', name: product.name, description, image: images.length ? images.map((item) => this.seo.absoluteUrl(item)) : [this.seo.absoluteUrl(image)], category: categoryLabel, sku: product.id, offers: { '@type': 'Offer', price: Number(product.price ?? 0).toFixed(2), priceCurrency: 'EUR', availability: product.available === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock', url: this.seo.absoluteUrl(route), seller: { '@type': 'Organization', name: SEO_SITE_CONFIG.siteName } } });
  }
}
