import { NotificationService } from '../../core/services/notification.service';
import { getUserFriendlyError } from '../../core/utils/user-friendly-error';
import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AdminPaymentSettings,
  emptyAdminPaymentSettings,
  formatIbanDisplay,
  paymentMethodStatusLabel
} from '../../core/models/payment-settings.model';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { AdminOrderService } from '../../core/services/admin-order.service';
import { AdminPaymentSettingsService } from '../../core/services/admin-payment-settings.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-payment-settings-page.component.html',
  styleUrls: ['./admin-payment-settings-page.component.css']
})
export class AdminPaymentSettingsPageComponent {
  email = '';
  password = '';
  form: AdminPaymentSettings = emptyAdminPaymentSettings();
  readonly loading = signal(false);
  readonly error = signal('');
  readonly fieldErrors = signal<Record<string, string>>({});

  constructor(
    public readonly auth: AdminAuthService,
    private readonly adminOrders: AdminOrderService,
    private readonly paymentSettings: AdminPaymentSettingsService,
    private readonly notifications: NotificationService
  ) {
    if (this.auth.isAuthenticated()) {
      void this.loadSettings();
    }
  }

  statusLabel(status: AdminPaymentSettings['bizum']['status']): string {
    return paymentMethodStatusLabel(status);
  }

  bizumStatus(): string {
    if (!this.form.bizum.enabled) return this.statusLabel('disabled');
    return this.form.bizum.phone.trim() ? this.statusLabel('configured') : this.statusLabel('incomplete');
  }

  transferStatus(): string {
    if (!this.form.bankTransfer.enabled) return this.statusLabel('disabled');
    return this.form.bankTransfer.holder.trim() && this.form.bankTransfer.iban.trim()
      ? this.statusLabel('configured')
      : this.statusLabel('incomplete');
  }

  cashStatus(): string {
    return this.statusLabel(this.form.cash.enabled ? 'active' : 'disabled');
  }

  formatIbanField(): void {
    this.form.bankTransfer.iban = formatIbanDisplay(this.form.bankTransfer.iban);
  }

  async login(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.adminOrders.login(this.email, this.password);
      await this.loadSettings();
    } catch (error) {
      this.error.set(getUserFriendlyError(error, 'No se pudo iniciar sesión.'));
    } finally {
      this.loading.set(false);
    }
  }

  logout(): void {
    this.auth.logout();
    this.form = emptyAdminPaymentSettings();
    this.error.set('');
    this.fieldErrors.set({});
  }

  async loadSettings(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const settings = await this.paymentSettings.getSettings();
      this.form = {
        ...settings,
        bankTransfer: {
          ...settings.bankTransfer,
          iban: formatIbanDisplay(settings.bankTransfer.iban)
        }
      };
    } catch (error) {
      this.error.set(getUserFriendlyError(error, 'No se pudo cargar la configuración de pagos.'));
    } finally {
      this.loading.set(false);
    }
  }

  async saveSettings(): Promise<void> {
    if (this.loading()) return;
    const errors = this.validate();
    this.fieldErrors.set(errors);
    if (Object.keys(errors).length) {
      this.error.set('Revisa los campos marcados antes de guardar.');
      return;
    }

    const id = this.notifications.loading('Guardando configuración de pagos…', undefined, { key: 'payment-settings-save' });
    this.loading.set(true);
    this.error.set('');

    try {
      const saved = await this.paymentSettings.saveSettings(this.form);
      this.form = {
        ...saved,
        bankTransfer: {
          ...saved.bankTransfer,
          iban: formatIbanDisplay(saved.bankTransfer.iban)
        }
      };
      this.notifications.updateSuccess(id, 'Configuración de pagos guardada');
    } catch (error) {
      this.notifications.updateError(id, 'No se pudo guardar la configuración', getUserFriendlyError(error));
      this.error.set(getUserFriendlyError(error, 'No se pudo guardar la configuración de pagos.'));
    } finally {
      this.loading.set(false);
    }
  }

  private validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (this.form.bizum.enabled && !this.form.bizum.phone.trim()) {
      errors['bizum.phone'] = 'El teléfono es obligatorio si Bizum está activo.';
    }
    if (this.form.bankTransfer.enabled && !this.form.bankTransfer.holder.trim()) {
      errors['bankTransfer.holder'] = 'El titular es obligatorio si la transferencia está activa.';
    }
    if (this.form.bankTransfer.enabled && !this.form.bankTransfer.iban.trim()) {
      errors['bankTransfer.iban'] = 'El IBAN es obligatorio si la transferencia está activa.';
    }
    return errors;
  }
}
