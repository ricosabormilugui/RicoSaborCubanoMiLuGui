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
    <header class="header">
      <div class="container nav-shell">
        <div class="left-zone">
          <button class="icon-btn" type="button" aria-label="Menú">☰</button>
          <a routerLink="/" class="mini-link">Tuppers</a>
          <a routerLink="/" class="mini-link">Keto</a>
          <a routerLink="/" class="mini-link">Veganos</a>
        </div>

        <a class="brand" routerLink="/">
          <strong>RicoSabor</strong>
          <span>Cubano · Mi Lu Gui</span>
        </a>

        <div class="right-zone">
          <a class="icon-link" routerLink="/" aria-label="Buscar">⌕</a>
          <a class="icon-link" routerLink="/contacto" aria-label="Contacto">☎</a>
          <a class="icon-link" routerLink="/mis-pedidos" aria-label="Pedidos">🗓</a>
          <a class="icon-link" routerLink="/login" aria-label="Cuenta">👤</a>

          <button class="theme-toggle" type="button" (click)="toggleTheme()">
            {{ theme() === 'dark' ? '☀️' : '🌙' }}
          </button>

          <a class="cart-chip" routerLink="/carrito">
            <span>{{ cart.totalItems() }} productos</span>
          </a>
        </div>
      </div>

      <div class="container routes-nav">
        <a class="nav-pill" routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Catálogo</a>
        <a class="nav-pill" routerLink="/checkout" routerLinkActive="active">Checkout</a>
        <a class="nav-pill" routerLink="/contacto" routerLinkActive="active">Contacto</a>
        <a class="nav-pill" routerLink="/login" routerLinkActive="active" *ngIf="!customerAuth.isAuthenticated()">Entrar</a>
        <a class="nav-pill" routerLink="/registro" routerLinkActive="active" *ngIf="!customerAuth.isAuthenticated()">Registro</a>
        <a class="nav-pill" routerLink="/mis-pedidos" routerLinkActive="active" *ngIf="customerAuth.isAuthenticated()">Mis pedidos</a>
        <button class="nav-pill" type="button" *ngIf="customerAuth.isAuthenticated()" (click)="logoutCustomer()">Salir cliente</button>
        <a class="nav-pill" routerLink="/admin/pedidos" routerLinkActive="active" *ngIf="isAdmin()">Admin pedidos</a>
        <a class="nav-pill" routerLink="/admin/cocina" routerLinkActive="active" *ngIf="isAdmin()">Panel cocina</a>
        <a class="nav-pill" routerLink="/admin/contactos" routerLinkActive="active" *ngIf="isAdmin()">Admin contactos</a>
        <a class="nav-pill" routerLink="/admin/productos" routerLinkActive="active" *ngIf="isAdmin()">Admin productos</a>
      </div>
    </header>

    <main class="container main">
      <router-outlet />
    </main>

    <app-notifications />
  `,
  styles: [
    `.header{position:sticky;top:0;background:#1d1c2b;border-bottom:1px solid #2f2d42;z-index:15}`,
    `.nav-shell{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;min-height:84px;gap:1rem}`,
    `.left-zone,.right-zone{display:flex;align-items:center;gap:.9rem}`,
    `.right-zone{justify-content:flex-end}`,
    `.mini-link{text-decoration:none;color:#f3f3f8;font-weight:700;font-size:1.02rem}`,
    `.mini-link:hover{color:var(--accent-red)}`,
    `.brand{text-decoration:none;display:flex;flex-direction:column;align-items:center;line-height:1.05}`,
    `.brand strong{font-family:Georgia,'Times New Roman',serif;font-size:2.05rem;color:#fff;letter-spacing:.3px}`,
    `.brand span{font-size:.82rem;color:#d8d8e6}`,
    `.icon-btn,.icon-link{border:0;background:transparent;color:#fff;font-size:1.6rem;line-height:1;cursor:pointer;text-decoration:none}`,
    `.icon-btn{padding:.15rem .35rem}`,
    `.theme-toggle{border:1px solid #4d4a66;background:#242338;color:#fff;border-radius:8px;padding:.35rem .55rem;cursor:pointer}`,
    `.cart-chip{border:1px solid #f2f2f5;border-radius:8px;padding:.45rem .75rem;text-decoration:none;color:#fff;font-weight:700;background:transparent;min-width:122px;text-align:center}`,
    `.routes-nav{display:flex;flex-wrap:wrap;gap:.5rem;padding:0 0 .7rem}`,
    `.nav-pill{padding:.42rem .8rem;border-radius:999px;text-decoration:none;color:#eef0ff;background:#31304b;font-weight:700;border:1px solid transparent;cursor:pointer}`,
    `.nav-pill.active{background:var(--accent-red);color:#fff}`,
    `.main{padding:1rem 0 2.5rem}`,
    `@media (max-width:1050px){.nav-shell{grid-template-columns:1fr}.left-zone,.right-zone{justify-content:center}.brand{order:-1}}`
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
