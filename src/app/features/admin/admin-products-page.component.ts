import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { AdminOrderService } from '../../core/services/admin-order.service';
import {
  AdminProductPayload,
  AdminProductService
} from '../../core/services/admin-product.service';
import { ProductApiRecord } from '../../core/models/product.model';

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
          <textarea [(ngModel)]="form.description" name="description" placeholder="Descripción"></textarea>
          <div class="actions">
            <button class="btn btn-primary" type="submit">{{ editId() ? 'Guardar cambios' : '+ Nuevo producto' }}</button>
            <button class="btn" type="button" *ngIf="editId()" (click)="resetForm()">Cancelar edición</button>
          </div>
        </form>

        <article class="order" *ngFor="let product of products()">
          <header>
            <h3>{{ product.name }}</h3>
            <span class="badge" [class.anulado]="!product.available">{{ product.available ? 'disponible' : 'oculto' }}</span>
          </header>
          <p><strong>Categoría:</strong> {{ product.category }} · <strong>Precio:</strong> {{ product.price | currency:'EUR' }} · <strong>Orden:</strong> {{ product.order ?? 0 }}</p>
          <p>{{ product.description }}</p>
          <div class="actions">
            <button class="btn" (click)="editProduct(product)">Editar</button>
            <button class="btn" (click)="toggleAvailability(product)">{{ product.available ? 'Desactivar' : 'Activar' }}</button>
            <button class="btn" (click)="removeProduct(product)">Eliminar</button>
          </div>
        </article>
      </section>
    </ng-template>
  `,
  styles: [
    `.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem;margin-bottom:.7rem}`,
    `.toolbar{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}`,
    `.actions{display:flex;gap:.6rem;flex-wrap:wrap}`,
    `.product-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.55rem;border:1px solid #e5e7eb;border-radius:12px;padding:.8rem}`,
    `.product-form textarea{grid-column:1/-1;min-height:74px}`,
    `.order{border:1px solid #e5e7eb;border-radius:12px;padding:.9rem;margin-top:.8rem;background:#fff}`,
    `.badge{padding:.25rem .6rem;border-radius:999px;color:#fff;font-weight:700;background:#2f8a2c}`,
    `.badge.anulado{background:#c71f26}`,
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

  form: AdminProductPayload = {
    name: '',
    description: '',
    price: 0,
    category: 'platos',
    imageUrl: '',
    available: true,
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

  editProduct(product: ProductApiRecord): void {
    this.editId.set(product._id);
    this.form = {
      name: product.name,
      description: product.description ?? '',
      price: Number(product.price ?? 0),
      category: product.category ?? 'platos',
      imageUrl: product.imageUrl ?? '',
      available: product.available ?? true,
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

  async toggleAvailability(product: ProductApiRecord): Promise<void> {
    try {
      await this.adminProducts.updateProduct(product._id, {
        name: product.name,
        description: product.description ?? '',
        price: Number(product.price ?? 0),
        category: product.category ?? 'platos',
        imageUrl: product.imageUrl ?? '',
        available: !(product.available ?? true),
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
