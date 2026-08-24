import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { buildWhatsAppContactUrl } from '../../core/config/whatsapp.config';
import { CatalogService } from '../../core/services/catalog.service';
import { NotificationService } from '../../core/services/notification.service';
import { isProductCustomizable, Product } from '../../core/models/product.model';
import { getProductRoute, selectBestSellers } from '../../core/models/product-filter';
import { getProductCategoryLabel } from '../../core/config/product-categories.config';
import { DELIVERY_RULES, SHIPPING_ZONES } from '../../core/config/shipping.config';
import { HomeContentService } from '../../core/services/home-content.service';
import { SeoService } from '../../core/services/seo.service';
import { AddToCartButtonComponent, AddToCartAction } from '../../shared/ui/add-to-cart-button.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { ProductCategoryService } from '../../core/services/product-category.service';
import { BRAND_CONFIG } from '../../core/config/brand.config';
import { optimizedImageUrl, responsiveImageSrcset } from '../../core/utils/responsive-image';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, AddToCartButtonComponent, IconComponent],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.css']
})
export class HomePageComponent {
  private readonly catalog = inject(CatalogService);
  private readonly homeContent = inject(HomeContentService);
  private readonly cart = inject(CartService);
  private readonly notifications = inject(NotificationService);
  private readonly seo = inject(SeoService);
  private readonly router = inject(Router);
  private readonly productCategories = inject(ProductCategoryService);

  readonly whatsappUrl = buildWhatsAppContactUrl('Hola, quiero pedir información sobre una tarta personalizada o un pedido bajo encargo.');
  readonly brand = BRAND_CONFIG;
  readonly fallbackImage = 'https://images.unsplash.com/photo-1543353071-873f17a7a088?w=1200';
  readonly localZone = SHIPPING_ZONES[0];
  readonly advanceNoticeHours = DELIVERY_RULES.advanceNoticeHours;
  readonly personalizedNoticeHours = DELIVERY_RULES.personalizedAdvanceNoticeHours;
  readonly marqueeItems = ['Casero', 'Sabor cubano', 'Por encargo', 'Hecho con cariño'];
  readonly marqueeLoop = Array.from({ length: 4 }, () => this.marqueeItems).flat();

  readonly bestSellers = computed(() => selectBestSellers(this.catalog.products(), 4));
  readonly heroImage = computed(() => this.homeContent.content().heroImageUrl);
  readonly cubanImage = computed(() => this.homeContent.content().cubanImageUrl);
  readonly cakesImage = computed(() => this.homeContent.content().cakesImageUrl);
  readonly spanishImage = computed(() => this.homeContent.content().spanishImageUrl);
  readonly collections = computed(() =>
    this.productCategories.categories().map((category) => ({
      ...category,
      imageUrl: this.homeContent.content().categoryImages[category.slug] || ''
    }))
  );
  readonly reviews = computed(() =>
    this.catalog.products()
      .flatMap((product) => (product.reviews ?? []).map((review) => ({
        ...review,
        productName: product.name
      })))
      .filter((review) => review.comment?.trim())
      .slice(0, 3)
  );

  constructor() {
    void this.catalog.loadProducts();
    void this.homeContent.load();
    void this.productCategories.loadPublicCategories().catch(() => undefined);
    effect(() => this.updateSeo());
  }

  productRoute(product: Product): string[] {
    return getProductRoute(product);
  }

  categoryLabel(value: string): string {
    return this.productCategories.labelFor(value) || getProductCategoryLabel(value);
  }

  productImageAlt(product: Product): string {
    const category = this.categoryLabel(product.category);
    return `${product.name}${category ? ` de la categoría ${category}` : ''} en ${this.brand.name}`;
  }

  imageUrl(source: string, width: number): string {
    return optimizedImageUrl(source, width);
  }

  imageSrcset(source: string, widths: readonly number[]): string | null {
    return responsiveImageSrcset(source, widths);
  }

  trackProduct(_index: number, product: Product): string {
    return product.id;
  }

  trackCategory(_index: number, category: { slug: string }): string {
    return category.slug;
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

  scrollCollections(track: HTMLElement): void {
    const amount = Math.max(240, Math.round(track.clientWidth * 0.7));
    track.scrollBy({ left: amount, behavior: 'smooth' });
  }

  private minimumQuantity(product: Product): number {
    const quantity = Math.floor(Number(product.minimumQuantity ?? 1));
    return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  }

  private updateSeo(): void {
    this.seo.setPageMeta({
      title: `${this.brand.name} | ${this.brand.slogan}`,
      description: `Encarga en ${this.brand.name} tartas personalizadas, comida cubana tradicional, platos españoles caseros y propuestas para cumpleaños, eventos y celebraciones.`,
      path: '/',
      canonicalPath: '/',
      type: 'website'
    });

    this.seo.setJsonLd('breadcrumb', this.seo.buildBreadcrumbSchema([
      { name: 'Inicio', path: '/' }
    ]));
    this.seo.removeJsonLd('product');
  }
}
