import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { NotificationService } from '../../core/services/notification.service';
import { getUserFriendlyError } from '../../core/utils/user-friendly-error';
import { CommonModule } from '@angular/common';
import { Component, computed, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminOrder, AdminOrderStatus } from '../../core/models/admin-order.model';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { AdminOrderService } from '../../core/services/admin-order.service';
import { formatPaymentDeadline } from '../../core/config/shipping.config';

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
            <button class="btn" routerLink="/admin/pagos">Pagos</button>
            <button class="btn" (click)="logout()">Salir</button>
          </div>
        </div>

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
            <ng-container *ngIf="showsPaymentReservation(order)"> · <strong>Pago pendiente</strong> · Reserva hasta: {{ paymentReservationLabel(order) }}</ng-container>
            <ng-container *ngIf="isPaymentExpired(order)"> · Cancelado automáticamente · Motivo: pago no recibido dentro del plazo</ng-container>
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
                  (change)="onPaymentChange(order, $event, paymentNote.value)" />
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
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly notifications = inject(NotificationService);
  email = '';
  password = '';
  statusFilter: '' | AdminOrderStatus = '';

  readonly loading = signal(false);
  readonly error = signal('');
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
    try {
      await this.adminOrders.login(this.email, this.password);
      await this.loadOrders();
    } catch (error) {
      this.error.set(getUserFriendlyError(error, 'No se pudo iniciar sesión.'));
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
      this.error.set(getUserFriendlyError(error, 'No se pudieron cargar pedidos.'));
    } finally {
      this.loading.set(false);
    }
  }

  async updateStatus(orderId: string, status: string, statusNote: string, deliverySignature: string): Promise<void> {
    if (['cancelado', 'anulado'].includes(status) && !await this.confirmDialog.open({
      title: status === 'cancelado' ? 'Cancelar pedido' : 'Anular pedido',
      message: `Se cambiará el estado del pedido ${orderId}. Comprueba los datos antes de continuar.`,
      confirmText: status === 'cancelado' ? 'Cancelar pedido' : 'Anular pedido', variant: 'danger'
    })) return;
    const id = this.notifications.loading('Actualizando pedido…', orderId, { key: 'order-status:' + orderId });
    try {
      const result = await this.adminOrders.updateStatus(orderId, status as AdminOrderStatus, statusNote, deliverySignature);
      if (result.notifications.email.sent) {
        this.notifications.updateSuccess(id, 'Pedido actualizado', 'Se ha enviado la notificación por email.');
      } else {
        this.notifications.warning('Pedido actualizado sin aviso por email', getUserFriendlyError(result.notifications.email.warning, 'No se pudo enviar el correo.'), { id });
      }
      await this.loadOrders();
    } catch (error) {
      this.notifications.updateError(id, 'No se pudo actualizar el pedido', getUserFriendlyError(error));
    }
  }

  isPaid(order: AdminOrder): boolean {
    return (order.payment?.status ?? order.paymentStatus) === 'paid';
  }

  onPaymentChange(order: AdminOrder, event: Event, note: string): void {
    const input = event.target as HTMLInputElement;
    const checked = input.checked;
    // Keep the actual payment state visible while the confirmation/API is pending.
    input.checked = this.isPaid(order);
    void this.togglePayment(order, checked, note);
  }

  async togglePayment(order: AdminOrder, checked: boolean, note: string): Promise<void> {
    if (!checked && this.isPaid(order) && !await this.confirmDialog.open({
      title: 'Marcar como pendiente de pago', message: 'Vas a retirar la confirmación de pago de este pedido. ¿Deseas continuar?',
      confirmText: 'Marcar pendiente', variant: 'danger'
    })) return;
    const id = this.notifications.loading('Actualizando pago…', order.orderId, { key: 'order-payment:' + order.orderId });
    try {
      const nextStatus = checked ? 'paid' : 'pending';
      const result = await this.adminOrders.updatePayment(order.orderId, nextStatus, note, checked);
      if (checked && !result.notifications.email.sent) {
        this.notifications.warning('Pago confirmado sin aviso por email', getUserFriendlyError(result.notifications.email.warning, 'No se pudo enviar el correo.'), { id });
      } else {
        this.notifications.updateSuccess(id, checked ? 'Pago confirmado' : 'Pedido pendiente de pago');
      }
      await this.loadOrders();
    } catch (error) {
      this.notifications.updateError(id, 'No se pudo actualizar el pago', getUserFriendlyError(error));
    }
  }

  async deleteOrder(orderId: string): Promise<void> {
    if (!await this.confirmDialog.open({ title: 'Eliminar pedido', message: `Se eliminará el pedido ${orderId}. Esta acción no se puede deshacer.`, confirmText: 'Eliminar', variant: 'danger' })) return;
    const id = this.notifications.loading('Eliminando pedido…', orderId, { key: 'order-delete:' + orderId });
    try {
      await this.adminOrders.deleteOrder(orderId);
      this.orders.set(this.orders().filter((order) => order.orderId !== orderId));
      this.notifications.updateSuccess(id, 'Pedido eliminado');
    } catch (error) {
      this.notifications.updateError(id, 'No se pudo eliminar el pedido', getUserFriendlyError(error));
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

  showsPaymentReservation(order: AdminOrder): boolean {
    const status = order.payment?.status ?? order.paymentStatus;
    const method = order.payment?.method ?? order.paymentMethod;
    return Boolean(order.paymentExpiresAt) && status === 'pending' && method !== 'cash';
  }

  paymentReservationLabel(order: AdminOrder): string {
    return formatPaymentDeadline(order.paymentExpiresAt ?? '');
  }

  isPaymentExpired(order: AdminOrder): boolean {
    return order.cancellationReason === 'payment_expired' || (order.status === 'cancelado' && Boolean(order.paymentExpiredAt));
  }

}
