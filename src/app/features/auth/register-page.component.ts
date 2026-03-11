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
      <h1>Crear cuenta</h1>
      <p>También puedes comprar como invitado y registrarte más tarde.</p>
      <div class="grid">
        <input [(ngModel)]="fullName" placeholder="Nombre completo" />
        <input [(ngModel)]="email" placeholder="Email" />
        <input [(ngModel)]="password" type="password" placeholder="Contraseña" />
      </div>
      <button class="btn btn-primary" (click)="register()" [disabled]="loading()">{{ loading() ? 'Creando...' : 'Crear cuenta' }}</button>
      <p class="ok" *ngIf="success()">{{ success() }}</p>
      <p class="err" *ngIf="error()">{{ error() }}</p>
      <p>¿Ya tienes cuenta? <a routerLink="/login">Inicia sesión</a>.</p>
    </section>
  `,
  styles: [`.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.7rem;margin-bottom:.8rem}.err{color:#b42318}.ok{color:#0f7a3b}@media(max-width:900px){.grid{grid-template-columns:1fr}}`]
})
export class RegisterPageComponent {
  fullName = '';
  email = '';
  password = '';

  readonly loading = signal(false);
  readonly error = signal('');
  readonly success = signal('');

  constructor(private readonly auth: CustomerAuthService, private readonly router: Router) {}

  async register(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    this.success.set('');
    try {
      const result = await this.auth.register(this.fullName, this.email, this.password);
      this.success.set(result.linkedOrders > 0 ? `Cuenta creada. Se vincularon ${result.linkedOrders} pedidos previos con tu email.` : 'Cuenta creada correctamente.');
      await this.router.navigateByUrl('/checkout');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo crear la cuenta.');
    } finally {
      this.loading.set(false);
    }
  }
}
