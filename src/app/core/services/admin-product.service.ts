import { Injectable } from '@angular/core';
import { resolveApiBaseUrl } from '../config/api.config';
import { ProductApiRecord } from '../models/product.model';
import { AdminAuthService } from './admin-auth.service';

export interface AdminProductPayload {
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
  available: boolean;
  published: boolean;
  trackStock: boolean;
  stock: number;
  lowStockAlert: number;
  order: number;
}

@Injectable({ providedIn: 'root' })
export class AdminProductService {
  private readonly apiBase = resolveApiBaseUrl();

  constructor(private readonly auth: AdminAuthService) {}

  async listProducts(): Promise<ProductApiRecord[]> {
    const response = await fetch(`${this.apiBase}/admin/products`, {
      headers: { Authorization: `Bearer ${this.auth.token()}` }
    });

    if (!response.ok) {
      throw new Error('No fue posible cargar productos.');
    }

    const data = (await response.json()) as { products?: ProductApiRecord[] };
    return data.products ?? [];
  }

  async createProduct(payload: AdminProductPayload): Promise<void> {
    const response = await fetch(`${this.apiBase}/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.auth.token()}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('No fue posible crear el producto.');
  }

  async updateProduct(id: string, payload: AdminProductPayload): Promise<void> {
    const response = await fetch(`${this.apiBase}/admin/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.auth.token()}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('No fue posible actualizar el producto.');
  }

  async deleteProduct(id: string): Promise<void> {
    const response = await fetch(`${this.apiBase}/admin/products/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.auth.token()}` }
    });

    if (!response.ok) throw new Error('No fue posible eliminar el producto.');
  }
}
