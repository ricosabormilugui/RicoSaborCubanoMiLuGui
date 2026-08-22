import { CommonModule } from '@angular/common';
import { Component, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminOrder } from '../../core/models/admin-order.model';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { AdminOrderService } from '../../core/services/admin-order.service';

type KitchenLane = 'nuevos' | 'preparando' | 'listos';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="card" *ngIf="!auth.isAuthenticated(); else kitchenPanel">
      <h1>Panel cocina · acceso administrador</h1>
      <div class="grid two">
        <input [(ngModel)]="email" placeholder="Email admin" />
        <input [(ngModel)]="password" type="password" placeholder="Contraseña" />
      </div>
      <button class="btn btn-primary" (click)="loginAndStart()" [disabled]="loading()">
        {{ loading() ? 'Iniciando sesión...' : 'Iniciar sesión en cocina' }}
      </button>
      <p class="err" *ngIf="error()">{{ error() }}</p>
    </section>

    <ng-template #kitchenPanel>
      <section class="card">
        <div class="toolbar">
          <div>
            <h1>🔴 Panel cocina (tiempo real)</h1>
            <p class="meta">Actualización automática cada {{ refreshSeconds }}s · Última carga: {{ lastUpdated() || '—' }}</p>
          </div>

          <div class="actions">
            <button class="btn" (click)="loadKitchenOrders()">Actualizar ahora</button>
            <button class="btn" routerLink="/admin/dashboard">Dashboard</button>
            <button class="btn" routerLink="/admin/pedidos">Ir a pedidos</button>
            <button class="btn" routerLink="/admin/contactos">Contactos</button>
            <button class="btn" routerLink="/admin/productos">Productos</button>
            <button class="btn" routerLink="/admin/portada">Portada</button>
            <button class="btn" (click)="logout()">Salir</button>
          </div>
        </div>

        <p class="err" *ngIf="error()">{{ error() }}</p>

        <div class="lanes">
          <section class="lane">
            <header>
              <h2>🆕 Nuevos</h2>
              <span>{{ getLaneOrders('nuevos').length }}</span>
            </header>
            <article class="ticket" *ngFor="let order of getLaneOrders('nuevos')">
              <h3>{{ order.orderId }}</h3>
              <p><strong>{{ order.customer?.fullName || 'Cliente' }}</strong> · {{ order.customer?.phone || 'N/A' }}</p>
              <p>💰 {{ (order.total ?? 0) | currency:'EUR' }}</p>
              <ul>
                <li *ngFor="let item of order.items">{{ item.quantity }} x {{ item.name }}<small *ngFor="let option of item.customization"> · {{ option.label }}: {{ option.value }}</small></li>
              </ul>
            </article>
          </section>

          <section class="lane warning">
            <header>
              <h2>👨‍🍳 Preparando</h2>
              <span>{{ getLaneOrders('preparando').length }}</span>
            </header>
            <article class="ticket" *ngFor="let order of getLaneOrders('preparando')">
              <h3>{{ order.orderId }}</h3>
              <p><strong>{{ order.customer?.fullName || 'Cliente' }}</strong> · {{ order.customer?.phone || 'N/A' }}</p>
              <p>💰 {{ (order.total ?? 0) | currency:'EUR' }}</p>
              <ul>
                <li *ngFor="let item of order.items">{{ item.quantity }} x {{ item.name }}<small *ngFor="let option of item.customization"> · {{ option.label }}: {{ option.value }}</small></li>
              </ul>
            </article>
          </section>

          <section class="lane ok">
            <header>
              <h2>📦 Listos</h2>
              <span>{{ getLaneOrders('listos').length }}</span>
            </header>
            <article class="ticket" *ngFor="let order of getLaneOrders('listos')">
              <h3>{{ order.orderId }}</h3>
              <p><strong>{{ order.customer?.fullName || 'Cliente' }}</strong> · {{ order.customer?.phone || 'N/A' }}</p>
              <p>💰 {{ (order.total ?? 0) | currency:'EUR' }}</p>
              <ul>
                <li *ngFor="let item of order.items">{{ item.quantity }} x {{ item.name }}<small *ngFor="let option of item.customization"> · {{ option.label }}: {{ option.value }}</small></li>
              </ul>
            </article>
          </section>
        </div>
      </section>
    </ng-template>
  `,
  styles: [
    `.grid{display:grid;gap:.7rem;margin-bottom:.7rem}`,
    `.grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}`,
    `.toolbar{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;margin-bottom:.9rem}`,
    `.actions{display:flex;gap:.6rem;flex-wrap:wrap}`,
    `.meta{margin:.25rem 0 0;color:var(--text-soft)}`,
    `.lanes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.8rem}`,
    `.lane{background:var(--surface-1);border:1px solid var(--border-soft);border-radius:12px;padding:.7rem;color:var(--text-main)}`,
    `.lane header{display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem}`,
    `.lane header h2{margin:0;font-size:1rem}`,
    `.lane header span{background:var(--surface-2);color:var(--text-main);border-radius:999px;padding:.15rem .45rem;font-size:.82rem;border:1px solid var(--border-soft)}`,
    `.lane.warning{background:color-mix(in srgb, var(--accent-red) 14%, var(--surface-1));border-color:color-mix(in srgb, var(--accent-red) 35%, var(--border-soft))}`,
    `.lane.ok{background:color-mix(in srgb, var(--accent-green) 16%, var(--surface-1));border-color:color-mix(in srgb, var(--accent-green) 36%, var(--border-soft))}`,
    `.ticket{background:var(--surface-0);border:1px solid var(--border-soft);border-radius:10px;padding:.65rem;margin-bottom:.55rem}`,
    `.ticket h3{margin:.1rem 0 .4rem;font-size:.95rem}`,
    `.ticket p{margin:.2rem 0;color:var(--text-main)}`,
    `.ticket ul{margin:.35rem 0 0;padding-left:1rem}`,
    `.ticket li{font-size:.9rem;color:var(--text-main)}`,
    `.err{color:var(--error-text)}`,
    `@media (max-width:1000px){.lanes{grid-template-columns:1fr}}`,
    `@media (max-width:700px){.grid.two{grid-template-columns:1fr}}`
  ]
})
export class AdminKitchenPageComponent implements OnDestroy {
  email = '';
  password = '';

  readonly loading = signal(false);
  readonly error = signal('');
  readonly orders = signal<AdminOrder[]>([]);
  readonly lastUpdated = signal('');

  readonly refreshSeconds = 8;
  private refreshHandle: number | null = null;



  getLaneOrders(lane: KitchenLane): AdminOrder[] {
    const all = this.orders();
    if (lane === 'nuevos') {
      return all.filter((order) => order.status === 'nuevo' || order.status === 'confirmado');
    }

    if (lane === 'preparando') {
      return all.filter((order) => order.status === 'preparando');
    }

    return all.filter((order) => order.status === 'listo');
  }

  constructor(public readonly auth: AdminAuthService, private readonly adminOrders: AdminOrderService) {
    if (this.auth.isAuthenticated()) {
      this.startRealtimeRefresh();
    }
  }

  ngOnDestroy(): void {
    this.stopRealtimeRefresh();
  }

  async loginAndStart(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      await this.adminOrders.login(this.email, this.password);
      this.startRealtimeRefresh();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo iniciar sesión de cocina.');
    } finally {
      this.loading.set(false);
    }
  }

  logout(): void {
    this.stopRealtimeRefresh();
    this.auth.logout();
    this.orders.set([]);
  }

  async loadKitchenOrders(): Promise<void> {
    try {
      const orders = await this.adminOrders.listOrders();
      this.orders.set(orders);
      this.lastUpdated.set(new Date().toLocaleTimeString());
      this.error.set('');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo actualizar panel cocina.');
    }
  }

  private startRealtimeRefresh(): void {
    void this.loadKitchenOrders();
    this.stopRealtimeRefresh();
    this.refreshHandle = window.setInterval(() => {
      void this.loadKitchenOrders();
    }, this.refreshSeconds * 1000);
  }

  private stopRealtimeRefresh(): void {
    if (this.refreshHandle !== null) {
      window.clearInterval(this.refreshHandle);
      this.refreshHandle = null;
    }
  }
}
