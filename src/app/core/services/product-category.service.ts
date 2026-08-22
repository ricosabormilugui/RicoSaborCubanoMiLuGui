import { Injectable, signal } from '@angular/core';
import { PRODUCT_CATEGORIES, getProductCategoryLabel, normalizeCategorySlug } from '../config/product-categories.config';
import { resolveApiBaseUrl } from '../config/api.config';
import { ProductCategoryPayload, ProductCategoryRecord } from '../models/product-category.model';
import { AdminAuthService } from './admin-auth.service';

export class ProductCategoryApiError extends Error {
  constructor(message: string, readonly status: number, readonly productCount?: number) {
    super(message);
    this.name = 'ProductCategoryApiError';
  }
}

function fallbackCategories(): ProductCategoryRecord[] {
  return PRODUCT_CATEGORIES.map((category, index) => ({
    _id: '',
    ...category,
    order: index
  }));
}

function normalizeRecord(value: Partial<ProductCategoryRecord>): ProductCategoryRecord | null {
  const slug = normalizeCategorySlug(value.slug);
  const label = String(value.label ?? '').trim();
  if (!slug || !label) return null;
  return {
    _id: String(value._id ?? ''),
    slug,
    label,
    order: Number(value.order ?? 0),
    ...(value.productCount !== undefined ? { productCount: Math.max(0, Number(value.productCount ?? 0)) } : {})
  };
}

@Injectable({ providedIn: 'root' })
export class ProductCategoryService {
  private readonly apiBase = resolveApiBaseUrl();
  private publicLoadingRequest: Promise<void> | null = null;

  readonly categories = signal<ProductCategoryRecord[]>(fallbackCategories());
  readonly loading = signal(false);

  constructor(private readonly auth: AdminAuthService) {}

  labelFor(value: string | null | undefined): string {
    const slug = normalizeCategorySlug(value);
    return this.categories().find((category) => category.slug === slug)?.label ?? getProductCategoryLabel(value);
  }

  async loadPublicCategories({ force = false } = {}): Promise<void> {
    if (this.publicLoadingRequest && !force) return this.publicLoadingRequest;
    this.loading.set(true);
    this.publicLoadingRequest = this.fetchCategories(`${this.apiBase}/categories`)
      .then((categories) => this.categories.set(categories))
      .finally(() => {
        this.loading.set(false);
        this.publicLoadingRequest = null;
      });
    return this.publicLoadingRequest;
  }

  async loadAdminCategories(): Promise<void> {
    this.loading.set(true);
    try {
      this.categories.set(await this.fetchCategories(`${this.apiBase}/admin/categories`, true));
    } finally {
      this.loading.set(false);
    }
  }

  async createCategory(payload: ProductCategoryPayload): Promise<void> {
    await this.writeCategory(`${this.apiBase}/admin/categories`, 'POST', payload);
    await this.loadAdminCategories();
  }

  async updateCategory(id: string, payload: ProductCategoryPayload): Promise<void> {
    await this.writeCategory(`${this.apiBase}/admin/categories/${encodeURIComponent(id)}`, 'PUT', payload);
    await this.loadAdminCategories();
  }

  async deleteCategory(id: string): Promise<void> {
    const response = await fetch(`${this.apiBase}/admin/categories/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this.adminHeaders()
    });
    if (!response.ok) throw await this.toApiError(response, 'No fue posible eliminar la categoría.');
    this.categories.update((categories) => categories.filter((category) => category._id !== id));
  }

  private async fetchCategories(url: string, admin = false): Promise<ProductCategoryRecord[]> {
    const response = await fetch(url, { headers: admin ? this.adminHeaders() : undefined });
    if (!response.ok) throw await this.toApiError(response, 'No fue posible cargar las categorías.');
    const data = (await response.json()) as { categories?: Partial<ProductCategoryRecord>[] };
    return (data.categories ?? [])
      .map(normalizeRecord)
      .filter((category): category is ProductCategoryRecord => Boolean(category))
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'es'));
  }

  private async writeCategory(url: string, method: 'POST' | 'PUT', payload: ProductCategoryPayload): Promise<void> {
    const response = await fetch(url, {
      method,
      headers: { ...this.adminHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw await this.toApiError(response, 'No fue posible guardar la categoría.');
  }

  private adminHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.auth.token()}` };
  }

  private async toApiError(response: Response, fallback: string): Promise<ProductCategoryApiError> {
    let data: { message?: string; error?: string; productCount?: number } = {};
    try {
      data = await response.json() as typeof data;
    } catch {
      // Keep the safe fallback when the server does not return JSON.
    }
    if (response.status === 401 || response.status === 403) this.auth.logout();
    return new ProductCategoryApiError(data.message ?? data.error ?? fallback, response.status, data.productCount);
  }
}
