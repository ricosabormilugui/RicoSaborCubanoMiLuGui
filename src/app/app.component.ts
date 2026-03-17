import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, ElementRef, HostListener, computed, effect, inject, signal } from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { CartService } from './core/services/cart.service';
import { CustomerAuthService } from './core/services/customer-auth.service';
import { NotificationService } from './core/services/notification.service';
import { CatalogService } from './core/services/catalog.service';
import { NotificationsComponent } from './shared/ui/notifications.component';

type ThemeMode = 'dark' | 'light';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, NotificationsComponent],
  template: `
    <div class="app-shell">
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
          <button class="icon-btn" type="button" (click)="toggleSearch()" aria-label="Buscar">🔍</button>

          <button class="icon-btn" type="button" (click)="openCalendar()" aria-label="Elegir fecha de entrega">
            📅
            <span *ngIf="deliveryDate()" class="badge-date">{{ deliveryDate() | date:'dd/MM' }}</span>
          </button>

          <button class="icon-btn" type="button" (click)="openWhatsApp()" aria-label="Contacto WhatsApp">📞</button>

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

          <a class="cart-box" [class.bump]="cartBump()" routerLink="/carrito">
            🛒 {{ cart.totalItems() }} · {{ cart.subtotal() | currency:'EUR' }}
          </a>
        </div>
      </div>
      </header>

      <aside class="side-menu" [class.open]="menuOpen()">
      <div class="menu-user">👤 {{ customerAuth.profile()?.email ?? 'Invitado' }}</div>

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

      <section class="search-modal" *ngIf="searchOpen()">
      <div class="search-card card">
        <div class="search-head">
          <h3>Buscar productos</h3>
          <button type="button" (click)="toggleSearch()">✕</button>
        </div>
        <input [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)" placeholder="Ej. croquetas, combo..." />
        <div class="result" *ngFor="let item of searchResults()" (click)="openCatalogFromSearch()">
          {{ item.name }}
        </div>
      </div>
      <div class="overlay" (click)="toggleSearch()"></div>
      </section>

      <main class="page-content">
        <div class="container main-layout">
          <div class="route-fade" [@fade]="currentRoute()">
            <router-outlet />
          </div>
        </div>
      </main>

      <app-notifications />
    </div>
  `,
  animations: [
    trigger('fade', [
      transition('* <=> *', [
        style({ opacity: 0 }),
        animate('200ms ease', style({ opacity: 1 }))
      ])
    ])
  ],
  styles: [
    `.top-banner{background:#ef4444;text-align:center;padding:6px;font-size:14px;color:#fff;font-weight:700}`,
    `.app-shell{width:100%;min-height:100vh;display:flex;flex-direction:column}`,
    `.navbar{width:100%;padding:12px 0;background:rgba(20,20,30,.9);backdrop-filter:blur(10px);position:sticky;top:0;z-index:50;border-bottom:1px solid rgba(255,255,255,.05)}`,
    `.nav-grid{display:flex;align-items:center;justify-content:space-between;gap:1rem}`,
    `.nav-left,.nav-right{flex:1;display:flex;align-items:center;gap:8px}`,
    `.nav-center{flex:1;text-align:center;text-decoration:none;color:#fff}`,
    `.logo{font-size:clamp(20px,2.5vw,28px);font-weight:800;font-family:Georgia,'Times New Roman',serif;line-height:1}`,
    `.subtitle{font-size:12px;opacity:.7}`,
    `.nav-right{display:flex;align-items:center;justify-content:flex-end;gap:8px}`,
    `.icon-btn{background:transparent;border:none;color:#fff;font-size:18px;cursor:pointer;transition:.2s;text-decoration:none;display:inline-grid;place-items:center;width:36px;height:36px;border-radius:10px;position:relative}`,
    `.icon-btn:hover{transform:scale(1.1);background:rgba(255,255,255,.06)}`,
    `.badge-date{position:absolute;bottom:-4px;right:-7px;font-size:10px;background:#22c55e;color:#fff;border-radius:6px;padding:2px 4px}`,
    `.theme-btn{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);color:#fff;border-radius:10px;padding:6px 9px;cursor:pointer}`,
    `.cart-box{border:1px solid rgba(255,255,255,.2);padding:6px 10px;border-radius:10px;color:#fff;text-decoration:none;white-space:nowrap;transition:all .2s ease}`,
    `.cart-box:hover{transform:scale(1.05);box-shadow:0 4px 12px rgba(0,0,0,.3)}`,
    `.cart-box.bump{animation:cartBump .28s ease}`,
    `@keyframes cartBump{50%{transform:scale(1.08)}}`,
    `.user-menu{position:relative}`,
    `.dropdown{position:absolute;right:0;top:38px;display:grid;gap:4px;background:#1a1d28;border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:8px;min-width:150px;z-index:60;animation:fadeIn .2s ease}`,
    `.dropdown button{background:rgba(255,255,255,.06);border:0;color:#fff;padding:8px;border-radius:8px;text-align:left;cursor:pointer}`,
    `.dropdown button:hover{background:rgba(255,255,255,.15)}`,
    `.side-menu{position:fixed;left:0;top:0;width:280px;height:100%;background:#1a1d28;transition:.3s;z-index:100;padding:20px;display:grid;align-content:start;gap:10px;transform:translateX(-100%)}`,
    `.side-menu.open{transform:translateX(0)}`,
    `.menu-user{color:#fff;background:rgba(255,255,255,.08);padding:10px 12px;border-radius:10px;margin-bottom:2px}`,
    `.menu-header{display:flex;justify-content:space-between;align-items:center;color:#fff;margin-bottom:6px}`,
    `.menu-header button{background:none;border:0;color:#fff;font-size:20px;cursor:pointer}`,
    `.side-menu a,.menu-action{color:#fff;text-decoration:none;background:rgba(255,255,255,.08);padding:10px 12px;border-radius:10px;border:0;text-align:left;cursor:pointer}`,
    `.side-menu a:hover,.menu-action:hover{background:rgba(255,255,255,.16)}`,
    `.menu-divider{height:1px;background:rgba(255,255,255,.2);margin:4px 0}`,
    `.overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:90}`,
    `.search-modal{position:fixed;inset:0;z-index:95;display:grid;place-items:flex-start center;padding-top:80px}`,
    `.search-card{z-index:96;width:min(640px,92vw);display:grid;gap:.6rem}`,
    `.search-head{display:flex;justify-content:space-between;align-items:center}`,
    `.search-head h3{margin:0}`,
    `.search-head button{background:none;border:0;color:var(--text-main);font-size:20px;cursor:pointer}`,
    `.result{padding:.6rem .7rem;border-radius:8px;background:var(--surface-1);cursor:pointer}`,
    `.result:hover{background:var(--surface-2)}`,
    `.page-content{width:100%;max-width:1400px;margin:0 auto;padding:clamp(16px,4vw,40px);flex:1}`,
    `.main-layout{width:100%;min-height:calc(100vh - 150px)}`,
    `@media (max-width:1000px){.cart-box{display:none}.nav-right{justify-content:flex-end}}`,
    `@media (max-width:768px){.nav-center .subtitle{display:none}.cart-box{padding:4px 6px;font-size:12px}.icon-btn{font-size:16px}}`
  ]
})
export class AppComponent {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly theme = signal<ThemeMode>('dark');
  readonly menuOpen = signal(false);
  readonly userMenuOpen = signal(false);
  readonly searchOpen = signal(false);
  readonly searchQuery = signal('');
  readonly deliveryDate = signal<Date | null>(null);
  readonly cartBump = signal(false);

  readonly searchResults = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) return this.catalog.products().slice(0, 6);
    return this.catalog.products().filter((item) => item.name.toLowerCase().includes(query)).slice(0, 6);
  });

  constructor(
    public readonly cart: CartService,
    public readonly customerAuth: CustomerAuthService,
    private readonly catalog: CatalogService
  ) {
    void this.customerAuth.restoreSession();
    void this.catalog.loadProducts();

    const saved = this.document.defaultView?.localStorage.getItem('theme-mode');
    if (saved === 'light' || saved === 'dark') {
      this.theme.set(saved);
    }

    this.applyTheme(this.theme());

    let previousItems = this.cart.totalItems();
    effect(() => {
      const currentItems = this.cart.totalItems();
      if (currentItems > previousItems) {
        this.cartBump.set(true);
        globalThis.setTimeout(() => this.cartBump.set(false), 300);
      }
      previousItems = currentItems;
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as Node | null;
    if (!target) return;
    if (!this.host.nativeElement.contains(target)) {
      this.userMenuOpen.set(false);
    }
  }

  toggleMenu(): void {
    this.menuOpen.set(!this.menuOpen());
    this.userMenuOpen.set(false);
    this.searchOpen.set(false);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  toggleUserMenu(): void {
    this.userMenuOpen.set(!this.userMenuOpen());
    this.menuOpen.set(false);
  }

  toggleSearch(): void {
    this.searchOpen.set(!this.searchOpen());
    this.menuOpen.set(false);
    this.userMenuOpen.set(false);
    if (!this.searchOpen()) this.searchQuery.set('');
  }

  openCatalogFromSearch(): void {
    this.searchOpen.set(false);
    this.searchQuery.set('');
    void this.router.navigateByUrl('/');
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
    const selected = globalThis.prompt('Fecha de entrega (YYYY-MM-DD)');
    if (!selected) return;
    const parsed = new Date(selected);
    if (Number.isNaN(parsed.getTime())) {
      this.notifications.warning('Fecha inválida', 'Usa el formato YYYY-MM-DD.');
      return;
    }

    this.deliveryDate.set(parsed);
    this.notifications.success('Fecha guardada', `Entrega estimada: ${parsed.toLocaleDateString()}`);
  }

  openWhatsApp(): void {
    globalThis.open('https://wa.me/34600000000', '_blank', 'noopener,noreferrer');
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

  currentRoute(): string {
    return this.router.url;
  }

  private applyTheme(theme: ThemeMode): void {
    this.document.documentElement.setAttribute('data-theme', theme);
  }
}
