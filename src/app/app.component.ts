import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CartService } from './core/services/cart.service';
import { CustomerAuthService } from './core/services/customer-auth.service';

type ThemeMode = 'dark' | 'light';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="promo-strip">Regalo sorpresa en tu primer pedido</div>

    <header class="header">
      <div class="container nav-wrap">
        <div class="left-links">
          <a routerLink="/" class="mini-link">Tuppers</a>
          <a routerLink="/" class="mini-link">Keto</a>
          <a routerLink="/" class="mini-link">Veganos</a>
        </div>

        <a class="brand" routerLink="/">
          <strong>RicoSabor</strong>
          <span>Cubano · Mi Lu Gui</span>
        </a>

        <div class="actions">
          <button class="theme-toggle" type="button" (click)="toggleTheme()">
            {{ theme() === 'dark' ? '☀️ Light' : '🌙 Dark' }}
          </button>
          <a class="cart-chip" routerLink="/carrito">{{ cart.totalItems() }} productos</a>
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
  `,
  styles: [
    `.promo-strip{height:32px;display:grid;place-items:center;background:var(--accent-red);color:#fff;font-weight:700;letter-spacing:.2px}`,
    `.header{position:sticky;top:0;background:color-mix(in srgb, var(--surface-0) 92%, transparent);backdrop-filter:blur(9px);border-bottom:1px solid var(--border-soft);z-index:15}`,
    `.nav-wrap{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:.65rem 0;gap:.8rem}`,
    `.left-links{display:flex;gap:1rem;align-items:center}`,
    `.mini-link{text-decoration:none;color:var(--text-soft);font-weight:600;font-size:.95rem}`,
    `.mini-link:hover{color:var(--text-main)}`,
    `.brand{display:flex;flex-direction:column;line-height:1.08;text-decoration:none;align-items:center}`,
    `.brand strong{font-size:2rem;color:var(--text-main);letter-spacing:.3px}`,
    `.brand span{font-size:.86rem;color:var(--text-soft)}`,
    `.actions{display:flex;justify-content:flex-end;gap:.55rem;align-items:center}`,
    `.theme-toggle,.cart-chip{border:1px solid var(--border-soft);background:var(--surface-1);color:var(--text-main);border-radius:10px;padding:.45rem .75rem;text-decoration:none;font-weight:700}`,
    `.theme-toggle{cursor:pointer}`,
    `.routes-nav{display:flex;flex-wrap:wrap;gap:.5rem;padding:0 0 .75rem}`,
    `.nav-pill{padding:.42rem .8rem;border-radius:999px;text-decoration:none;color:var(--text-main);background:var(--surface-2);font-weight:700;border:1px solid transparent;cursor:pointer}`,
    `.nav-pill.active{background:var(--accent-red);color:#fff}`,
    `.main{padding:1rem 0 2.5rem}`,
    `@media (max-width:950px){.nav-wrap{grid-template-columns:1fr}.left-links,.actions{justify-content:center}.brand{order:-1}}`
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
