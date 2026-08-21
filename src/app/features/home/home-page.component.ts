import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { buildWhatsAppContactUrl } from '../../core/config/whatsapp.config';
import { CatalogService } from '../../core/services/catalog.service';
import { NotificationService } from '../../core/services/notification.service';
import { isProductCustomizable, Product } from '../../core/models/product.model';
import { getProductRoute, matchesProductSearch, selectBestSellers } from '../../core/models/product-filter';
import { PRODUCT_CATEGORIES, getProductCategoryLabel, normalizeCategorySlug } from '../../core/config/product-categories.config';
import { DELIVERY_RULES, SHIPPING_ZONES } from '../../core/config/shipping.config';
import { SeoService } from '../../core/services/seo.service';
import { AddToCartButtonComponent, AddToCartAction } from '../../shared/ui/add-to-cart-button.component';
import { IconComponent } from '../../shared/ui/icon.component';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, AddToCartButtonComponent, IconComponent],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.css']
})
export class HomePageComponent {
  private readonly catalog = inject(CatalogService);
  private readonly cart = inject(CartService);
  private readonly notifications = inject(NotificationService);
  private readonly seo = inject(SeoService);
  private readonly router = inject(Router);

  readonly whatsappUrl = buildWhatsAppContactUrl('Hola, quiero pedir información sobre una tarta personalizada o un pedido bajo encargo.');
  readonly fallbackImage = 'https://images.unsplash.com/photo-1543353071-873f17a7a088?w=1200';
  readonly localZone = SHIPPING_ZONES[0];
  readonly advanceNoticeHours = DELIVERY_RULES.advanceNoticeHours;
  readonly personalizedNoticeHours = DELIVERY_RULES.personalizedAdvanceNoticeHours;
  readonly marqueeItems = ['Casero', 'Sabor cubano', 'Alcorcón', 'Por encargo', 'Hecho con cariño'];

  readonly bestSellers = computed(() => selectBestSellers(this.catalog.products(), 4));
  readonly heroImage = computed(() => this.imageForCategory('tartas') || this.bestSellers()[0]?.imageUrl || this.fallbackImage);
  readonly cubanImage = computed(() => this.imageForQuery('cubano') || this.imageForCategory('platos') || this.imageForCategory('combos') || this.fallbackImage);
  readonly spanishImage = computed(() => this.imageForQuery('española') || this.imageForCategory('platos') || this.fallbackImage);
  readonly collections = computed(() =>
    PRODUCT_CATEGORIES.map((category) => ({
      ...category,
      imageUrl: this.imageForCategory(category.slug) || this.fallbackImage
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
    effect(() => this.updateSeo());
  }

  productRoute(product: Product): string[] {
    return getProductRoute(product);
  }

  categoryLabel(value: string): string {
    return getProductCategoryLabel(value);
  }

  productImageAlt(product: Product): string {
    const category = this.categoryLabel(product.category);
    return `${product.name}${category ? ` de la categoría ${category}` : ''} en Rico Sabor Cubano`;
  }

  addToCart(product: Product): void {
    if (this.isCustomizable(product)) {
      void this.router.navigate(this.productRoute(product));
      return;
    }
    const quantity = this.minimumQuantity(product);
    this.cart.add(product, [], product.price, quantity);
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

  private imageForCategory(slug: string): string | undefined {
    return this.catalog.products().find((product) =>
      normalizeCategorySlug(product.category) === slug && this.hasImage(product)
    )?.imageUrl;
  }

  private imageForQuery(query: string): string | undefined {
    return this.catalog.products().find((product) =>
      matchesProductSearch(product, query) && this.hasImage(product)
    )?.imageUrl;
  }

  private hasImage(product: Product): boolean {
    return Boolean(product.imageUrl?.trim());
  }

  private minimumQuantity(product: Product): number {
    const quantity = Math.floor(Number(product.minimumQuantity ?? 1));
    return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  }

  private updateSeo(): void {
    this.seo.setPageMeta({
      title: 'Tartas personalizadas y comida casera por encargo',
      description: 'Encarga tartas personalizadas para cumpleaños, eventos y celebraciones, comida cubana tradicional y platos españoles caseros en Rico Sabor Cubano.',
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
