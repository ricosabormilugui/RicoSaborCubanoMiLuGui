import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, inject, output, signal } from '@angular/core';
import { NavigationStart, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CustomerAuthService } from '../../core/services/customer-auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-account-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  template: `
    <button
      class="icon-btn"
      type="button"
      (click)="toggle()"
      [attr.aria-label]="auth.isAuthenticated() ? 'Abrir menú de cuenta' : 'Acceder a tu cuenta'"
      [attr.title]="auth.isAuthenticated() ? 'Abrir menú de cuenta' : 'Acceder a tu cuenta'"
      [attr.aria-expanded]="open()"
      aria-haspopup="menu"
      aria-controls="account-menu">
      <app-icon name="user" />
    </button>

    <div class="dropdown" *ngIf="open()" id="account-menu" role="menu">
      <ng-container *ngIf="!auth.isAuthenticated(); else loggedMenu">
        <button type="button" role="menuitem" (click)="goLogin()">Iniciar sesión</button>
        <button type="button" role="menuitem" (click)="goRegister()">Registro</button>
      </ng-container>

      <ng-template #loggedMenu>
        <a *ngIf="!auth.isAdminAccount()" routerLink="/favoritos" role="menuitem" (click)="close()">Mis favoritos</a>
        <a routerLink="/mis-notificaciones" role="menuitem" (click)="close()">Mis notificaciones</a>
        <button type="button" role="menuitem" (click)="goOrders()">Mis pedidos</button>
        <button type="button" role="menuitem" (click)="logout()">Salir</button>
      </ng-template>
    </div>
  `,
  styles: [`
    :host {
      position: relative;
      display: inline-grid;
      place-items: center;
      align-self: center;
      flex: 0 0 var(--nav-action-size, 34px);
      width: var(--nav-action-size, 34px);
      height: var(--nav-action-size, 34px);
      overflow: visible;
    }

    .icon-btn {
      width: 100%;
      height: 100%;
      padding: 0;
      margin: 0;
      display: inline-grid;
      place-items: center;
      position: relative;
      border: 0;
      border-radius: 10px;
      background: transparent;
      color: var(--text-main);
      cursor: pointer;
      line-height: 0;
      transition: .2s;
    }

    .icon-btn:hover { transform: scale(1.12); background: var(--hover-surface); }

    .dropdown {
      position: absolute;
      right: 0;
      top: calc(100% + 4px);
      z-index: 60;
      display: grid;
      gap: 4px;
      min-width: 150px;
      padding: 8px;
      border: 1px solid color-mix(in srgb, var(--border-soft) 75%, transparent);
      border-radius: 10px;
      background: var(--surface-0);
      animation: fadeIn .2s ease;
    }

    .dropdown button,
    .dropdown a {
      font: inherit;
      text-decoration: none;
      background: color-mix(in srgb, var(--surface-2) 40%, transparent);
      border: 0;
      color: var(--text-main);
      padding: 8px;
      border-radius: 8px;
      text-align: left;
      cursor: pointer;
    }

    .dropdown button:hover,
    .dropdown a:hover { background: color-mix(in srgb, var(--surface-2) 70%, transparent); }

    @media (max-width: 760px) {
      :host {
        flex: 0 0 44px;
        width: 44px;
        height: 44px;
      }

      .dropdown {
        min-width: min(220px, calc(100vw - 16px));
      }

      .dropdown button,
      .dropdown a { min-height: 44px; padding: 12px; }
    }

    @media (hover: none) {
      .icon-btn:hover { transform: none; background: transparent; }
    }

    @media (prefers-reduced-motion: reduce) {
      .dropdown { animation: none; }
      .icon-btn { transition: none; }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: none; }
    }
  `]
})
export class AccountMenuComponent {
  readonly opened = output<void>();

  readonly auth = inject(CustomerAuthService);
  readonly open = signal(false);

  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly host = inject(ElementRef<HTMLElement>);

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationStart) this.close();
    });
  }

  isOpen(): boolean {
    return this.open();
  }

  toggle(): void {
    const next = !this.open();
    this.open.set(next);
    if (next) this.opened.emit();
  }

  close(): void {
    this.open.set(false);
  }

  goLogin(): void {
    this.close();
    void this.router.navigateByUrl('/login');
  }

  goRegister(): void {
    this.close();
    void this.router.navigateByUrl('/registro');
  }

  goOrders(): void {
    this.close();
    void this.router.navigateByUrl('/mis-pedidos');
  }

  logout(): void {
    this.close();
    this.auth.logout();
    this.notifications.info('Sesión cerrada', 'Hasta pronto.');
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.open()) return;
    const target = event.target as Node | null;
    if (target && !this.host.nativeElement.contains(target)) this.close();
  }

  focusTrigger(): void {
    this.host.nativeElement.querySelector('.icon-btn')?.focus();
  }
}
