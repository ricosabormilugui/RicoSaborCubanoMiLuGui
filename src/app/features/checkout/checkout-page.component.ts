import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CartService } from '../../core/services/cart.service';
import { CheckoutFormData } from '../../core/models/order.model';
import { OrderService } from '../../core/services/order.service';
import { CustomerAuthService } from '../../core/services/customer-auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { DeliveryStateService } from '../../core/services/delivery-state.service';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="card">
      <h1>Checkout (sin pasarela de pago)</h1>
      <p class="meta">Selecciona fecha y franja de entrega para confirmar tu pedido.</p>
      <p *ngIf="!cart.items().length">No hay productos en el carrito.</p>

      <form [formGroup]="form" (ngSubmit)="submit()" *ngIf="cart.items().length">
        <div class="grid">
          <input formControlName="fullName" placeholder="Nombre completo" />
          <input formControlName="phone" placeholder="Teléfono" />
          <input formControlName="email" placeholder="Email (opcional)" />
          <select formControlName="deliveryType">
            <option value="delivery">Domicilio</option>
            <option value="pickup">Recoger</option>
          </select>
          <input formControlName="deliveryDate" type="date" />
        </div>

        <div class="slots">
          <p><strong>Franja horaria</strong></p>
          <div class="slot-buttons">
            <button
              *ngFor="let slot of slots"
              type="button"
              class="slot-btn"
              [class.active]="form.controls.deliverySlot.value === slot"
              (click)="form.controls.deliverySlot.setValue(slot)">
              {{ slot }}
            </button>
          </div>
        </div>

        <div class="grid">
          <input formControlName="address" placeholder="Dirección" />
          <input formControlName="reference" placeholder="Referencia" />
        </div>
        <textarea formControlName="notes" placeholder="Notas del pedido"></textarea>
        <button class="btn btn-primary" type="submit" [disabled]="form.invalid || loading()">
          {{ loading() ? 'Enviando...' : 'Enviar pedido' }}
        </button>
      </form>

      <div class="app-alert app-alert-success" *ngIf="orderId()">✅ Pedido registrado. Tu número es: <strong>{{ orderId() }}</strong></div>
      <p class="meta" *ngIf="destination()">Destino: {{ destination() }}</p>
      <div class="app-alert app-alert-warn" *ngIf="notificationWarning()">
        Notificaciones: {{ notificationWarning() }}
      </div>
      <div class="app-alert app-alert-info" *ngIf="isLocalDraft()">
        Estás en modo local (<code>ng serve</code>). Este pedido se guardó solo en tu navegador.
        Para enviarlo realmente al backend despliega el frontend y configura el modo <strong><code>api</code></strong> con tu URL de Render.
      </div>
      <div class="app-alert app-alert-error" *ngIf="error()">{{ error() }}</div>
    </section>
  `,
  styles: [
    `.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem}`,
    `.slots{margin:.8rem 0}`,
    `.slot-buttons{display:flex;gap:.6rem;flex-wrap:wrap}`,
    `.slot-btn{background:var(--surface-1);color:var(--text-main);border:1px solid var(--border-soft);border-radius:999px;padding:.45rem .9rem;cursor:pointer}`,
    `.slot-btn.active{background:#14532d;color:#fff;border-color:#14532d}`,
    `textarea{width:100%;margin:.8rem 0;min-height:80px}`,
    `.meta{color:#374151;font-size:.95rem}`,
    `@media (max-width:700px){.grid{grid-template-columns:1fr}}`
  ]
})
export class CheckoutPageComponent {
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly orderId = signal('');
  readonly error = signal('');
  readonly destination = signal('');
  readonly isLocalDraft = signal(false);
  readonly notificationWarning = signal('');
  readonly slots = ['12:00-14:00', '14:00-16:00', '18:00-20:00'];

  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required]],
    phone: ['', [Validators.required]],
    email: [''],
    deliveryType: this.fb.nonNullable.control<'delivery' | 'pickup'>('delivery'),
    deliveryDate: ['', [Validators.required]],
    deliverySlot: ['', [Validators.required]],
    address: [''],
    reference: [''],
    notes: ['']
  });

  constructor(
    public readonly cart: CartService,
    private readonly orderService: OrderService,
    private readonly customerAuth: CustomerAuthService,
    private readonly notifications: NotificationService,
    private readonly deliveryState: DeliveryStateService
  ) {
    const email = this.customerAuth.profile()?.email ?? '';
    this.form.patchValue({
      email,
      deliveryDate: this.deliveryState.date() ?? '',
      deliverySlot: this.deliveryState.slot() ?? '',
      deliveryType: this.deliveryState.type()
    });
  }

  async submit(): Promise<void> {
    if (!this.form.value.deliveryDate || !this.form.value.deliverySlot) {
      this.notifications.warning('Datos incompletos', 'Selecciona fecha y horario');
      return;
    }

    if (this.form.invalid) return;
    this.loading.set(true);
    this.orderId.set('');
    this.error.set('');
    this.destination.set('');
    this.isLocalDraft.set(false);
    this.notificationWarning.set('');

    try {
      const payload = this.orderService.createPayload(this.form.getRawValue() as CheckoutFormData);
      const result = await this.orderService.submitOrder(payload);
      this.orderId.set(result.orderId);
      this.destination.set(result.destination);
      this.isLocalDraft.set(result.channel === 'local');
      this.notificationWarning.set(result.warning ?? '');

      this.notifications.success('Pedido creado', `Tu número es ${result.orderId}.`);
      if (result.warning) {
        this.notifications.warning('Pedido con aviso', result.warning);
      }
      this.cart.clear();

      const accountEmail = this.customerAuth.profile()?.email ?? '';
      this.form.reset({
        deliveryType: 'delivery',
        deliveryDate: '',
        deliverySlot: '',
        email: accountEmail
      });
      this.deliveryState.clear();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible registrar el pedido. Intenta nuevamente.';
      this.error.set(message);
      this.notifications.error('No se pudo enviar el pedido', message);
    } finally {
      this.loading.set(false);
    }
  }
}
