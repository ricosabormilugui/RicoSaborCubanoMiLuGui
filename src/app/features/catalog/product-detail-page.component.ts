import { CommonModule } from '@angular/common';
import { Component, computed, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { CartCustomizationSelection } from '../../core/models/order.model';
import { CatalogService } from '../../core/services/catalog.service';
import { NotificationService } from '../../core/services/notification.service';
import { isProductCustomizable, Product, ProductCustomizationOption } from '../../core/models/product.model';
import { findProductBySlugOrId, getProductRoute, selectBestSellers } from '../../core/models/product-filter';
import { getProductCategoryLabel, normalizeCategorySlug } from '../../core/config/product-categories.config';
import { SEO_SITE_CONFIG } from '../../core/config/seo.config';
import { SeoService } from '../../core/services/seo.service';
import { Router } from '@angular/router';
import { AddToCartButtonComponent, AddToCartAction } from '../../shared/ui/add-to-cart-button.component';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AddToCartButtonComponent],
  templateUrl: './product-detail-page.component.html',
  styleUrls: ['./product-detail-page.component.css']
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

  constructor(public readonly cart: CartService, private readonly catalog: CatalogService, private readonly notifications: NotificationService, private readonly route: ActivatedRoute, private readonly seo: SeoService, private readonly router: Router) {
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
  isCustomCake(product: Product): boolean { return isProductCustomizable(product); }
  customizationGroups(product: Product): Array<{ key: string; label: string; options: ProductCustomizationOption[] }> { const options = product.customizationOptions ?? {}; return [{ key: 'themes', label: 'Temática', options: options.themes ?? [] }, { key: 'colors', label: 'Color', options: options.colors ?? [] }, { key: 'sizes', label: 'Tamaño / porciones', options: options.sizes ?? [] }, { key: 'fillings', label: 'Relleno', options: options.fillings ?? [] }, { key: 'toppings', label: 'Cobertura', options: options.toppings ?? [] }].filter((group) => group.options.length); }
  selectCustomization(key: string, option: ProductCustomizationOption): void { this.selectedCustomization.set({ ...this.selectedCustomization(), [key]: option }); this.customizationError.set(''); }
  customizationExtraTotal(): number { return Object.values(this.selectedCustomization()).reduce((sum, option) => sum + Number(option.price ?? 0), 0); }
  customizedTotal(product: Product): number { return Number((Number(product.price ?? 0) + this.customizationExtraTotal()).toFixed(2)); }
  private selectedCustomizationItems(product: Product): CartCustomizationSelection[] { const labels = new Map(this.customizationGroups(product).map((group) => [group.key, group.label])); return Object.entries(this.selectedCustomization()).map(([key, option]) => ({ label: labels.get(key) ?? key, value: option.name, price: option.price })); }

  addToCart(product: Product, amount = this.quantity()): boolean {
    const groups = this.customizationGroups(product);
    if (this.isCustomCake(product) && !this.hasRequiredCustomization(groups)) { this.customizationError.set('Selecciona temática, color, tamaño/porciones, relleno y cobertura antes de añadir la tarta.'); return false; }
    const quantity = Math.max(1, Math.floor(amount));
    const customization = this.selectedCustomizationItems(product);
    const unitPrice = this.customizedTotal(product);
    for (let index = 0; index < quantity; index += 1) this.cart.add(product, customization, unitPrice);
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

  private hasRequiredCustomization(groups: Array<{ key: string }>): boolean {
    const requiredKeys = ['themes', 'colors', 'sizes', 'fillings', 'toppings'];
    const groupKeys = new Set(groups.map((group) => group.key));
    return requiredKeys
      .filter((key) => groupKeys.has(key))
      .every((key) => Boolean(this.selectedCustomization()[key]));
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
