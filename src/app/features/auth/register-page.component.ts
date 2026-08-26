import { getUserFriendlyError } from '../../core/utils/user-friendly-error';
import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CustomerAuthService } from '../../core/services/customer-auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { getPasswordPolicyError, PASSWORD_POLICY_MESSAGE } from '../../core/config/password-policy.config';
import { returnUrlQueryParams, safeReturnUrl } from '../../core/utils/safe-return-url';
import { AuthLayoutComponent } from './auth-layout.component';
import { AuthPasswordToggleComponent } from './auth-password-toggle.component';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AuthLayoutComponent, AuthPasswordToggleComponent],
  styleUrls: ['./auth-form.css'],
  template: `
    <app-auth-layout
      title="Crea tu cuenta"
      subtitle="Regístrate en MIXSABOR y disfruta de una experiencia de compra más rápida.">
      <form class="auth-form-grid" (ngSubmit)="register()" novalidate>
        <div class="auth-field" [class.is-error]="!!nameError()" [class.is-filled]="!!fullName">
          <label for="register-name">Nombre completo</label>
          <input
            id="register-name"
            [(ngModel)]="fullName"
            name="fullName"
            aria-label="Nombre completo"
            placeholder="Tu nombre"
            autocomplete="name"
            [attr.aria-invalid]="nameError() ? true : null"
            [attr.aria-describedby]="nameError() ? 'register-name-error' : null" />
          <p class="auth-field-error" id="register-name-error" role="alert">{{ nameError() }}</p>
        </div>

        <div class="auth-field" [class.is-error]="!!emailError()" [class.is-filled]="!!email">
          <label for="register-email">Email</label>
          <input
            id="register-email"
            [(ngModel)]="email"
            name="email"
            type="email"
            aria-label="Email"
            placeholder="tu@email.com"
            autocomplete="email"
            inputmode="email"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            [attr.aria-invalid]="emailError() ? true : null"
            [attr.aria-describedby]="emailError() ? 'register-email-error' : null" />
          <p class="auth-field-error" id="register-email-error" role="alert">{{ emailError() }}</p>
        </div>

        <div class="auth-field" [class.is-error]="!!error()" [class.is-filled]="!!password">
          <label for="register-password">Contraseña</label>
          <div class="auth-password">
            <input
              id="register-password"
              [(ngModel)]="password"
              name="password"
              [type]="showPassword() ? 'text' : 'password'"
              aria-label="Contraseña"
              placeholder="••••••••"
              autocomplete="new-password"
              [attr.aria-invalid]="error() ? true : null"
              [attr.aria-describedby]="'register-password-hint' + (error() ? ' register-password-error' : '')" />
            <app-auth-password-toggle [(visible)]="showPassword" />
          </div>
          <p class="auth-hint" id="register-password-hint">{{ passwordPolicyMessage }}</p>
          <p class="auth-field-error" id="register-password-error" role="alert">{{ error() }}</p>
        </div>

        <button class="btn btn-primary auth-submit" type="submit" [disabled]="loading()">
          <span class="auth-spinner" *ngIf="loading()" aria-hidden="true"></span>
          {{ loading() ? 'Creando...' : 'Crear mi cuenta' }}
        </button>

        <p class="auth-switch">¿Ya tienes una cuenta? <a routerLink="/login" [queryParams]="returnLinkParams">Iniciar sesión</a></p>
      </form>
    </app-auth-layout>
  `
})
export class RegisterPageComponent {
  fullName = '';
  email = '';
  password = '';
  readonly showPassword = signal(false);
  readonly passwordPolicyMessage = PASSWORD_POLICY_MESSAGE;
  readonly loading = signal(false);
  readonly error = signal('');
  readonly nameError = signal('');
  readonly emailError = signal('');

  constructor(
    private readonly auth: CustomerAuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly notifications: NotificationService
  ) {}

  get returnLinkParams(): { returnUrl: string } | Record<string, never> {
    return returnUrlQueryParams(this.route.snapshot.queryParamMap.get('returnUrl'));
  }

  async register(): Promise<void> {
    const fullName = this.fullName.trim();
    const email = this.email.trim();
    this.nameError.set(fullName ? '' : 'Introduce tu nombre.');
    this.emailError.set(email ? '' : 'Introduce tu email.');
    const policyError = getPasswordPolicyError(this.password);
    this.error.set(policyError);
    if (!fullName || !email || policyError) return;

    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.auth.register(fullName, email, this.password);
      const successMessage = result.linkedOrders > 0
        ? `Cuenta creada. Se vincularon ${result.linkedOrders} pedidos previos con tu email.`
        : 'Cuenta creada correctamente.';
      this.notifications.success('Registro completado', successMessage);
      await this.router.navigateByUrl(safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')));
    } catch (error) {
      const message = getUserFriendlyError(error, 'No se pudo crear la cuenta.');
      this.notifications.error('Error al registrarte', message);
    } finally {
      this.loading.set(false);
    }
  }
}
