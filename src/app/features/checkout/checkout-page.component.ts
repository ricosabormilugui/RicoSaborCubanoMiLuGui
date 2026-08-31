import { getUserFriendlyError } from '../../core/utils/user-friendly-error';
import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { CheckoutFormData, PaymentMethod } from '../../core/models/order.model';
import { getPaymentInstructions, getPaymentMethodLabel, OrderService } from '../../core/services/order.service';
import { CustomerAuthService } from '../../core/services/customer-auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { DeliveryStateService } from '../../core/services/delivery-state.service';
import { ActiveIdentityService } from '../../core/services/active-identity.service';
import { CatalogService } from '../../core/services/catalog.service';
import { CouponDraftService } from '../../core/services/coupon.service';
import { CheckoutDraftService } from '../../core/services/checkout-draft.service';
import { PAYMENT_METHOD_META } from '../../core/config/payment.config';
import { PaymentSettingsService } from '../../core/services/payment-settings.service';
import { PublicPaymentSettings } from '../../core/models/payment-settings.model';
import {
  DELIVERY_RULES,
  ShippingQuote,
  calculateShippingQuote,
  explainUnavailableDate,
  formatPaymentDeadlineTime,
  getMaximumFulfillmentDate,
  getMinimumFulfillmentDate,
  getSlotsForDeliveryType,
  getValidSlotsForDate,
  isFulfillmentDateAvailable,
  normalizePostalCode,
  reconcileFulfillmentSelection,
  validateFulfillmentSelection
} from '../../core/config/shipping.config';
import { resolveApiBaseUrl } from '../../core/config/api.config';
import { cartBaseProductId, formatStockConflictMessage } from '../../core/utils/cart-stock';
import { CartLineComponent } from '../../shared/ui/cart-line.component';
import { IconComponent } from '../../shared/ui/icon.component';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, CartLineComponent, IconComponent],
  templateUrl: './checkout-page.component.html',
  styleUrls: ['./checkout-page.component.css']
})
export class CheckoutPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly apiBaseUrl = resolveApiBaseUrl();

  readonly loading = signal(false);
  readonly orderId = signal('');
  readonly destination = signal('');
  readonly notificationWarning = signal('');
  readonly emailAlreadyRegistered = signal(false);
  readonly paymentSettingsLoading = signal(true);
  readonly paymentSettingsError = signal('');
  readonly publicPayment = signal<PublicPaymentSettings | null>(null);
  readonly completedPaymentMethod = signal<PaymentMethod | null>(null);
  readonly paymentExpiresAt = signal('');
  readonly stockSubmitError = signal('');
  readonly paymentMethods = PAYMENT_METHOD_META;
  readonly deliveryRules = DELIVERY_RULES;
  private hydrating = false;

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
    public readonly customerAuth: CustomerAuthService,
    private readonly notifications: NotificationService,
    private readonly deliveryState: DeliveryStateService,
    private readonly identity: ActiveIdentityService,
    private readonly paymentSettings: PaymentSettingsService,
    private readonly catalog: CatalogService,
    public readonly coupon: CouponDraftService,
    private readonly checkoutDraft: CheckoutDraftService
  ) {
    effect(() => {
      this.identity.session();
      untracked(() => this.resetPersonalForm());
    });

    this.form.controls.email.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((email) => void this.checkEmailRegistered(email ?? ""));
    this.form.controls.deliveryType.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((type) => {
        this.updateAddressValidation(type);
        this.reconcileDeliverySlot();
      });
    this.form.controls.deliveryDate.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reconcileDeliverySlot());
    this.form.controls.deliverySlot.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.validateDeliverySelection());
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.requiresAdvancePayment() && !this.deliveryRules.cashAllowedForAdvancePaymentOrders && this.form.controls.paymentMethod.value === 'cash') {
        this.reconcilePaymentMethod();
      }
      this.persistCheckoutState();
    });
    void this.loadPaymentSettings();
    void this.refreshInventory();
  }

  async refreshInventory(): Promise<void> {
    try {
      await this.catalog.loadProducts({ force: true });
    } catch {
      // CatalogService already stores a user-facing error; cart keeps the last known snapshot.
    }
    const products = this.catalog.products();
    if (products.length) this.cart.syncInventory(products);
  }

  hasBlockingStock(): boolean {
    return Boolean(this.cart.hasStockConflicts?.());
  }

  submitDisabled(): boolean {
    return this.loading()
      || !this.cart.items().length
      || this.paymentSettingsLoading()
      || !this.availablePaymentMethods().length
      || this.hasBlockingStock();
  }

  private resetPersonalForm(): void {
    this.hydrating = true;
    const draft = this.checkoutDraft.snapshot();
    const accountEmail = this.identity.identity()?.type === 'user' ? (this.customerAuth.profile()?.email ?? '') : '';
    this.form.reset({
      fullName: draft.fullName,
      phoneCountryCode: draft.phoneCountryCode || '34',
      phoneNumber: draft.phoneNumber,
      email: accountEmail || draft.email,
      deliveryType: this.deliveryState.type(),
      deliveryDate: this.deliveryState.date() ?? '',
      deliverySlot: this.deliveryState.slot() ?? '',
      address: draft.address,
      postalCode: draft.postalCode,
      reference: draft.reference,
      notes: draft.notes,
      marketingConsent: draft.marketingConsent,
      legalConsent: draft.legalConsent,
      paymentMethod: draft.paymentMethod,
      couponCode: this.coupon.applied() ? this.coupon.code() : ''
    }, { emitEvent: false });
    this.emailAlreadyRegistered.set(false);
    this.orderId.set('');
    this.destination.set('');
    this.notificationWarning.set('');
    this.paymentExpiresAt.set('');
    this.stockSubmitError.set('');
    this.updateAddressValidation(this.form.controls.deliveryType.value);
    this.reconcileDeliverySlot();
    this.hydrating = false;
  }

  private persistCheckoutState(): void {
    if (this.hydrating || this.orderId()) return;
    const value = this.form.getRawValue();
    this.checkoutDraft.save({
      fullName: value.fullName,
      phoneCountryCode: value.phoneCountryCode,
      phoneNumber: value.phoneNumber,
      email: value.email,
      address: value.address,
      postalCode: value.postalCode,
      reference: value.reference,
      notes: value.notes,
      marketingConsent: value.marketingConsent,
      legalConsent: value.legalConsent,
      paymentMethod: value.paymentMethod
    });
    this.deliveryState.setDeliveryState({
      date: value.deliveryDate || '',
      slot: value.deliverySlot || '',
      type: value.deliveryType
    });
  }



  availablePaymentMethods(): Array<{ value: PaymentMethod; label: string; description: string }> {
    const settings = this.publicPayment();
    if (!settings) return [];

    const enabled = this.paymentMethods.filter((method) => {
      if (method.value === 'bizum') return settings.bizum.enabled;
      if (method.value === 'bank_transfer') return settings.bankTransfer.enabled;
      return settings.cash.enabled;
    });

    if (this.requiresAdvancePayment() && !this.deliveryRules.cashAllowedForAdvancePaymentOrders) {
      return enabled.filter((method) => method.value !== 'cash');
    }

    return enabled;
  }

  async loadPaymentSettings(): Promise<void> {
    this.paymentSettingsLoading.set(true);
    this.paymentSettingsError.set('');
    try {
      this.publicPayment.set(await this.paymentSettings.getPublicSettings());
      this.reconcilePaymentMethod();
    } catch (error) {
      this.publicPayment.set(null);
      this.paymentSettingsError.set(getUserFriendlyError(error, 'No se pudieron cargar los métodos de pago.'));
    } finally {
      this.paymentSettingsLoading.set(false);
    }
  }

  private reconcilePaymentMethod(): void {
    const available = this.availablePaymentMethods();
    const current = this.form.controls.paymentMethod.value;
    if (!available.some((method) => method.value === current)) {
      const next = available[0]?.value;
      if (next) {
        this.form.controls.paymentMethod.setValue(next, { emitEvent: false });
      }
    }
  }

  selectedPaymentLabel(): string {
    return getPaymentMethodLabel(this.form.controls.paymentMethod.value);
  }

  selectedPaymentInstructions(orderId?: string): string {
    const method = this.completedPaymentMethod() ?? this.form.controls.paymentMethod.value;
    return getPaymentInstructions(method, orderId);
  }

  shippingQuote(): ShippingQuote {
    return calculateShippingQuote(
      this.form.controls.deliveryType.value,
      this.form.controls.postalCode.value,
      this.cart.subtotal()
    );
  }

  hasCompletePostalCode(): boolean {
    return normalizePostalCode(this.form.controls.postalCode.value).length === 5;
  }

  shippingQuoteMessage(): string {
    const quote = this.shippingQuote();
    if (this.form.controls.deliveryType.value !== 'delivery' || this.hasCompletePostalCode()) {
      return quote.message;
    }
    if (this.isInvalid('postalCode')) return quote.message;
    return 'Indica el código postal para calcular el envío.';
  }

  shippingQuoteBlocked(): boolean {
    const quote = this.shippingQuote();
    if (this.form.controls.deliveryType.value !== 'delivery') return !quote.available;
    if (!this.hasCompletePostalCode()) return this.isInvalid('postalCode');
    return !quote.available;
  }

  paymentReservationHours(): number {
    return Math.max(1, Math.round(this.deliveryRules.paymentReservationMinutes / 60));
  }

  paymentDeadlineTime(): string {
    return formatPaymentDeadlineTime(this.paymentExpiresAt());
  }

  showsPaymentReservation(): boolean {
    return Boolean(this.paymentExpiresAt()) && this.completedPaymentMethod() !== 'cash';
  }

  couponDiscountPreview(): number {
    return this.coupon.discount(this.cart.subtotal());
  }

  orderTotal(): number {
    return Number((this.cart.subtotal() - this.couponDiscountPreview() + this.shippingQuote().cost).toFixed(2));
  }

  requiresAdvancePayment(): boolean {
    return this.cart.items().some((item) => Boolean(item.requiresAdvancePayment) || Boolean(item.customization?.length));
  }

  showExistingEmailHint(): boolean {
    return Boolean(this.emailAlreadyRegistered()) && !this.customerAuth.isAuthenticated();
  }



  requiredAdvanceNoticeHours(): number {
    return this.requiresAdvancePayment()
      ? this.deliveryRules.personalizedAdvanceNoticeHours
      : this.deliveryRules.advanceNoticeHours;
  }

  isInvalid(controlName: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }

  ariaInvalid(controlName: keyof typeof this.form.controls): 'true' | null {
    return this.isInvalid(controlName) ? 'true' : null;
  }

  availableSlots(): readonly string[] {
    const date = this.form.controls.deliveryDate.value;
    const type = this.form.controls.deliveryType.value;
    const hours = this.requiredAdvanceNoticeHours();
    if (!date) return getSlotsForDeliveryType(type);
    return getValidSlotsForDate(date, type, hours);
  }

  minimumDeliveryDate(): string {
    return getMinimumFulfillmentDate(
      this.form.controls.deliveryType.value,
      this.requiredAdvanceNoticeHours()
    );
  }

  maximumDeliveryDate(): string {
    return getMaximumFulfillmentDate();
  }

  isSlotAvailable(slot: string): boolean {
    const date = this.form.controls.deliveryDate.value;
    if (!date) return true;
    return validateFulfillmentSelection(
      date,
      slot,
      this.form.controls.deliveryType.value,
      this.requiredAdvanceNoticeHours()
    ).valid;
  }

  onDeliveryDateChange(): void {
    const dateControl = this.form.controls.deliveryDate;
    const slotControl = this.form.controls.deliverySlot;
    const date = dateControl.value;
    const type = this.form.controls.deliveryType.value;
    const hours = this.requiredAdvanceNoticeHours();
    if (!date) {
      slotControl.setValue('');
      this.validateDeliverySelection();
      return;
    }
    if (!isFulfillmentDateAvailable(date, type, hours)) {
      const message = explainUnavailableDate(date, type, hours);
      dateControl.setValue('', { emitEvent: false });
      slotControl.setValue('', { emitEvent: false });
      this.setFulfillmentError(dateControl, message);
      dateControl.markAsTouched();
      this.notifications.warning('Fecha no disponible', message);
      return;
    }
    this.reconcileDeliverySlot();
  }

  selectSlot(slot: string): void {
    if (!this.isSlotAvailable(slot)) return;
    this.form.controls.deliverySlot.setValue(slot);
    this.form.controls.deliverySlot.markAsTouched();
  }

  deliveryDateError(): string {
    const control = this.form.controls.deliveryDate;
    if (control.hasError('required')) return 'Selecciona una fecha.';
    return String(control.getError('fulfillment') ?? 'Selecciona una fecha válida.');
  }

  deliverySlotError(): string {
    const control = this.form.controls.deliverySlot;
    if (control.hasError('required')) return 'Selecciona una franja horaria.';
    return String(control.getError('fulfillment') ?? 'Selecciona una franja horaria válida.');
  }

  sanitizePhoneDigits(): void {
    const clean = String(this.form.controls.phoneNumber.value ?? '').replace(/\D/g, '');
    if (clean !== this.form.controls.phoneNumber.value) {
      this.form.controls.phoneNumber.setValue(clean);
    }
  }

  sanitizePostalCode(): void {
    const clean = normalizePostalCode(this.form.controls.postalCode.value);
    if (clean !== this.form.controls.postalCode.value) {
      this.form.controls.postalCode.setValue(clean);
    }
  }

  private async checkEmailRegistered(email: string): Promise<void> {
    const session = this.identity.session();
    const clean = String(email ?? "").trim().toLowerCase();
    if (!clean || this.customerAuth.isAuthenticated()) { this.emailAlreadyRegistered.set(false); return; }
    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/email-exists?email=${encodeURIComponent(clean)}`);
      if (!response.ok || !this.identity.isCurrent(session)) return;
      const data = await response.json();
      if (!this.identity.isCurrent(session)) return;
      this.emailAlreadyRegistered.set(Boolean(data.exists));
    } catch {}
  }

  private updateAddressValidation(deliveryType: 'delivery' | 'pickup'): void {
    const addressControl = this.form.controls.address;
    const postalCodeControl = this.form.controls.postalCode;

    if (deliveryType === 'delivery') {
      addressControl.setValidators([Validators.required, Validators.minLength(5)]);
      postalCodeControl.setValidators([Validators.required, Validators.pattern(/^[0-9]{5}$/)]);
    } else {
      addressControl.clearValidators();
      postalCodeControl.clearValidators();
    }

    addressControl.updateValueAndValidity({ emitEvent: false });
    postalCodeControl.updateValueAndValidity({ emitEvent: false });
  }

  private reconcileDeliverySlot(): void {
    const dateControl = this.form.controls.deliveryDate;
    const slotControl = this.form.controls.deliverySlot;
    const next = reconcileFulfillmentSelection(
      dateControl.value,
      slotControl.value,
      this.form.controls.deliveryType.value,
      this.requiredAdvanceNoticeHours()
    );
    if (next.date !== dateControl.value) dateControl.setValue(next.date, { emitEvent: false });
    if (next.slot !== slotControl.value) slotControl.setValue(next.slot, { emitEvent: false });
    this.validateDeliverySelection();
  }

  private validateDeliverySelection(): void {
    const dateControl = this.form.controls.deliveryDate;
    const slotControl = this.form.controls.deliverySlot;
    this.setFulfillmentError(dateControl, null);
    this.setFulfillmentError(slotControl, null);
    if (!dateControl.value) return;

    const slot = String(slotControl.value ?? '').trim();
    if (!slot) return;

    const result = validateFulfillmentSelection(
      dateControl.value,
      slot,
      this.form.controls.deliveryType.value,
      this.requiredAdvanceNoticeHours()
    );
    if (result.valid) return;

    if (result.error === 'invalid-slot') {
      this.setFulfillmentError(slotControl, result.message || 'No quedan horarios disponibles para este día.');
    } else {
      this.setFulfillmentError(dateControl, result.message);
    }
  }

  private setFulfillmentError(
    control: typeof this.form.controls.deliveryDate | typeof this.form.controls.deliverySlot,
    message: string | null
  ): void {
    const errors = { ...(control.errors ?? {}) };
    if (message) errors['fulfillment'] = message;
    else delete errors['fulfillment'];
    control.setErrors(Object.keys(errors).length ? errors : null, { emitEvent: false });
  }

  async submit(): Promise<void> {
    if (this.loading()) return;

    this.form.markAllAsTouched();

    if (!this.cart.items().length) {
      this.notifications.warning('Carrito vacío', 'Añade productos antes de confirmar el pedido.');
      return;
    }

    if (this.hasBlockingStock()) {
      this.stockSubmitError.set('La disponibilidad de tu pedido ha cambiado.');
      this.notifications.warning('Revisa el pedido', 'La disponibilidad de tu pedido ha cambiado.');
      this.focusSummary();
      return;
    }

    this.updateAddressValidation(this.form.controls.deliveryType.value);
    this.reconcileDeliverySlot();
    this.validateDeliverySelection();

    if (!this.form.value.deliveryDate || !this.form.value.deliverySlot) {
      this.notifications.warning('Datos incompletos', 'Selecciona fecha y horario');
      this.focusFirstInvalidField();
      return;
    }

    this.sanitizePhoneDigits();
    this.sanitizePostalCode();
    this.form.controls.couponCode.setValue(this.coupon.applied() ? this.coupon.code() : '', { emitEvent: false });

    if (this.paymentSettingsLoading() || this.paymentSettingsError() || !this.availablePaymentMethods().length) {
      this.notifications.warning(
        'Pago no disponible',
        'Ahora mismo no hay métodos de pago disponibles. Contacta con nosotros para completar tu pedido.'
      );
      return;
    }

    if (!this.availablePaymentMethods().some((method) => method.value === this.form.controls.paymentMethod.value)) {
      this.notifications.warning('Pago no disponible', 'El método de pago seleccionado ya no está disponible.');
      this.reconcilePaymentMethod();
      return;
    }

    if (this.requiresAdvancePayment() && !this.deliveryRules.cashAllowedForAdvancePaymentOrders && this.form.controls.paymentMethod.value === "cash") {
      this.notifications.warning('Pago no permitido', 'Este pedido requiere pago anticipado por tratarse de productos personalizados o bajo encargo.');
      return;
    }

    if (!this.shippingQuote().available) {
      this.notifications.warning('Revisa el envío', this.shippingQuote().message);
      return;
    }

    if (this.form.invalid) {
      this.notifications.warning('Revisa el formulario', 'Completa los campos obligatorios y verifica el teléfono.');
      this.focusFirstInvalidField();
      return;
    }

    this.loading.set(true);
    this.orderId.set('');
    this.destination.set('');
    this.notificationWarning.set('');
    this.stockSubmitError.set('');

    const id = this.notifications.loading('Procesando pedido…', 'Estamos validando disponibilidad y stock.', { key: 'checkout' });
    const historySession = this.notifications.historySession();
    const checkoutSession = this.identity.session();
    try {
      const payload = this.orderService.createPayload(this.form.getRawValue() as CheckoutFormData);
      payload.requiresAdvancePayment = this.requiresAdvancePayment();
      const result = await this.orderService.submitOrder(payload);
      if (!this.identity.isCurrent(checkoutSession)) return;

      this.completedPaymentMethod.set(payload.paymentMethod);

      this.orderId.set(result.orderId);
      this.destination.set(result.destination);
      this.paymentExpiresAt.set(result.paymentExpiresAt ?? '');
      this.notificationWarning.set(result.warning ? getUserFriendlyError(result.warning, 'El pedido se ha guardado, pero no se pudo enviar el aviso por correo.') : '');

      this.notifications.updateSuccess(id, 'Pedido recibido', `Tu pedido ${result.orderId} queda pendiente de pago.`, { saveToHistory: true, history: { sessionVersion: historySession, accountEquivalent: result.channel === 'backend' } });
      this.catalog.invalidate();
      void this.catalog.loadProducts({ force: true });
      this.hydrating = true;
      this.cart.clear();
      this.coupon.clear();
      this.checkoutDraft.clear();
      this.orderService.completeOrderIntent();

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
      }, { emitEvent: false });
      this.deliveryState.clear();
      this.hydrating = false;
    } catch (error) {
      if (!this.identity.isCurrent(checkoutSession)) return;
      const message = this.applyStockSubmitError(error)
        || getUserFriendlyError(error, 'No hemos podido enviar tu pedido. Revisa los datos e inténtalo de nuevo.');
      this.notifications.updateError(id, 'No se pudo enviar el pedido', message, { saveToHistory: true, history: { sessionVersion: historySession, action: { label: 'Revisar pedido', url: '/checkout' } } });
      if (this.stockSubmitError?.()) this.focusSummary();
    } finally {
      if (this.identity.isCurrent(checkoutSession)) this.loading.set(false);
    }
  }

  private applyStockSubmitError(error: unknown): string | null {
    if (!error || typeof error !== 'object') return null;
    const source = error as {
      body?: { code?: string; productId?: string; available?: number; productName?: string };
      code?: string;
    };
    if ((source.body?.code ?? source.code) !== 'ORDER_STOCK_CONFLICT') return null;
    const productId = String(source.body?.productId ?? '').trim();
    const available = source.body?.available;
    if (productId && available !== undefined) {
      this.cart.applyRemoteStock?.(productId, available);
    }
    const line = this.cart.items().find((item) => item.productId === productId || cartBaseProductId(item) === productId);
    const message = formatStockConflictMessage({
      productName: source.body?.productName || line?.name,
      requested: line?.quantity,
      available
    });
    this.stockSubmitError.set('La disponibilidad de tu pedido ha cambiado.');
    this.catalog.invalidate();
    void this.catalog.loadProducts({ force: true });
    return message;
  }

  private focusSummary(): void {
    globalThis.setTimeout(() => {
      this.document.getElementById('checkout-summary')?.scrollIntoView({ block: 'start', behavior: 'auto' });
    });
  }

  private focusFirstInvalidField(): void {
    globalThis.setTimeout(() => {
      const invalid = this.document.querySelector<HTMLElement>('.checkout-form [aria-invalid="true"]');
      if (!invalid) return;
      const target = invalid.matches('input, select, textarea, button, [tabindex]')
        ? invalid
        : invalid.querySelector<HTMLElement>('input, select, textarea, button, [tabindex]');
      target?.focus();
      target?.scrollIntoView({ block: 'center', behavior: 'auto' });
    });
  }
}
