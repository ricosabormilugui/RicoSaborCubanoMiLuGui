import { Injectable, signal } from '@angular/core';
import { resolveApiBaseUrl } from '../config/api.config';
import { Product, ProductApiRecord, ProductReview } from '../models/product.model';
import { normalizeCustomizationOptions } from '../utils/customization-pricing';

const PRODUCTS_CACHE_KEY = 'ricosabor-products-cache';
const PRODUCTS_REQUEST_CACHE_MS = 5 * 60_000;

function normalizeImages(item: Partial<ProductApiRecord> | Partial<Product>): string[] {
  const values = Array.isArray(item.images) ? item.images : [];
  const imageUrl = String(item.imageUrl ?? '').trim();
  return Array.from(new Set([imageUrl, ...values.map((value) => String(value ?? '').trim())].filter(Boolean)));
}

function normalizeIngredients(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  return String(value ?? '').split(/\n|,/).map((item) => item.trim()).filter(Boolean);
}

function normalizeReviews(value: unknown): ProductReview[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((review) => {
      const source = review as Partial<ProductReview>;
      return {
        author: String(source.author ?? '').trim(),
        rating: Math.max(1, Math.min(5, Number(source.rating ?? 5))),
        comment: String(source.comment ?? '').trim(),
        date: source.date ? String(source.date) : undefined
      };
    })
    .filter((review) => review.author && review.comment);
}

function normalizeMinimumQuantity(value: unknown): number {
  const quantity = Math.floor(Number(value));
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function toProduct(item: ProductApiRecord): Product {
  return {
    id: item._id,
    name: item.name,
    description: item.description ?? '',
    price: Number(item.price ?? 0),
    category: item.category ?? 'extras',
    imageUrl: item.imageUrl ?? '',
    images: normalizeImages(item),
    ingredients: normalizeIngredients(item.ingredients),
    reviews: normalizeReviews(item.reviews),
    customizationOptions: normalizeCustomizationOptions(item.customizationOptions),
    slug: item.slug ?? '',
    available: item.available ?? true,
    published: item.published ?? true,
    trackStock: item.trackStock ?? false,
    stock: Number(item.stock ?? 0),
    lowStockAlert: Number(item.lowStockAlert ?? 5),
    minimumQuantity: normalizeMinimumQuantity(item.minimumQuantity),
    unitLabel: String(item.unitLabel ?? '').trim(),
    order: item.order ?? 0,
    isBestSeller: item.isBestSeller ?? false,
    featured: item.featured ?? false,
    salesCount: Number(item.salesCount ?? 0),
    soldCount: Number(item.soldCount ?? 0)
  };
}

function toCachedProduct(item: Partial<Product>): Product | null {
  if (!item.id || !item.name) return null;

  return {
    id: item.id,
    name: item.name,
    description: item.description ?? '',
    price: Number(item.price ?? 0),
    category: item.category ?? 'extras',
    imageUrl: item.imageUrl ?? '',
    images: normalizeImages(item),
    ingredients: normalizeIngredients(item.ingredients),
    reviews: normalizeReviews(item.reviews),
    customizationOptions: normalizeCustomizationOptions(item.customizationOptions),
    slug: item.slug ?? '',
    available: item.available ?? true,
    published: item.published ?? true,
    trackStock: item.trackStock ?? false,
    stock: Number(item.stock ?? 0),
    lowStockAlert: Number(item.lowStockAlert ?? 5),
    minimumQuantity: normalizeMinimumQuantity(item.minimumQuantity),
    unitLabel: String(item.unitLabel ?? '').trim(),
    order: item.order ?? 0,
    isBestSeller: item.isBestSeller ?? false,
    featured: item.featured ?? false,
    salesCount: Number(item.salesCount ?? 0),
    soldCount: Number(item.soldCount ?? 0)
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
    slug: 'combo-cubano-clasico',
    available: true,
    published: true,
    trackStock: false,
    stock: 0,
    lowStockAlert: 5,
    order: 1,
    isBestSeller: true,
    featured: true,
    salesCount: 42,
    soldCount: 42
  },
  {
    id: 'tarta-1',
    name: 'Tarta Tres Leches',
    description: 'Bizcocho jugoso con mezcla de tres leches y merengue suave.',
    price: 4.9,
    category: 'tartas',
    imageUrl: 'https://images.unsplash.com/photo-1464305795204-6f5bbfc7fb81?w=900',
    images: ['https://images.unsplash.com/photo-1464305795204-6f5bbfc7fb81?w=900'],
    ingredients: ['Bizcocho', 'Tres leches', 'Merengue'],
    reviews: [{ author: 'Cliente verificado', rating: 5, comment: 'Muy jugosa y perfecta para compartir.' }],
    customizationOptions: {
      themes: [{ name: 'Cumpleaños' }, { name: 'Celebración familiar' }],
      colors: [{ name: 'Blanco' }, { name: 'Rojo' }],
      sizes: [{ name: '6 porciones' }, { name: '10 porciones', price: 8 }],
      fillings: [{ name: 'Tres leches' }, { name: 'Dulce de leche', price: 3 }],
      toppings: [{ name: 'Merengue' }, { name: 'Fruta', price: 4 }]
    },
    slug: 'tarta-tres-leches',
    available: true,
    published: true,
    trackStock: false,
    stock: 0,
    lowStockAlert: 5,
    order: 20,
    isBestSeller: false,
    featured: false,
    salesCount: 0,
    soldCount: 0
  },
  {
    id: 'dulce-gourmet-1',
    name: 'Dulce Gourmet de Coco',
    description: 'Bocado artesanal de coco con acabado premium para eventos y sobremesas.',
    price: 3.5,
    category: 'dulces-gourmet',
    imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=900',
    slug: 'dulce-gourmet-de-coco',
    available: true,
    published: true,
    trackStock: false,
    stock: 0,
    lowStockAlert: 5,
    order: 21,
    isBestSeller: false,
    featured: false,
    salesCount: 0,
    soldCount: 0
  }
];

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly endpoint = `${resolveApiBaseUrl()}/products`;
  private loadingRequest: Promise<void> | null = null;
  private lastLoadAt = 0;

  readonly products = signal<Product[]>(this.readCachedProducts());
  readonly loading = signal(false);

  async loadProducts({ force = false } = {}): Promise<void> {
    if (this.loadingRequest) return this.loadingRequest;
    if (!force && this.lastLoadAt && Date.now() - this.lastLoadAt < PRODUCTS_REQUEST_CACHE_MS) return;

    this.loading.set(true);
    this.loadingRequest = this.fetchProducts()
      .catch(() => {
        if (!this.products().length) {
          this.products.set(fallbackProducts);
        }
      })
      .finally(() => {
        this.lastLoadAt = Date.now();
        this.loading.set(false);
        this.loadingRequest = null;
      });

    return this.loadingRequest;
  }

  private async fetchProducts(): Promise<void> {
    const response = await fetch(this.endpoint);
    if (!response.ok) throw new Error('No se pudieron cargar los productos.');

    const data = (await response.json()) as { products?: ProductApiRecord[] };
    const normalized = (data.products ?? []).map(toProduct);
    this.products.set(normalized);
    this.writeCachedProducts(normalized);
  }

  private readCachedProducts(): Product[] {
    try {
      const raw = globalThis.localStorage?.getItem(PRODUCTS_CACHE_KEY);
      if (!raw) return [];

      const parsed = JSON.parse(raw) as Partial<Product>[];
      if (!Array.isArray(parsed)) return [];

      return parsed
        .map(toCachedProduct)
        .filter((product): product is Product => Boolean(product));
    } catch {
      return [];
    }
  }

  private writeCachedProducts(products: Product[]): void {
    try {
      globalThis.localStorage?.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(products));
    } catch {
      // Ignore storage failures so product loading is not blocked by browser settings.
    }
  }
}
