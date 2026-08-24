import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, NavigationStart, Router, RouterLink, RouterOutlet } from '@angular/router';
import { CartService } from './core/services/cart.service';
import { CustomerAuthService } from './core/services/customer-auth.service';
import { NotificationService } from './core/services/notification.service';
import { CatalogService } from './core/services/catalog.service';
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
import { ProductCategoryService } from './core/services/product-category.service';
import { SeoMetaInput, SeoService } from './core/services/seo.service';
import { buildWhatsAppContactUrl } from './core/config/whatsapp.config';
import { BRAND_CONFIG, getBrandLogo } from './core/config/brand.config';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, NotificationsComponent, CookieBannerComponent, IconComponent],
  template: `
    <div class="app-shell">
      <div class="top-banner">
        <app-icon name="gift" [size]="16" />
        <span>Regalo sorpresa en tu primer pedido</span>
      </div>

      <header class="navbar">
        <div class="container nav-grid">
          <div class="nav-left">
            <a class="nav-brand" routerLink="/" [attr.aria-label]="brand.name">
              <img
                *ngIf="brandLogoAvailable(); else headerBrandFallback"
                class="brand-logo brand-logo-header"
                [src]="brandLogo()"
                [alt]="brand.name"
                (error)="markBrandLogoUnavailable()" />
              <ng-template #headerBrandFallback><span class="brand-wordmark">{{ brand.name }}</span></ng-template>
            </a>

            <button id="menu-trigger" class="icon-btn" type="button" (click)="toggleMenu()" [attr.aria-expanded]="menuOpen()" aria-controls="site-menu" [attr.aria-label]="menuOpen() ? 'Cerrar menú' : 'Abrir menú'">
              <app-icon name="menu" />
            </button>
          </div>

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

      <aside id="site-menu" class="side-menu" [class.open]="menuOpen()" role="dialog" aria-modal="true" aria-label="Menú principal" [attr.inert]="menuOpen() ? null : ''" [attr.aria-hidden]="!menuOpen()" (keydown)="trapMenuFocus($event)">
        <div class="menu-header">
          <app-icon name="user" [size]="18" />
          <span>{{ customerAuth.profile()?.email ?? 'Invitado' }}</span>
        </div>

        <a routerLink="/" (click)="closeMenu()">Inicio</a>
        <a routerLink="/productos" (click)="closeMenu()">Productos</a>
        <a routerLink="/checkout" (click)="closeMenu()">Checkout</a>
        <a routerLink="/mis-pedidos" (click)="closeMenu()" *ngIf="customerAuth.isAuthenticated()">Mis pedidos</a>
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

      <section class="search-modal" *ngIf="searchOpen()" role="dialog" aria-modal="true" aria-labelledby="app-search-title" (keydown)="trapSearchFocus($event)">
        <div class="search-card card">
          <div class="search-head">
            <h2 id="app-search-title">Buscar productos</h2>
            <button class="icon-btn" type="button" (click)="toggleSearch()" aria-label="Cerrar búsqueda">
              <app-icon name="close" [size]="20" />
            </button>
          </div>
          <input id="app-search-input" [value]="searchQuery()" (input)="updateSearchQuery($event)" (keydown.enter)="openCatalogFromSearch()" placeholder="Ej. croquetas, combo..." aria-label="Buscar productos" />
          <button class="search-submit" type="button" (click)="openCatalogFromSearch()">Buscar productos</button>
          <button class="result" type="button" *ngFor="let item of searchResults(); trackBy: trackProduct" (click)="openCatalogFromSearch(item)">
            <strong>{{ item.name }}</strong>
            <span>{{ categoryLabel(item.category) }}</span>
          </button>
          <div class="no-results" *ngIf="searchQuery().trim() && !searchResults().length">No se encontraron productos.</div>
        </div>
        <button class="overlay" type="button" tabindex="-1" aria-label="Cerrar búsqueda" (click)="toggleSearch()"></button>
      </section>

      <main class="page-content" [class.is-flush]="isHome()">
        <div class="container main-layout" [class.is-flush]="isHome()">
          <div class="route-fade">
            <router-outlet />
          </div>
        </div>
      </main>

      <footer class="site-footer" [class.has-newsletter]="isHome()">
        <div class="container footer-grid" *ngIf="isHome()">
          <div>
            <p class="eyebrow">Newsletter</p>
            <h2>10% descuento en tu primer pedido</h2>
            <p class="footer-copy">Suscríbete para recibir promociones de {{ brand.name }}. Guardaremos tu consentimiento y evitaremos duplicados por email.</p>
          </div>

          <form class="newsletter-form" (submit)="submitNewsletter($event)">
            <div class="newsletter-email-row">
              <label>
                Email
                <input
                  name="newsletterEmail"
                  type="email"
                  autocomplete="email"
                  required
                  [value]="newsletterEmail()"
                  (input)="updateNewsletterEmail($event)"
                  placeholder="tu@email.com" />
              </label>
              <button class="btn btn-primary" type="submit" [disabled]="newsletterLoading()">
                {{ newsletterLoading() ? 'Guardando...' : 'Activar cupón' }}
                <app-icon *ngIf="!newsletterLoading()" name="arrow" [size]="16" />
              </button>
            </div>
            <label class="newsletter-consent">
              <input
                name="newsletterConsent"
                type="checkbox"
                required
                [checked]="newsletterConsent()"
                (change)="updateNewsletterConsent($event)" />
              <span>Acepto recibir promociones y comunicaciones comerciales. He leído la <a routerLink="/legal/privacidad">política de privacidad</a> y podré solicitar la baja en cualquier momento.</span>
            </label>
            <p class="ok" *ngIf="newsletterNotice()">{{ newsletterNotice() }}</p>
            <p class="err" *ngIf="newsletterError()">{{ newsletterError() }}</p>
          </form>
        </div>

        <div class="container footer-bottom">
          <a class="footer-identity" routerLink="/" [attr.aria-label]="brand.name">
            <img
              *ngIf="brandLogoAvailable(); else footerBrandFallback"
              class="brand-logo brand-logo-footer"
              [src]="brandLogo()"
              [alt]="brand.name"
              (error)="markBrandLogoUnavailable()" />
            <ng-template #footerBrandFallback>
              <strong>{{ brand.name }}</strong>
              <span>{{ brand.slogan }}</span>
            </ng-template>
          </a>
          <nav class="legal-footer" aria-label="Enlaces legales">
            <a *ngFor="let link of legalLinks" [routerLink]="['/legal', link.slug]">{{ link.title }}</a>
            <button type="button" (click)="resetCookieConsent()">Configurar cookies</button>
          </nav>
          <a class="whatsapp-link" [href]="whatsappUrl" target="_blank" rel="noopener noreferrer">
            <app-icon name="whatsapp" [size]="18" />
            <span>Contactar por WhatsApp</span>
          </a>
        </div>
      </footer>

      <app-cookie-banner />
      <app-notifications />
    </div>
  `,
  styles: [
    `.top-banner{display:flex;align-items:center;justify-content:center;gap:6px;background:var(--accent-red);text-align:center;padding:5px 12px;font-size:.78rem;line-height:1.2;color:var(--on-accent);font-weight:750}`,
    `.app-shell{width:100%;min-height:100vh;display:flex;flex-direction:column}`,
    `.navbar{display:flex;align-items:center;justify-content:space-between;padding:2px 0;width:100%;max-width:100%;min-width:0;backdrop-filter:blur(10px);background:color-mix(in srgb, var(--surface-0) 88%, var(--bg-main) 12%);position:sticky;top:0;z-index:50;border-bottom:1px solid color-mix(in srgb, var(--border-soft) 80%, transparent)}`,
    `.nav-grid{display:flex;align-items:center;justify-content:space-between;gap:clamp(6px,2vw,10px);min-width:0;max-width:100%}`,
    `.nav-left,.nav-right{display:flex;align-items:center;gap:6px;min-width:0;flex:0 0 auto}`,
    `.nav-left{gap:2px}`,
    `.nav-right{justify-content:flex-end}`,
    `.nav-brand{display:flex;flex:0 0 auto;align-items:center;justify-content:flex-start;min-width:0;text-decoration:none;color:var(--text-main)}`,
    `.brand-logo{display:block;max-width:100%;object-fit:contain}.brand-logo-header{width:auto;height:68px}.brand-wordmark{display:block;max-width:96px;font-size:clamp(.78rem,3vw,1.1rem);font-weight:900;letter-spacing:.06em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`,
    `.icon-btn{background:transparent;border:none;color:var(--text-main);cursor:pointer;transition:.2s;border-radius:10px;width:34px;height:34px;display:inline-grid;place-items:center;position:relative}`,
    `.icon-btn:hover{transform:scale(1.12);background:var(--hover-surface)}`,
    `.cart-box{position:relative;width:34px;height:34px;padding:0;display:inline-grid;place-items:center;border-radius:10px;border:1px solid color-mix(in srgb, var(--border-soft) 85%, transparent);background:transparent;color:var(--text-main);cursor:pointer}`,
    `.badge{position:absolute;top:-5px;right:-5px;background:var(--accent-red);border-radius:50%;font-size:10px;padding:2px 5px;color:var(--on-accent)}`,
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
    `.result{display:grid;width:100%;gap:2px;padding:.6rem .7rem;border:0;border-radius:8px;background:var(--surface-1);color:var(--text-main);font:inherit;text-align:left;cursor:pointer}`,
    `.result span{color:var(--text-soft);font-size:.85rem}`,
    `.result:hover,.result:focus-visible{background:var(--surface-2)}`,
    `.no-results{padding:.7rem;color:var(--text-soft);font-weight:700}`,
    `.page-content{width:100%;max-width:none;margin:0;padding:clamp(.9rem,3vw,1.75rem) 0;flex:1}`,
    `.page-content.is-flush{padding:0}`,
    `.container.is-flush{max-width:none;padding:0}`,
    `.main-layout{width:100%;min-height:calc(100vh - 150px)}`,
    `.site-footer{border-top:1px solid var(--border-soft);background:color-mix(in srgb,var(--surface-0) 88%,var(--bg-main) 12%);padding:clamp(1.1rem,2.6vw,1.75rem) 0}`,
    `.footer-grid{display:grid;grid-template-columns:minmax(220px,.8fr) minmax(0,1.2fr);gap:clamp(.8rem,2vw,1.4rem);align-items:center}`,
    `.site-footer .eyebrow{margin:0 0 .2rem;color:var(--accent-red-text);font-size:.72rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase}`,
    `.site-footer h2{margin:0 0 .3rem;color:var(--text-main);font-size:var(--title-section);line-height:1.12}`,
    `.footer-copy{max-width:48ch;margin:0;color:var(--text-soft);font-size:.88rem;line-height:1.45}`,
    `.newsletter-form{display:grid;gap:.52rem;background:var(--surface-1);border:1px solid var(--border-soft);border-radius:var(--radius-card);padding:.8rem;color:var(--text-main)}`,
    `.newsletter-email-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.6rem;align-items:end}`,
    `.newsletter-form label{display:grid;gap:.28rem;font-size:.82rem;font-weight:800}`,
    `.newsletter-form input[type="email"]{width:100%;border:1px solid var(--border-soft);border-radius:10px;padding:.62rem .72rem;background:var(--surface-0);color:var(--text-main)}`,
    `.newsletter-email-row .btn{min-height:44px}`,
    `.newsletter-consent{display:flex!important;align-items:flex-start;gap:.5rem;color:var(--text-soft);font-size:.76rem;line-height:1.4;font-weight:650!important}`,
    `.newsletter-consent input{margin-top:.18rem;width:18px;height:18px}`,
    `.newsletter-consent a{color:var(--accent-green);font-weight:900}`,
    `.footer-bottom{display:flex;align-items:center;justify-content:space-between;gap:.8rem;margin-top:.8rem}`,
    `.footer-identity{display:grid;gap:.05rem;flex:0 0 auto;color:var(--text-main);text-decoration:none}.footer-identity strong{font-size:.9rem;letter-spacing:.08em}.footer-identity span{color:var(--text-soft);font-size:.66rem}.brand-logo-footer{width:auto;height:112px}`,
    `.legal-footer{display:flex;gap:.35rem .7rem;justify-content:flex-start;flex-wrap:wrap}`,
    `.legal-footer a,.legal-footer button{border:0;padding:.15rem 0;background:transparent;color:var(--text-soft);font-size:.75rem;text-decoration:underline;cursor:pointer;font-weight:700}`,
    `.legal-footer a:hover,.legal-footer a:focus-visible,.legal-footer button:hover,.legal-footer button:focus-visible{color:var(--accent-green);outline:2px solid color-mix(in srgb,var(--accent-green) 35%,transparent);outline-offset:3px;border-radius:6px}`,
    `.whatsapp-link{display:inline-flex;align-items:center;justify-content:center;gap:.42rem;flex:0 0 auto;min-height:40px;padding:.45rem .75rem;border:1px solid color-mix(in srgb,#25d366 55%,var(--border-soft));border-radius:var(--radius-pill);background:color-mix(in srgb,#25d366 12%,var(--surface-1));color:var(--text-main);font-size:.8rem;font-weight:800;text-decoration:none}`,
    `.whatsapp-link:hover,.whatsapp-link:focus-visible{border-color:#25d366;background:color-mix(in srgb,#25d366 20%,var(--surface-1));outline:3px solid color-mix(in srgb,#25d366 32%,transparent);outline-offset:2px}`,
    `.ok{color:var(--ok-text);margin:.1rem 0 0}`,
    `.err{color:var(--error-text);margin:.1rem 0 0}`,
    `.site-footer:not(.has-newsletter){padding:.7rem 0}.site-footer:not(.has-newsletter) .footer-bottom{margin-top:0}`,
    `@media (max-width:760px){.footer-grid{grid-template-columns:1fr}.top-banner{font-size:.66rem;padding:4px 8px}.navbar{padding:2px 0;padding-top:max(2px,env(safe-area-inset-top))}.brand-logo-header{height:clamp(50px,14vw,54px)}.brand-wordmark{max-width:72px;font-size:.8rem}.icon-btn,.cart-box,.theme-btn{width:44px;height:44px}.nav-grid{gap:4px}.nav-right{gap:2px}.page-content{padding:.65rem 0;font-size:.94rem}.search-modal{padding:10px;padding-top:max(10px,env(safe-area-inset-top));place-items:start stretch}.search-card{width:100%}.side-menu{padding-top:max(16px,env(safe-area-inset-top));width:min(300px,calc(100vw - 16px))}.newsletter-email-row{grid-template-columns:1fr}.newsletter-email-row .btn{width:100%}.site-footer{padding:.85rem 0}.site-footer h2{font-size:1.18rem}.footer-copy{font-size:.8rem}.footer-bottom{align-items:flex-start;flex-direction:column;gap:.55rem;margin-top:.6rem}.footer-identity{align-self:center;width:100%;justify-items:center;text-align:center}.brand-logo-footer{height:88px}.legal-footer{gap:.25rem .55rem;padding:0}.legal-footer a,.legal-footer button{font-size:.69rem}.whatsapp-link{width:auto;min-height:36px;padding:.36rem .65rem;font-size:.74rem}}`,
    `@media (hover:none){.icon-btn:hover{transform:none}}`,
    `@media (prefers-reduced-motion:reduce){.dropdown{animation:none}.icon-btn,.result{transition:none}}`,
    `@media (min-width:768px){.desktop-only{display:flex;gap:6px}.mobile-only{display:none}.brand-wordmark{font-size:1.3rem}}`
  ]
})
export class AppComponent {
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly themeService = inject(ThemeService);
  private readonly productCategories = inject(ProductCategoryService);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);
  private returnFocusElement: HTMLElement | null = null;
  private menuReturnFocusElement: HTMLElement | null = null;

  readonly theme = this.themeService.mode;
  readonly brand = BRAND_CONFIG;
  readonly brandLogo = computed(() => getBrandLogo(this.theme()));
  readonly brandLogoAvailable = signal(BRAND_CONFIG.logos.available);
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
    return this.productCategories.labelFor(value) || getProductCategoryLabel(value);
  }

  constructor(
    public readonly cart: CartService,
    public readonly customerAuth: CustomerAuthService,
    private readonly catalog: CatalogService,
    private readonly newsletterService: NewsletterService,
    private readonly cookieConsent: CookieConsentService,
    private readonly seo: SeoService
  ) {
    this.seo.setOrganizationAndWebsiteSchema();
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.seo.clearPageMetadata();
      }

      if (event instanceof NavigationEnd) {
        let route = this.activatedRoute;
        while (route.firstChild) route = route.firstChild;
        const routeMeta = route.snapshot.data['seo'] as SeoMetaInput | undefined;
        if (routeMeta) this.seo.setPageMeta(routeMeta);
      }
    });
    void this.customerAuth.restoreSession();
    void this.productCategories.loadPublicCategories().catch(() => undefined);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as Node | null;
    if (!target) return;
    if (!this.host.nativeElement.contains(target)) {
      this.userMenuOpen.set(false);
    }
  }

  async submitNewsletter(event?: Event): Promise<void> {
    event?.preventDefault();
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
    const nextOpen = !this.menuOpen();
    if (nextOpen) this.menuReturnFocusElement = this.document.activeElement as HTMLElement | null;
    else this.menuReturnFocusElement?.focus();
    this.menuOpen.set(nextOpen);
    this.userMenuOpen.set(false);
    this.searchOpen.set(false);
    if (nextOpen) {
      globalThis.setTimeout(() => this.document.querySelector<HTMLElement>('#site-menu a, #site-menu button')?.focus());
    }
  }

  closeMenu(): void {
    if (this.menuOpen()) this.menuReturnFocusElement?.focus();
    this.menuOpen.set(false);
  }

  trapMenuFocus(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const menu = this.document.getElementById('site-menu');
    const focusable = Array.from(menu?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') ?? []);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && this.document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && this.document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  openSearch(): void {
    this.toggleSearch();
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    if (this.searchOpen()) {
      event.preventDefault();
      this.toggleSearch();
    } else if (this.menuOpen()) {
      event.preventDefault();
      this.closeMenu();
      this.document.getElementById('menu-trigger')?.focus();
    } else if (this.userMenuOpen()) {
      this.userMenuOpen.set(false);
    }
  }

  toggleUserMenu(): void {
    this.userMenuOpen.set(!this.userMenuOpen());
    this.menuOpen.set(false);
  }

  toggleSearch(): void {
    const nextOpen = !this.searchOpen();
    if (nextOpen) {
      this.returnFocusElement = this.document.activeElement as HTMLElement | null;
      void this.catalog.loadProducts();
    }
    this.searchOpen.set(nextOpen);
    this.menuOpen.set(false);
    this.userMenuOpen.set(false);
    if (nextOpen) {
      globalThis.setTimeout(() => this.document.getElementById('app-search-input')?.focus());
    } else {
      this.searchQuery.set('');
      globalThis.setTimeout(() => this.returnFocusElement?.focus());
    }
  }

  trapSearchFocus(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const dialog = this.document.querySelector<HTMLElement>('.search-card');
    const focusable = Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') ?? []);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && this.document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && this.document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  updateSearchQuery(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  updateNewsletterEmail(event: Event): void {
    this.newsletterEmail.set((event.target as HTMLInputElement).value);
  }

  updateNewsletterConsent(event: Event): void {
    this.newsletterConsent.set((event.target as HTMLInputElement).checked);
  }

  trackProduct(_index: number, product: Product): string {
    return product.id;
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

  markBrandLogoUnavailable(): void {
    this.brandLogoAvailable.set(false);
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

  currentRoute(): string {
    return this.router.url;
  }

}
