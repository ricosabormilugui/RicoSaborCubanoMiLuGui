import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { NotificationService } from '../../core/services/notification.service';
import { PasswordRecoveryService } from '../../core/services/password-recovery.service';
import { returnUrlQueryParams } from '../../core/utils/safe-return-url';
import { AuthLayoutComponent } from './auth-layout.component';

@Component({
  selector: 'app-forgot-password-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AuthLayoutComponent],
  styleUrls: ['./auth-form.css'],
  template: `
    <app-auth-layout
      title="Recuperar contraseña"
      subtitle="Introduce el correo asociado a tu cuenta y te enviaremos las instrucciones para restablecerla.">
      <form class="auth-form-grid" *ngIf="!sent()" (ngSubmit)="submit()" novalidate>
        <div class="auth-field" [class.is-error]="!!error()" [class.is-filled]="!!email">
          <label for="recovery-email">Correo electrónico</label>
          <input
            id="recovery-email"
            name="email"
            type="email"
            [(ngModel)]="email"
            autocomplete="email"
            inputmode="email"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            placeholder="tu@email.com"
            required
            [attr.aria-invalid]="error() ? true : null"
            [attr.aria-describedby]="error() ? 'recovery-email-error' : null" />
          <p class="auth-field-error" id="recovery-email-error" role="alert">{{ error() }}</p>
        </div>

        <button class="btn btn-primary auth-submit" type="submit" [disabled]="loading()">
          <span class="auth-spinner" *ngIf="loading()" aria-hidden="true"></span>
          {{ loading() ? 'Enviando...' : 'Enviar instrucciones' }}
        </button>
      </form>

      <div class="auth-form-grid" *ngIf="sent()">
        <div class="auth-status success" role="status">
          <h2>Revisa tu correo</h2>
          <p>{{ successMessage() }}</p>
        </div>
      </div>

      <a class="auth-back" routerLink="/login" [queryParams]="returnLinkParams">Volver a iniciar sesión</a>
    </app-auth-layout>
  `
})
export class ForgotPasswordPageComponent {
  email = '';
  readonly loading = signal(false);
  readonly sent = signal(false);
  readonly successMessage = signal('');
  readonly error = signal('');

  constructor(
    private readonly recovery: PasswordRecoveryService,
    private readonly notifications: NotificationService,
    private readonly route: ActivatedRoute
  ) {}

  get returnLinkParams(): { returnUrl: string } | Record<string, never> {
    return returnUrlQueryParams(this.route.snapshot.queryParamMap.get('returnUrl'));
  }

  async submit(): Promise<void> {
    const email = this.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.error.set('Introduce un correo electrónico válido.');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    try {
      this.successMessage.set(await this.recovery.requestReset(email, this.route.snapshot.queryParamMap.get('returnUrl')));
      this.sent.set(true);
      this.notifications.success('Solicitud recibida', 'Revisa tu correo para continuar.');
    } catch {
      const message = 'No hemos podido conectar con el servicio. Inténtalo de nuevo en unos minutos.';
      this.notifications.error('No se pudo enviar', message);
    } finally {
      this.loading.set(false);
    }
  }
}
