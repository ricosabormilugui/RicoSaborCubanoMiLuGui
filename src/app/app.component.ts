import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { CartService } from './core/services/cart.service';
import { CustomerAuthService } from './core/services/customer-auth.service';
import { NotificationService } from './core/services/notification.service';
import { CatalogService } from './core/services/catalog.service';
import { DeliveryStateService } from './core/services/delivery-state.service';
import { NotificationsComponent } from './shared/ui/notifications.component';
import { matchesProductSearch } from './core/models/product-filter';
import { Product } from './core/models/product.model';
import { ThemeService } from './core/services/theme.service';
import { NewsletterService } from './core/services/newsletter.service';
import { LEGAL_NAV_LINKS } from './core/config/legal-links.config';
import { CookieConsentService } from './core/services/cookie-consent.service';
import { CookieBannerComponent } from './shared/ui/cookie-banner.component';
import { IconComponent } from './shared/ui/icon.component';
import { getProductCategoryLabel } from './core/config/product-categories.config';
import { SeoService } from './core/services/seo.service';
import { buildWhatsAppContactUrl } from './core/config/whatsapp.config';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, NotificationsComponent, CookieBannerComponent, IconComponent],
  animations: [
    trigger('fade', [
      transition('* <=> *', [
        style({ opacity: 0 }),
        animate('200ms ease', style({ opacity: 1 }))
      ])
    ])
  ],
  template: `
    <div class="app-shell">
      <div class="top-banner">
        <app-icon name="gift" [size]="16" />
        <span>Regalo sorpresa en tu primer pedido</span>
      </div>

      <header class="navbar">
        <div class="container nav-grid">
          <div class="nav-left">
            <button class="icon-btn" type="button" (click)="toggleMenu()" aria-label="Abrir menú">
              <app-icon name="menu" />
            </button>
          </div>

          <a class="nav-center" routerLink="/">
            <div class="logo">Rico Sabor Cubano</div>
          </a>

          <div class="nav-right">
            <button class="icon-btn mobile-only" type="button" (click)="openSearch()" aria-label="Buscar">
              <app-icon name="search" />
            </button>

            <button class="cart-box" type="button" (click)="openCart()" aria-label="Carrito">
              <app-icon name="cart" />
              <span class="badge" *ngIf="cart.totalItems()">{{ cart.totalItems() }}</span>
            </button>

            <div class="desktop-only">
              <button class="icon-btn" type="button" (click)="openSearch()" aria-label="Buscar">
                <app-icon name="search" />
              </button>

              <button class="icon-btn" type="button" (click)="openCalendar()" aria-label="Elegir fecha de entrega">
                <app-icon name="calendar" />
                <span *ngIf="deliveryState.date()" class="badge-date">{{ deliveryState.date() | date:'dd/MM' }}</span>
              </button>

              <button class="icon-btn" type="button" (click)="openContact()" aria-label="Contacto">
                <app-icon name="phone" />
              </button>

              <div class="user-menu">
                <button class="icon-btn" type="button" (click)="toggleUserMenu()" aria-label="Cuenta">
                  <app-icon name="user" />
                </button>

                <div class="dropdown" *ngIf="userMenuOpen()">
                  <ng-container *ngIf="!customerAuth.isAuthenticated(); else loggedMenu">
                    <button type="button" (click)="goLogin()">Iniciar sesión</button>
                    <button type="button" (click)="goRegister()">Registro</button>
                  </ng-container>

                  <ng-template #loggedMenu>
                    <button type="button" (click)="goOrders()">Mis pedidos</button>
                    <button type="button" (click)="logoutCustomer()">Salir</button>
                  </ng-template>
                </div>
              </div>

              <button class="theme-btn" type="button" (click)="toggleTheme()" [attr.aria-label]="theme() === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'">
                <app-icon [name]="theme() === 'dark' ? 'sun' : 'moon'" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <aside class="side-menu" [class.open]="menuOpen()">
        <div class="menu-header">
          <app-icon name="user" [size]="18" />
          <span>{{ customerAuth.profile()?.email ?? 'Invitado' }}</span>
        </div>

        <a routerLink="/" (click)="closeMenu()">Inicio</a>
        <a routerLink="/productos" (click)="closeMenu()">Productos</a>
        <a routerLink="/checkout" (click)="closeMenu()">Checkout</a>
        <a routerLink="/mis-pedidos" (click)="closeMenu()" *ngIf="customerAuth.isAuthenticated()">Mis pedidos</a>
        <button type="button" class="menu-action" (click)="openCalendar()">Elegir fecha</button>
        <button type="button" class="menu-action" (click)="openContact()">Contacto</button>

        <button
          type="button"
          class="menu-action menu-theme-action"
          (click)="toggleTheme()"
          [attr.aria-label]="theme() === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'">
          <app-icon [name]="theme() === 'dark' ? 'sun' : 'moon'" [size]="18" />
          <span>{{ theme() === 'dark' ? 'Modo claro' : 'Modo oscuro' }}</span>
        </button>

        <ng-container *ngIf="!customerAuth.isAuthenticated(); else accountLinks">
          <a routerLink="/login" (click)="closeMenu()">Iniciar sesión</a>
          <a routerLink="/registro" (click)="closeMenu()">Registro</a>
        </ng-container>
        <ng-template #accountLinks>
          <button type="button" class="menu-action" (click)="logoutCustomer()">Salir cliente</button>
        </ng-template>

        <div class="menu-divider" *ngIf="isAdmin()"></div>
        <a routerLink="/admin/dashboard" (click)="closeMenu()" *ngIf="isAdmin()">Admin dashboard</a>
        <a routerLink="/admin/pedidos" (click)="closeMenu()" *ngIf="isAdmin()">Admin pedidos</a>
        <a routerLink="/admin/cocina" (click)="closeMenu()" *ngIf="isAdmin()">Panel cocina</a>
        <a routerLink="/admin/contactos" (click)="closeMenu()" *ngIf="isAdmin()">Admin contactos</a>
        <a routerLink="/admin/clientes" (click)="closeMenu()" *ngIf="isAdmin()">Admin clientes</a>
        <a routerLink="/admin/productos" (click)="closeMenu()" *ngIf="isAdmin()">Admin productos</a>
        <a routerLink="/admin/portada" (click)="closeMenu()" *ngIf="isAdmin()">Admin portada</a>
      </aside>

      <div class="overlay" *ngIf="menuOpen()" (click)="closeMenu()"></div>

      <section class="search-modal" *ngIf="searchOpen()">
        <div class="search-card card">
          <div class="search-head">
            <h3>Buscar productos</h3>
            <button class="icon-btn" type="button" (click)="toggleSearch()" aria-label="Cerrar búsqueda">
              <app-icon name="close" [size]="20" />
            </button>
          </div>
          <input [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)" (keydown.enter)="openCatalogFromSearch()" placeholder="Ej. croquetas, combo..." aria-label="Buscar productos" />
          <button class="search-submit" type="button" (click)="openCatalogFromSearch()">Buscar productos</button>
          <div class="result" *ngFor="let item of searchResults()" (click)="openCatalogFromSearch(item)">
            <strong>{{ item.name }}</strong>
            <span>{{ categoryLabel(item.category) }}</span>
          </div>
          <div class="no-results" *ngIf="searchQuery().trim() && !searchResults().length">No se encontraron productos.</div>
        </div>
        <div class="overlay" (click)="toggleSearch()"></div>
      </section>

      <main class="page-content" [class.is-flush]="isHome()">
        <div class="container main-layout" [class.is-flush]="isHome()">
          <div class="route-fade" [@fade]="currentRoute()">
            <router-outlet />
          </div>
        </div>
      </main>

      <footer class="site-footer">
        <div class="container footer-grid">
          <div>
            <p class="eyebrow">Newsletter</p>
            <h2>10% descuento en tu primer pedido</h2>
            <p class="footer-copy">Suscríbete para recibir promociones de Rico Sabor Cubano. Guardaremos tu consentimiento y evitaremos duplicados por email.</p>
          </div>

          <form class="newsletter-form" (ngSubmit)="submitNewsletter()">
            <label>
              Email
              <input
                name="newsletterEmail"
                type="email"
                autocomplete="email"
                required
                [ngModel]="newsletterEmail()"
                (ngModelChange)="newsletterEmail.set($event)"
                placeholder="tu@email.com" />
            </label>
            <label class="newsletter-consent">
              <input
                name="newsletterConsent"
                type="checkbox"
                required
                [ngModel]="newsletterConsent()"
                (ngModelChange)="newsletterConsent.set($event)" />
              <span>Acepto recibir promociones y comunicaciones comerciales. He leído la <a routerLink="/legal/privacidad">política de privacidad</a> y podré solicitar la baja en cualquier momento.</span>
            </label>
            <button class="btn btn-primary" type="submit" [disabled]="newsletterLoading()">
              {{ newsletterLoading() ? 'Guardando...' : 'Activar cupón' }}
              <app-icon *ngIf="!newsletterLoading()" name="arrow" [size]="16" />
            </button>
            <p class="ok" *ngIf="newsletterNotice()">{{ newsletterNotice() }}</p>
            <p class="err" *ngIf="newsletterError()">{{ newsletterError() }}</p>
          </form>
        </div>

        <nav class="legal-footer" aria-label="Enlaces legales">
          <a *ngFor="let link of legalLinks" [routerLink]="['/legal', link.slug]">{{ link.title }}</a>
          <button type="button" (click)="resetCookieConsent()">Configurar cookies</button>
        </nav>
      </footer>

      <a
        class="whatsapp-float"
        *ngIf="showWhatsAppFloat()"
        [href]="whatsappUrl"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Escribir por WhatsApp">
        <app-icon name="whatsapp" [size]="26" />
      </a>

      <app-cookie-banner />
      <app-notifications />
    </div>
  `,
  styles: [
    `.top-banner{display:flex;align-items:center;justify-content:center;gap:8px;background:var(--accent-red);text-align:center;padding:6px 12px;font-size:14px;color:var(--on-accent);font-weight:700}`,
    `.app-shell{width:100%;min-height:100vh;display:flex;flex-direction:column}`,
    `.navbar{display:flex;align-items:center;justify-content:space-between;padding:10px 0;width:100%;max-width:100%;min-width:0;overflow-x:clip;backdrop-filter:blur(10px);background:color-mix(in srgb, var(--surface-0) 88%, var(--bg-main) 12%);position:sticky;top:0;z-index:50;border-bottom:1px solid color-mix(in srgb, var(--border-soft) 80%, transparent)}`,
    `.nav-grid{display:flex;align-items:center;justify-content:space-between;gap:clamp(6px,2vw,10px);min-width:0;max-width:100%}`,
    `.nav-left,.nav-right{display:flex;align-items:center;gap:6px;min-width:0;flex:0 0 auto}`,
    `.nav-right{justify-content:flex-end}`,
    `.nav-center{text-align:center;flex:1 1 auto;min-width:0;text-decoration:none;color:var(--text-main);overflow:hidden}`,
    `.logo{font-size:clamp(15px,4.4vw,18px);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`,
    `.icon-btn{background:transparent;border:none;color:var(--text-main);cursor:pointer;transition:.2s;border-radius:10px;width:34px;height:34px;display:inline-grid;place-items:center;position:relative}`,
    `.icon-btn:hover{transform:scale(1.12);background:var(--hover-surface)}`,
    `.cart-box{position:relative;width:34px;height:34px;padding:0;display:inline-grid;place-items:center;border-radius:10px;border:1px solid color-mix(in srgb, var(--border-soft) 85%, transparent);background:transparent;color:var(--text-main);cursor:pointer}`,
    `.badge{position:absolute;top:-5px;right:-5px;background:var(--accent-red);border-radius:50%;font-size:10px;padding:2px 5px;color:var(--on-accent)}`,
    `.badge-date{position:absolute;bottom:-4px;right:-7px;font-size:10px;background:var(--ok-active-bg);color:var(--ok-active-text);border-radius:6px;padding:2px 4px}`,
    `.desktop-only{display:none}`,
    `.mobile-only{display:inline-flex}`,
    `.theme-btn{width:34px;height:34px;padding:0;display:inline-grid;place-items:center;background:color-mix(in srgb, var(--surface-2) 80%, transparent);border:1px solid color-mix(in srgb, var(--border-soft) 75%, transparent);color:var(--text-main);border-radius:10px;cursor:pointer}`,
    `.user-menu{position:relative}`,
    `.dropdown{position:absolute;right:0;top:38px;display:grid;gap:4px;background:var(--surface-0);border:1px solid color-mix(in srgb, var(--border-soft) 75%, transparent);border-radius:10px;padding:8px;min-width:150px;z-index:60;animation:fadeIn .2s ease}`,
    `.dropdown button{background:color-mix(in srgb, var(--surface-2) 40%, transparent);border:0;color:var(--text-main);padding:8px;border-radius:8px;text-align:left;cursor:pointer}`,
    `.dropdown button:hover{background:color-mix(in srgb, var(--surface-2) 70%, transparent)}`,
    `.side-menu{position:fixed;left:0;top:0;width:min(280px,calc(100vw - 24px));max-width:100%;height:100%;background:var(--surface-0);transition:.3s;z-index:100;padding:20px;display:grid;align-content:start;gap:10px;transform:translateX(-100%);overflow-y:auto;overflow-x:hidden}`,
    `.side-menu.open{transform:translateX(0)}`,
    `.menu-header{display:flex;align-items:center;gap:8px;color:var(--text-main);background:color-mix(in srgb, var(--surface-2) 55%, transparent);padding:10px 12px;border-radius:10px;min-width:0}`,
    `.menu-header span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}`,
    `.side-menu a,.menu-action{color:var(--text-main);text-decoration:none;background:color-mix(in srgb, var(--surface-2) 40%, transparent);padding:10px 12px;border-radius:10px;border:0;text-align:left;cursor:pointer;min-width:0;max-width:100%;overflow-wrap:anywhere}`,
    `.side-menu a:hover,.menu-action:hover{background:color-mix(in srgb, var(--surface-2) 70%, transparent)}`,
    `.menu-theme-action{display:flex;align-items:center;justify-content:space-between;gap:.75rem}`,
    `.menu-divider{height:1px;background:color-mix(in srgb, var(--border-soft) 85%, transparent);margin:4px 0}`,
    `.overlay{position:fixed;inset:0;background:var(--overlay-bg);z-index:90}`,
    `.search-modal{position:fixed;inset:0;z-index:95;display:grid;place-items:flex-start center;padding-top:80px}`,
    `.search-card{z-index:96;width:min(640px,92vw);display:grid;gap:.6rem}`,
    `.search-head{display:flex;justify-content:space-between;align-items:center}`,
    `.search-head h3{margin:0}`,
    `.search-head .icon-btn{color:var(--text-main)}`,
    `.search-submit{justify-self:start;border:1px solid var(--border-soft);background:var(--surface-2);color:var(--text-main);border-radius:10px;padding:.5rem .8rem;font-weight:700;cursor:pointer}`,
    `.result{display:grid;gap:2px;padding:.6rem .7rem;border-radius:8px;background:var(--surface-1);cursor:pointer;color:var(--text-main)}`,
    `.result span{color:var(--text-soft);font-size:.85rem}`,
    `.result:hover,.result:focus-visible{background:var(--surface-2)}`,
    `.no-results{padding:.7rem;color:var(--text-soft);font-weight:700}`,
    `.page-content{width:100%;max-width:none;margin:0;padding:clamp(16px,4vw,40px) 0;flex:1}`,
    `.page-content.is-flush{padding:0}`,
    `.container.is-flush{max-width:none;padding:0}`,
    `.main-layout{width:100%;min-height:calc(100vh - 150px)}`,
    `.whatsapp-float{position:fixed;right:18px;bottom:18px;z-index:70;width:56px;height:56px;display:grid;place-items:center;border-radius:50%;background:#25d366;color:#fff;box-shadow:0 10px 24px rgba(0,0,0,.28);transition:transform .16s ease,filter .16s ease}`,
    `.whatsapp-float:hover,.whatsapp-float:focus-visible{transform:translateY(-2px);filter:brightness(1.06);outline:3px solid color-mix(in srgb,var(--accent-green) 50%,transparent);outline-offset:3px}`,
    `.site-footer{border-top:1px solid var(--border-soft);background:color-mix(in srgb,var(--surface-0) 88%,var(--bg-main) 12%);padding:clamp(20px,4vw,36px) 0}`,
    `.footer-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,460px);gap:1rem;align-items:start}`,
    `.site-footer h2{margin:.2rem 0 .45rem;color:var(--text-main)}`,
    `.footer-copy{margin:0;color:var(--text-soft);line-height:1.5}`,
    `.newsletter-form{display:grid;gap:.65rem;background:var(--surface-1);border:1px solid var(--border-soft);border-radius:16px;padding:1rem;color:var(--text-main)}`,
    `.newsletter-form label{display:grid;gap:.35rem;font-weight:800}`,
    `.newsletter-form input[type="email"]{border:1px solid var(--border-soft);border-radius:12px;padding:.72rem;background:var(--surface-0);color:var(--text-main)}`,
    `.newsletter-consent{display:flex!important;align-items:flex-start;gap:.55rem;color:var(--text-soft);font-weight:700!important}`,
    `.newsletter-consent input{margin-top:.18rem;width:18px;height:18px}`,
    `.newsletter-consent a{color:var(--accent-green);font-weight:900}`,
    `.legal-footer{display:flex;gap:.55rem;justify-content:center;flex-wrap:wrap;margin-top:1rem}`,
    `.legal-footer a,.legal-footer button{border:0;background:transparent;color:var(--text-soft);text-decoration:underline;cursor:pointer;font-weight:800}`,
    `.legal-footer a:hover,.legal-footer a:focus-visible,.legal-footer button:hover,.legal-footer button:focus-visible{color:var(--accent-green);outline:2px solid color-mix(in srgb,var(--accent-green) 35%,transparent);outline-offset:3px;border-radius:6px}`,
    `.ok{color:var(--ok-text);margin:.1rem 0 0}`,
    `.err{color:var(--error-text);margin:.1rem 0 0}`,
    `@media (max-width:760px){.footer-grid{grid-template-columns:1fr}}`,
    `@media (min-width:768px){.desktop-only{display:flex;gap:8px}.mobile-only{display:none}.logo{font-size:24px}}`
  ]
})
export class AppComponent {
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly themeService = inject(ThemeService);

  readonly theme = this.themeService.mode;
  readonly menuOpen = signal(false);
  readonly userMenuOpen = signal(false);
  readonly searchOpen = signal(false);
  readonly searchQuery = signal('');
  readonly newsletterEmail = signal('');
  readonly newsletterConsent = signal(false);
  readonly newsletterLoading = signal(false);
  readonly newsletterNotice = signal('');
  readonly newsletterError = signal('');
  readonly legalLinks = LEGAL_NAV_LINKS;
  readonly whatsappUrl = buildWhatsAppContactUrl();

  readonly searchResults = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) return this.catalog.products().slice(0, 6);
    return this.catalog.products().filter((item) => matchesProductSearch(item, query)).slice(0, 6);
  });

  categoryLabel(value: string | null | undefined): string {
    return getProductCategoryLabel(value);
  }

  constructor(
    public readonly cart: CartService,
    public readonly customerAuth: CustomerAuthService,
    private readonly catalog: CatalogService,
    readonly deliveryState: DeliveryStateService,
    private readonly newsletterService: NewsletterService,
    private readonly cookieConsent: CookieConsentService,
    private readonly seo: SeoService
  ) {
    this.seo.setOrganizationAndWebsiteSchema();
    void this.customerAuth.restoreSession();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as Node | null;
    if (!target) return;
    if (!this.host.nativeElement.contains(target)) {
      this.userMenuOpen.set(false);
    }
  }

  async submitNewsletter(): Promise<void> {
    const email = this.newsletterEmail().trim().toLowerCase();
    this.newsletterNotice.set('');
    this.newsletterError.set('');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.newsletterError.set('Introduce un email válido.');
      return;
    }

    if (!this.newsletterConsent()) {
      this.newsletterError.set('Debes aceptar la política de privacidad para recibir promociones.');
      return;
    }

    this.newsletterLoading.set(true);

    try {
      const result = await this.newsletterService.subscribe(email, true);
      const message = result.duplicated
        ? 'Este email ya estaba suscrito. Mantienes tu cupón si aplica.'
        : 'Suscripción guardada. Cupón registrado para validación manual.';
      this.newsletterNotice.set(message);
      this.notifications.success('Newsletter', message);
      this.newsletterEmail.set('');
      this.newsletterConsent.set(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible registrar la suscripción.';
      this.newsletterError.set(message);
      this.notifications.error('Newsletter', message);
    } finally {
      this.newsletterLoading.set(false);
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

  openSearch(): void {
    this.toggleSearch();
  }

  toggleUserMenu(): void {
    this.userMenuOpen.set(!this.userMenuOpen());
    this.menuOpen.set(false);
  }

  toggleSearch(): void {
    const nextOpen = !this.searchOpen();
    if (nextOpen) {
      void this.catalog.loadProducts();
    }
    this.searchOpen.set(nextOpen);
    this.menuOpen.set(false);
    this.userMenuOpen.set(false);
    if (!this.searchOpen()) this.searchQuery.set('');
  }

  openCatalogFromSearch(product?: Product): void {
    const query = product?.name ?? this.searchQuery().trim();
    this.searchOpen.set(false);
    this.searchQuery.set('');
    void this.router.navigate(['/productos'], { queryParams: query ? { q: query } : {} });
  }

  openCart(): void {
    this.closeMenu();
    void this.router.navigateByUrl('/carrito');
  }

  goLogin(): void {
    this.userMenuOpen.set(false);
    this.closeMenu();
    void this.router.navigateByUrl('/login');
  }

  goRegister(): void {
    this.userMenuOpen.set(false);
    this.closeMenu();
    void this.router.navigateByUrl('/registro');
  }

  goOrders(): void {
    this.userMenuOpen.set(false);
    this.closeMenu();
    void this.router.navigateByUrl('/mis-pedidos');
  }

  openCalendar(): void {
    this.closeMenu();
    void this.router.navigateByUrl('/checkout');
  }

  openContact(): void {
    this.closeMenu();
    void this.router.navigateByUrl('/contacto');
  }

  resetCookieConsent(): void {
    this.cookieConsent.reset();
    this.notifications.info('Cookies', 'Puedes volver a configurar tus preferencias.');
  }

  toggleTheme(): void {
    this.themeService.toggle();
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

  isHome(): boolean {
    return this.router.url.split('?')[0] === '/';
  }

  showWhatsAppFloat(): boolean {
    return !this.router.url.startsWith('/admin');
  }

  currentRoute(): string {
    return this.router.url;
  }

}
