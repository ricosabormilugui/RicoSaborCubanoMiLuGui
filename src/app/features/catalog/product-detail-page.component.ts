import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { CatalogService } from '../../core/services/catalog.service';
import { NotificationService } from '../../core/services/notification.service';
import { isProductCustomizable, Product, ProductCustomizationGroupKey, ProductCustomizationOption } from '../../core/models/product.model';
import { findProductBySlugOrId, getProductRoute, selectBestSellers } from '../../core/models/product-filter';
import { getProductCategoryLabel, normalizeCategorySlug } from '../../core/config/product-categories.config';
import { ProductCategoryService } from '../../core/services/product-category.service';
import { SEO_SITE_CONFIG } from '../../core/config/seo.config';
import { BRAND_CONFIG } from '../../core/config/brand.config';
import { SeoService } from '../../core/services/seo.service';
import { Router } from '@angular/router';
import { AddToCartButtonComponent, AddToCartAction } from '../../shared/ui/add-to-cart-button.component';
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
  imports: [CommonModule, FormsModule, RouterLink, AddToCartButtonComponent],
  templateUrl: './product-detail-page.component.html',
  styleUrls: ['./product-detail-page.component.css']
})
export class ProductDetailPageComponent {
  private readonly productCategories = inject(ProductCategoryService);
  readonly brand = BRAND_CONFIG;
  readonly fallbackImage = 'https://images.unsplash.com/photo-1543353071-873f17a7a088?w=900';
  readonly productParam = signal('');
  readonly quantity = signal(1);
  readonly selectedImage = signal('');
  readonly selectedCustomization = signal<ProductCustomizationSelectionState>({});
  readonly customizationError = signal('');

  readonly product = computed(() => findProductBySlugOrId(this.catalog.products(), this.productParam()));
  readonly isLoadingDetail = computed(() => this.catalog.loading() && !this.product());
  readonly relatedProducts = computed(() => selectBestSellers(this.catalog.products(), 4, this.product()?.id));

  constructor(public readonly cart: CartService, private readonly catalog: CatalogService, private readonly notifications: NotificationService, private readonly route: ActivatedRoute, private readonly seo: SeoService, private readonly router: Router) {
    void this.catalog.loadProducts();
    this.route.paramMap.subscribe((params) => { this.productParam.set(params.get('slug') ?? ''); this.quantity.set(1); this.selectedImage.set(''); this.selectedCustomization.set({}); this.customizationError.set(''); });
    effect(() => this.updateSeo());
    effect(() => {
      const product = this.product();
      if (!product) return;
      this.quantity.set(this.minimumQuantity(product));
      const defaults = Object.fromEntries(
        this.customizationGroups(product)
          .filter((group) => group.required && group.options.length === 1)
          .map((group) => [group.key, [group.options[0]]])
      );
      this.selectedCustomization.set(defaults);
    });
  }

  selectImage(image: string): void { this.selectedImage.set(image); }
  minimumQuantity(product: Product): number { const value = Math.floor(Number(product.minimumQuantity ?? 1)); return Number.isFinite(value) && value > 0 ? value : 1; }
  setQuantity(value: number | string): void { const parsed = Number(value); const minimum = this.product() ? this.minimumQuantity(this.product()!) : 1; this.quantity.set(Number.isFinite(parsed) && parsed > 0 ? Math.max(minimum, Math.min(99, Math.floor(parsed))) : minimum); }
  productRoute(product: Product): string[] { return getProductRoute(product); }
  categoryLabel(value: string): string { return this.productCategories.labelFor(value) || getProductCategoryLabel(value); }
  productImageAlt(product: Product): string { const category = this.categoryLabel(product.category); return `${product.name}${category ? ` de la categoría ${category}` : ''} en ${BRAND_CONFIG.name}`; }
  productImages(product: Product): string[] { return Array.from(new Set([product.imageUrl, ...(product.images ?? [])].map((image) => String(image ?? '').trim()).filter(Boolean))); }
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

  addToCart(product: Product, amount = this.quantity()): boolean {
    const groups = this.customizationGroups(product);
    if (this.isCustomCake(product) && !hasAllRequiredCustomizations(groups, this.selectedCustomization())) { this.customizationError.set('Completa las opciones obligatorias antes de añadir el producto.'); return false; }
    const quantity = Math.max(this.minimumQuantity(product), Math.floor(amount));
    const customization = buildCartCustomizationSelections(product, this.selectedCustomization());
    this.cart.add(product, customization, quantity);
    const suffix = quantity > 1 ? ` (${quantity} uds.)` : '';
    this.notifications.info('Producto añadido', `${product.name}${suffix} se agregó al carrito.`);
    return true;
  }

  addRelated(item: Product): boolean {
    if (this.isCustomCake(item)) {
      void this.router.navigate(this.productRoute(item));
      return false;
    }
    return this.addToCart(item, 1);
  }

  detailAddAction(product: Product): AddToCartAction {
    return () => this.addToCart(product);
  }

  relatedAddAction(product: Product): AddToCartAction {
    return () => this.addRelated(product);
  }

  private optionId(option: ProductCustomizationOption): string { return String(option.id ?? option.name).trim().toLowerCase(); }

  private updateSeo(): void {
    const product = this.product();
    if (!product) { this.seo.setPageMeta({ title: 'Producto no encontrado', description: `No encontramos el producto solicitado en el catálogo de ${BRAND_CONFIG.name}.`, path: '/producto/no-encontrado', canonicalPath: '/productos', robots: 'noindex,follow' }); this.seo.removeJsonLd('product'); return; }
    const route = this.productRoute(product).join('/').replace('//', '/');
    const categoryLabel = this.categoryLabel(product.category);
    const description = product.description || `${product.name} de ${BRAND_CONFIG.name}. Producto casero disponible para pedido manual con entrega local o recogida.`;
    const images = this.productImages(product);
    const image = images[0] || SEO_SITE_CONFIG.defaultImage;
    this.seo.setPageMeta({ title: `${product.name} · ${categoryLabel}`, description, path: route, canonicalPath: route, image, type: 'product', price: Number(product.price ?? 0), currency: 'EUR', availability: product.available === false ? 'out of stock' : 'in stock' });
    this.seo.setJsonLd('breadcrumb', this.seo.buildBreadcrumbSchema([{ name: 'Inicio', path: '/' }, { name: 'Productos', path: '/productos' }, { name: categoryLabel, path: `/categoria/${encodeURIComponent(normalizeCategorySlug(product.category))}` }, { name: product.name, path: route }]));
    this.seo.setJsonLd('product', { '@context': 'https://schema.org', '@type': 'Product', name: product.name, description, image: images.length ? images.map((item) => this.seo.absoluteUrl(item)) : [this.seo.absoluteUrl(image)], category: categoryLabel, sku: product.id, offers: { '@type': 'Offer', price: Number(product.price ?? 0).toFixed(2), priceCurrency: 'EUR', availability: product.available === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock', url: this.seo.absoluteUrl(route), seller: { '@type': 'Organization', name: SEO_SITE_CONFIG.siteName } } });
  }
}
