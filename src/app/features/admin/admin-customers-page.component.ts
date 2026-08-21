import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { buildWhatsAppContactUrl } from '../../core/config/whatsapp.config';
import {
  AdminCustomer,
  AdminCustomerCouponFilter,
  AdminCustomerMarketingFilter,
  AdminCustomerMetrics,
  AdminCustomerOrdersFilter,
  AdminCustomerPagination
} from '../../core/models/admin-customer.model';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { AdminCustomerService } from '../../core/services/admin-customer.service';
import { AdminOrderService } from '../../core/services/admin-order.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="card" *ngIf="!auth.isAuthenticated(); else panel">
      <h1>Acceso administrador</h1>
      <div class="grid two">
        <input [(ngModel)]="email" placeholder="Email admin" />
        <input [(ngModel)]="password" type="password" placeholder="Contraseña" />
      </div>
      <button class="btn btn-primary" (click)="login()" [disabled]="loading()">{{ loading() ? 'Iniciando sesión...' : 'Iniciar sesión' }}</button>
      <p class="err" *ngIf="error()">{{ error() }}</p>
    </section>

    <ng-template #panel>
      <section class="card admin-customers">
        <div class="toolbar">
          <div>
            <p class="eyebrow">CRM operativo</p>
            <h1>👥 Clientes y newsletter</h1>
            <p class="muted">Listado ligero con búsqueda, filtros y acciones rápidas.</p>
          </div>
          <div class="actions">
            <button class="btn" routerLink="/admin/dashboard">Dashboard</button>
            <button class="btn" routerLink="/admin/pedidos">Pedidos</button>
            <button class="btn" routerLink="/admin/contactos">Contactos</button>
            <button class="btn" routerLink="/admin/cocina">Cocina</button>
            <button class="btn" routerLink="/admin/productos">Productos</button>
            <button class="btn" routerLink="/admin/portada">Portada</button>
            <button class="btn" (click)="logout()">Salir</button>
          </div>
        </div>

        <div class="metrics" aria-label="Métricas de clientes">
          <article>
            <span>Total clientes</span>
            <strong>{{ metrics().totalCustomers }}</strong>
          </article>
          <article>
            <span>Clientes marketing</span>
            <strong>{{ metrics().marketingCustomers }}</strong>
          </article>
          <article>
            <span>Clientes con pedidos</span>
            <strong>{{ metrics().customersWithOrders }}</strong>
          </article>
        </div>

        <form class="filters" (ngSubmit)="applyFilters()">
          <label>
            Buscar
            <input [(ngModel)]="search" name="search" placeholder="Nombre, email o teléfono" />
          </label>
          <label>
            Marketing
            <select [(ngModel)]="marketingFilter" name="marketingFilter" (change)="applyFilters()">
              <option value="">Todos</option>
              <option value="true">Con consentimiento</option>
              <option value="false">Sin consentimiento</option>
            </select>
          </label>
          <label>
            Pedidos
            <select [(ngModel)]="ordersFilter" name="ordersFilter" (change)="applyFilters()">
              <option value="">Todos</option>
              <option value="with_orders">Con pedidos</option>
              <option value="without_orders">Sin pedidos</option>
            </select>
          </label>
          <label>
            Cupón
            <select [(ngModel)]="couponFilter" name="couponFilter" (change)="applyFilters()">
              <option value="">Todos</option>
              <option value="used">Usado</option>
              <option value="not_used">No usado</option>
            </select>
          </label>
          <label>
            Límite
            <select [(ngModel)]="limit" name="limit" (change)="applyFilters()">
              <option [ngValue]="25">25</option>
              <option [ngValue]="50">50</option>
              <option [ngValue]="100">100</option>
            </select>
          </label>
          <div class="filter-actions">
            <button class="btn btn-primary" type="submit" [disabled]="loading()">{{ loading() ? 'Cargando...' : 'Buscar' }}</button>
            <button class="btn btn-secondary" type="button" (click)="resetFilters()">Limpiar</button>
          </div>
        </form>

        <p class="ok" *ngIf="notice()">{{ notice() }}</p>
        <p class="err" *ngIf="error()">{{ error() }}</p>

        <div class="list-summary">
          <span>{{ customers().length }} mostrados de {{ pagination().total }}</span>
          <span>Página {{ pagination().page }} · {{ pagination().limit }} por página</span>
        </div>

        <div class="customer-list" *ngIf="customers().length; else emptyState">
          <article class="customer-card" *ngFor="let customer of customers(); trackBy: trackByCustomerId">
            <header>
              <div>
                <h2>{{ customer.fullName || 'Cliente sin nombre' }}</h2>
                <p class="muted">Alta: {{ customer.createdAt ? (customer.createdAt | date:'dd/MM/yyyy HH:mm') : 'N/A' }}</p>
              </div>
              <span class="coupon" [class.used]="isCouponUsed(customer)" [class.available]="!isCouponUsed(customer)">
                {{ couponLabel(customer) }}
              </span>
            </header>

            <div class="customer-grid">
              <div>
                <small>Email</small>
                <strong>{{ customer.email || 'N/A' }}</strong>
              </div>
              <div>
                <small>Teléfono</small>
                <strong>{{ customer.phone || 'N/A' }}</strong>
              </div>
              <div>
                <small>Pedidos</small>
                <strong>{{ customer.orderCount ?? 0 }}</strong>
              </div>
              <div>
                <small>Total gastado</small>
                <strong>{{ (customer.totalSpent ?? 0) | currency:'EUR' }}</strong>
              </div>
              <div>
                <small>Marketing</small>
                <strong>{{ customer.marketingConsent ? 'Sí' : 'No' }}</strong>
              </div>
              <div>
                <small>Newsletter</small>
                <strong>{{ customer.newsletter?.subscribed ? 'Suscrito' : '—' }}</strong>
              </div>
            </div>

            <div class="quick-actions">
              <button class="btn btn-secondary" type="button" (click)="copyValue(customer.email, 'Email')" [disabled]="!customer.email">Copiar email</button>
              <button class="btn btn-secondary" type="button" (click)="copyValue(customer.phone, 'Teléfono')" [disabled]="!customer.phone">Copiar teléfono</button>
              <a class="btn btn-primary" [href]="whatsappContactUrl" target="_blank" rel="noopener noreferrer">Contactar por WhatsApp</a>
            </div>
          </article>
        </div>

        <ng-template #emptyState>
          <div class="empty">No hay clientes para los filtros seleccionados.</div>
        </ng-template>

        <div class="pagination">
          <button class="btn btn-secondary" type="button" (click)="previousPage()" [disabled]="loading() || !pagination().hasPreviousPage">Anterior</button>
          <button class="btn btn-secondary" type="button" (click)="nextPage()" [disabled]="loading() || !pagination().hasNextPage">Siguiente</button>
        </div>
      </section>
    </ng-template>
  `,
  styles: [
    `.admin-customers{display:grid;gap:1rem}`,
    `.grid.two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem;margin-bottom:.7rem}`,
    `.toolbar{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap}`,
    `.toolbar h1{margin:.15rem 0}`,
    `.actions,.quick-actions,.pagination{display:flex;gap:.55rem;flex-wrap:wrap}`,
    `.eyebrow{margin:0;color:var(--accent-green);font-weight:900;text-transform:uppercase;letter-spacing:.06em;font-size:.78rem}`,
    `.muted{color:var(--text-soft);margin:.15rem 0}`,
    `.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.75rem}`,
    `.metrics article{background:var(--surface-1);border:1px solid var(--border-soft);border-radius:14px;padding:.85rem}`,
    `.metrics span,.customer-grid small{display:block;color:var(--text-soft);font-weight:700;font-size:.78rem}`,
    `.metrics strong{display:block;margin-top:.25rem;font-size:1.65rem;color:var(--text-main)}`,
    `.filters{display:grid;grid-template-columns:2fr repeat(4,minmax(120px,1fr)) auto;gap:.7rem;align-items:end;background:var(--surface-1);border:1px solid var(--border-soft);border-radius:14px;padding:.85rem}`,
    `.filters label{display:grid;gap:.35rem;color:var(--text-soft);font-weight:800}`,
    `.filter-actions{display:flex;gap:.45rem;flex-wrap:wrap}`,
    `.list-summary{display:flex;justify-content:space-between;gap:.75rem;flex-wrap:wrap;color:var(--text-soft);font-weight:800}`,
    `.customer-list{display:grid;gap:.75rem}`,
    `.customer-card{background:var(--surface-1);border:1px solid var(--border-soft);border-radius:14px;padding:.85rem;color:var(--text-main)}`,
    `.customer-card header{display:flex;justify-content:space-between;gap:.75rem;align-items:flex-start;flex-wrap:wrap;margin-bottom:.75rem}`,
    `.customer-card h2{margin:0;font-size:1.1rem}`,
    `.customer-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:.65rem;margin-bottom:.85rem}`,
    `.customer-grid div{background:var(--surface-0);border:1px solid var(--border-soft);border-radius:10px;padding:.65rem;min-width:0}`,
    `.customer-grid strong{display:block;overflow-wrap:anywhere;color:var(--text-main);margin-top:.15rem}`,
    `.coupon{border-radius:999px;padding:.28rem .65rem;color:var(--on-accent);font-weight:900;background:var(--status-cancelled-bg)}`,
    `.coupon.used{background:var(--status-delivered-bg)}`,
    `.coupon.available{background:var(--status-sent-bg)}`,
    `.empty{border:1px dashed var(--border-soft);border-radius:14px;padding:1.2rem;text-align:center;color:var(--text-soft);background:var(--surface-1)}`,
    `.err{color:var(--error-text);white-space:pre-line}`,
    `.ok{color:var(--ok-text);white-space:pre-line}`,
    `@media (max-width:1100px){.filters{grid-template-columns:repeat(2,minmax(0,1fr))}.customer-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}`,
    `@media (max-width:720px){.metrics,.filters,.customer-grid,.grid.two{grid-template-columns:1fr}.quick-actions .btn,.quick-actions a{width:100%;text-align:center}.customer-card header{display:grid}}`
  ]
})
export class AdminCustomersPageComponent {
  email = '';
  password = '';
  search = '';
  marketingFilter: AdminCustomerMarketingFilter = '';
  ordersFilter: AdminCustomerOrdersFilter = '';
  couponFilter: AdminCustomerCouponFilter = '';
  limit = 50;
  readonly whatsappContactUrl = buildWhatsAppContactUrl();

  readonly loading = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly customers = signal<AdminCustomer[]>([]);
  readonly metrics = signal<AdminCustomerMetrics>({ totalCustomers: 0, marketingCustomers: 0, customersWithOrders: 0 });
  readonly pagination = signal<AdminCustomerPagination>({ page: 1, limit: 50, total: 0, hasNextPage: false, hasPreviousPage: false });
  readonly currentPage = computed(() => this.pagination().page);

  constructor(
    public readonly auth: AdminAuthService,
    private readonly adminOrders: AdminOrderService,
    private readonly adminCustomers: AdminCustomerService
  ) {
    if (this.auth.isAuthenticated()) {
      void this.loadCustomers();
    }
  }

  async login(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    this.notice.set('');

    try {
      await this.adminOrders.login(this.email, this.password);
      await this.loadCustomers();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
    } finally {
      this.loading.set(false);
    }
  }

  logout(): void {
    this.auth.logout();
    this.customers.set([]);
    this.metrics.set({ totalCustomers: 0, marketingCustomers: 0, customersWithOrders: 0 });
    this.pagination.set({ page: 1, limit: this.limit, total: 0, hasNextPage: false, hasPreviousPage: false });
  }

  async applyFilters(): Promise<void> {
    await this.loadCustomers(1);
  }

  async resetFilters(): Promise<void> {
    this.search = '';
    this.marketingFilter = '';
    this.ordersFilter = '';
    this.couponFilter = '';
    this.limit = 50;
    await this.loadCustomers(1);
  }

  async previousPage(): Promise<void> {
    if (!this.pagination().hasPreviousPage) return;
    await this.loadCustomers(this.currentPage() - 1);
  }

  async nextPage(): Promise<void> {
    if (!this.pagination().hasNextPage) return;
    await this.loadCustomers(this.currentPage() + 1);
  }

  async loadCustomers(page = this.currentPage()): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    this.notice.set('');

    try {
      const result = await this.adminCustomers.listCustomers({
        search: this.search,
        marketingFilter: this.marketingFilter,
        ordersFilter: this.ordersFilter,
        couponFilter: this.couponFilter,
        page,
        limit: this.limit
      });

      this.customers.set(result.customers);
      this.metrics.set(result.metrics);
      this.pagination.set(result.pagination);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudieron cargar clientes/newsletter.');
    } finally {
      this.loading.set(false);
    }
  }

  trackByCustomerId(_index: number, customer: AdminCustomer): string {
    return customer.id;
  }

  isCouponUsed(customer: AdminCustomer): boolean {
    return customer.firstOrderDiscount?.status === 'used' || customer.firstOrderCoupon?.status === 'used';
  }

  couponLabel(customer: AdminCustomer): string {
    if (this.isCouponUsed(customer)) return 'PRIMER10 usado';
    return 'PRIMER10 no usado';
  }

  async copyValue(value: string | null | undefined, label: string): Promise<void> {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      this.notice.set(`${label} copiado.`);
    } catch {
      this.error.set(`No se pudo copiar ${label.toLowerCase()}.`);
    }
  }

}
