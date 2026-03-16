import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProductApiRecord } from '../../core/models/product.model';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { AdminOrderService } from '../../core/services/admin-order.service';
import {
  AdminProductPayload,
  AdminProductService
} from '../../core/services/admin-product.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="card" *ngIf="!auth.isAuthenticated(); else panel">
      <h1>Acceso administrador</h1>
      <div class="grid">
        <input [(ngModel)]="email" placeholder="Email admin" />
        <input [(ngModel)]="password" type="password" placeholder="Contraseña" />
      </div>
      <button class="btn btn-primary" (click)="login()" [disabled]="loading()">{{ loading() ? 'Entrando...' : 'Entrar' }}</button>
      <p class="err" *ngIf="error()">{{ error() }}</p>
    </section>

    <ng-template #panel>
      <section class="card">
        <div class="toolbar">
          <h1>Admin · Productos</h1>
          <div class="actions">
            <button class="btn" (click)="loadProducts()">Actualizar</button>
            <button class="btn" routerLink="/admin/pedidos">Ir a pedidos</button>
            <button class="btn" (click)="logout()">Salir</button>
          </div>
        </div>

        <p class="err" *ngIf="error()">{{ error() }}</p>

        <form class="product-form" (ngSubmit)="saveProduct()">
          <input [(ngModel)]="form.name" name="name" placeholder="Nombre" required />
          <input [(ngModel)]="form.category" name="category" placeholder="Categoría" required />
          <input [(ngModel)]="form.price" name="price" type="number" min="0" step="0.01" placeholder="Precio" required />
          <input [(ngModel)]="form.imageUrl" name="imageUrl" placeholder="URL imagen" />
          <input [(ngModel)]="form.order" name="order" type="number" placeholder="Orden" />
          <label><input type="checkbox" [(ngModel)]="form.available" name="available" /> Disponible</label>
          <label><input type="checkbox" [(ngModel)]="form.published" name="published" /> Publicado</label>
          <label><input type="checkbox" [(ngModel)]="form.trackStock" name="trackStock" /> Controlar stock</label>
          <input [(ngModel)]="form.stock" name="stock" type="number" min="0" placeholder="Stock" />
          <input [(ngModel)]="form.lowStockAlert" name="lowStockAlert" type="number" min="0" placeholder="Alerta stock bajo" />
          <textarea [(ngModel)]="form.description" name="description" placeholder="Descripción"></textarea>
          <div class="actions form-actions">
            <button class="btn btn-primary" type="submit">{{ editId() ? 'Guardar cambios' : '+ Nuevo producto' }}</button>
            <button class="btn" type="button" *ngIf="editId()" (click)="resetForm()">Cancelar edición</button>
          </div>
        </form>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Publicado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let product of products()">
                <td>
                  <strong>{{ product.name }}</strong>
                  <small class="meta" *ngIf="isLowStock(product)">⚠ Stock bajo</small>
                </td>
                <td>{{ product.category }}</td>
                <td>{{ product.price | currency:'EUR' }}</td>
                <td>
                  <ng-container *ngIf="product.trackStock; else noStockTracking">
                    {{ product.stock ?? 0 }}
                  </ng-container>
                  <ng-template #noStockTracking>—</ng-template>
                </td>
                <td>{{ product.published ? '✅' : '❌' }}</td>
                <td class="actions">
                  <button class="btn" (click)="editProduct(product)">Editar</button>
                  <button class="btn" (click)="togglePublished(product)">{{ product.published ? 'Despublicar' : 'Publicar' }}</button>
                  <button class="btn" (click)="toggleAvailability(product)">{{ product.available ? 'Desactivar' : 'Activar' }}</button>
                  <button class="btn" (click)="removeProduct(product)">Eliminar</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </ng-template>
  `,
  styles: [
    `.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem;margin-bottom:.7rem}`,
    `.toolbar{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}`,
    `.actions{display:flex;gap:.6rem;flex-wrap:wrap}`,
    `.product-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.55rem;border:1px solid #e5e7eb;border-radius:12px;padding:.8rem;margin-bottom:1rem}`,
    `.product-form textarea{grid-column:1/-1;min-height:74px}`,
    `.form-actions{grid-column:1/-1}`,
    `.table-wrap{overflow:auto}`,
    `table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb;border-radius:12px}`,
    `th,td{padding:.65rem;border-bottom:1px solid #edf0f5;text-align:left;vertical-align:top}`,
    `th{background:#f8fafc}`,
    `.meta{display:block;color:#c71f26;font-size:.8rem;margin-top:.2rem}`,
    `.err{color:#b42318}`,
    `@media (max-width:900px){.grid,.product-form{grid-template-columns:1fr}}`
  ]
})
export class AdminProductsPageComponent {
  email = '';
  password = '';

  readonly loading = signal(false);
  readonly error = signal('');
  readonly editId = signal<string>('');
  readonly products = signal<ProductApiRecord[]>([]);

  readonly lowStockCount = computed(
    () => this.products().filter((item) => this.isLowStock(item)).length
  );

  form: AdminProductPayload = {
    name: '',
    description: '',
    price: 0,
    category: 'platos',
    imageUrl: '',
    available: true,
    published: true,
    trackStock: false,
    stock: 0,
    lowStockAlert: 5,
    order: 0
  };

  constructor(
    public readonly auth: AdminAuthService,
    private readonly adminOrders: AdminOrderService,
    private readonly adminProducts: AdminProductService
  ) {
    if (this.auth.isAuthenticated()) {
      void this.loadProducts();
    }
  }

  async login(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.adminOrders.login(this.email, this.password);
      await this.loadProducts();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
    } finally {
      this.loading.set(false);
    }
  }

  logout(): void {
    this.auth.logout();
    this.products.set([]);
  }

  async loadProducts(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.products.set(await this.adminProducts.listProducts());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudieron cargar productos.');
    } finally {
      this.loading.set(false);
    }
  }

  isLowStock(product: ProductApiRecord): boolean {
    return Boolean(product.trackStock) && Number(product.stock ?? 0) <= Number(product.lowStockAlert ?? 5);
  }

  editProduct(product: ProductApiRecord): void {
    this.editId.set(product._id);
    this.form = {
      name: product.name,
      description: product.description ?? '',
      price: Number(product.price ?? 0),
      category: product.category ?? 'platos',
      imageUrl: product.imageUrl ?? '',
      available: product.available ?? true,
      published: product.published ?? true,
      trackStock: product.trackStock ?? false,
      stock: Number(product.stock ?? 0),
      lowStockAlert: Number(product.lowStockAlert ?? 5),
      order: Number(product.order ?? 0)
    };
  }

  resetForm(): void {
    this.editId.set('');
    this.form = {
      name: '',
      description: '',
      price: 0,
      category: 'platos',
      imageUrl: '',
      available: true,
      published: true,
      trackStock: false,
      stock: 0,
      lowStockAlert: 5,
      order: 0
    };
  }

  async saveProduct(): Promise<void> {
    try {
      if (this.editId()) {
        await this.adminProducts.updateProduct(this.editId(), this.form);
      } else {
        await this.adminProducts.createProduct(this.form);
      }

      this.resetForm();
      await this.loadProducts();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo guardar el producto.');
    }
  }

  async togglePublished(product: ProductApiRecord): Promise<void> {
    try {
      await this.adminProducts.updateProduct(product._id, {
        name: product.name,
        description: product.description ?? '',
        price: Number(product.price ?? 0),
        category: product.category ?? 'platos',
        imageUrl: product.imageUrl ?? '',
        available: product.available ?? true,
        published: !(product.published ?? true),
        trackStock: product.trackStock ?? false,
        stock: Number(product.stock ?? 0),
        lowStockAlert: Number(product.lowStockAlert ?? 5),
        order: Number(product.order ?? 0)
      });
      await this.loadProducts();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo cambiar publicación.');
    }
  }

  async toggleAvailability(product: ProductApiRecord): Promise<void> {
    try {
      await this.adminProducts.updateProduct(product._id, {
        name: product.name,
        description: product.description ?? '',
        price: Number(product.price ?? 0),
        category: product.category ?? 'platos',
        imageUrl: product.imageUrl ?? '',
        available: !(product.available ?? true),
        published: product.published ?? true,
        trackStock: product.trackStock ?? false,
        stock: Number(product.stock ?? 0),
        lowStockAlert: Number(product.lowStockAlert ?? 5),
        order: Number(product.order ?? 0)
      });
      await this.loadProducts();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo cambiar disponibilidad.');
    }
  }

  async removeProduct(product: ProductApiRecord): Promise<void> {
    if (!globalThis.confirm(`Eliminar producto ${product.name}?`)) return;

    try {
      await this.adminProducts.deleteProduct(product._id);
      await this.loadProducts();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo eliminar producto.');
    }
  }
}
