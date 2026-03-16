import { Injectable, signal } from '@angular/core';
import { resolveApiBaseUrl } from '../config/api.config';
import { Product, ProductApiRecord } from '../models/product.model';

function toProduct(item: ProductApiRecord): Product {
  return {
    id: item._id,
    name: item.name,
    description: item.description ?? '',
    price: Number(item.price ?? 0),
    category: item.category ?? 'extras',
    imageUrl: item.imageUrl ?? '',
    available: item.available ?? true,
    published: item.published ?? true,
    trackStock: item.trackStock ?? false,
    stock: Number(item.stock ?? 0),
    lowStockAlert: Number(item.lowStockAlert ?? 5),
    order: item.order ?? 0
  };
}

const fallbackProducts: Product[] = [
  {
    id: 'combo-1',
    name: 'Combo Cubano Clásico',
    description: 'Ropa vieja, arroz moro y plátano maduro.',
    price: 11.5,
    category: 'combos',
    imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=900',
    available: true,
    published: true,
    trackStock: false,
    stock: 0,
    lowStockAlert: 5,
    order: 1
  }
];

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly endpoint = `${resolveApiBaseUrl()}/products`;
  readonly products = signal<Product[]>(fallbackProducts);

  async loadProducts(): Promise<void> {
    try {
      const response = await fetch(this.endpoint);
      if (!response.ok) return;

      const data = (await response.json()) as { products?: ProductApiRecord[] };
      const normalized = (data.products ?? []).map(toProduct);
      if (normalized.length) {
        this.products.set(normalized);
      }
    } catch {
      // keep fallback products for local/demo resilience
    }
  }
}
