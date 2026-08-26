import { getUserFriendlyError } from '../../core/utils/user-friendly-error';
import { CommonModule } from '@angular/common';
import { Component, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CustomerAuthService } from '../../core/services/customer-auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { getPasswordPolicyError } from '../../core/config/password-policy.config';
import { returnUrlQueryParams, safeReturnUrl } from '../../core/utils/safe-return-url';
import { isValidAuthEmail } from './auth-validation';
import { AuthLayoutComponent } from './auth-layout.component';
import { AuthPasswordPolicyComponent } from './auth-password-policy.component';
import { AuthPasswordToggleComponent } from './auth-password-toggle.component';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AuthLayoutComponent, AuthPasswordToggleComponent, AuthPasswordPolicyComponent],
  styleUrls: ['./auth-form.css'],
  template: `
    <app-auth-layout
      title="Crea tu cuenta"
      subtitle="Regístrate en MIXSABOR y disfruta de una experiencia de compra más rápida.">
      <form class="auth-form-grid" (ngSubmit)="register()" novalidate>
        <div class="auth-field" [class.is-error]="!!nameError()" [class.is-filled]="!!fullName" [class.is-valid]="nameOk()">
          <label for="register-name">
            Nombre completo
            <span class="auth-valid-mark" aria-hidden="true">✓</span>
          </label>
          <input
            id="register-name"
            [(ngModel)]="fullName"
            name="fullName"
            aria-label="Nombre completo"
            placeholder="Tu nombre"
            autocomplete="name"
            [attr.aria-invalid]="nameError() ? true : null"
            [attr.aria-describedby]="nameError() ? 'register-name-error' : null" />
          <p class="auth-field-error" id="register-name-error" [class.is-on]="!!nameError()" [attr.role]="nameError() ? 'alert' : null">{{ nameError() }}</p>
        </div>

        <div class="auth-field" [class.is-error]="!!emailError()" [class.is-filled]="!!email" [class.is-valid]="emailOk()">
          <label for="register-email">
            Email
            <span class="auth-valid-mark" aria-hidden="true">✓</span>
          </label>
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
          <p class="auth-field-error" id="register-email-error" [class.is-on]="!!emailError()" [attr.role]="emailError() ? 'alert' : null">{{ emailError() }}</p>
        </div>

        <div class="auth-field" [class.is-error]="!!error()" [class.is-filled]="!!password" [class.is-valid]="passwordOk()">
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
              [attr.aria-describedby]="'register-password-policy' + (error() ? ' register-password-error' : '')" />
            <app-auth-password-toggle [(visible)]="showPassword" />
          </div>
          <div id="register-password-policy">
            <app-auth-password-policy [password]="password" />
          </div>
          <p class="auth-field-error" id="register-password-error" [class.is-on]="!!error()" [attr.role]="error() ? 'alert' : null">{{ error() }}</p>
        </div>

        <button class="btn btn-primary auth-submit" type="submit" [class.is-loading]="loading()" [disabled]="loading()">
          <span class="auth-submit-label">
            <span class="auth-submit-idle">Crear mi cuenta</span>
            <span class="auth-submit-busy">
              <span class="auth-spinner" aria-hidden="true"></span>
              Creando…
            </span>
          </span>
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
  readonly loading = signal(false);
  readonly error = signal('');
  readonly nameError = signal('');
  readonly emailError = signal('');
  private readonly layout = viewChild(AuthLayoutComponent);
  private finishing = false;

  constructor(
    private readonly auth: CustomerAuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly notifications: NotificationService
  ) {}

  get returnLinkParams(): { returnUrl: string } | Record<string, never> {
    return returnUrlQueryParams(this.route.snapshot.queryParamMap.get('returnUrl'));
  }

  nameOk(): boolean {
    return this.fullName.trim().length >= 2;
  }

  emailOk(): boolean {
    return isValidAuthEmail(this.email);
  }

  passwordOk(): boolean {
    return !getPasswordPolicyError(this.password);
  }

  async register(): Promise<void> {
    if (this.loading() || this.finishing) return;
    const fullName = this.fullName.trim();
    const email = this.email.trim();
    this.nameError.set(fullName ? '' : 'Introduce tu nombre.');
    this.emailError.set(!email ? 'Introduce tu email.' : isValidAuthEmail(email) ? '' : 'Introduce un correo electrónico válido.');
    const policyError = getPasswordPolicyError(this.password);
    this.error.set(policyError);
    if (this.nameError() || this.emailError() || policyError) return;

    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.auth.register(fullName, email, this.password);
      this.finishing = true;
      this.loading.set(false);
      const successMessage = result.linkedOrders > 0
        ? `Cuenta creada. Se vincularon ${result.linkedOrders} pedidos previos con tu email.`
        : 'Cuenta creada correctamente.';
      this.notifications.success('Registro completado', successMessage);
      if (await this.layout()?.playSuccess('welcome') !== false) {
        await this.router.navigateByUrl(safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')));
      }
    } catch (error) {
      const message = getUserFriendlyError(error, 'No se pudo crear la cuenta.');
      this.notifications.error('Error al registrarte', message);
    } finally {
      this.loading.set(false);
    }
  }
}
