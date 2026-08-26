import { getUserFriendlyError } from '../../core/utils/user-friendly-error';
import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CustomerAuthService } from '../../core/services/customer-auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { returnUrlQueryParams, safeReturnUrl } from '../../core/utils/safe-return-url';
import { AuthLayoutComponent } from './auth-layout.component';
import { AuthPasswordToggleComponent } from './auth-password-toggle.component';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AuthLayoutComponent, AuthPasswordToggleComponent],
  styleUrls: ['./auth-form.css'],
  template: `
    <app-auth-layout
      title="Bienvenido de nuevo"
      subtitle="Entra en tu cuenta y continúa disfrutando de MIXSABOR.">
      <form class="auth-form-grid" (ngSubmit)="login()" novalidate>
        <div class="auth-field" [class.is-error]="!!emailError()" [class.is-filled]="!!email">
          <label for="login-email">Email</label>
          <input
            id="login-email"
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
            [attr.aria-describedby]="emailError() ? 'login-email-error' : null" />
          <p class="auth-field-error" id="login-email-error" role="alert">{{ emailError() }}</p>
        </div>

        <div class="auth-field" [class.is-error]="!!passwordError()" [class.is-filled]="!!password">
          <label for="login-password">Contraseña</label>
          <div class="auth-password">
            <input
              id="login-password"
              [(ngModel)]="password"
              name="password"
              [type]="showPassword() ? 'text' : 'password'"
              aria-label="Contraseña"
              placeholder="••••••••"
              autocomplete="current-password"
              [attr.aria-invalid]="passwordError() ? true : null"
              [attr.aria-describedby]="passwordError() ? 'login-password-error' : null" />
            <app-auth-password-toggle [(visible)]="showPassword" />
          </div>
          <p class="auth-field-error" id="login-password-error" role="alert">{{ passwordError() }}</p>
        </div>

        <div class="auth-row">
          <a class="auth-forgot" routerLink="/recuperar-contrasena" [queryParams]="returnLinkParams">Recuperar contraseña</a>
        </div>

        <button class="btn btn-primary auth-submit" type="submit" [disabled]="loading()">
          <span class="auth-spinner" *ngIf="loading()" aria-hidden="true"></span>
          {{ loading() ? 'Iniciando sesión...' : 'Iniciar sesión' }}
        </button>

        <p class="auth-ok" *ngIf="auth.isAuthenticated()">Sesión activa como {{ auth.profile()?.email }}</p>
        <p class="auth-switch">¿Todavía no tienes cuenta? <a routerLink="/registro" [queryParams]="returnLinkParams">Crear cuenta</a></p>
      </form>
    </app-auth-layout>
  `
})
export class LoginPageComponent {
  email = '';
  password = '';
  readonly showPassword = signal(false);
  readonly loading = signal(false);
  readonly emailError = signal('');
  readonly passwordError = signal('');

  constructor(
    public readonly auth: CustomerAuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly notifications: NotificationService
  ) {}

  get returnLinkParams(): { returnUrl: string } | Record<string, never> {
    return returnUrlQueryParams(this.route.snapshot.queryParamMap.get('returnUrl'));
  }

  private destinationUrl(): string {
    return safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
  }

  async login(): Promise<void> {
    const email = this.email.trim();
    this.emailError.set(email ? '' : 'Introduce tu email.');
    this.passwordError.set(this.password ? '' : 'Introduce tu contraseña.');
    if (!email || !this.password) return;

    this.loading.set(true);
    try {
      await this.auth.login(email, this.password);
      this.notifications.success('Sesión iniciada', 'Bienvenido de nuevo.');
      await this.router.navigateByUrl(this.destinationUrl());
    } catch (error) {
      const message = getUserFriendlyError(error, 'No se pudo iniciar sesión.');
      this.notifications.error('Error al iniciar sesión', message);
    } finally {
      this.loading.set(false);
    }
  }
}
