import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { CheckoutFormData, PaymentMethod } from '../../core/models/order.model';
import { getPaymentInstructions, getPaymentMethodLabel, OrderService } from '../../core/services/order.service';
import { CustomerAuthService } from '../../core/services/customer-auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { DeliveryStateService } from '../../core/services/delivery-state.service';
import { MANUAL_PAYMENT_DETAILS } from '../../core/config/payment.config';
import { ShippingQuote, calculateShippingQuote, normalizePostalCode } from '../../core/config/shipping.config';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="checkout-shell">
      <header class="checkout-hero card">
        <div>
          <p class="eyebrow">Pedido manual</p>
          <h1>Finaliza tu pedido</h1>
          <p class="meta">Recibiremos tu pedido como <strong>pendiente de pago</strong>. Lo confirmaremos definitivamente cuando validemos el pago.</p>
        </div>
        <div class="status-pill">Sin pasarela online</div>
      </header>

      <div class="empty-cart card" *ngIf="!cart.items().length; else checkoutContent">
        <h2>Tu carrito está vacío</h2>
        <p class="meta">Añade productos al carrito para poder continuar con el pedido.</p>
      </div>

      <ng-template #checkoutContent>
        <div class="checkout-layout">
          <form class="checkout-form card" [formGroup]="form" (ngSubmit)="submit()">
            <section class="form-section">
              <div class="section-head">
                <span>1</span>
                <div>
                  <h2>Datos de contacto</h2>
                  <p>Te contactaremos para validar el pago y coordinar la entrega.</p>
                </div>
              </div>

              <div class="grid">
                <label>
                  Nombre completo
                  <input formControlName="fullName" autocomplete="name" placeholder="Tu nombre y apellidos" />
                  <small class="field-error" *ngIf="isInvalid('fullName')">El nombre es obligatorio.</small>
                </label>

                <label>
                  Email
                  <input formControlName="email" type="email" autocomplete="email" placeholder="tu@email.com (opcional)" />
                  <small class="field-error" *ngIf="isInvalid('email')">Introduce un email válido o déjalo vacío.</small>
                </label>
              </div>

              <label>
                Teléfono
                <div class="phone-input">
                  <select formControlName="phoneCountryCode" aria-label="Prefijo telefónico">
                    <option value="34">🇪🇸 +34</option>
                    <option value="1">🇺🇸 +1</option>
                    <option value="52">🇲🇽 +52</option>
                  </select>
                  <input
                    formControlName="phoneNumber"
                    type="tel"
                    inputmode="numeric"
                    autocomplete="tel-national"
                    placeholder="644423790"
                    (input)="sanitizePhoneDigits()" />
                </div>
                <small class="field-error" *ngIf="isInvalid('phoneNumber')">Escribe solo dígitos: entre 7 y 12 números.</small>
              </label>
            </section>

            <section class="form-section">
              <div class="section-head">
                <span>2</span>
                <div>
                  <h2>Entrega</h2>
                  <p>Elige cómo y cuándo quieres recibir tu pedido.</p>
                </div>
              </div>

              <div class="grid">
                <label>
                  Tipo de entrega
                  <select formControlName="deliveryType">
                    <option value="delivery">Domicilio</option>
                    <option value="pickup">Recoger</option>
                  </select>
                </label>
                <label>
                  Fecha
                  <input formControlName="deliveryDate" type="date" />
                  <small class="field-error" *ngIf="isInvalid('deliveryDate')">Selecciona una fecha.</small>
                </label>
              </div>

              <div class="slots">
                <p><strong>Franja horaria</strong></p>
                <div class="slot-buttons">
                  <button
                    *ngFor="let slot of slots"
                    type="button"
                    class="slot-btn"
                    [class.active]="form.controls.deliverySlot.value === slot"
                    (click)="form.controls.deliverySlot.setValue(slot); form.controls.deliverySlot.markAsTouched()">
                    {{ slot }}
                  </button>
                </div>
                <small class="field-error" *ngIf="isInvalid('deliverySlot')">Selecciona una franja horaria.</small>
              </div>

              <div class="grid">
                <label>
                  Dirección
                  <input formControlName="address" autocomplete="street-address" placeholder="Calle, número, piso" />
                  <small class="field-error" *ngIf="isInvalid('address')">La dirección es obligatoria para entrega a domicilio.</small>
                </label>
                <label>
                  Código postal
                  <input formControlName="postalCode" inputmode="numeric" autocomplete="postal-code" placeholder="29001" (input)="sanitizePostalCode()" />
                  <small class="field-error" *ngIf="isInvalid('postalCode')">Introduce un código postal válido.</small>
                </label>
              </div>

              <div class="shipping-quote" [class.blocked]="!shippingQuote().available">
                <strong>Zona y coste de envío</strong>
                <p>{{ shippingQuote().message }}</p>
              </div>

              <div class="grid">
                <label>
                  Referencia
                  <input formControlName="reference" placeholder="Portal, timbre, indicaciones" />
                </label>
              </div>

              <label>
                Notas del pedido
                <textarea formControlName="notes" placeholder="Alergias, preferencias, instrucciones de entrega..."></textarea>
              </label>

              <label class="consent-check">
                <input type="checkbox" formControlName="marketingConsent" />
                <span>Acepto recibir promociones y activar el cupón inicial para validación manual según la <a routerLink="/legal/privacidad">política de privacidad</a>.</span>
              </label>

              <label class="consent-check">
                <input type="checkbox" formControlName="legalConsent" />
                <span>He leído y acepto las <a routerLink="/legal/condiciones-compra">condiciones de compra</a>, la <a routerLink="/legal/privacidad">política de privacidad</a>, la <a routerLink="/legal/envios">política de envíos</a> y la <a routerLink="/legal/devoluciones-cancelaciones">política de devoluciones/cancelaciones</a>.</span>
              </label>
              <small class="field-error" *ngIf="isInvalid('legalConsent')">Debes aceptar las condiciones legales para crear el pedido.</small>
            </section>

            <section class="form-section">
              <div class="section-head">
                <span>3</span>
                <div>
                  <h2>Pago manual</h2>
                  <p>El pedido queda pendiente hasta validar el pago.</p>
                </div>
              </div>

              <div class="payment-options" role="radiogroup" aria-label="Método de pago">
                <label class="payment-card" *ngFor="let method of paymentMethods" [class.active]="form.controls.paymentMethod.value === method.value">
                  <input type="radio" formControlName="paymentMethod" [value]="method.value" />
                  <span>
                    <strong>{{ method.label }}</strong>
                    <small>{{ method.description }}</small>
                  </span>
                </label>
              </div>

              <div class="payment-instructions">
                <strong>Instrucciones</strong>
                <p>{{ selectedPaymentInstructions(orderId()) }}</p>
              </div>
            </section>

            <div class="form-actions">
              <div class="pending-note">Estado inicial: <strong>pendiente de pago</strong></div>
              <button class="btn btn-primary submit-btn" type="submit" [disabled]="form.invalid || loading() || !cart.items().length || !canSubmitOrder()" [attr.aria-busy]="loading()">
                <span class="spinner" *ngIf="loading()" aria-hidden="true"></span>
                {{ loading() ? 'Creando pedido...' : 'Confirmar pedido pendiente de pago' }}
              </button>
            </div>
          </form>

          <aside class="summary-card card">
            <h2>Resumen</h2>
            <div class="summary-items">
              <div class="summary-item" *ngFor="let item of cart.items()">
                <div>
                  <strong>{{ item.name }}</strong>
                  <span>{{ item.quantity }} × {{ item.unitPrice | currency:'EUR' }}</span>
                </div>
                <strong>{{ item.unitPrice * item.quantity | currency:'EUR' }}</strong>
              </div>
            </div>
            <div class="coupon-box">
              <label>
                Cupón descuento
                <div class="coupon-row">
                  <input [value]="form.controls.couponCode.value" placeholder="Cupon" (input)="setCouponCode($event)" />
                  <button class="btn btn-secondary" type="button" (click)="applyCouponPreview()">Aplicar</button>
                </div>
              </label>
              <small class="coupon-ok" *ngIf="couponPreviewValid()">Cupón preaplicado. El backend validará que sea tu primer pedido.</small>
              <small class="field-error" *ngIf="couponPreviewMessage()">{{ couponPreviewMessage() }}</small>
            </div>
            <div class="summary-line">
              <span>Subtotal</span>
              <strong>{{ cart.subtotal() | currency:'EUR' }}</strong>
            </div>
            <div class="summary-line discount" *ngIf="couponDiscountPreview() > 0">
              <span>Descuento Cupon</span>
              <strong>-{{ couponDiscountPreview() | currency:'EUR' }}</strong>
            </div>
            <div class="summary-line">
              <span>Envío</span>
              <strong>{{ shippingQuote().cost | currency:'EUR' }}</strong>
            </div>
            <div class="summary-total">
              <span>Total</span>
              <strong>{{ orderTotal() | currency:'EUR' }}</strong>
            </div>
            <div class="payment-summary">
              <span>Método</span>
              <strong>{{ selectedPaymentLabel() }}</strong>
              <small>Se validará manualmente antes de confirmar definitivamente.</small>
            </div>
          </aside>
        </div>
      </ng-template>

      <div class="app-alert app-alert-success" *ngIf="orderId()">
        ✅ Pedido recibido como <strong>pendiente de pago</strong>. Número: <strong>{{ orderId() }}</strong>
        <p>{{ selectedPaymentInstructions(orderId()) }}</p>
      </div>
      <p class="meta" *ngIf="destination()">Destino: {{ destination() }}</p>
      <div class="app-alert app-alert-warn" *ngIf="notificationWarning()">{{ notificationWarning() }}</div>
      <div class="app-alert app-alert-info" *ngIf="isLocalDraft()">
        Estás en modo local (<code>ng serve</code>). Este pedido se guardó solo en tu navegador.
        Para enviarlo realmente al backend despliega el frontend y configura el modo <strong><code>api</code></strong> con tu URL de Render.
      </div>
      <div class="app-alert app-alert-error" *ngIf="error()">{{ error() }}</div>
    </section>
  `,
  styles: [
    `.checkout-shell{display:grid;gap:clamp(.75rem,3vw,1rem);width:100%;max-width:100%;min-width:0;overflow-x:clip;padding:0 0 2rem}`,
    `.checkout-hero{display:grid;gap:.8rem;align-items:flex-start;min-width:0;max-width:100%;padding:clamp(.9rem,3vw,1rem);background:linear-gradient(135deg,color-mix(in srgb,var(--surface-1) 36%,var(--surface-0) 64%),var(--surface-0))}`,
    `.eyebrow{margin:0;color:var(--accent-green);font-weight:800;text-transform:uppercase;font-size:.8rem;letter-spacing:.04em}`,
    `h1,h2{margin:.1rem 0 .35rem;line-height:1.1;overflow-wrap:anywhere}`,
    `.meta,.section-head p,.payment-card small,.payment-summary small{color:var(--text-soft);overflow-wrap:anywhere}`,
    `.status-pill,.pending-note{width:max-content;max-width:100%;border:1px solid var(--border-soft);background:var(--surface-1);border-radius:999px;padding:.35rem .7rem;color:var(--text-soft);font-weight:800;white-space:normal;overflow-wrap:anywhere}`,
    `.checkout-layout{display:grid;grid-template-columns:minmax(0,1fr);gap:clamp(.75rem,3vw,1rem);align-items:start;min-width:0}`,
    `.checkout-form{display:grid;gap:clamp(.75rem,3vw,1rem);min-width:0;max-width:100%;padding:clamp(.85rem,3vw,1rem)}`,
    `.form-section{display:grid;gap:.75rem;min-width:0;max-width:100%;border:1px solid color-mix(in srgb,var(--border-soft) 78%,transparent);border-radius:16px;padding:clamp(.78rem,3vw,1rem);background:color-mix(in srgb,var(--surface-0) 84%,var(--surface-1) 16%)}`,
    `.section-head{display:flex;gap:.65rem;align-items:flex-start;min-width:0}`,
    `.section-head div{min-width:0}`,
    `.section-head span{display:grid;place-items:center;flex:0 0 30px;height:30px;border-radius:50%;background:var(--accent-red);color:var(--on-accent);font-weight:900}`,
    `.section-head p{margin:0;font-size:.92rem;line-height:1.45}`,
    `.grid{display:grid;grid-template-columns:minmax(0,1fr);gap:.7rem;min-width:0}`,
    `label{display:grid;gap:.35rem;min-width:0;max-width:100%;color:var(--text-main);font-weight:800;overflow-wrap:anywhere}`,
    `input,select,textarea{width:100%;min-width:0;max-width:100%}`,
    `.phone-input{display:grid;grid-template-columns:minmax(0,1fr);gap:.5rem;min-width:0}`,
    `.slots{display:grid;gap:.45rem;min-width:0}`,
    `.slots p{margin:0;color:var(--text-main)}`,
    `.slot-buttons{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,9rem),1fr));gap:.5rem;min-width:0}`,
    `.slot-btn{min-width:0;background:var(--surface-1);color:var(--text-main);border:1px solid var(--border-soft);border-radius:999px;padding:.5rem .72rem;cursor:pointer;min-height:40px;white-space:normal;line-height:1.15}`,
    `.slot-btn.active{background:var(--ok-active-bg);color:var(--ok-active-text);border-color:var(--ok-active-bg)}`,
    `.slot-btn:hover,.slot-btn:focus-visible,.payment-card:hover,.payment-card:focus-within{outline:2px solid color-mix(in srgb,var(--accent-green) 42%,transparent);outline-offset:2px}`,
    `textarea{min-height:96px;resize:vertical}`,
    `.field-error{color:var(--error-text);font-weight:700;line-height:1.35;overflow-wrap:anywhere}`,
    `.consent-check{display:flex;align-items:flex-start;gap:.55rem;min-width:0;font-weight:700;color:var(--text-soft)}`,
    `.consent-check input{flex:0 0 18px;margin-top:.2rem;width:18px;height:18px}`,
    `.consent-check span{min-width:0;line-height:1.45;overflow-wrap:anywhere}`,
    `.consent-check a{color:var(--accent-green);font-weight:900}`,
    `.payment-options{display:grid;grid-template-columns:minmax(0,1fr);gap:.65rem;min-width:0}`,
    `.payment-card{display:flex;gap:.6rem;align-items:flex-start;min-width:0;border:1px solid var(--border-soft);border-radius:14px;padding:.75rem;background:var(--surface-1);cursor:pointer}`,
    `.payment-card.active{border-color:var(--accent-green);background:color-mix(in srgb,var(--accent-green) 14%,var(--surface-1))}`,
    `.payment-card input{flex:0 0 18px;width:18px;height:18px;margin-top:.15rem}`,
    `.payment-card span{display:grid;gap:.2rem;min-width:0;overflow-wrap:anywhere}`,
    `.shipping-quote{min-width:0;border-left:4px solid var(--accent-green);background:var(--surface-1);border-radius:12px;padding:.78rem;color:var(--text-main)}`,
    `.shipping-quote.blocked{border-left-color:var(--error-text)}`,
    `.shipping-quote p{margin:.25rem 0 0;color:var(--text-soft);line-height:1.45;overflow-wrap:anywhere}`,
    `.payment-instructions{min-width:0;border-left:4px solid var(--accent-green);background:var(--surface-1);border-radius:12px;padding:.78rem;color:var(--text-main)}`,
    `.payment-instructions p{margin:.3rem 0 0;color:var(--text-soft);line-height:1.45;overflow-wrap:anywhere}`,
    `.form-actions{display:grid;grid-template-columns:minmax(0,1fr);gap:.7rem;align-items:center;min-width:0}`,
    `.submit-btn{width:100%;max-width:100%;min-height:46px;display:inline-flex;justify-content:center;align-items:center;gap:.5rem;white-space:normal;line-height:1.15;text-align:center}`,
    `.spinner{flex:0 0 18px;width:18px;height:18px;border:2px solid var(--on-accent);border-top-color:transparent;border-radius:50%;animation:spin .7s linear infinite}`,
    `.summary-card{display:grid;gap:.8rem;min-width:0;max-width:100%;padding:clamp(.85rem,3vw,1rem)}`,
    `.summary-items{display:grid;gap:.65rem;max-height:none;overflow:visible;padding-right:0;min-width:0}`,
    `.summary-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.65rem;align-items:flex-start;border-bottom:1px solid var(--border-soft);padding-bottom:.65rem;min-width:0}`,
    `.summary-item div{display:grid;gap:.2rem;min-width:0}`,
    `.summary-item strong{min-width:0;overflow-wrap:anywhere}`,
    `.summary-item>strong{text-align:right;white-space:nowrap}`,
    `.summary-item span{color:var(--text-soft);font-size:.9rem;overflow-wrap:anywhere}`,
    `.coupon-box{min-width:0;border:1px solid var(--border-soft);border-radius:12px;padding:.72rem;background:var(--surface-1);display:grid;gap:.35rem}`,
    `.coupon-row{display:grid;grid-template-columns:minmax(0,1fr);gap:.5rem;min-width:0}`,
    `.coupon-row .btn{width:100%;min-height:40px;white-space:normal}`,
    `.coupon-ok,.summary-line.discount strong{color:var(--ok-text);font-weight:800}`,
    `.summary-line,.summary-total{display:flex;justify-content:space-between;align-items:flex-start;gap:.75rem;min-width:0;font-size:1rem}`,
    `.summary-line span,.summary-total span{min-width:0;overflow-wrap:anywhere}`,
    `.summary-line strong{color:var(--text-main);text-align:right;overflow-wrap:anywhere}`,
    `.summary-total strong{color:var(--accent-green);font-size:clamp(1.25rem,5vw,1.45rem);text-align:right;overflow-wrap:anywhere}`,
    `.payment-summary{display:grid;gap:.25rem;min-width:0;border:1px solid var(--border-soft);border-radius:12px;padding:.72rem;background:var(--surface-1);overflow-wrap:anywhere}`,
    `.empty-cart{text-align:center;min-width:0}`,
    `@keyframes spin{to{transform:rotate(360deg)}}`,
    `@media (min-width:560px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.phone-input{grid-template-columns:minmax(110px,150px) minmax(0,1fr)}.coupon-row{grid-template-columns:minmax(0,1fr) auto}.coupon-row .btn{width:auto}.form-actions{grid-template-columns:minmax(0,1fr) auto}.submit-btn{width:auto}.pending-note{justify-self:start}}`,
    `@media (min-width:760px){.checkout-hero{display:flex;justify-content:space-between}.payment-options{grid-template-columns:repeat(3,minmax(0,1fr))}.summary-items{max-height:42vh;overflow:auto;padding-right:.2rem}}`,
    `@media (min-width:981px){.checkout-layout{grid-template-columns:minmax(0,1fr) minmax(300px,380px)}.summary-card{position:sticky;top:86px}}`,
    `@media (max-width:420px){.section-head{gap:.55rem}.section-head span{flex-basis:28px;height:28px}.slot-buttons{grid-template-columns:1fr}.summary-item{grid-template-columns:minmax(0,1fr)}.summary-item>strong{text-align:left;white-space:normal}}`
  ]
})
export class CheckoutPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(false);
  readonly orderId = signal('');
  readonly error = signal('');
  readonly destination = signal('');
  readonly isLocalDraft = signal(false);
  readonly notificationWarning = signal('');
  readonly couponPreviewMessage = signal('');
  readonly couponPreviewValid = signal(false);
  readonly slots = ['12:00-14:00', '14:00-16:00', '18:00-20:00'];
  readonly paymentMethods: Array<{ value: PaymentMethod; label: string; description: string }> = [
    { value: 'bizum', label: 'Bizum', description: `Enviar al ${MANUAL_PAYMENT_DETAILS.bizumPhone}` },
    { value: 'bank_transfer', label: 'Transferencia', description: 'Pago por IBAN / cuenta bancaria' },
    { value: 'cash', label: 'Efectivo', description: 'Al recibir o recoger el pedido' }
  ];

  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required]],
    phoneCountryCode: ['34', [Validators.required]],
    phoneNumber: ['', [Validators.required, Validators.pattern(/^[0-9]{7,12}$/)]],
    email: ['', [Validators.email]],
    deliveryType: this.fb.nonNullable.control<'delivery' | 'pickup'>('delivery', [Validators.required]),
    deliveryDate: ['', [Validators.required]],
    deliverySlot: ['', [Validators.required]],
    address: [''],
    postalCode: [''],
    reference: [''],
    notes: [''],
    marketingConsent: [false],
    legalConsent: [false, [Validators.requiredTrue]],
    paymentMethod: this.fb.nonNullable.control<PaymentMethod>('bizum', [Validators.required]),
    couponCode: ['']
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

    this.updateAddressValidation(this.form.controls.deliveryType.value);
    this.form.controls.deliveryType.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((type) => this.updateAddressValidation(type));
  }

  selectedPaymentLabel(): string {
    return getPaymentMethodLabel(this.form.controls.paymentMethod.value);
  }

  selectedPaymentInstructions(orderId?: string): string {
    return getPaymentInstructions(this.form.controls.paymentMethod.value, orderId);
  }

  shippingQuote(): ShippingQuote {
    return calculateShippingQuote(
      this.form.controls.deliveryType.value,
      this.form.controls.postalCode.value,
      this.cart.subtotal()
    );
  }

  couponDiscountPreview(): number {
    return this.couponPreviewValid() ? Number((this.cart.subtotal() * 0.10).toFixed(2)) : 0;
  }

  orderTotal(): number {
    return Number((this.cart.subtotal() - this.couponDiscountPreview() + this.shippingQuote().cost).toFixed(2));
  }

  canSubmitOrder(): boolean {
    return this.shippingQuote().available;
  }

  isInvalid(controlName: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }

  sanitizePhoneDigits(): void {
    const clean = String(this.form.controls.phoneNumber.value ?? '').replace(/\D/g, '');
    if (clean !== this.form.controls.phoneNumber.value) {
      this.form.controls.phoneNumber.setValue(clean);
    }
  }

  setCouponCode(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.form.controls.couponCode.setValue(input?.value ?? '');
    this.sanitizeCouponCode();
  }

  sanitizeCouponCode(): void {
    const clean = String(this.form.controls.couponCode.value ?? '').toUpperCase().replace(/\s+/g, '');
    if (clean !== this.form.controls.couponCode.value) {
      this.form.controls.couponCode.setValue(clean);
    }
    if (!clean) {
      this.couponPreviewValid.set(false);
      this.couponPreviewMessage.set('');
    }
  }

  applyCouponPreview(): void {
    this.sanitizeCouponCode();
    const code = String(this.form.controls.couponCode.value ?? '').trim().toUpperCase();

    if (!code) {
      this.couponPreviewValid.set(false);
      this.couponPreviewMessage.set('');
      return;
    }

    if (code !== 'PRIMER10') {
      this.couponPreviewValid.set(false);
      this.couponPreviewMessage.set('Cupón no válido. Usa PRIMER10 si es tu primer pedido.');
      return;
    }

    this.couponPreviewValid.set(true);
    this.couponPreviewMessage.set('');
  }

  sanitizePostalCode(): void {
    const clean = normalizePostalCode(this.form.controls.postalCode.value);
    if (clean !== this.form.controls.postalCode.value) {
      this.form.controls.postalCode.setValue(clean);
    }
  }

  private updateAddressValidation(deliveryType: 'delivery' | 'pickup'): void {
    const addressControl = this.form.controls.address;
    const postalCodeControl = this.form.controls.postalCode;

    if (deliveryType === 'delivery') {
      addressControl.addValidators([Validators.required, Validators.minLength(5)]);
      postalCodeControl.addValidators([Validators.required, Validators.pattern(/^[0-9]{5}$/)]);
    } else {
      addressControl.clearValidators();
      postalCodeControl.clearValidators();
    }

    addressControl.updateValueAndValidity({ emitEvent: false });
    postalCodeControl.updateValueAndValidity({ emitEvent: false });
  }

  async submit(): Promise<void> {
    if (this.loading()) return;

    this.form.markAllAsTouched();

    if (!this.cart.items().length) {
      this.notifications.warning('Carrito vacío', 'Añade productos antes de confirmar el pedido.');
      return;
    }

    this.updateAddressValidation(this.form.controls.deliveryType.value);

    if (!this.form.value.deliveryDate || !this.form.value.deliverySlot) {
      this.notifications.warning('Datos incompletos', 'Selecciona fecha y horario');
      return;
    }

    this.sanitizePhoneDigits();
    this.sanitizePostalCode();
    this.applyCouponPreview();

    if (!this.shippingQuote().available) {
      this.notifications.warning('Revisa el envío', this.shippingQuote().message);
      return;
    }

    if (this.form.invalid) {
      this.notifications.warning('Revisa el formulario', 'Completa los campos obligatorios y verifica el teléfono.');
      return;
    }

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

      this.notifications.success('Pedido recibido', `Tu pedido ${result.orderId} queda pendiente de pago.`);
      if (result.warning) {
        this.notifications.warning('Aviso de notificación', result.warning);
      }
      this.cart.clear();

      const accountEmail = this.customerAuth.profile()?.email ?? '';
      this.form.reset({
        phoneCountryCode: '34',
        phoneNumber: '',
        deliveryType: 'delivery',
        deliveryDate: '',
        deliverySlot: '',
        email: accountEmail,
        address: '',
        postalCode: '',
        reference: '',
        notes: '',
        marketingConsent: false,
        legalConsent: false,
        paymentMethod: 'bizum',
        couponCode: ''
      });
      this.couponPreviewValid.set(false);
      this.couponPreviewMessage.set('');
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
