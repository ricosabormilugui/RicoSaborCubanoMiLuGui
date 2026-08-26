import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BRAND_CONFIG } from '../../core/config/brand.config';
import { getProductCategoryLabel } from '../../core/config/product-categories.config';
import { isProductCustomizable, isProductOrderable, Product } from '../../core/models/product.model';
import { getProductRoute } from '../../core/models/product-filter';
import { FavoritesService } from '../../core/services/favorites.service';
import { ProductCategoryService } from '../../core/services/product-category.service';
import { optimizedImageUrl, responsiveImageSrcset } from '../../core/utils/responsive-image';
import { LucideArrowRight, LucideHeart, LucidePlus } from '@lucide/angular';
import { AddToCartAction } from './add-to-cart-button.component';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1543353071-873f17a7a088?w=800';

@Component({
  selector: 'app-product-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, RouterLink, LucideArrowRight, LucideHeart, LucidePlus],
  template: `
    <div class="media">
      <a class="product-image" [routerLink]="route()" [attr.aria-label]="'Ver detalle de ' + product().name">
        <img
          [src]="imageUrl()"
          [attr.srcset]="srcset()"
          [attr.sizes]="sizes()"
          [alt]="imageAlt()"
          width="800"
          height="600"
          [attr.loading]="priority() ? 'eager' : 'lazy'"
          [attr.fetchpriority]="priority() ? 'high' : null"
          decoding="async" />
      </a>
      @if (badge()) {
        <span class="badge" [class.is-sold]="!orderable()">{{ badge() }}</span>
      }
      <button
        class="favorite"
        type="button"
        [class.is-on]="favorite()"
        [attr.aria-pressed]="favorite()"
        [attr.aria-label]="favorite() ? 'Quitar ' + product().name + ' de favoritos' : 'Guardar ' + product().name + ' en favoritos'"
        (click)="toggleFavorite($event)">
        <svg lucideHeart [size]="18" [strokeWidth]="1.6" [style.fill]="favorite() ? 'currentColor' : 'none'" aria-hidden="true" />
      </button>
    </div>
    <div class="body">
      <a class="product-name" [routerLink]="route()">{{ product().name }}</a>
      <div class="meta">
        @if (orderable()) {
          <p class="price">
            @if (customizable()) { <span>desde</span> }
            <strong>{{ product().price | currency:'EUR' }}</strong>
          </p>
        } @else {
          <p class="price is-sold"><strong>Agotado</strong></p>
        }
        @if (!orderable()) {
          <button class="cta" type="button" disabled aria-label="Producto agotado">
            <svg lucidePlus [size]="18" [strokeWidth]="1.6" aria-hidden="true" />
          </button>
        } @else if (customizable()) {
          <a class="cta" [routerLink]="route()" [attr.aria-label]="'Personalizar ' + product().name">
            <svg lucideArrowRight [size]="18" [strokeWidth]="1.6" aria-hidden="true" />
          </a>
        } @else {
          <button class="cta" type="button" [attr.aria-label]="'Añadir ' + product().name + ' al carrito'" (click)="add()">
            <svg lucidePlus [size]="18" [strokeWidth]="1.6" aria-hidden="true" />
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      min-width: 0;
      height: 100%;
      border: 1px solid color-mix(in srgb, var(--border-soft) 82%, transparent);
      border-radius: 12px;
      background: var(--surface-0);
      box-shadow: 0 1px 2px color-mix(in srgb, var(--shadow-soft) 35%, transparent);
      color: var(--text-main);
    }
    .media {
      position: relative;
      isolation: isolate;
    }
    .product-image {
      display: block;
      aspect-ratio: 4 / 3;
      overflow: hidden;
      border-radius: 11px 11px 0 0;
      background: var(--surface-2);
    }
    .product-image img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
    }
    :host(.is-sold-out) .product-image img { opacity: .72; filter: grayscale(.18); }
    .badge {
      position: absolute;
      z-index: 2;
      top: .45rem;
      left: .45rem;
      max-width: calc(100% - 3.6rem);
      padding: .18rem .4rem;
      border-radius: 999px;
      background: color-mix(in srgb, var(--surface-0) 88%, transparent);
      color: var(--text-main);
      font-size: .58rem;
      font-weight: 800;
      letter-spacing: .04em;
      text-transform: uppercase;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .badge.is-sold { background: color-mix(in srgb, var(--surface-0) 92%, var(--accent-red) 8%); }
    .favorite,
    .cta {
      appearance: none;
      position: relative;
      padding: 0;
      margin: 0;
      font: inherit;
    }
    .favorite::after,
    .cta::after {
      content: '';
      position: absolute;
      inset: -2px;
    }
    .favorite {
      position: absolute;
      z-index: 2;
      top: .3rem;
      right: .3rem;
      display: grid;
      width: 40px;
      height: 40px;
      place-items: center;
      border: 0;
      border-radius: 50%;
      background: color-mix(in srgb, var(--surface-0) 88%, transparent);
      color: var(--text-main);
      cursor: pointer;
    }
    .favorite.is-on { color: var(--accent-red-text); }
    .favorite svg,
    .cta svg {
      display: block;
      pointer-events: none;
    }
    .body {
      display: grid;
      gap: .28rem;
      min-width: 0;
      padding: .5rem .55rem .55rem;
    }
    .product-name {
      display: -webkit-box;
      min-height: 2.46em;
      overflow: hidden;
      color: var(--text-main);
      font-size: .84rem;
      font-weight: 600;
      line-height: 1.23;
      text-decoration: none;
      overflow-wrap: anywhere;
      line-clamp: 2;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .meta { display: flex; align-items: center; justify-content: space-between; gap: .4rem; min-width: 0; }
    .price {
      display: flex;
      align-items: baseline;
      flex: 1;
      flex-wrap: wrap;
      gap: .18rem .28rem;
      min-width: 0;
      margin: 0;
    }
    .price span { color: var(--text-soft); font-size: .62rem; font-weight: 700; text-transform: lowercase; }
    .price strong { color: var(--text-main); font-size: .95rem; font-weight: 800; line-height: 1.1; }
    .price.is-sold strong {
      color: var(--text-soft);
      font-size: .78rem;
      font-weight: 700;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
    .cta {
      display: grid;
      width: 40px;
      height: 40px;
      flex: 0 0 40px;
      place-items: center;
      border: 1px solid color-mix(in srgb, var(--border-soft) 88%, transparent);
      border-radius: 50%;
      background: var(--surface-1);
      color: var(--text-main);
      text-decoration: none;
      cursor: pointer;
    }
    .cta:disabled {
      color: var(--text-soft);
      opacity: .55;
      cursor: not-allowed;
    }
    .product-image:focus-visible {
      outline: 3px solid color-mix(in srgb, var(--accent-green) 65%, transparent);
      outline-offset: -3px;
    }
    .product-name:focus-visible,
    .favorite:focus-visible,
    .cta:focus-visible {
      outline: 3px solid color-mix(in srgb, var(--accent-green) 65%, transparent);
      outline-offset: 2px;
    }
    @media (hover: hover) and (pointer: fine) {
      :host { transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease; }
      .product-image img { transition: transform .22s ease; }
      .cta { transition: background .2s ease, border-color .2s ease, color .2s ease; }
      :host:hover {
        z-index: 1;
        transform: translateY(-2px);
        border-color: color-mix(in srgb, var(--accent-green) 32%, var(--border-soft));
        box-shadow: 0 8px 18px color-mix(in srgb, var(--shadow-soft) 42%, transparent);
      }
      :host:hover .product-image img { transform: scale(1.03); }
      .product-name:hover { color: var(--accent-green); }
      .cta:hover:not(:disabled) {
        border-color: color-mix(in srgb, var(--accent-red) 55%, var(--border-soft));
        background: var(--accent-red);
        color: var(--on-accent);
      }
      .favorite:hover { background: var(--surface-1); }
    }
    @media (prefers-reduced-motion: reduce) {
      :host, .product-image img, .cta { transition: none; }
      :host:hover { transform: none; }
      :host:hover .product-image img { transform: none; }
    }
  `],
  host: {
    '[class.is-sold-out]': '!orderable()'
  }
})
export class ProductCardComponent {
  private readonly router = inject(Router);
  private readonly favorites = inject(FavoritesService);
  private readonly categories = inject(ProductCategoryService);

  readonly product = input.required<Product>();
  readonly addAction = input<AddToCartAction>();
  readonly priority = input(false);
  readonly sizes = input('(min-width: 1100px) 25vw, (min-width: 768px) 33vw, 50vw');

  readonly customizable = computed(() => isProductCustomizable(this.product()));
  readonly orderable = computed(() => isProductOrderable(this.product()));
  readonly favorite = computed(() => this.favorites.isFavorite(this.product().id));
  readonly route = computed(() => getProductRoute(this.product()));
  readonly imageUrl = computed(() => optimizedImageUrl(this.product().imageUrl || FALLBACK_IMAGE, 800));
  readonly srcset = computed(() => responsiveImageSrcset(this.product().imageUrl, [360, 540, 720, 900]));
  readonly badge = computed(() => !this.orderable() ? 'Agotado' : this.customizable() ? 'Personalizable' : '');
  readonly imageAlt = computed(() => {
    const product = this.product();
    const category = this.categories.labelFor(product.category) || getProductCategoryLabel(product.category);
    return `${product.name}${category ? ` de la categoría ${category}` : ''} en ${BRAND_CONFIG.name}`;
  });

  toggleFavorite(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.favorites.toggle(this.product().id);
  }

  add(): void {
    if (!this.orderable()) return;
    if (this.customizable()) {
      void this.router.navigate(this.route());
      return;
    }
    void this.addAction()?.();
  }
}
