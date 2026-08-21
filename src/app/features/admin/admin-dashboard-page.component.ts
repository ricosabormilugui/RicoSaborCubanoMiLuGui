import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AdminDashboardData,
  AdminDashboardSalesDay,
  AdminDashboardStatusMetric
} from '../../core/models/admin-dashboard.model';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { AdminDashboardService } from '../../core/services/admin-dashboard.service';
import { AdminOrderService } from '../../core/services/admin-order.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="card" *ngIf="!auth.isAuthenticated(); else dashboardPanel">
      <h1>Acceso administrador</h1>
      <div class="login-grid">
        <input [(ngModel)]="email" placeholder="Email admin" />
        <input [(ngModel)]="password" type="password" placeholder="Contraseña" />
      </div>
      <button class="btn btn-primary" (click)="login()" [disabled]="loading()">{{ loading() ? 'Iniciando sesión...' : 'Iniciar sesión' }}</button>
      <p class="err" *ngIf="error()">{{ error() }}</p>
    </section>

    <ng-template #dashboardPanel>
      <section class="card dashboard">
        <div class="toolbar">
          <div>
            <p class="eyebrow">Panel admin</p>
            <h1>📊 Dashboard operativo</h1>
            <p class="muted" *ngIf="dashboard() as data">Actualizado: {{ data.generatedAt | date:'dd/MM/yyyy HH:mm' }}</p>
          </div>
          <div class="actions">
            <select [(ngModel)]="days" (change)="loadDashboard()" aria-label="Rango de ventas por día">
              <option [ngValue]="7">7 días</option>
              <option [ngValue]="14">14 días</option>
              <option [ngValue]="30">30 días</option>
            </select>
            <button class="btn" (click)="loadDashboard()" [disabled]="loading()">Actualizar</button>
            <button class="btn" routerLink="/admin/pedidos">Pedidos</button>
            <button class="btn" routerLink="/admin/clientes">Clientes</button>
            <button class="btn" routerLink="/admin/contactos">Contactos</button>
            <button class="btn" routerLink="/admin/productos">Productos</button>
            <button class="btn" routerLink="/admin/portada">Portada</button>
            <button class="btn" (click)="logout()">Salir</button>
          </div>
        </div>

        <p class="loading" *ngIf="loading()">Cargando métricas operativas...</p>
        <p class="err" *ngIf="error()">{{ error() }}</p>

        <ng-container *ngIf="dashboard() as data">
          <div class="metric-grid">
            <article class="metric-card">
              <span>Pedidos totales</span>
              <strong>{{ data.summary.totalOrders }}</strong>
            </article>
            <article class="metric-card warning">
              <span>Pedidos pendientes</span>
              <strong>{{ data.summary.pendingOrders }}</strong>
            </article>
            <article class="metric-card">
              <span>Ventas totales</span>
              <strong>{{ data.summary.totalSales | currency:'EUR' }}</strong>
            </article>
            <article class="metric-card">
              <span>Ventas del mes</span>
              <strong>{{ data.summary.monthSales | currency:'EUR' }}</strong>
            </article>
            <article class="metric-card">
              <span>Ticket medio</span>
              <strong>{{ data.summary.averageTicket | currency:'EUR' }}</strong>
            </article>
            <article class="metric-card">
              <span>Clientes totales</span>
              <strong>{{ data.summary.totalCustomers }}</strong>
            </article>
            <article class="metric-card ok">
              <span>Clientes marketing</span>
              <strong>{{ data.summary.marketingCustomers }}</strong>
            </article>
            <article class="metric-card danger">
              <span>Pendientes de pago</span>
              <strong>{{ data.operations.pendingPaymentOrders }}</strong>
            </article>
          </div>

          <div class="dashboard-grid two-columns">
            <article class="panel chart-panel">
              <header>
                <h2>Ventas por día</h2>
                <span>{{ data.range.days }} días</span>
              </header>
              <div class="bar-chart" *ngIf="data.charts.salesByDay.length; else noSalesDays">
                <div class="bar-row" *ngFor="let item of data.charts.salesByDay">
                  <span>{{ dayLabel(item.day) }}</span>
                  <div class="bar-track">
                    <div class="bar-fill" [style.width.%]="salesBarWidth(item)"></div>
                  </div>
                  <strong>{{ item.sales | currency:'EUR' }}</strong>
                </div>
              </div>
              <ng-template #noSalesDays><p class="empty">Sin ventas en el rango.</p></ng-template>
            </article>

            <article class="panel chart-panel">
              <header>
                <h2>Pedidos por estado</h2>
                <span>{{ totalStatusOrders(data.charts.ordersByStatus) }} pedidos</span>
              </header>
              <div class="bar-chart" *ngIf="data.charts.ordersByStatus.length; else noStatuses">
                <div class="bar-row" *ngFor="let item of data.charts.ordersByStatus">
                  <span>{{ statusLabel(item.status) }}</span>
                  <div class="bar-track status">
                    <div class="bar-fill status-fill" [style.width.%]="statusBarWidth(item)"></div>
                  </div>
                  <strong>{{ item.count }}</strong>
                </div>
              </div>
              <ng-template #noStatuses><p class="empty">Sin pedidos todavía.</p></ng-template>
            </article>
          </div>

          <div class="dashboard-grid three-columns">
            <article class="panel">
              <header>
                <h2>Métodos de pago</h2>
              </header>
              <div class="list" *ngIf="data.operations.paymentMethods.length; else noPayments">
                <div class="list-row" *ngFor="let item of data.operations.paymentMethods">
                  <span>{{ paymentLabel(item.method) }}</span>
                  <strong>{{ item.count }} · {{ item.sales | currency:'EUR' }}</strong>
                </div>
              </div>
              <ng-template #noPayments><p class="empty">Sin datos de pago.</p></ng-template>
            </article>

            <article class="panel">
              <header>
                <h2>Zonas de envío</h2>
              </header>
              <div class="list" *ngIf="data.operations.shippingZones.length; else noZones">
                <div class="list-row" *ngFor="let item of data.operations.shippingZones">
                  <span>{{ item.zone }}</span>
                  <strong>{{ item.count }} · {{ item.sales | currency:'EUR' }}</strong>
                </div>
              </div>
              <ng-template #noZones><p class="empty">Sin zonas registradas.</p></ng-template>
            </article>

            <article class="panel">
              <header>
                <h2>Top productos</h2>
              </header>
              <div class="list" *ngIf="data.topProducts.length; else noProducts">
                <div class="list-row" *ngFor="let item of data.topProducts">
                  <span>{{ item.name }}</span>
                  <strong>{{ item.quantity }} uds · {{ item.sales | currency:'EUR' }}</strong>
                </div>
              </div>
              <ng-template #noProducts><p class="empty">Sin líneas de producto suficientes.</p></ng-template>
            </article>
          </div>

          <article class="panel" *ngIf="data.topCategories.length">
            <header>
              <h2>Top categorías</h2>
              <span>Solo si el pedido conserva categoría</span>
            </header>
            <div class="list compact">
              <div class="list-row" *ngFor="let item of data.topCategories">
                <span>{{ item.category }}</span>
                <strong>{{ item.quantity }} uds · {{ item.sales | currency:'EUR' }}</strong>
              </div>
            </div>
          </article>
        </ng-container>
      </section>
    </ng-template>
  `,
  styles: [
    `.dashboard{display:grid;gap:1rem}`,
    `.login-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem;margin-bottom:.7rem}`,
    `.toolbar{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap}`,
    `.toolbar h1{margin:.15rem 0}`,
    `.actions{display:flex;gap:.55rem;flex-wrap:wrap;align-items:center}`,
    `.eyebrow{margin:0;color:var(--accent-green);font-weight:900;text-transform:uppercase;letter-spacing:.06em;font-size:.78rem}`,
    `.muted{color:var(--text-soft);margin:.15rem 0}`,
    `.loading{padding:.8rem;border:1px solid var(--info-border);background:var(--info-bg);color:var(--info-text);border-radius:12px;margin:0}`,
    `.metric-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.75rem}`,
    `.metric-card,.panel{background:var(--surface-1);border:1px solid var(--border-soft);border-radius:14px;padding:.85rem;color:var(--text-main)}`,
    `.metric-card span,.panel header span{display:block;color:var(--text-soft);font-weight:800;font-size:.78rem}`,
    `.metric-card strong{display:block;margin-top:.25rem;font-size:1.45rem}`,
    `.metric-card.warning{border-color:var(--warning-border);background:color-mix(in srgb, var(--warning-bg) 42%, var(--surface-1))}`,
    `.metric-card.ok{border-color:color-mix(in srgb, var(--ok-text) 35%, var(--border-soft))}`,
    `.metric-card.danger{border-color:color-mix(in srgb, var(--error-text) 35%, var(--border-soft))}`,
    `.dashboard-grid{display:grid;gap:.75rem}`,
    `.two-columns{grid-template-columns:repeat(2,minmax(0,1fr))}`,
    `.three-columns{grid-template-columns:repeat(3,minmax(0,1fr))}`,
    `.panel header{display:flex;justify-content:space-between;gap:.75rem;align-items:flex-start;margin-bottom:.75rem}`,
    `.panel h2{margin:0;font-size:1.05rem}`,
    `.bar-chart,.list{display:grid;gap:.55rem}`,
    `.bar-row{display:grid;grid-template-columns:82px 1fr minmax(68px,auto);gap:.55rem;align-items:center}`,
    `.bar-row span,.list-row span{color:var(--text-soft);font-weight:800;overflow:hidden;text-overflow:ellipsis}`,
    `.bar-track{height:12px;border-radius:999px;background:var(--surface-0);overflow:hidden;border:1px solid var(--border-soft)}`,
    `.bar-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--accent-green),var(--accent-red))}`,
    `.status-fill{background:linear-gradient(90deg,var(--status-confirmed-bg),var(--status-delivered-bg))}`,
    `.bar-row strong{font-size:.86rem;text-align:right}`,
    `.list-row{display:flex;justify-content:space-between;gap:.75rem;padding:.58rem;border-radius:10px;background:var(--surface-0);border:1px solid var(--border-soft)}`,
    `.list-row strong{text-align:right;white-space:nowrap}`,
    `.compact{grid-template-columns:repeat(2,minmax(0,1fr))}`,
    `.empty{margin:0;color:var(--text-soft);border:1px dashed var(--border-soft);border-radius:12px;padding:.8rem;text-align:center}`,
    `.err{color:var(--error-text);white-space:pre-line}`,
    `@media (max-width:1100px){.metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.two-columns,.three-columns{grid-template-columns:1fr}.compact{grid-template-columns:1fr}}`,
    `@media (max-width:700px){.metric-grid,.login-grid{grid-template-columns:1fr}.bar-row{grid-template-columns:1fr}.bar-row strong{text-align:left}.actions .btn,.actions select{width:100%}.toolbar{display:grid}}`
  ]
})
export class AdminDashboardPageComponent {
  email = '';
  password = '';
  days = 14;

  readonly loading = signal(false);
  readonly error = signal('');
  readonly dashboard = signal<AdminDashboardData | null>(null);
  readonly maxSales = computed(() => Math.max(1, ...(this.dashboard()?.charts.salesByDay.map((item) => item.sales) ?? [0])));
  readonly maxStatusCount = computed(() => Math.max(1, ...(this.dashboard()?.charts.ordersByStatus.map((item) => item.count) ?? [0])));

  constructor(
    public readonly auth: AdminAuthService,
    private readonly adminOrders: AdminOrderService,
    private readonly adminDashboard: AdminDashboardService
  ) {
    if (this.auth.isAuthenticated()) {
      void this.loadDashboard();
    }
  }

  async login(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      await this.adminOrders.login(this.email, this.password);
      await this.loadDashboard();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
    } finally {
      this.loading.set(false);
    }
  }

  logout(): void {
    this.auth.logout();
    this.dashboard.set(null);
  }

  async loadDashboard(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      this.dashboard.set(await this.adminDashboard.getDashboard(this.days));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo cargar el dashboard.');
    } finally {
      this.loading.set(false);
    }
  }

  salesBarWidth(item: AdminDashboardSalesDay): number {
    return Math.max(4, Math.round((item.sales / this.maxSales()) * 100));
  }

  statusBarWidth(item: AdminDashboardStatusMetric): number {
    return Math.max(4, Math.round((item.count / this.maxStatusCount()) * 100));
  }

  totalStatusOrders(items: AdminDashboardStatusMetric[]): number {
    return items.reduce((total, item) => total + item.count, 0);
  }

  dayLabel(day: string): string {
    const [, month = '', date = ''] = day.split('-');
    return `${date}/${month}`;
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      nuevo: 'Nuevo',
      confirmado: 'Confirmado',
      preparando: 'Preparando',
      listo: 'Listo',
      enviado: 'Enviado',
      entregado: 'Entregado',
      cancelado: 'Cancelado',
      anulado: 'Anulado',
      sin_estado: 'Sin estado'
    };

    return labels[status] ?? status;
  }

  paymentLabel(method: string): string {
    const labels: Record<string, string> = {
      bizum: 'Bizum',
      bank_transfer: 'Transferencia',
      cash: 'Efectivo',
      sin_metodo: 'Sin método'
    };

    return labels[method] ?? method;
  }
}
