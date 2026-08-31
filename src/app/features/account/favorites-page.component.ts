import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideHeart } from '@lucide/angular';
import { Product } from '../../core/models/product.model';
import { CartService } from '../../core/services/cart.service';
import { CatalogService } from '../../core/services/catalog.service';
import { FavoritesService } from '../../core/services/favorites.service';
import { NotificationService } from '../../core/services/notification.service';
import { AddToCartAction } from '../../shared/ui/add-to-cart-button.component';
import { ProductCardComponent } from '../../shared/ui/product-card.component';
import { addSimpleProductWithFreshStock } from '../../core/utils/live-add-to-cart';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, ProductCardComponent, LucideHeart],
  templateUrl: './favorites-page.component.html',
  styleUrls: ['./favorites-page.component.css']
})
export class FavoritesPageComponent {
  readonly catalog = inject(CatalogService);
  private readonly cart = inject(CartService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  readonly favorites = inject(FavoritesService);

  readonly skeletonCards = Array.from({ length: 4 });
  private readonly catalogSettled = signal(false);
  readonly isInitialLoading = computed(() =>
    !this.catalog.products().length && (this.catalog.loading() || !this.catalogSettled())
  );
  readonly products = computed(() => {
    const byId = new Map(this.catalog.products().map((product) => [product.id, product]));
    return this.favorites.ids()
      .slice()
      .reverse()
      .map((id) => byId.get(id))
      .filter((product): product is Product => Boolean(product));
  });
  readonly empty = computed(() => !this.isInitialLoading() && !this.products().length);

  constructor() {
    void this.catalog.refreshAvailability().finally(() => this.catalogSettled.set(true));
    effect(() => {
      const products = this.catalog.products();
      const loading = this.catalog.loading();
      const loadError = this.catalog.loadError();
      const liveCatalog = this.catalog.hasLiveCatalog();
      untracked(() => {
        if (loading || loadError || !liveCatalog || !products.length) return;
        void this.favorites.pruneMissing(products.map((product) => product.id));
      });
    });
  }

  trackProduct(_index: number, product: Product): string {
    return product.id;
  }

  retryProducts(): void {
    void this.catalog.loadProducts({ force: true });
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
}
