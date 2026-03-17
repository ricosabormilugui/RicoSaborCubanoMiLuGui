import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CartService } from './core/services/cart.service';
import { CustomerAuthService } from './core/services/customer-auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="header">
      <div class="container nav-wrap">
        <a class="brand" routerLink="/">
          <span>Rico Sabor</span>
          <strong>Cubano</strong>
        </a>

        <nav>
          <a class="nav-pill neutral" routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Catálogo</a>
          <a class="nav-pill blue" routerLink="/carrito" routerLinkActive="active">Carrito ({{ cart.totalItems() }})</a>
          <a class="nav-pill red" routerLink="/checkout" routerLinkActive="active">Checkout</a>
          <a class="nav-pill" routerLink="/contacto" routerLinkActive="active">Contacto</a>
          <a class="nav-pill neutral" routerLink="/login" routerLinkActive="active" *ngIf="!customerAuth.isAuthenticated()">Entrar</a>
          <a class="nav-pill neutral" routerLink="/registro" routerLinkActive="active" *ngIf="!customerAuth.isAuthenticated()">Registro</a>
          <a class="nav-pill neutral" routerLink="/mis-pedidos" routerLinkActive="active" *ngIf="customerAuth.isAuthenticated()">Mis pedidos</a>
          <button class="nav-pill neutral" type="button" *ngIf="customerAuth.isAuthenticated()" (click)="logoutCustomer()">Salir cliente</button>
          <a class="nav-pill neutral" routerLink="/admin/pedidos" routerLinkActive="active" *ngIf="isAdmin()">Admin pedidos</a>
          <a class="nav-pill neutral" routerLink="/admin/cocina" routerLinkActive="active" *ngIf="isAdmin()">Panel cocina</a>
          <a class="nav-pill neutral" routerLink="/admin/contactos" routerLinkActive="active" *ngIf="isAdmin()">Admin contactos</a>
          <a class="nav-pill neutral" routerLink="/admin/productos" routerLinkActive="active" *ngIf="isAdmin()">Admin productos</a>
        </nav>
      </div>
    </header>

    <main class="container main">
      <router-outlet />
    </main>
  `,
  styles: [
    `.header{position:sticky;top:0;background:rgba(255,255,255,.9);backdrop-filter:blur(8px);border-bottom:1px solid #e8e3d7;z-index:10}`,
    `.nav-wrap{display:flex;justify-content:space-between;align-items:center;padding:.8rem 0;gap:1rem}`,
    `.brand{display:flex;flex-direction:column;line-height:1;text-decoration:none}`,
    `.brand span{font-weight:800;color:#1f4f8f;font-size:1rem}`,
    `.brand strong{font-size:1.6rem;color:#c71f26;text-transform:uppercase;letter-spacing:.6px}`,
    `nav{display:flex;gap:.6rem;flex-wrap:wrap;justify-content:flex-end}`,
    `.nav-pill{padding:.45rem .85rem;border-radius:999px;text-decoration:none;color:#fff;background:#2f8a2c;font-weight:700;border:0;cursor:pointer}`,
    `.nav-pill.neutral{color:#111;background:#eef0f5}`,
    `.nav-pill.blue{background:#1f4f8f}`,
    `.nav-pill.red{background:#c71f26}`,
    `.active{outline:3px solid rgba(17,17,17,.12)}`,
    `.main{padding:1rem 0 2rem}`
  ]
})
export class AppComponent {
  constructor(
    public readonly cart: CartService,
    public readonly customerAuth: CustomerAuthService
  ) {
    void this.customerAuth.restoreSession();
  }

  logoutCustomer(): void {
    this.customerAuth.logout();
  }

  isAdmin(): boolean {
    return this.customerAuth.profile()?.role === 'admin';
  }
}
