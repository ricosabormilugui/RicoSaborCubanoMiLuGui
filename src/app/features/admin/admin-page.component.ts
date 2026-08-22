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
      <button class="btn btn-primary" (click)="login()" [disabled]="loading()">{{ loading() ? 'Iniciando sesión...' : 'Iniciar sesión' }}</button>
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
            <button class="btn" routerLink="/admin/dashboard">Dashboard</button>
            <button class="btn" routerLink="/admin/cocina">Ir a cocina</button>
            <button class="btn" routerLink="/admin/contactos">Contactos</button>
            <button class="btn" routerLink="/admin/clientes">Clientes</button>
            <button class="btn" routerLink="/admin/productos">Productos</button>
            <button class="btn" routerLink="/admin/portada">Portada</button>
            <button class="btn" (click)="logout()">Salir</button>
          </div>
        </div>

        <p class="ok" *ngIf="notice()">{{ notice() }}</p>
        <p class="err" *ngIf="error()">{{ error() }}</p>

        <article class="order" *ngFor="let order of orders()">
          <header>
            <h3>{{ order.orderId }} · {{ order.customer?.fullName || 'Cliente' }}</h3>
            <div class="header-actions">
              <span class="badge" [class]="'badge ' + order.status">{{ order.status }}</span>
              <button class="icon-delete" title="Eliminar pedido" aria-label="Eliminar pedido" (click)="deleteOrder(order.orderId)">🗑</button>
            </div>
          </header>
          <p>
            <strong>Tel:</strong> {{ order.customer?.phone || 'N/A' }} ·
            <strong>Cuenta:</strong> {{ order.accountMode || 'guest' }} ·
            <strong>Envío:</strong> {{ shippingLabel(order) }} ·
            <strong>Subtotal:</strong> {{ (order.subtotal ?? 0) | currency:'EUR' }} ·
            <strong *ngIf="(order.discountAmount ?? 0) > 0">Cupón {{ order.couponCode }}: -{{ (order.discountAmount ?? 0) | currency:'EUR' }} ·</strong>
            <strong>Total:</strong> {{ (order.total ?? 0) | currency:'EUR' }} ·
            <strong>📅:</strong> {{ order.deliveryDate ? (order.deliveryDate | date:'dd/MM') : 'N/A' }} ·
            <strong>🕒:</strong> {{ order.deliverySlot || 'N/A' }} ·
            <strong>Pago:</strong> {{ paymentLabel(order) }} · {{ paymentStatusLabel(order) }} · <strong>{{ order.requiresAdvancePayment ? 'Pago anticipado requerido' : 'Efectivo permitido' }}</strong>
          </p>
          <ul>
            <li *ngFor="let item of order.items">
              {{ item.quantity }} x {{ item.name }}
              <small *ngIf="item.description"> — {{ item.description }}</small>
              <ul *ngIf="item.customization?.length">
                <li *ngFor="let option of item.customization">{{ option.label }}: {{ option.value }}<span *ngIf="option.priceModifier"> (+{{ option.priceModifier | currency:'EUR' }})</span></li>
              </ul>
            </li>
          </ul>
          <p *ngIf="order.notes"><strong>Notas:</strong> {{ order.notes }}</p>

          <div class="payment-tools">
            <div class="payment-main">
              <label class="payment-check">
                <input
                  type="checkbox"
                  [checked]="isPaid(order)"
                  (change)="togglePayment(order, $any($event.target).checked, paymentNote.value)" />
                <span>Pago confirmado</span>
              </label>
              <small class="payment-hint">{{ isPaid(order) ? 'Pagado' : 'Pendiente de pago' }} · Método: {{ paymentLabel(order) }}</small>
            </div>
            <input #paymentNote placeholder="Nota de pago (opcional)" />
          </div>

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
    `.order{border:1px solid var(--border-soft);border-radius:12px;padding:.9rem;margin-top:.8rem;background:var(--surface-1);color:var(--text-main)}`,
    `.order header{display:flex;justify-content:space-between;align-items:center;gap:.6rem}`,
    `.header-actions{display:flex;align-items:center;gap:.5rem}`,
    `.badge{padding:.25rem .6rem;border-radius:999px;color:var(--on-accent);font-weight:700;text-transform:capitalize}`,
    `.badge.nuevo{background:var(--status-new-bg)}`,
    `.badge.confirmado{background:var(--status-confirmed-bg)}`,
    `.badge.preparando{background:var(--status-preparing-bg)}`,
    `.badge.listo{background:var(--status-ready-bg)}`,
    `.badge.enviado{background:var(--status-sent-bg)}`,
    `.badge.entregado{background:var(--status-delivered-bg)}`,
    `.badge.cancelado{background:var(--status-cancelled-bg)}`,
    `.badge.anulado{background:var(--status-void-bg)}`,
    `.status-tools{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.55rem}`,
    `.payment-tools{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,320px);gap:.55rem;margin:.6rem 0;padding:.6rem;border:1px solid var(--border-soft);border-radius:10px;background:var(--surface-0)}`,
    `.payment-main{display:grid;gap:.2rem}`,
    `.payment-check{display:flex;align-items:center;gap:.45rem;font-weight:700}`,
    `.payment-hint{color:var(--text-soft)}`,
    `.icon-delete{border:1px solid color-mix(in srgb,var(--error-text) 45%,var(--border-soft));background:transparent;color:var(--error-text);border-radius:8px;width:32px;height:32px;cursor:pointer;line-height:1}`,
    `.order p,.order li,.order h3,.order small,.order strong{color:inherit}`,
    `.err{color:var(--error-text);white-space:pre-line}`,
    `.ok{color:var(--ok-text);white-space:pre-line}`,
    `@media (max-width:900px){.status-tools{grid-template-columns:1fr}.payment-tools{grid-template-columns:1fr}.grid{grid-template-columns:1fr}}`
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
      const { email } = result.notifications;
      const message = email.sent
        ? '✅ Estado actualizado correctamente\n📧 Notificación enviada por email'
        : `⚠️ Estado actualizado\n❗ Email no enviado: ${email.warning ?? 'motivo no disponible'}`;

      this.notice.set(message);
      await this.loadOrders();
    } catch (error) {
      this.error.set(`❌ No se pudo actualizar el pedido\n${error instanceof Error ? error.message : 'Error inesperado.'}`);
    }
  }

  isPaid(order: AdminOrder): boolean {
    return (order.payment?.status ?? order.paymentStatus) === 'paid';
  }

  async togglePayment(order: AdminOrder, checked: boolean, note: string): Promise<void> {
    this.notice.set('');
    this.error.set('');
    if (!checked && this.isPaid(order)) {
      const confirmed = globalThis.confirm('Vas a marcar este pedido como pendiente de pago. ¿Continuar?');
      if (!confirmed) return;
    }
    try {
      const nextStatus = checked ? 'paid' : 'pending';
      const result = await this.adminOrders.updatePayment(order.orderId, nextStatus, note, checked);
      this.notice.set(
        checked
          ? (result.notifications.email.sent ? '✅ Pago confirmado y email enviado.' : `⚠️ Pago confirmado. Email no enviado: ${result.notifications.email.warning ?? 'sin detalle'}`)
          : '✅ Pedido marcado nuevamente como pendiente de pago.'
      );
      await this.loadOrders();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo actualizar el pago.');
    }
  }

  async deleteOrder(orderId: string): Promise<void> {
    if (!globalThis.confirm('¿Seguro que deseas eliminar este pedido? Esta acción no se puede deshacer.')) return;
    this.notice.set('');
    this.error.set('');
    try {
      await this.adminOrders.deleteOrder(orderId);
      this.orders.set(this.orders().filter((order) => order.orderId !== orderId));
      this.notice.set('✅ Pedido eliminado correctamente.');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo eliminar el pedido.');
    }
  }

  shippingLabel(order: AdminOrder): string {
    if (order.deliveryType === 'pickup') return 'Recogida · 0,00 €';
    const zone = order.shipping?.zoneName ? `${order.shipping.zoneName} · ` : '';
    const cost = order.shipping?.cost ?? order.shippingCost ?? 0;
    return `${zone}${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cost)}`;
  }

  paymentLabel(order: AdminOrder): string {
    const method = order.payment?.method ?? order.paymentMethod;

    if (method === 'bank_transfer') return 'Transferencia bancaria';
    if (method === 'cash') return 'Efectivo / Cash';
    return 'Bizum';
  }

  paymentStatusLabel(order: AdminOrder): string {
    const status = order.payment?.status ?? order.paymentStatus;

    if (status === 'paid') return 'pagado';
    if (status === 'failed') return 'fallido';
    if (status === 'cancelled') return 'cancelado';
    return 'pendiente de pago';
  }

}
