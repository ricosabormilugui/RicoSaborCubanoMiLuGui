import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { buildWhatsAppContactUrl } from '../../core/config/whatsapp.config';
import { CatalogService } from '../../core/services/catalog.service';
import { NotificationService } from '../../core/services/notification.service';
import { Product } from '../../core/models/product.model';
import { getProductRoute, selectBestSellers } from '../../core/models/product-filter';
import { getProductCategoryLabel } from '../../core/config/product-categories.config';
import { SeoService } from '../../core/services/seo.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.css']
})
export class HomePageComponent {
  private readonly catalog = inject(CatalogService);
  private readonly cart = inject(CartService);
  private readonly notifications = inject(NotificationService);
  private readonly seo = inject(SeoService);

  readonly whatsappUrl = buildWhatsAppContactUrl('Hola, quiero pedir información sobre una tarta personalizada o un pedido bajo encargo.');
  readonly fallbackImage = 'https://images.unsplash.com/photo-1543353071-873f17a7a088?w=700';
  readonly bestSellers = computed(() => selectBestSellers(this.catalog.products(), 4));

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
    this.cart.add(product);
    this.notifications.info('Producto añadido', `${product.name} se agregó al carrito.`);
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
