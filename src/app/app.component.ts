import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CartService } from './core/services/cart.service';
import { CustomerAuthService } from './core/services/customer-auth.service';
import { NotificationsComponent } from './shared/ui/notifications.component';

type ThemeMode = 'dark' | 'light';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, NotificationsComponent],
  template: `
    <div class="top-banner">🎁 Regalo sorpresa en tu primer pedido</div>

    <header class="navbar">
      <div class="container nav-container">
        <div class="nav-left">
          <button class="menu-btn" type="button" aria-label="Menú">☰</button>
        </div>

        <a class="nav-center" routerLink="/">
          <div class="logo">RicoSabor</div>
          <div class="subtitle">Cubano · Mi Lu Gui</div>
        </a>

        <div class="nav-right">
          <a class="nav-pill" routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Catálogo</a>
          <a class="nav-pill" routerLink="/checkout" routerLinkActive="active">Checkout</a>
          <a class="nav-pill" routerLink="/contacto" routerLinkActive="active">Contacto</a>
          <a class="nav-pill" routerLink="/login" routerLinkActive="active" *ngIf="!customerAuth.isAuthenticated()">Entrar</a>
          <a class="nav-pill" routerLink="/registro" routerLinkActive="active" *ngIf="!customerAuth.isAuthenticated()">Registro</a>
          <a class="nav-pill" routerLink="/mis-pedidos" routerLinkActive="active" *ngIf="customerAuth.isAuthenticated()">Mis pedidos</a>
          <button class="nav-pill" type="button" *ngIf="customerAuth.isAuthenticated()" (click)="logoutCustomer()">Salir cliente</button>

          <button class="theme-btn" type="button" (click)="toggleTheme()" [attr.aria-label]="theme() === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'">
            {{ theme() === 'dark' ? '☀️' : '🌙' }}
          </button>

          <a class="cart-box" routerLink="/carrito">
            🛒 {{ cart.totalItems() }} productos
            <span>{{ cart.subtotal() | currency:'EUR' }}</span>
          </a>
        </div>
      </div>

      <div class="container admin-row" *ngIf="isAdmin()">
        <a class="nav-pill" routerLink="/admin/pedidos" routerLinkActive="active">Admin pedidos</a>
        <a class="nav-pill" routerLink="/admin/cocina" routerLinkActive="active">Panel cocina</a>
        <a class="nav-pill" routerLink="/admin/contactos" routerLinkActive="active">Admin contactos</a>
        <a class="nav-pill" routerLink="/admin/productos" routerLinkActive="active">Admin productos</a>
      </div>
    </header>

    <main class="container main">
      <router-outlet />
    </main>

    <app-notifications />
  `,
  styles: [
    `.top-banner{background:#ef4444;text-align:center;padding:6px 10px;font-size:14px;color:#fff;font-weight:700}`,
    `.navbar{background:linear-gradient(180deg,#1f2330,#1a1d28);color:#fff;border-bottom:1px solid rgba(255,255,255,.05);position:sticky;top:0;z-index:20}`,
    `.nav-container{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:10px 0}`,
    `.nav-left{display:flex;align-items:center}`,
    `.menu-btn{background:none;border:none;color:#fff;font-size:20px;cursor:pointer}`,
    `.nav-center{text-align:center;text-decoration:none;color:#fff;min-width:220px}`,
    `.logo{font-size:44px;font-weight:700;font-family:Georgia,'Times New Roman',serif;line-height:1}`,
    `.subtitle{font-size:14px;opacity:.7}`,
    `.nav-right{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end}`,
    `.nav-pill{background:rgba(255,255,255,.08);border:none;padding:8px 14px;border-radius:999px;color:#fff;cursor:pointer;transition:all .2s ease;text-decoration:none;font-weight:700}`,
    `.nav-pill:hover{background:rgba(255,255,255,.15);transform:translateY(-1px)}`,
    `.nav-pill.active{background:#ef4444}`,
    `.theme-btn{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);padding:8px 10px;border-radius:10px;color:#fff;cursor:pointer}`,
    `.cart-box{border:1px solid rgba(255,255,255,.2);padding:8px 14px;border-radius:12px;font-size:14px;color:#fff;text-decoration:none;min-width:130px;text-align:center}`,
    `.cart-box span{display:block;font-weight:700}`,
    `.admin-row{display:flex;gap:10px;padding:0 0 10px;flex-wrap:wrap}`,
    `.main{padding:1rem 0 2.5rem}`,
    `@media (max-width:1200px){.logo{font-size:34px}.nav-container{flex-wrap:wrap}.nav-center{order:-1;width:100%}.nav-left{display:none}.nav-right{justify-content:center;width:100%}}`
  ]
})
export class AppComponent {
  private readonly document = inject(DOCUMENT);
  readonly theme = signal<ThemeMode>('dark');

  constructor(
    public readonly cart: CartService,
    public readonly customerAuth: CustomerAuthService
  ) {
    void this.customerAuth.restoreSession();

    const saved = this.document.defaultView?.localStorage.getItem('theme-mode');
    if (saved === 'light' || saved === 'dark') {
      this.theme.set(saved);
    }

    this.applyTheme(this.theme());
  }

  toggleTheme(): void {
    const next = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(next);
    this.applyTheme(next);
    this.document.defaultView?.localStorage.setItem('theme-mode', next);
  }

  logoutCustomer(): void {
    this.customerAuth.logout();
  }

  isAdmin(): boolean {
    return this.customerAuth.profile()?.role === 'admin';
  }

  private applyTheme(theme: ThemeMode): void {
    this.document.documentElement.setAttribute('data-theme', theme);
  }
}
