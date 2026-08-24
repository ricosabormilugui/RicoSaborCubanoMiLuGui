import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, HostListener, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { CatalogService } from '../../core/services/catalog.service';
import { NotificationService } from '../../core/services/notification.service';
import { isProductCustomizable, Product } from '../../core/models/product.model';
import { filterProducts, getProductRoute, selectBestSellers } from '../../core/models/product-filter';
import { getProductCategoryLabel, normalizeCategorySlug } from '../../core/config/product-categories.config';
import { SeoService } from '../../core/services/seo.service';
import { AddToCartButtonComponent, AddToCartAction } from '../../shared/ui/add-to-cart-button.component';
import { ProductCategoryService } from '../../core/services/product-category.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { BRAND_CONFIG } from '../../core/config/brand.config';

type CatalogSort = 'featured' | 'price-asc' | 'price-desc' | 'name-asc';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AddToCartButtonComponent, IconComponent],
  templateUrl: './catalog-page.component.html',
  styleUrls: ['./catalog-page.component.css']
})
export class CatalogPageComponent implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private previousBodyOverflow = '';

  readonly query = signal('');
  readonly category = signal('');
  readonly minPrice = signal('');
  readonly maxPrice = signal('');
  readonly sortBy = signal<CatalogSort>('featured');
  readonly filtersOpen = signal(false);
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

  readonly hasActiveDrawerFilters = computed(() => Boolean(
    this.category() || this.minPrice() || this.maxPrice() || this.sortBy() !== 'featured'
  ));

  readonly bestSellers = computed(() => selectBestSellers(this.catalog.products(), 4));
  readonly categoryOptions = computed(() => {
    return this.productCategories.categories().map(({ slug, label }) => ({ slug, label }));
  });

  constructor(
    public readonly cart: CartService,
    private readonly catalog: CatalogService,
    private readonly notifications: NotificationService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly seo: SeoService,
    private readonly productCategories: ProductCategoryService
  ) {
    void this.catalog.loadProducts();
    void this.productCategories.loadPublicCategories().catch(() => undefined);
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

  openFilters(): void {
    if (this.filtersOpen()) return;
    this.previousBodyOverflow = this.document.body.style.overflow;
    this.document.body.style.overflow = 'hidden';
    this.filtersOpen.set(true);
    globalThis.setTimeout(() => this.document.getElementById('catalog-filter-close')?.focus());
  }

  closeFilters(restoreFocus = true): void {
    if (!this.filtersOpen()) return;
    this.filtersOpen.set(false);
    this.document.body.style.overflow = this.previousBodyOverflow;
    if (restoreFocus) {
      globalThis.setTimeout(() => this.document.getElementById('catalog-filter-trigger')?.focus());
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleFilterKeyboard(event: KeyboardEvent): void {
    if (!this.filtersOpen()) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeFilters();
      return;
    }

    if (event.key !== 'Tab') return;
    const drawer = this.document.getElementById('catalog-filter-drawer');
    if (!drawer) return;
    const focusable = Array.from(drawer.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && this.document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && this.document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  ngOnDestroy(): void {
    if (this.filtersOpen()) {
      this.document.body.style.overflow = this.previousBodyOverflow;
    }
  }

  categoryLabel(value: string): string {
    return this.productCategories.labelFor(value) || getProductCategoryLabel(value);
  }

  productImageAlt(product: Product): string {
    const category = this.categoryLabel(product.category);
    return `${product.name}${category ? ` de la categoría ${category}` : ''} en ${BRAND_CONFIG.name}`;
  }

  private updateSeo(): void {
    const category = this.category();
    const categoryLabel = category ? this.categoryLabel(category) : '';
    const path = category ? `/categoria/${encodeURIComponent(category)}` : '/productos';
    const title = category
      ? `${categoryLabel} del catálogo`
      : 'Productos, tartas y comida casera por encargo';
    const description = category
      ? `Compra ${categoryLabel.toLowerCase()} de ${BRAND_CONFIG.name} con pedido manual, entrega local o recogida y confirmación por el equipo.`
      : `Explora el catálogo completo de ${BRAND_CONFIG.name}: tartas, platos cubanos y españoles, dulces y encargos con entrega o recogida.`;

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
    if (this.isCustomizable(product)) {
      void this.router.navigate(this.productRoute(product));
      return;
    }
    const quantity = this.minimumQuantity(product);
    this.cart.add(product, [], quantity);
    const suffix = quantity > 1 ? ` (${quantity} uds. mínimas)` : '';
    this.notifications.info('Producto añadido', `${product.name}${suffix} se agregó al carrito.`);
  }

  addAction(product: Product): AddToCartAction {
    return () => this.addToCart(product);
  }

  isCustomizable(product: Product): boolean {
    return isProductCustomizable(product);
  }

  minimumQuantity(product: Product): number {
    const quantity = Math.floor(Number(product.minimumQuantity ?? 1));
    return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
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
