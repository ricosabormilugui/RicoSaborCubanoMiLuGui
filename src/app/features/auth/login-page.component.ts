import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CustomerAuthService } from '../../core/services/customer-auth.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="card">
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
  styles: [`.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem;margin-bottom:.8rem}.err{color:#b42318}.ok{color:#0f7a3b}@media(max-width:900px){.grid{grid-template-columns:1fr}}`]
})
export class LoginPageComponent {
  email = '';
  password = '';
  readonly loading = signal(false);
  readonly error = signal('');

  constructor(public readonly auth: CustomerAuthService, private readonly router: Router) {}

  async login(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.login(this.email, this.password);
      await this.router.navigateByUrl('/checkout');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
    } finally {
      this.loading.set(false);
    }
  }
}
