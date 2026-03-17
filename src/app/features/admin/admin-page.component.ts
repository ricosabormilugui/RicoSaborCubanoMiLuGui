import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminOrder, AdminOrderStatus } from '../../core/models/admin-order.model';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { AdminOrderService } from '../../core/services/admin-order.service';

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
          <h1>Panel de pedidos</h1>
          <div class="actions">
            <select [(ngModel)]="statusFilter" (change)="loadOrders()">
              <option value="">Todos</option>
              <option value="nuevo">Nuevo</option>
              <option value="confirmado">Confirmado</option>
              <option value="preparando">Preparando</option>
              <option value="listo">Listo</option>
              <option value="enviado">Enviado</option>
              <option value="entregado">Entregado</option>
              <option value="cancelado">Cancelado</option>
              <option value="anulado">Anulado</option>
            </select>
            <button class="btn" (click)="loadOrders()">Actualizar</button>
            <button class="btn" routerLink="/admin/cocina">Ir a cocina</button>
            <button class="btn" (click)="logout()">Salir</button>
          </div>
        </div>

        <p class="ok" *ngIf="notice()">{{ notice() }}</p>
        <p class="err" *ngIf="error()">{{ error() }}</p>

        <article class="order" *ngFor="let order of orders()">
          <header>
            <h3>{{ order.orderId }} · {{ order.customer?.fullName || 'Cliente' }}</h3>
            <span class="badge" [class]="'badge ' + order.status">{{ order.status }}</span>
          </header>
          <p>
            <strong>Tel:</strong> {{ order.customer?.phone || 'N/A' }} ·
            <strong>Cuenta:</strong> {{ order.accountMode || 'guest' }} ·
            <strong>Total:</strong> {{ (order.total ?? 0) | currency:'EUR' }} ·
            <strong>📱 WhatsApp:</strong> {{ whatsappStatus(order) }}
          </p>
          <ul>
            <li *ngFor="let item of order.items">
              {{ item.quantity }} x {{ item.name }}
              <small *ngIf="item.description"> — {{ item.description }}</small>
            </li>
          </ul>
          <p *ngIf="order.notes"><strong>Notas:</strong> {{ order.notes }}</p>

          <div class="status-tools">
            <select #nextStatus>
              <option value="nuevo">Nuevo</option>
              <option value="confirmado">Confirmado</option>
              <option value="preparando">Preparando</option>
              <option value="listo">Listo</option>
              <option value="enviado">Enviado</option>
              <option value="entregado">Entregado</option>
              <option value="cancelado">Cancelado</option>
              <option value="anulado">Anulado</option>
            </select>
            <input #note placeholder="Nota de estado (opcional)" />
            <input #signature placeholder="Firma (obligatoria si entregado)" />
            <button class="btn btn-primary" (click)="updateStatus(order.orderId, nextStatus.value, note.value, signature.value)">Guardar estado</button>
          </div>
        </article>
      </section>
    </ng-template>
  `,
  styles: [
    `.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem;margin-bottom:.7rem}`,
    `.toolbar{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}`,
    `.actions{display:flex;gap:.6rem;flex-wrap:wrap}`,
    `.order{border:1px solid #e5e7eb;border-radius:12px;padding:.9rem;margin-top:.8rem;background:#fff}`,
    `.order header{display:flex;justify-content:space-between;align-items:center;gap:.6rem}`,
    `.badge{padding:.25rem .6rem;border-radius:999px;color:#fff;font-weight:700;text-transform:capitalize}`,
    `.badge.nuevo{background:#1f4f8f}`,
    `.badge.confirmado{background:#2563eb}`,
    `.badge.preparando{background:#f59e0b}`,
    `.badge.listo{background:#0ea5e9}`,
    `.badge.enviado{background:#2f8a2c}`,
    `.badge.entregado{background:#7c3aed}`,
    `.badge.cancelado{background:#9ca3af}`,
    `.badge.anulado{background:#c71f26}`,
    `.status-tools{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.55rem}`,
    `.err{color:#b42318;white-space:pre-line}`,
    `.ok{color:#0f7a3b;white-space:pre-line}`,
    `@media (max-width:900px){.status-tools{grid-template-columns:1fr}.grid{grid-template-columns:1fr}}`
  ]
})
export class AdminPageComponent {
  email = '';
  password = '';
  statusFilter: '' | AdminOrderStatus = '';

  readonly loading = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly orders = signal<AdminOrder[]>([]);

  readonly orderCount = computed(() => this.orders().length);

  constructor(public readonly auth: AdminAuthService, private readonly adminOrders: AdminOrderService) {
    if (this.auth.isAuthenticated()) {
      void this.loadOrders();
    }
  }

  async login(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      await this.adminOrders.login(this.email, this.password);
      await this.loadOrders();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
    } finally {
      this.loading.set(false);
    }
  }

  logout(): void {
    this.auth.logout();
    this.orders.set([]);
  }

  async loadOrders(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const orders = await this.adminOrders.listOrders(this.statusFilter || undefined);
      this.orders.set(orders);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudieron cargar pedidos.');
    } finally {
      this.loading.set(false);
    }
  }

  async updateStatus(orderId: string, status: string, statusNote: string, deliverySignature: string): Promise<void> {
    this.notice.set('');
    this.error.set('');

    try {
      const result = await this.adminOrders.updateStatus(orderId, status as AdminOrderStatus, statusNote, deliverySignature);
      const { whatsapp } = result.notifications;
      const warningMessage = whatsapp.sent
        ? '✅ Estado actualizado correctamente\n📱 Notificación enviada al cliente'
        : `⚠️ Estado actualizado\n❗ WhatsApp no enviado: ${whatsapp.warning ?? 'motivo no disponible'}`;

      this.notice.set(warningMessage);
      await this.loadOrders();
    } catch (error) {
      this.error.set(`❌ No se pudo actualizar el pedido\n${error instanceof Error ? error.message : 'Error inesperado.'}`);
    }
  }

  whatsappStatus(order: AdminOrder): string {
    const whatsappEvents = (order.notifications ?? []).filter((event) => event.type === 'whatsapp');
    if (!whatsappEvents.length) {
      return '— No enviado';
    }

    const latest = whatsappEvents[whatsappEvents.length - 1];
    return latest.status === 'sent'
      ? '✔ Enviado'
      : `⚠ Fallo${latest.error ? ` (${latest.error})` : ''}`;
  }
}
