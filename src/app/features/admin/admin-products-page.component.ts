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
      <div class="grid two">
        <label>
          <span>Email admin</span>
          <input [(ngModel)]="email" placeholder="admin@dominio.com" />
        </label>
        <label>
          <span>Contraseña</span>
          <input [(ngModel)]="password" type="password" placeholder="********" />
        </label>
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
            <button class="btn" routerLink="/admin/cocina">Ir a cocina</button>
            <button class="btn" routerLink="/admin/contactos">Contactos</button>
            <button class="btn" (click)="logout()">Salir</button>
          </div>
        </div>

        <p class="err" *ngIf="error()">{{ error() }}</p>

        <form class="product-form" (ngSubmit)="saveProduct()">
          <h3>Información básica</h3>
          <div class="grid two">
            <label>
              <span>Nombre del producto</span>
              <input [(ngModel)]="form.name" name="name" placeholder="Croquetas" required />
            </label>
            <label>
              <span>Categoría</span>
              <input [(ngModel)]="form.category" name="category" placeholder="platos / bebidas / combos" required />
            </label>
            <label>
              <span>Precio (€)</span>
              <input [(ngModel)]="form.price" name="price" type="number" min="0" step="0.01" placeholder="13.00" required />
            </label>
            <label>
              <span>Orden en catálogo</span>
              <input [(ngModel)]="form.order" name="order" type="number" placeholder="0" />
            </label>
            <label class="full">
              <span>Imagen del producto (URL)</span>
              <input [(ngModel)]="form.imageUrl" name="imageUrl" placeholder="https://..." />
            </label>
          </div>

          <div class="preview" *ngIf="form.imageUrl">
            <p>Vista previa:</p>
            <img [src]="form.imageUrl" alt="Vista previa producto" class="product-preview" />
          </div>

          <h3>Inventario</h3>
          <div class="grid two">
            <label>
              <span>Stock disponible</span>
              <input [(ngModel)]="form.stock" name="stock" type="number" min="0" placeholder="0" />
              <small>Cantidad actual disponible para vender.</small>
            </label>
            <label>
              <span>Stock mínimo (alerta)</span>
              <input [(ngModel)]="form.lowStockAlert" name="lowStockAlert" type="number" min="0" placeholder="5" />
              <small>Se mostrará alerta cuando el stock sea ≤ a este valor.</small>
            </label>
            <label class="checkbox">
              <input type="checkbox" [(ngModel)]="form.trackStock" name="trackStock" />
              <div>
                <strong>Controlar stock</strong>
                <small>Si está activo, el sistema reducirá stock al recibir pedidos.</small>
              </div>
            </label>
          </div>

          <h3>Visibilidad y disponibilidad</h3>
          <div class="grid two">
            <label class="checkbox">
              <input type="checkbox" [(ngModel)]="form.published" name="published" />
              <div>
                <strong>Publicado en la web</strong>
                <small>Si lo desactivas, no aparecerá en el catálogo.</small>
              </div>
            </label>
            <label class="checkbox">
              <input type="checkbox" [(ngModel)]="form.available" name="available" />
              <div>
                <strong>Disponible para pedidos</strong>
                <small>Permite o bloquea la compra aunque esté publicado.</small>
              </div>
            </label>
          </div>

          <h3>Descripción</h3>
          <label class="full">
            <span>Descripción del producto</span>
            <textarea [(ngModel)]="form.description" name="description" placeholder="Describe ingredientes, porción y observaciones"></textarea>
          </label>

          <div class="actions form-actions">
            <button class="btn btn-primary" type="submit">{{ editId() ? 'Guardar cambios' : '+ Nuevo producto' }}</button>
            <button class="btn" type="button" *ngIf="editId()" (click)="resetForm()">Cancelar edición</button>
          </div>
        </form>

        <hr />

        <h3>Listado de productos</h3>
        <div class="grid two filters">
          <label>
            <span>Buscar producto</span>
            <input [(ngModel)]="search" placeholder="Nombre o categoría" />
          </label>
          <label>
            <span>Filtrar por categoría</span>
            <input [(ngModel)]="categoryFilter" placeholder="Todas" />
          </label>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Imagen</th>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let product of filteredProducts()">
                <td>
                  <img *ngIf="product.imageUrl" [src]="product.imageUrl" [alt]="product.name" class="thumb" />
                  <span *ngIf="!product.imageUrl">—</span>
                </td>
                <td>
                  <strong>{{ product.name }}</strong>
                  <small class="meta">Orden: {{ product.order ?? 0 }}</small>
                </td>
                <td>{{ product.category }}</td>
                <td>{{ product.price | currency:'EUR' }}</td>
                <td>
                  <ng-container *ngIf="product.trackStock; else noStockTracking">
                    {{ product.stock ?? 0 }}
                  </ng-container>
                  <ng-template #noStockTracking>—</ng-template>
                </td>
                <td>
                  <span class="status" [class.ok]="getStatus(product).kind === 'ok'" [class.warn]="getStatus(product).kind === 'warn'" [class.off]="getStatus(product).kind === 'off'">
                    {{ getStatus(product).label }}
                  </span>
                </td>
                <td class="actions">
                  <button class="btn" (click)="editProduct(product)">Editar</button>
                  <button class="btn" (click)="togglePublished(product)">{{ product.published ? 'Ocultar' : 'Publicar' }}</button>
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
    `.grid{display:grid;gap:.7rem;margin-bottom:.7rem}`,
    `.grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}`,
    `.toolbar{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}`,
    `.actions{display:flex;gap:.6rem;flex-wrap:wrap}`,
    `label{display:flex;flex-direction:column;gap:.28rem}`,
    `label span{font-weight:700;color:var(--text-main)}`,
    `small{color:var(--text-soft)}`,
    `.checkbox{display:flex;flex-direction:row;align-items:flex-start;gap:.55rem;border:1px solid var(--border-soft);border-radius:10px;padding:.55rem;background:var(--surface-1)}`,
    `.checkbox input{margin-top:.25rem}`,
    `.product-form{border:1px solid var(--border-soft);border-radius:12px;padding:.9rem;margin-bottom:1rem;background:var(--surface-0);color:var(--text-main)}`,
    `.product-form h3{margin:.2rem 0 .5rem;color:var(--accent-green)}`,
    `.product-form textarea{min-height:86px}`,
    `.full{grid-column:1/-1}`,
    `.form-actions{margin-top:.6rem}`,
    `.preview{padding:.55rem 0}`,
    `.product-preview{width:180px;height:120px;object-fit:cover;border-radius:10px;border:1px solid var(--border-soft)}`,
    `hr{border:none;border-top:1px solid var(--border-soft);margin:1rem 0}`,
    `.filters{margin-bottom:.9rem}`,
    `.table-wrap{overflow:auto}`,
    `table{width:100%;border-collapse:collapse;background:var(--surface-0);border:1px solid var(--border-soft);border-radius:12px;color:var(--text-main)}`,
    `th,td{padding:.65rem;border-bottom:1px solid var(--border-soft);text-align:left;vertical-align:top}`,
    `th{background:var(--surface-1)}`,
    `.thumb{width:56px;height:56px;object-fit:cover;border-radius:8px}`,
    `.meta{display:block;color:var(--text-soft);font-size:.78rem;margin-top:.2rem}`,
    `.status{display:inline-block;padding:.18rem .48rem;border-radius:999px;font-weight:700}`,
    `.status.ok{background:color-mix(in srgb, var(--accent-green) 20%, var(--surface-2));color:#c8f9e2}`,
    `.status.warn{background:color-mix(in srgb, #facc15 20%, var(--surface-2));color:#ffe9a8}`,
    `.status.off{background:var(--surface-2);color:var(--text-soft)}`,
    `.err{color:var(--error-text)}`,
    `@media (max-width:900px){.grid.two{grid-template-columns:1fr}}`
  ]
})
export class AdminProductsPageComponent {
  email = '';
  password = '';
  search = '';
  categoryFilter = '';

  readonly loading = signal(false);
  readonly error = signal('');
  readonly editId = signal<string>('');
  readonly products = signal<ProductApiRecord[]>([]);

  readonly filteredProducts = computed(() => {
    const query = this.search.trim().toLowerCase();
    const category = this.categoryFilter.trim().toLowerCase();

    return this.products()
      .filter((item) => (category ? String(item.category ?? '').toLowerCase().includes(category) : true))
      .filter((item) => {
        const text = `${item.name ?? ''} ${item.category ?? ''}`.toLowerCase();
        return query ? text.includes(query) : true;
      });
  });

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

  getStatus(product: ProductApiRecord): { label: string; kind: 'ok' | 'warn' | 'off' } {
    if (!product.published) return { label: '⚫ No publicado', kind: 'off' };
    if (!product.available) return { label: '⚫ No disponible', kind: 'off' };

    if (product.trackStock) {
      const stock = Number(product.stock ?? 0);
      if (stock <= 0) return { label: '🔴 Sin stock', kind: 'off' };
      if (this.isLowStock(product)) return { label: '🟡 Stock bajo', kind: 'warn' };
    }

    return { label: '🟢 Disponible', kind: 'ok' };
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
