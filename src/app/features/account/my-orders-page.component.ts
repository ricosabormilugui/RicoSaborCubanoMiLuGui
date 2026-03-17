import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomerAuthService } from '../../core/services/customer-auth.service';
import { CustomerOrdersService, CustomerOrder } from '../../core/services/customer-orders.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="card">
      <h1>Mis pedidos</h1>
      <p *ngIf="!auth.isAuthenticated()">
        Debes iniciar sesión para ver tu historial. <a routerLink="/login">Iniciar sesión</a>
      </p>

      <div *ngIf="auth.isAuthenticated()">
        <button class="btn" (click)="loadOrders()">Actualizar</button>
        <p class="err" *ngIf="error()">{{ error() }}</p>

        <article class="order" *ngFor="let order of orders()">
          <h3>{{ order.orderId }} · {{ order.status }}</h3>
          <p><strong>Fecha:</strong> {{ order.createdAt | date:'short' }} · <strong>Total:</strong> {{ (order.total ?? 0) | currency:'EUR' }}</p>
          <ul>
            <li *ngFor="let item of order.items">{{ item.quantity }} x {{ item.name }}</li>
          </ul>
          <p *ngIf="order.notes"><strong>Notas:</strong> {{ order.notes }}</p>
        </article>

        <p *ngIf="!orders().length && !error()">Aún no tienes pedidos asociados a tu cuenta.</p>
      </div>
    </section>
  `,
  styles: [`.order{border:1px solid var(--border-soft);border-radius:12px;padding:.9rem;margin-top:.8rem;background:var(--surface-1);color:var(--text-main)}.order h3,.order p,.order li,.order strong{color:inherit}.err{color:var(--error-text)}`]
})
export class MyOrdersPageComponent {
  readonly orders = signal<CustomerOrder[]>([]);
  readonly error = signal('');

  constructor(public readonly auth: CustomerAuthService, private readonly customerOrders: CustomerOrdersService) {
    if (this.auth.isAuthenticated()) {
      void this.loadOrders();
    }
  }

  async loadOrders(): Promise<void> {
    this.error.set('');
    try {
      this.orders.set(await this.customerOrders.listMyOrders());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo cargar el historial.');
    }
  }
}
