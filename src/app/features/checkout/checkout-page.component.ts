import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CartService } from '../../core/services/cart.service';
import { CheckoutFormData } from '../../core/models/order.model';
import { OrderService } from '../../core/services/order.service';
import { CustomerAuthService } from '../../core/services/customer-auth.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="card">
      <h1>Checkout (sin pasarela de pago)</h1>
      <p class="meta">Puedes comprar como invitado o con cuenta. Si te registras después, tus pedidos previos por email se vinculan automáticamente.</p>
      <p *ngIf="!cart.items().length">No hay productos en el carrito.</p>

      <form [formGroup]="form" (ngSubmit)="submit()" *ngIf="cart.items().length">
        <div class="grid">
          <input formControlName="fullName" placeholder="Nombre completo" />
          <input formControlName="phone" placeholder="Teléfono" />
          <input formControlName="email" placeholder="Email (opcional)" />
          <select formControlName="deliveryMode">
            <option value="delivery">Domicilio</option>
            <option value="pickup">Recoger</option>
          </select>
          <input formControlName="address" placeholder="Dirección" />
          <input formControlName="reference" placeholder="Referencia" />
          <input formControlName="preferredTime" placeholder="Horario preferido" />
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
    `textarea{width:100%;margin:.8rem 0;min-height:80px}`,
    `.meta{color:#374151;font-size:.95rem}`,
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

  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required]],
    phone: ['', [Validators.required]],
    email: [''],
    deliveryMode: this.fb.nonNullable.control<'delivery' | 'pickup'>('delivery'),
    address: [''],
    reference: [''],
    preferredTime: [''],
    notes: ['']
  });

  constructor(
    public readonly cart: CartService,
    private readonly orderService: OrderService,
    private readonly customerAuth: CustomerAuthService,
    private readonly notifications: NotificationService
  ) {
    const email = this.customerAuth.profile()?.email ?? '';
    if (email) {
      this.form.patchValue({ email });
    }
  }

  async submit(): Promise<void> {
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
        deliveryMode: 'delivery',
        email: accountEmail
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible registrar el pedido. Intenta nuevamente.';
      this.error.set(message);
      this.notifications.error('No se pudo enviar el pedido', message);
    } finally {
      this.loading.set(false);
    }
  }
}
