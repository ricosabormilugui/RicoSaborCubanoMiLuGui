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
        <input [(ngModel)]="email" placeholder="Email" />
        <input [(ngModel)]="password" type="password" placeholder="Contraseña" />
      </div>
      <button class="btn btn-primary" (click)="login()" [disabled]="loading()">{{ loading() ? 'Entrando...' : 'Entrar' }}</button>
      <p class="ok" *ngIf="auth.isAuthenticated()">Sesión activa como {{ auth.profile()?.email }}</p>
      <p class="err" *ngIf="error()">{{ error() }}</p>
      <p>¿No tienes cuenta? <a routerLink="/registro">Regístrate aquí</a>.</p>
    </section>
  `,
  styles: [`.auth-card{width:100%;max-width:720px;margin:40px auto;padding:30px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem;margin-bottom:.8rem}.err{color:#b42318}.ok{color:#0f7a3b}@media(max-width:900px){.grid{grid-template-columns:1fr}.auth-card{padding:20px}}`]
})
export class LoginPageComponent {
  email = '';
  password = '';
  readonly loading = signal(false);
  readonly error = signal('');

  constructor(
    public readonly auth: CustomerAuthService,
    private readonly router: Router,
    private readonly notifications: NotificationService
  ) {}

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
