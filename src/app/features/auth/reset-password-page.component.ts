import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { getPasswordPolicyError, PASSWORD_POLICY_MESSAGE } from '../../core/config/password-policy.config';
import { NotificationService } from '../../core/services/notification.service';
import { PasswordRecoveryError, PasswordRecoveryService } from '../../core/services/password-recovery.service';
import { returnUrlQueryParams } from '../../core/utils/safe-return-url';
import { AuthLayoutComponent } from './auth-layout.component';
import { AuthPasswordToggleComponent } from './auth-password-toggle.component';

@Component({
  selector: 'app-reset-password-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AuthLayoutComponent, AuthPasswordToggleComponent],
  styleUrls: ['./auth-form.css'],
  template: `
    <app-auth-layout
      title="Nueva contraseña"
      subtitle="Define una contraseña segura para volver a entrar en MIXSABOR.">
      <div class="auth-form-grid" *ngIf="invalidToken()">
        <div class="auth-status invalid" role="alert">
          <p>El enlace de recuperación no es válido o ha caducado.</p>
          <a routerLink="/recuperar-contrasena" [queryParams]="returnLinkParams">Solicitar un nuevo enlace</a>
        </div>
      </div>

      <div class="auth-form-grid" *ngIf="updated()">
        <div class="auth-status success" role="status">
          <h2>Contraseña actualizada correctamente</h2>
          <p>Ya puedes iniciar sesión con tu nueva contraseña.</p>
          <a class="btn btn-primary" routerLink="/login" [queryParams]="returnLinkParams">Ir a iniciar sesión</a>
        </div>
      </div>

      <form class="auth-form-grid" *ngIf="!invalidToken() && !updated()" (ngSubmit)="submit()" novalidate>
        <p class="auth-hint">{{ policyMessage }}</p>

        <div class="auth-field" [class.is-error]="!!passwordError()" [class.is-filled]="!!password">
          <label for="new-password">Nueva contraseña</label>
          <div class="auth-password">
            <input
              id="new-password"
              name="password"
              [(ngModel)]="password"
              [type]="showPassword() ? 'text' : 'password'"
              autocomplete="new-password"
              required
              [attr.aria-invalid]="passwordError() ? true : null"
              [attr.aria-describedby]="passwordError() ? 'reset-password-error' : null" />
            <app-auth-password-toggle [(visible)]="showPassword" showLabel="Mostrar nueva contraseña" hideLabel="Ocultar nueva contraseña" />
          </div>
          <p class="auth-field-error" id="reset-password-error" role="alert">{{ passwordError() }}</p>
        </div>

        <div class="auth-field" [class.is-error]="!!confirmError()" [class.is-filled]="!!confirmation">
          <label for="confirm-password">Confirmar contraseña</label>
          <div class="auth-password">
            <input
              id="confirm-password"
              name="confirmation"
              [(ngModel)]="confirmation"
              [type]="showConfirmation() ? 'text' : 'password'"
              autocomplete="new-password"
              required
              [attr.aria-invalid]="confirmError() ? true : null"
              [attr.aria-describedby]="confirmError() ? 'reset-confirm-error' : null" />
            <app-auth-password-toggle [(visible)]="showConfirmation" showLabel="Mostrar confirmación de contraseña" hideLabel="Ocultar confirmación de contraseña" />
          </div>
          <p class="auth-field-error" id="reset-confirm-error" role="alert">{{ confirmError() }}</p>
        </div>

        <button class="btn btn-primary auth-submit" type="submit" [disabled]="loading()">
          <span class="auth-spinner" *ngIf="loading()" aria-hidden="true"></span>
          {{ loading() ? 'Actualizando...' : 'Actualizar contraseña' }}
        </button>
      </form>

      <p class="auth-err" role="alert" *ngIf="error()">{{ error() }}</p>
      <a class="auth-back" routerLink="/login" [queryParams]="returnLinkParams" *ngIf="!updated()">Volver a iniciar sesión</a>
    </app-auth-layout>
  `
})
export class ResetPasswordPageComponent {
  password = '';
  confirmation = '';
  readonly policyMessage = PASSWORD_POLICY_MESSAGE;
  readonly showPassword = signal(false);
  readonly showConfirmation = signal(false);
  readonly loading = signal(false);
  readonly updated = signal(false);
  readonly invalidToken = signal(false);
  readonly error = signal('');
  readonly passwordError = signal('');
  readonly confirmError = signal('');
  private readonly token: string;

  constructor(
    private readonly route: ActivatedRoute,
    router: Router,
    private readonly recovery: PasswordRecoveryService,
    private readonly notifications: NotificationService
  ) {
    const fragmentToken = new URLSearchParams(this.route.snapshot.fragment ?? '').get('token');
    this.token = fragmentToken ?? this.route.snapshot.queryParamMap.get('token') ?? '';
    this.invalidToken.set(!this.token);

    if (this.token && globalThis.history) {
      const cleanUrl = router.serializeUrl(router.createUrlTree(['/reset-password'], { queryParams: this.returnLinkParams }));
      globalThis.history.replaceState(globalThis.history.state, '', cleanUrl);
    }
  }

  get returnLinkParams(): { returnUrl: string } | Record<string, never> {
    return returnUrlQueryParams(this.route.snapshot.queryParamMap.get('returnUrl'));
  }

  async submit(): Promise<void> {
    const policyError = getPasswordPolicyError(this.password);
    this.passwordError.set(policyError);
    this.confirmError.set(this.password === this.confirmation ? '' : 'Las contraseñas no coinciden.');
    this.error.set('');
    if (policyError || this.password !== this.confirmation) return;

    this.loading.set(true);
    try {
      await this.recovery.resetPassword(this.token, this.password);
      this.password = '';
      this.confirmation = '';
      this.updated.set(true);
      this.notifications.success('Contraseña actualizada', 'Ya puedes iniciar sesión con tu nueva contraseña.');
    } catch (error) {
      if (error instanceof PasswordRecoveryError && error.code === 'INVALID_OR_EXPIRED_TOKEN') {
        this.invalidToken.set(true);
        return;
      }

      const message = error instanceof PasswordRecoveryError && error.code === 'PASSWORD_POLICY'
        ? error.message
        : 'No hemos podido actualizar la contraseña. Comprueba tu conexión e inténtalo de nuevo.';
      if (error instanceof PasswordRecoveryError && error.code === 'PASSWORD_POLICY') {
        this.passwordError.set(message);
        return;
      }
      this.notifications.error('No se pudo actualizar', message);
    } finally {
      this.loading.set(false);
    }
  }
}
