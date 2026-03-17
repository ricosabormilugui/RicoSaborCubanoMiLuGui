import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { CartService } from './core/services/cart.service';
import { CustomerAuthService } from './core/services/customer-auth.service';
import { NotificationService } from './core/services/notification.service';
import { NotificationsComponent } from './shared/ui/notifications.component';

type ThemeMode = 'dark' | 'light';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, NotificationsComponent],
  template: `
    <div class="top-banner">🎁 Regalo sorpresa en tu primer pedido</div>

    <header class="navbar">
      <div class="container nav-grid">
        <div class="nav-left">
          <button class="icon-btn" type="button" (click)="toggleMenu()" aria-label="Abrir menú">☰</button>
        </div>

        <a class="nav-center" routerLink="/">
          <div class="logo">RicoSabor</div>
          <span class="subtitle">Cubano · Mi Lu Gui</span>
        </a>

        <div class="nav-right">
          <a class="icon-btn" routerLink="/" aria-label="Buscar">🔍</a>
          <button class="icon-btn" type="button" (click)="openCalendar()" aria-label="Elegir fecha">📅</button>
          <a class="icon-btn" routerLink="/contacto" aria-label="Contacto">📞</a>

          <div class="user-menu">
            <button class="icon-btn" type="button" (click)="toggleUserMenu()" aria-label="Cuenta">👤</button>

            <div class="dropdown" *ngIf="userMenuOpen()">
              <ng-container *ngIf="!customerAuth.isAuthenticated(); else loggedMenu">
                <button type="button" (click)="goLogin()">Entrar</button>
                <button type="button" (click)="goRegister()">Registro</button>
              </ng-container>

              <ng-template #loggedMenu>
                <button type="button" (click)="goOrders()">Mis pedidos</button>
                <button type="button" (click)="logoutCustomer()">Salir</button>
              </ng-template>
            </div>
          </div>

          <button class="theme-btn" type="button" (click)="toggleTheme()" [attr.aria-label]="theme() === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'">
            {{ theme() === 'dark' ? '☀️' : '🌙' }}
          </button>

          <a class="cart-box" routerLink="/carrito">
            🛒 {{ cart.totalItems() }} · {{ cart.subtotal() | currency:'EUR' }}
          </a>
        </div>
      </div>
    </header>

    <aside class="side-menu" [class.open]="menuOpen()">
      <div class="menu-header">
        <span>Menú</span>
        <button type="button" (click)="toggleMenu()">✕</button>
      </div>

      <a routerLink="/" (click)="closeMenu()">Catálogo</a>
      <a routerLink="/checkout" (click)="closeMenu()">Checkout</a>
      <a routerLink="/contacto" (click)="closeMenu()">Contacto</a>

      <ng-container *ngIf="!customerAuth.isAuthenticated(); else accountLinks">
        <a routerLink="/login" (click)="closeMenu()">Entrar</a>
        <a routerLink="/registro" (click)="closeMenu()">Registro</a>
      </ng-container>
      <ng-template #accountLinks>
        <a routerLink="/mis-pedidos" (click)="closeMenu()">Mis pedidos</a>
        <button type="button" class="menu-action" (click)="logoutCustomer()">Salir cliente</button>
      </ng-template>

      <div class="menu-divider" *ngIf="isAdmin()"></div>
      <a routerLink="/admin/pedidos" (click)="closeMenu()" *ngIf="isAdmin()">Admin pedidos</a>
      <a routerLink="/admin/cocina" (click)="closeMenu()" *ngIf="isAdmin()">Panel cocina</a>
      <a routerLink="/admin/contactos" (click)="closeMenu()" *ngIf="isAdmin()">Admin contactos</a>
      <a routerLink="/admin/productos" (click)="closeMenu()" *ngIf="isAdmin()">Admin productos</a>
    </aside>

    <div class="overlay" *ngIf="menuOpen()" (click)="closeMenu()"></div>

    <main class="container main">
      <router-outlet />
    </main>

    <app-notifications />
  `,
  styles: [
    `.top-banner{background:#ef4444;text-align:center;padding:6px;font-size:14px;color:#fff;font-weight:700}`,
    `.navbar{display:flex;align-items:center;justify-content:space-between;padding:12px 0;background:rgba(20,20,30,.9);backdrop-filter:blur(10px);position:sticky;top:0;z-index:50;border-bottom:1px solid rgba(255,255,255,.05)}`,
    `.nav-grid{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:1rem}`,
    `.nav-center{text-align:center;text-decoration:none;color:#fff}`,
    `.logo{font-size:34px;font-weight:700;font-family:Georgia,'Times New Roman',serif;line-height:1}`,
    `.subtitle{font-size:12px;opacity:.7}`,
    `.nav-right{display:flex;align-items:center;justify-content:flex-end;gap:8px}`,
    `.icon-btn{background:transparent;border:none;color:#fff;font-size:18px;cursor:pointer;transition:.2s;text-decoration:none;display:inline-grid;place-items:center;width:34px;height:34px}`,
    `.icon-btn:hover{transform:scale(1.15)}`,
    `.theme-btn{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);color:#fff;border-radius:10px;padding:6px 9px;cursor:pointer}`,
    `.cart-box{border:1px solid rgba(255,255,255,.2);padding:6px 10px;border-radius:10px;color:#fff;text-decoration:none;white-space:nowrap}`,
    `.user-menu{position:relative}`,
    `.dropdown{position:absolute;right:0;top:38px;display:grid;gap:4px;background:#1a1d28;border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:8px;min-width:150px;z-index:60}`,
    `.dropdown button{background:rgba(255,255,255,.06);border:0;color:#fff;padding:8px;border-radius:8px;text-align:left;cursor:pointer}`,
    `.dropdown button:hover{background:rgba(255,255,255,.15)}`,
    `.side-menu{position:fixed;left:-280px;top:0;width:280px;height:100%;background:#1a1d28;transition:.3s;z-index:100;padding:20px;display:grid;align-content:start;gap:10px}`,
    `.side-menu.open{left:0}`,
    `.menu-header{display:flex;justify-content:space-between;align-items:center;color:#fff;margin-bottom:6px}`,
    `.menu-header button{background:none;border:0;color:#fff;font-size:20px;cursor:pointer}`,
    `.side-menu a,.menu-action{color:#fff;text-decoration:none;background:rgba(255,255,255,.08);padding:10px 12px;border-radius:10px;border:0;text-align:left;cursor:pointer}`,
    `.side-menu a:hover,.menu-action:hover{background:rgba(255,255,255,.16)}`,
    `.menu-divider{height:1px;background:rgba(255,255,255,.2);margin:4px 0}`,
    `.overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:90}`,
    `.main{padding:1rem 0 2.5rem}`,
    `@media (max-width:1000px){.nav-grid{grid-template-columns:auto 1fr auto}.logo{font-size:28px}.cart-box{display:none}}`
  ]
})
export class AppComponent {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);

  readonly theme = signal<ThemeMode>('dark');
  readonly menuOpen = signal(false);
  readonly userMenuOpen = signal(false);

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

  toggleMenu(): void {
    this.menuOpen.set(!this.menuOpen());
    this.userMenuOpen.set(false);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  toggleUserMenu(): void {
    this.userMenuOpen.set(!this.userMenuOpen());
    this.menuOpen.set(false);
  }

  goLogin(): void {
    this.userMenuOpen.set(false);
    void this.router.navigateByUrl('/login');
  }

  goRegister(): void {
    this.userMenuOpen.set(false);
    void this.router.navigateByUrl('/registro');
  }

  goOrders(): void {
    this.userMenuOpen.set(false);
    void this.router.navigateByUrl('/mis-pedidos');
  }

  openCalendar(): void {
    this.notifications.info('Fecha de entrega', 'Puedes indicarla al crear el pedido en Checkout.');
  }

  toggleTheme(): void {
    const next = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(next);
    this.applyTheme(next);
    this.document.defaultView?.localStorage.setItem('theme-mode', next);
  }

  logoutCustomer(): void {
    this.userMenuOpen.set(false);
    this.closeMenu();
    this.customerAuth.logout();
    this.notifications.info('Sesión cerrada', 'Hasta pronto.');
  }

  isAdmin(): boolean {
    return this.customerAuth.profile()?.role === 'admin';
  }

  private applyTheme(theme: ThemeMode): void {
    this.document.documentElement.setAttribute('data-theme', theme);
  }
}
