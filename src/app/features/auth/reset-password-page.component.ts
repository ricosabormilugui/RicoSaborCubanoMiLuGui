import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { getPasswordPolicyError, PASSWORD_POLICY_MESSAGE } from '../../core/config/password-policy.config';
import { NotificationService } from '../../core/services/notification.service';
import { PasswordRecoveryError, PasswordRecoveryService } from '../../core/services/password-recovery.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="card auth-card">
      <h1>Nueva contraseña</h1>

      <div class="status invalid" role="alert" *ngIf="invalidToken()">
        <p>El enlace de recuperación no es válido o ha caducado.</p>
        <a routerLink="/recuperar-contrasena">Solicitar un nuevo enlace</a>
      </div>

      <div class="status success" role="status" *ngIf="updated()">
        <h2>Contraseña actualizada correctamente</h2>
        <p>Ya puedes iniciar sesión con tu nueva contraseña.</p>
        <a class="btn btn-primary" routerLink="/login">Ir a iniciar sesión</a>
      </div>

      <form *ngIf="!invalidToken() && !updated()" (ngSubmit)="submit()" novalidate>
        <p class="hint">{{ policyMessage }}</p>
        <label for="new-password">Nueva contraseña</label>
        <div class="password-field">
          <input id="new-password" name="password" [(ngModel)]="password" [type]="showPassword() ? 'text' : 'password'" autocomplete="new-password" required />
          <button class="password-toggle" type="button" (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Ocultar nueva contraseña' : 'Mostrar nueva contraseña'">{{ showPassword() ? '🙈' : '👁️' }}</button>
        </div>

        <label for="confirm-password">Confirmar contraseña</label>
        <div class="password-field">
          <input id="confirm-password" name="confirmation" [(ngModel)]="confirmation" [type]="showConfirmation() ? 'text' : 'password'" autocomplete="new-password" required />
          <button class="password-toggle" type="button" (click)="showConfirmation.set(!showConfirmation())" [attr.aria-label]="showConfirmation() ? 'Ocultar confirmación de contraseña' : 'Mostrar confirmación de contraseña'">{{ showConfirmation() ? '🙈' : '👁️' }}</button>
        </div>

        <button class="btn btn-primary" type="submit" [disabled]="loading()">
          {{ loading() ? 'Actualizando...' : 'Actualizar contraseña' }}
        </button>
      </form>

      <p class="err" role="alert" *ngIf="error()">{{ error() }}</p>
      <a class="back-link" routerLink="/login" *ngIf="!updated()">Volver a iniciar sesión</a>
    </section>
  `,
  styles: [
    `.auth-card{width:100%;max-width:620px;margin:40px auto;padding:30px}h1{margin-top:0}`,
    `form{display:grid;gap:.7rem;margin:1rem 0}label{font-weight:700}.hint{color:var(--text-soft);font-size:.92rem;line-height:1.5;margin:0 0 .3rem}`,
    `.password-field{position:relative}.password-field input{width:100%;padding-right:3rem}`,
    `.password-toggle{position:absolute;right:.35rem;top:50%;transform:translateY(-50%);display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:9px;background:transparent;color:var(--text-main);cursor:pointer}`,
    `.password-toggle:hover,.password-toggle:focus-visible{background:var(--surface-2);outline:2px solid color-mix(in srgb,var(--accent-green) 55%,transparent);outline-offset:1px}`,
    `.btn{justify-self:start;margin-top:.35rem}.status{margin:1rem 0;padding:1rem;border-radius:12px;border:1px solid var(--border-soft)}`,
    `.status h2{font-size:1.1rem;margin:0 0 .4rem}.status p{margin:0 0 .8rem}.status a:not(.btn),.back-link{color:var(--accent-green);font-weight:700;text-underline-offset:3px}`,
    `.success{background:color-mix(in srgb,var(--accent-green) 8%,var(--surface-0))}.invalid{background:color-mix(in srgb,var(--error-text) 6%,var(--surface-0))}.err{color:var(--error-text)}`,
    `.back-link{display:inline-block;margin-top:.5rem}`,
    `@media(max-width:640px){.auth-card{margin:20px auto;padding:20px}.btn{width:100%;text-align:center}}`
  ]
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
  private readonly token: string;

  constructor(
    route: ActivatedRoute,
    router: Router,
    private readonly recovery: PasswordRecoveryService,
    private readonly notifications: NotificationService
  ) {
    const fragmentToken = new URLSearchParams(route.snapshot.fragment ?? '').get('token');
    this.token = fragmentToken ?? route.snapshot.queryParamMap.get('token') ?? '';
    this.invalidToken.set(!this.token);

    if (this.token && globalThis.history) {
      const cleanUrl = router.serializeUrl(router.createUrlTree(['/reset-password']));
      globalThis.history.replaceState(globalThis.history.state, '', cleanUrl);
    }
  }

  async submit(): Promise<void> {
    const policyError = getPasswordPolicyError(this.password);
    if (policyError) {
      this.error.set(policyError);
      return;
    }
    if (this.password !== this.confirmation) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }

    this.loading.set(true);
    this.error.set('');
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
      this.error.set(message);
      this.notifications.error('No se pudo actualizar', message);
    } finally {
      this.loading.set(false);
    }
  }
}
