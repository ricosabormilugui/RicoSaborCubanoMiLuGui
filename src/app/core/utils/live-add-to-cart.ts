import { Router } from '@angular/router';
import { isProductCustomizable, Product } from '../models/product.model';
import { getProductRoute } from '../models/product-filter';
import { CartService } from '../services/cart.service';
import { CatalogService } from '../services/catalog.service';
import { NotificationService } from '../services/notification.service';
import { evaluateLiveAddToCart } from './cart-stock';

function minimumQuantity(product: Product): number {
  const quantity = Math.floor(Number(product.minimumQuantity ?? 1));
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

export async function addSimpleProductWithFreshStock(
  product: Product,
  deps: {
    catalog: CatalogService;
    cart: CartService;
    notifications: NotificationService;
    router: Router;
  }
): Promise<boolean> {
  if (isProductCustomizable(product)) {
    void deps.router.navigate(getProductRoute(product));
    return false;
  }

  const live = await deps.catalog.refreshTrackedProduct(product);
  const evaluation = evaluateLiveAddToCart(live, minimumQuantity(live));
  if (!evaluation.allowed) {
    deps.notifications.warning('Producto no disponible', evaluation.message, {
      key: 'cart-add-blocked:' + product.id
    });
    return false;
  }

  if (evaluation.kind === 'limited') {
    deps.notifications.warning('Disponibilidad actualizada', evaluation.message, {
      key: 'cart-add-limited:' + product.id
    });
  }

  deps.cart.add(evaluation.product, [], evaluation.quantity);
  const suffix = evaluation.quantity > 1 ? ` (${evaluation.quantity} uds. mínimas)` : '';
  deps.notifications.success('Producto añadido al carrito', `${evaluation.product.name}${suffix}`, {
    key: 'cart-add:' + product.id,
    saveToHistory: true,
    history: { action: { label: 'Ver carrito', url: '/carrito' } },
    action: { label: 'Ver carrito', handler: () => deps.router.navigateByUrl('/carrito') }
  });
  return true;
}
