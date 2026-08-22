import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CustomerAuthService } from '../../core/services/customer-auth.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="card auth-card">
      <h1>Iniciar sesión</h1>
      <div class="grid">
        <input [(ngModel)]="email" placeholder="Email" autocomplete="email" />
        <div class="password-field">
          <input [(ngModel)]="password" [type]="showPassword() ? 'text' : 'password'" placeholder="Contraseña" autocomplete="current-password" />
          <button class="password-toggle" type="button" (click)="togglePassword()" [attr.aria-label]="showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'">
            {{ showPassword() ? '🙈' : '👁️' }}
          </button>
        </div>
      </div>
      <a class="forgot-link" routerLink="/recuperar-contrasena">¿Has olvidado tu contraseña?</a>
      <button class="btn btn-primary" (click)="login()" [disabled]="loading()">{{ loading() ? 'Iniciando sesión...' : 'Iniciar sesión' }}</button>
      <p class="ok" *ngIf="auth.isAuthenticated()">Sesión activa como {{ auth.profile()?.email }}</p>
      <p class="err" *ngIf="error()">{{ error() }}</p>
      <p class="auth-help">¿No tienes cuenta? <a routerLink="/registro">Regístrate aquí</a>.</p>
    </section>
  `,
  styles: [
    `.auth-card{width:100%;max-width:720px;margin:40px auto;padding:30px}`,
    `.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem;margin-bottom:.8rem}`,
    `.password-field{position:relative}`,
    `.password-field input{width:100%;padding-right:3rem}`,
    `.password-toggle{position:absolute;right:.35rem;top:50%;transform:translateY(-50%);display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:9px;background:transparent;color:var(--text-main);cursor:pointer}`,
    `.password-toggle:hover,.password-toggle:focus-visible{background:var(--surface-2);outline:2px solid color-mix(in srgb, var(--accent-green) 55%, transparent);outline-offset:1px}`,
    `.forgot-link{display:block;width:max-content;max-width:100%;margin:-.2rem 0 .85rem;color:var(--text-soft);font-weight:650;text-underline-offset:3px}`,
    `.forgot-link:hover,.forgot-link:focus-visible{color:var(--accent-green);outline:2px solid color-mix(in srgb,var(--accent-green) 55%,transparent);outline-offset:3px;border-radius:4px}`,
    `.auth-help{color:var(--text-soft)}`,
    `.auth-help a{color:var(--accent-green);font-weight:700;text-underline-offset:3px}`,
    `.auth-help a:hover,.auth-help a:focus-visible{color:var(--text-main);outline:2px solid color-mix(in srgb, var(--accent-green) 55%, transparent);outline-offset:3px;border-radius:4px}`,
    `.err{color:var(--error-text)}`,
    `.ok{color:var(--ok-text)}`,
    `@media(max-width:900px){.grid{grid-template-columns:1fr}.auth-card{padding:20px}}`
  ]
})
export class LoginPageComponent {
  email = '';
  password = '';
  readonly showPassword = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');

  constructor(
    public readonly auth: CustomerAuthService,
    private readonly router: Router,
    private readonly notifications: NotificationService
  ) {}

  togglePassword(): void {
    this.showPassword.set(!this.showPassword());
  }

  async login(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.login(this.email, this.password);
      this.notifications.success('Sesión iniciada', 'Bienvenido de nuevo.');
      await this.router.navigateByUrl('/checkout');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo iniciar sesión.';
      this.error.set(message);
      this.notifications.error('Error al iniciar sesión', message);
    } finally {
      this.loading.set(false);
    }
  }
}
