import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CustomerAuthService } from '../../core/services/customer-auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { getPasswordPolicyError, PASSWORD_POLICY_MESSAGE } from '../../core/config/password-policy.config';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="card auth-card">
      <h1>Crear cuenta</h1>
      <p>También puedes comprar como invitado y registrarte más tarde.</p>
      <div class="grid">
        <input [(ngModel)]="fullName" aria-label="Nombre completo" placeholder="Nombre completo" autocomplete="name" />
        <input [(ngModel)]="email" type="email" aria-label="Email" placeholder="Email" autocomplete="email" />
        <div class="password-field">
          <input [(ngModel)]="password" [type]="showPassword() ? 'text' : 'password'" aria-label="Contraseña" placeholder="Contraseña" autocomplete="new-password" />
          <button class="password-toggle" type="button" (click)="togglePassword()" [attr.aria-label]="showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'">
            {{ showPassword() ? '🙈' : '👁️' }}
          </button>
        </div>
      </div>
      <p class="password-hint">{{ passwordPolicyMessage }}</p>
      <button class="btn btn-primary" (click)="register()" [disabled]="loading()">{{ loading() ? 'Creando...' : 'Crear cuenta' }}</button>
      <p class="ok" *ngIf="success()">{{ success() }}</p>
      <p class="err" *ngIf="error()">{{ error() }}</p>
      <p class="auth-help">¿Ya tienes cuenta? <a routerLink="/login">Inicia sesión</a>.</p>
    </section>
  `,
  styles: [
    `.auth-card{width:100%;max-width:720px;margin:clamp(1rem,4vw,2rem) auto;padding:clamp(1rem,3vw,1.5rem)}h1{margin:.1rem 0 .5rem;font-size:var(--title-section)}`,
    `.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.7rem;margin-bottom:.8rem}`,
    `.password-field{position:relative}`,
    `.password-field input{width:100%;padding-right:3rem}`,
    `.password-toggle{position:absolute;right:.35rem;top:50%;transform:translateY(-50%);display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:9px;background:transparent;color:var(--text-main);cursor:pointer}`,
    `.password-toggle:hover,.password-toggle:focus-visible{background:var(--surface-2);outline:2px solid color-mix(in srgb, var(--accent-green) 55%, transparent);outline-offset:1px}`,
    `.auth-help{color:var(--text-soft)}`,
    `.password-hint{margin:-.25rem 0 .8rem;color:var(--text-soft);font-size:.9rem}`,
    `.auth-help a{color:var(--accent-green);font-weight:700;text-underline-offset:3px}`,
    `.auth-help a:hover,.auth-help a:focus-visible{color:var(--text-main);outline:2px solid color-mix(in srgb, var(--accent-green) 55%, transparent);outline-offset:3px;border-radius:4px}`,
    `.err{color:var(--error-text)}`,
    `.ok{color:var(--ok-text)}`,
    `@media(max-width:900px){.grid{grid-template-columns:1fr}}@media(max-width:640px){.auth-card>.btn{width:100%;min-height:44px}}`
  ]
})
export class RegisterPageComponent {
  fullName = '';
  email = '';
  password = '';
  readonly showPassword = signal(false);
  readonly passwordPolicyMessage = PASSWORD_POLICY_MESSAGE;

  readonly loading = signal(false);
  readonly error = signal('');
  readonly success = signal('');

  constructor(
    private readonly auth: CustomerAuthService,
    private readonly router: Router,
    private readonly notifications: NotificationService
  ) {}

  togglePassword(): void {
    this.showPassword.set(!this.showPassword());
  }

  async register(): Promise<void> {
    const policyError = getPasswordPolicyError(this.password);
    if (policyError) {
      this.error.set(policyError);
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.success.set('');
    try {
      const result = await this.auth.register(this.fullName, this.email, this.password);
      const successMessage = result.linkedOrders > 0
        ? `Cuenta creada. Se vincularon ${result.linkedOrders} pedidos previos con tu email.`
        : 'Cuenta creada correctamente.';
      this.success.set(successMessage);
      this.notifications.success('Registro completado', successMessage);
      await this.router.navigateByUrl('/checkout');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo crear la cuenta.';
      this.error.set(message);
      this.notifications.error('Error al registrarte', message);
    } finally {
      this.loading.set(false);
    }
  }
}
