import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { buildWhatsAppContactUrl } from '../../core/config/whatsapp.config';
import { CatalogService } from '../../core/services/catalog.service';
import { NotificationService } from '../../core/services/notification.service';
import { isProductCustomizable, Product } from '../../core/models/product.model';
import { getProductRoute, selectBestSellers } from '../../core/models/product-filter';
import { DELIVERY_RULES, SHIPPING_ZONES } from '../../core/config/shipping.config';
import { HomeContentService } from '../../core/services/home-content.service';
import { SeoService } from '../../core/services/seo.service';
import { AddToCartAction } from '../../shared/ui/add-to-cart-button.component';
import { ProductCardComponent } from '../../shared/ui/product-card.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { ProductCategoryService } from '../../core/services/product-category.service';
import { BRAND_CONFIG } from '../../core/config/brand.config';
import { optimizedImageUrl, responsiveImageSrcset } from '../../core/utils/responsive-image';
import { addSimpleProductWithFreshStock } from '../../core/utils/live-add-to-cart';
import { BEST_SELLERS_EYEBROW, BEST_SELLERS_TITLE, COMPACT_PRODUCT_SIZES } from '../../core/config/best-sellers.config';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, ProductCardComponent, IconComponent],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.css', '../../shared/ui/product-collection.css']
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
  readonly localZone = SHIPPING_ZONES[0];
  readonly advanceNoticeHours = DELIVERY_RULES.advanceNoticeHours;
  readonly personalizedNoticeHours = DELIVERY_RULES.personalizedAdvanceNoticeHours;
  readonly marqueeItems = ['Casero', 'Sabor cubano', 'Por encargo', 'Hecho con cariño'];
  readonly marqueeLoop = Array.from({ length: 4 }, () => this.marqueeItems).flat();
  readonly bestSellersEyebrow = BEST_SELLERS_EYEBROW;
  readonly bestSellersTitle = BEST_SELLERS_TITLE;
  readonly compactProductSizes = COMPACT_PRODUCT_SIZES;

  readonly bestSellers = computed(() => selectBestSellers(this.catalog.products(), 5));
  readonly heroImage = computed(() => this.homeContent.content().heroImageUrl);
  readonly cubanImage = computed(() => this.homeContent.content().cubanImageUrl);
  readonly cakesImage = computed(() => this.homeContent.content().cakesImageUrl);
  readonly spanishImage = computed(() => this.homeContent.content().spanishImageUrl);
  readonly collections = computed(() => {
    if (this.productCategories.loading()) return [];

    const categoryImages = this.homeContent.content().categoryImages;
    let hasPriorityImage = false;

    return this.productCategories.categories().map((category) => {
      const imageUrl = categoryImages[category.slug] || '';
      const priority = Boolean(imageUrl) && !hasPriorityImage;
      if (priority) hasPriorityImage = true;

      return { ...category, imageUrl, priority };
    });
  });
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
    void this.catalog.refreshAvailability();
    void this.homeContent.load();
    void this.productCategories.loadPublicCategories().catch(() => undefined);
    effect(() => this.updateSeo());
  }

  productRoute(product: Product): string[] {
    return getProductRoute(product);
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

  addToCart(product: Product): Promise<boolean> {
    return addSimpleProductWithFreshStock(product, {
      catalog: this.catalog,
      cart: this.cart,
      notifications: this.notifications,
      router: this.router
    });
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
