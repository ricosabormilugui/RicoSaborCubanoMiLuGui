import { getUserFriendlyError } from '../../core/utils/user-friendly-error';
import { CommonModule } from '@angular/common';
import { Component, ElementRef, Injector, afterNextRender, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { CartAnimationService } from '../../core/services/cart-animation.service';
import { CatalogService } from '../../core/services/catalog.service';
import { NotificationService } from '../../core/services/notification.service';
import { isProductCustomizable, Product, ProductCustomizationGroupKey, ProductCustomizationOption } from '../../core/models/product.model';
import { getProductRoute } from '../../core/models/product-filter';
import { getProductCategoryLabel, normalizeCategorySlug } from '../../core/config/product-categories.config';
import { ProductCategoryService } from '../../core/services/product-category.service';
import { SEO_SITE_CONFIG } from '../../core/config/seo.config';
import { BRAND_CONFIG } from '../../core/config/brand.config';
import { SeoService } from '../../core/services/seo.service';
import { ApiRequestError } from '../../core/utils/api-client';
import { Router } from '@angular/router';
import { AddToCartButtonComponent, AddToCartAction } from '../../shared/ui/add-to-cart-button.component';
import { ProductCardComponent } from '../../shared/ui/product-card.component';
import { BEST_SELLERS_EYEBROW, BEST_SELLERS_TITLE, COMPACT_PRODUCT_SIZES } from '../../core/config/best-sellers.config';
import { optimizedImageUrl, responsiveImageSrcset } from '../../core/utils/responsive-image';
import { evaluateLiveAddToCart, maxAddableQuantity, stockHintForProduct, tracksInventory, UNLIMITED_CART_QUANTITY } from '../../core/utils/cart-stock';
import {
  buildCartCustomizationSelections,
  calculateCustomizationExtra,
  calculateFinalUnitPrice,
  flattenCustomizationSelections,
  getCustomizationGroups,
  getPriceModifier,
  hasAllRequiredCustomizations,
  ProductCustomizationGroup,
  ProductCustomizationSelectionState
} from '../../core/utils/customization-pricing';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, AddToCartButtonComponent, ProductCardComponent],
  templateUrl: './product-detail-page.component.html',
  styleUrls: ['./product-detail-page.component.css', '../../shared/ui/product-collection.css']
})
export class ProductDetailPageComponent {
  private readonly productCategories = inject(ProductCategoryService);
  private readonly injector = inject(Injector);
  private readonly cartAnimation = inject(CartAnimationService);
  readonly brand = BRAND_CONFIG;
  readonly bestSellersEyebrow = BEST_SELLERS_EYEBROW;
  readonly bestSellersTitle = BEST_SELLERS_TITLE;
  readonly compactProductSizes = COMPACT_PRODUCT_SIZES;
  readonly fallbackImage = 'https://images.unsplash.com/photo-1543353071-873f17a7a088?w=900';
  readonly optionPreviewLimit = 8;
  readonly productParam = signal('');
  readonly quantity = signal(1);
  readonly selectedImage = signal('');
  readonly selectedCustomization = signal<ProductCustomizationSelectionState>({});
  readonly customizationError = signal('');
  readonly expandedGroupKeys = signal<readonly string[]>([]);
  readonly purchaseInView = signal(true);
  readonly product = signal<Product | null>(null);
  readonly relatedProducts = signal<Product[]>([]);
  readonly detailLoading = signal(true);
  readonly detailError = signal('');
  readonly purchaseAnchor = viewChild<ElementRef<HTMLElement>>('purchaseAnchor');
  private readonly heroImage = viewChild<ElementRef<HTMLImageElement>>('heroImage');
  private readonly detailAddCta = viewChild('detailAddCta', { read: ElementRef });
  private lastConfiguredProductId = '';

  readonly currentImages = computed(() => this.product() ? this.productImages(this.product()!) : []);
  readonly isLoadingDetail = computed(() => this.detailLoading());

  constructor(public readonly cart: CartService, private readonly catalog: CatalogService, private readonly notifications: NotificationService, private readonly route: ActivatedRoute, private readonly seo: SeoService, private readonly router: Router) {
    this.route.paramMap.subscribe((params) => {
      const identifier = params.get('slug') ?? '';
      this.productParam.set(identifier);
      this.quantity.set(1);
      this.selectedImage.set('');
      this.selectedCustomization.set({});
      this.customizationError.set('');
      this.expandedGroupKeys.set([]);
      this.purchaseInView.set(true);
      void this.loadProduct(identifier);
    });
    effect(() => this.updateSeo());
    effect(() => {
      const product = this.product();
      if (!product) {
        this.lastConfiguredProductId = '';
        return;
      }
      const switched = product.id !== this.lastConfiguredProductId;
      this.lastConfiguredProductId = product.id;
      if (switched) {
        this.quantity.set(this.minimumQuantity(product));
        const defaults = Object.fromEntries(
          this.customizationGroups(product)
            .filter((group) => group.required && group.options.length === 1)
            .map((group) => [group.key, [group.options[0]]])
        );
        this.selectedCustomization.set(defaults);
        return;
      }
      const current = this.quantity();
      const minimum = this.minimumQuantity(product);
      if (current < minimum) this.quantity.set(minimum);
    });
    effect((onCleanup) => {
      const anchor = this.purchaseAnchor()?.nativeElement;
      if (!anchor || typeof IntersectionObserver === 'undefined') {
        untracked(() => this.purchaseInView.set(true));
        return;
      }
      const observer = new IntersectionObserver((entries) => {
        this.purchaseInView.set(entries.some((entry) => entry.isIntersecting));
      }, { threshold: 0.2, rootMargin: '0px 0px -12px 0px' });
      observer.observe(anchor);
      onCleanup(() => observer.disconnect());
    });
  }

  selectImage(image: string): void { this.selectedImage.set(image); }
  minimumQuantity(product: Product): number { const value = Math.floor(Number(product.minimumQuantity ?? 1)); return Number.isFinite(value) && value > 0 ? value : 1; }
  tracksStock(product: Product): boolean { return tracksInventory(product); }
  maxQuantity(product: Product): number {
    if (!this.tracksStock(product)) return UNLIMITED_CART_QUANTITY;
    return maxAddableQuantity(product, this.cart.items());
  }
  canDecrease(product: Product): boolean {
    return this.quantity() > this.minimumQuantity(product);
  }
  canIncrease(product: Product): boolean {
    const max = this.maxQuantity(product);
    return max > 0 && this.quantity() < max;
  }
  canAdd(product: Product): boolean {
    if (!this.isOrderable(product)) return false;
    if (!this.tracksStock(product)) return true;
    return this.maxQuantity(product) > 0;
  }
  stockHint(product: Product) {
    return stockHintForProduct(product, this.cart.items());
  }
  setQuantity(value: number | string): void {
    const parsed = Number(value);
    const product = this.product();
    const minimum = product ? this.minimumQuantity(product) : 1;
    if (!Number.isFinite(parsed) || parsed <= 0) {
      this.quantity.set(minimum);
      return;
    }
    const next = Math.floor(parsed);
    const max = product ? this.maxQuantity(product) : UNLIMITED_CART_QUANTITY;
    if (max <= 0) {
      this.quantity.set(Math.max(minimum, next));
      return;
    }
    this.quantity.set(Math.max(minimum, Math.min(max, next)));
  }
  adjustQuantity(delta: number): void { this.setQuantity(this.quantity() + delta); }
  productRoute(product: Product): string[] { return getProductRoute(product); }
  categoryLabel(value: string): string { return this.productCategories.labelFor(value) || getProductCategoryLabel(value); }
  productImageAlt(product: Product): string { const category = this.categoryLabel(product.category); return `${product.name}${category ? ` de la categoría ${category}` : ''} en ${BRAND_CONFIG.name}`; }
  productImages(product: Product): string[] { return Array.from(new Set([product.imageUrl, ...(product.images ?? [])].map((image) => String(image ?? '').trim()).filter(Boolean))); }
  imageUrl(source: string, width: number): string { return optimizedImageUrl(source, width); }
  imageSrcset(source: string, widths: readonly number[]): string | null { return responsiveImageSrcset(source, widths); }
  trackProduct(_index: number, product: Product): string { return product.id; }
  trackImage(_index: number, image: string): string { return image; }
  trackGroup(_index: number, group: ProductCustomizationGroup): string { return group.key; }
  trackOption(_index: number, option: ProductCustomizationOption): string { return String(option.id ?? option.name).trim().toLowerCase(); }
  productIngredients(product: Product): string[] { return Array.isArray(product.ingredients) ? product.ingredients.filter(Boolean) : []; }
  productReviews(product: Product) { return Array.isArray(product.reviews) ? product.reviews : []; }
  averageRating(product: Product): number { const reviews = this.productReviews(product); return reviews.length ? reviews.reduce((sum, review) => sum + Number(review.rating ?? 0), 0) / reviews.length : 0; }
  stars(rating: number): string { const value = Math.max(0, Math.min(5, Math.round(Number(rating ?? 0)))); return '★★★★★'.slice(0, value) + '☆☆☆☆☆'.slice(value); }
  isCustomCake(product: Product): boolean { return isProductCustomizable(product); }
  customizationGroups(product: Product): ProductCustomizationGroup[] { return getCustomizationGroups(product); }
  selectCustomization(group: ProductCustomizationGroup, option: ProductCustomizationOption): void {
    const state = this.selectedCustomization();
    const current = state[group.key] ?? [];
    const isSelected = current.some((item) => this.optionId(item) === this.optionId(option));
    const next = group.selectionType === 'multiple'
      ? (isSelected ? current.filter((item) => this.optionId(item) !== this.optionId(option)) : [...current, option])
      : (isSelected && !group.required ? [] : [option]);
    this.selectedCustomization.set({ ...state, [group.key]: next });
    this.customizationError.set('');
  }
  isOptionSelected(key: ProductCustomizationGroupKey, option: ProductCustomizationOption): boolean { return (this.selectedCustomization()[key] ?? []).some((item) => this.optionId(item) === this.optionId(option)); }
  optionPriceModifier(option: ProductCustomizationOption): number { return getPriceModifier(option); }
  selectedPricedOptions(): ProductCustomizationOption[] { return flattenCustomizationSelections(this.selectedCustomization()).filter((option) => getPriceModifier(option) > 0); }
  customizationExtraTotal(): number { return calculateCustomizationExtra(flattenCustomizationSelections(this.selectedCustomization())); }
  customizedTotal(product: Product): number { return calculateFinalUnitPrice(product.price, flattenCustomizationSelections(this.selectedCustomization())); }

  groupLayout(group: ProductCustomizationGroup): 'cards' | 'compact' | 'chips' {
    if (group.key === 'sizes' || group.key === 'decorations') return 'cards';
    if (group.key === 'fillings' || group.key === 'colors' || group.key === 'themes' || group.options.length >= 7) return 'chips';
    return 'compact';
  }

  isGroupComplete(group: ProductCustomizationGroup): boolean {
    return (this.selectedCustomization()[group.key]?.length ?? 0) > 0;
  }

  isGroupInvalid(group: ProductCustomizationGroup): boolean {
    return Boolean(this.customizationError()) && group.required && !this.isGroupComplete(group);
  }

  isGroupExpanded(key: ProductCustomizationGroupKey): boolean {
    return this.expandedGroupKeys().includes(key);
  }

  expandGroup(key: ProductCustomizationGroupKey): void {
    this.expandedGroupKeys.update((keys) => keys.includes(key) ? keys : [...keys, key]);
  }

  visibleOptions(group: ProductCustomizationGroup): ProductCustomizationOption[] {
    if (this.isGroupExpanded(group.key) || group.options.length <= this.optionPreviewLimit) return group.options;
    const preview = group.options.slice(0, this.optionPreviewLimit);
    const selected = this.selectedCustomization()[group.key] ?? [];
    const extras = selected.filter((option) => !preview.some((item) => this.optionId(item) === this.optionId(option)));
    return extras.length ? [...preview, ...extras] : preview;
  }

  optionCaption(option: ProductCustomizationOption): { title: string; hint: string } {
    const name = String(option.name ?? '').trim();
    const parts = name.split(/\s*[·|]\s*/).map((part) => part.trim()).filter(Boolean);
    return parts.length > 1 ? { title: parts[0], hint: parts.slice(1).join(' · ') } : { title: name, hint: '' };
  }

  priceKicker(product: Product): string {
    if (!this.isCustomCake(product)) return '';
    return hasAllRequiredCustomizations(this.customizationGroups(product), this.selectedCustomization()) ? '' : 'Desde';
  }

  configurationSummary(product: Product): string[] {
    return this.customizationGroups(product).flatMap((group) =>
      (this.selectedCustomization()[group.key] ?? []).map((option) => this.optionCaption(option).title)
    );
  }

  introText(product: Product): string {
    const text = String(product.description ?? '').trim();
    if (!text) return `Producto casero preparado por ${this.brand.name}.`;
    if (text.length <= 170) return text;
    const first = text.split(/(?<=[.!?])\s+/)[0] ?? text;
    return first.length > 0 && first.length <= 170 ? first : `${text.slice(0, 156).trimEnd()}…`;
  }

  hasExtendedDescription(product: Product): boolean {
    return String(product.description ?? '').trim().length > 170;
  }

  showDetails(product: Product): boolean {
    return this.hasExtendedDescription(product) || this.productIngredients(product).length > 0 || this.productReviews(product).length > 0;
  }

  showStickyPurchase(): boolean {
    const product = this.product();
    return Boolean(product && this.canAdd(product) && !this.purchaseInView());
  }

  addToCart(product: Product, amount = this.quantity()): boolean {
    if (product.trackStock !== true && !this.isOrderable(product)) return false;
    const groups = this.customizationGroups(product);
    if (this.isCustomCake(product) && !hasAllRequiredCustomizations(groups, this.selectedCustomization())) {
      const incomplete = groups.find((group) => group.required && !this.isGroupComplete(group));
      if (incomplete) this.expandGroup(incomplete.key);
      this.customizationError.set(incomplete ? `Selecciona ${incomplete.label} para continuar.` : 'Completa las opciones obligatorias antes de añadir el producto.');
      afterNextRender(() => this.focusGroup(incomplete?.key), { injector: this.injector });
      return false;
    }
    const quantity = Math.max(this.minimumQuantity(product), Math.floor(amount));
    const evaluation = evaluateLiveAddToCart(product, quantity, this.cart.items());
    if (!evaluation.allowed) {
      this.notifications.warning('Producto no disponible', evaluation.message, { key: 'cart-add-blocked:' + product.id });
      return false;
    }
    if (evaluation.kind === 'limited') {
      this.notifications.warning('Disponibilidad actualizada', evaluation.message, { key: 'cart-add-limited:' + product.id });
    }
    const customization = buildCartCustomizationSelections(evaluation.product, this.selectedCustomization());
    this.cart.add(evaluation.product, customization, evaluation.quantity);
    const suffix = evaluation.quantity > 1 ? ` (${evaluation.quantity} uds.)` : '';
    this.notifications.success('Producto añadido al carrito', `${evaluation.product.name}${suffix}`, { key: 'cart-add:' + product.id, saveToHistory: true, history: { action: { label: 'Ver carrito', url: '/carrito' } }, action: { label: 'Ver carrito', handler: () => this.router.navigateByUrl('/carrito') } });
    return true;
  }

  async addToCartWithFreshStock(product: Product, amount = this.quantity(), event?: Event): Promise<boolean> {
    const live = await this.catalog.refreshTrackedProduct(product);
    if (this.product()?.id === live.id) this.product.set(live);
    const added = this.addToCart(live, amount);
    if (added && this.product()?.id === live.id) this.playAddToCartAnimation(event);
    return added;
  }

  addRelated(item: Product): Promise<boolean> | boolean {
    if (this.isCustomCake(item)) {
      void this.router.navigate(this.productRoute(item));
      return false;
    }
    return this.addToCartWithFreshStock(item, 1);
  }

  detailAddAction(product: Product): AddToCartAction {
    return () => this.addToCartWithFreshStock(product);
  }

  relatedAddAction(product: Product): AddToCartAction {
    return () => this.addRelated(product);
  }

  private playAddToCartAnimation(_event?: Event): void {
    const hero = this.heroImage()?.nativeElement ?? null;
    const product = this.product();
    this.cartAnimation.animateAddToCart({
      sourceElement: hero ?? this.detailAddCta()?.nativeElement ?? null,
      imageUrl: hero?.currentSrc || hero?.src || this.selectedImage() || product?.imageUrl || this.fallbackImage
    });
  }

  private optionId(option: ProductCustomizationOption): string { return String(option.id ?? option.name).trim().toLowerCase(); }

  private focusGroup(key?: ProductCustomizationGroupKey): void {
    if (!key) return;
    const node = globalThis.document?.getElementById(`config-${key}`);
    if (!node) return;
    const reduceMotion = Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
    node.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    node.querySelector<HTMLElement>('button.option')?.focus({ preventScroll: true });
  }

  isOrderable(product: Product): boolean {
    return product.available !== false && (!product.trackStock || Number(product.stock ?? 0) > 0);
  }

  private async loadProduct(identifier: string): Promise<void> {
    this.detailLoading.set(true);
    this.detailError.set('');
    this.product.set(null);
    this.relatedProducts.set([]);
    try {
      const result = await this.catalog.loadProductByIdentifier(identifier);
      if (identifier !== this.productParam()) return;
      this.product.set(result.product);
      this.relatedProducts.set(result.relatedProducts);
      this.catalog.upsertProduct(result.product);
    } catch (error) {
      if (identifier !== this.productParam()) return;
      if (!(error instanceof ApiRequestError) || error.status !== 404) {
        this.detailError.set(getUserFriendlyError(error, 'No se pudo cargar el producto.'));
      }
    } finally {
      if (identifier === this.productParam()) this.detailLoading.set(false);
    }
  }

  private updateSeo(): void {
    if (this.detailLoading()) return;
    const product = this.product();
    if (!product) { this.seo.setPageMeta({ title: 'Producto no encontrado', description: `No encontramos el producto solicitado en el catálogo de ${BRAND_CONFIG.name}.`, path: '/producto/no-encontrado', canonicalPath: '/productos', robots: 'noindex,follow' }); this.seo.removeJsonLd('product'); this.seo.removeJsonLd('breadcrumb'); return; }
    const route = this.productRoute(product).join('/').replace('//', '/');
    const categoryLabel = this.categoryLabel(product.category);
    const description = product.description || `${product.name} de ${BRAND_CONFIG.name}. Producto casero disponible para pedido manual con entrega local o recogida.`;
    const images = this.productImages(product);
    const image = images[0] || SEO_SITE_CONFIG.defaultImage;
    const orderable = this.isOrderable(product);
    this.seo.setPageMeta({ title: `${product.name} · ${categoryLabel}`, description, path: route, canonicalPath: route, image, type: 'product', price: Number(product.price ?? 0), currency: 'EUR', availability: orderable ? 'in stock' : 'out of stock' });
    this.seo.setJsonLd('breadcrumb', this.seo.buildBreadcrumbSchema([{ name: 'Inicio', path: '/' }, { name: 'Productos', path: '/productos' }, { name: categoryLabel, path: `/categoria/${encodeURIComponent(normalizeCategorySlug(product.category))}` }, { name: product.name, path: route }]));
    const reviews = this.productReviews(product);
    const schema: Record<string, unknown> = { '@context': 'https://schema.org', '@type': 'Product', name: product.name, description, image: images.length ? images.map((item) => this.seo.absoluteUrl(item)) : [this.seo.absoluteUrl(image)], category: categoryLabel, url: this.seo.absoluteUrl(route), offers: { '@type': 'Offer', price: Number(product.price ?? 0).toFixed(2), priceCurrency: 'EUR', availability: orderable ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', url: this.seo.absoluteUrl(route), seller: { '@type': 'Organization', name: SEO_SITE_CONFIG.siteName } } };
    if (reviews.length) {
      schema['aggregateRating'] = { '@type': 'AggregateRating', ratingValue: this.averageRating(product).toFixed(1), reviewCount: reviews.length };
      schema['review'] = reviews.map((review) => ({ '@type': 'Review', author: { '@type': 'Person', name: review.author }, reviewRating: { '@type': 'Rating', ratingValue: review.rating, bestRating: 5, worstRating: 1 }, reviewBody: review.comment, ...(review.date ? { datePublished: review.date } : {}) }));
    }
    this.seo.setJsonLd('product', schema);
  }
}
