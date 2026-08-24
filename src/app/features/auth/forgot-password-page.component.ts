import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NotificationService } from '../../core/services/notification.service';
import { PasswordRecoveryService } from '../../core/services/password-recovery.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="card auth-card">
      <h1>Recuperar contraseña</h1>
      <p class="intro">Introduce el correo electrónico asociado a tu cuenta y te enviaremos las instrucciones para restablecer tu contraseña.</p>

      <form *ngIf="!sent()" (ngSubmit)="submit()" novalidate>
        <label for="recovery-email">Correo electrónico</label>
        <input id="recovery-email" name="email" type="email" [(ngModel)]="email" autocomplete="email" placeholder="tu@email.com" required />
        <button class="btn btn-primary" type="submit" [disabled]="loading()">
          {{ loading() ? 'Enviando...' : 'Enviar instrucciones' }}
        </button>
      </form>

      <div class="status success" role="status" *ngIf="sent()">
        <h2>Revisa tu correo</h2>
        <p>{{ successMessage() }}</p>
      </div>
      <p class="err" role="alert" *ngIf="error()">{{ error() }}</p>
      <a class="back-link" routerLink="/login">Volver a iniciar sesión</a>
    </section>
  `,
  styles: [
    `.auth-card{width:100%;max-width:620px;margin:clamp(1rem,4vw,2rem) auto;padding:clamp(1rem,3vw,1.5rem)}`,
    `h1{margin:.1rem 0 .65rem;font-size:var(--title-section)}.intro{margin:.4rem 0;color:var(--text-soft);line-height:1.52}`,
    `form{display:grid;gap:.7rem;margin:1.2rem 0}`,
    `label{font-weight:700}input{width:100%}`,
    `.btn{justify-self:start;margin-top:.25rem}`,
    `.status{margin:1.2rem 0;padding:1rem;border:1px solid color-mix(in srgb,var(--accent-green) 35%,var(--border-soft));border-radius:12px;background:color-mix(in srgb,var(--accent-green) 8%,var(--surface-0))}`,
    `.status h2{font-size:1.1rem;margin:0 0 .4rem}.status p{margin:0;line-height:1.55}`,
    `.err{color:var(--error-text)}`,
    `.back-link{display:inline-block;color:var(--accent-green);font-weight:700;text-underline-offset:3px;margin-top:.5rem}`,
    `.back-link:focus-visible{outline:2px solid color-mix(in srgb,var(--accent-green) 55%,transparent);outline-offset:3px;border-radius:4px}`,
    `@media(max-width:640px){.btn{width:100%;min-height:44px}}`
  ]
})
export class ForgotPasswordPageComponent {
  email = '';
  readonly loading = signal(false);
  readonly sent = signal(false);
  readonly successMessage = signal('');
  readonly error = signal('');

  constructor(
    private readonly recovery: PasswordRecoveryService,
    private readonly notifications: NotificationService
  ) {}

  async submit(): Promise<void> {
    const email = this.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.error.set('Introduce un correo electrónico válido.');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    try {
      this.successMessage.set(await this.recovery.requestReset(email));
      this.sent.set(true);
      this.notifications.success('Solicitud recibida', 'Revisa tu correo para continuar.');
    } catch {
      const message = 'No hemos podido conectar con el servicio. Inténtalo de nuevo en unos minutos.';
      this.error.set(message);
      this.notifications.error('No se pudo enviar', message);
    } finally {
      this.loading.set(false);
    }
  }
}
