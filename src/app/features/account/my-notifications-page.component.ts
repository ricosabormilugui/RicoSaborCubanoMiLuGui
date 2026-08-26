import { Component, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UserNotificationsService } from '../../core/services/user-notifications.service';
import { UserNotificationListComponent } from '../../shared/ui/user-notification-list.component';
import { NotificationFilters } from '../../core/notifications/user-notification.types';

@Component({
  standalone: true, imports: [RouterLink, UserNotificationListComponent],
  template: `
    <section class="notification-history">
      <header><div><p class="eyebrow">MI CUENTA</p><h1>Mis notificaciones</h1><p class="intro">Los avisos importantes, siempre a mano.</p></div>
        @if (service.session()) { <button type="button" class="btn btn-secondary" [disabled]="!service.unreadCount() || service.busy()" (click)="service.markAllRead()">Marcar todas leídas</button> }
      </header>
      @if (!service.session()) { <div class="state card"><p>Inicia sesión para ver tus notificaciones privadas.</p><a routerLink="/login" class="btn btn-primary">Iniciar sesión</a></div> }
      @else {
        <div class="filters" role="group" aria-label="Filtrar notificaciones">
          @for (option of options; track option.id) { <button type="button" [class.active]="selected() === option.id" [attr.aria-pressed]="selected() === option.id" [disabled]="service.busy()" (click)="filter(option.id)">{{ option.label }}</button> }
          <span class="unread-count" aria-live="polite">{{ service.unreadCount() }} sin leer</span>
        </div>
        @if (service.error()) { <div class="state card" role="alert"><p>{{ service.error() }}</p><button class="btn btn-secondary" type="button" (click)="reload()">Reintentar</button></div> }
        <div [attr.aria-busy]="service.loading().history"><app-user-notification-list [items]="service.history()" /></div>
        @if (service.loading().history) { <p class="state" role="status">Cargando notificaciones…</p> }
        @else if (!service.history().length && !service.error()) { <div class="state card"><h2>{{ selected() === 'all' ? 'Estás al día' : 'No hay avisos con este filtro' }}</h2><p>Cuando haya novedades, podrás consultarlas aquí.</p></div> }
        @if (service.nextCursor()) { <div class="load-more"><button type="button" class="btn btn-secondary" [disabled]="service.loading().history || service.busy()" (click)="loadMore()">Cargar más</button></div> }
      }
    </section>
  `,
  styles: [`
    .notification-history{max-width:850px;margin:0 auto;padding:1rem 0 2rem;color:var(--text-main)}header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;margin-bottom:1.5rem}.eyebrow{font-size:.7rem;letter-spacing:.12em;font-weight:800;color:var(--accent-green);margin:0 0 .4rem}h1{font-size:clamp(1.7rem,5vw,2.3rem);margin:0}.intro{color:var(--text-soft);margin:.5rem 0 0;font-size:.95rem}.filters{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;margin:0 0 1rem}.filters button{font:inherit;font-size:.85rem;min-height:44px;padding:.5rem 1rem;border:1px solid var(--border-soft);border-radius:99px;background:var(--surface-1);color:var(--text-soft);cursor:pointer}.filters button.active{background:var(--brand-blue);color:var(--on-accent);border-color:var(--brand-blue);font-weight:800}.unread-count{font-size:.8rem;color:var(--text-soft);margin-inline-start:auto}.state{text-align:center;padding:2rem 1rem;color:var(--text-soft)}.state h2{font-size:1.2rem;color:var(--text-main)}.load-more{text-align:center;padding:1rem}button:disabled{opacity:.55;cursor:default}button:focus-visible,a:focus-visible{outline:2px solid var(--accent-green);outline-offset:3px}@media(max-width:480px){header{align-items:stretch;flex-direction:column}.filters{gap:.4rem}.filters button{padding:.5rem .8rem}.unread-count{width:100%;margin:.3rem 0}}
  `]
})
export class MyNotificationsPageComponent {
  readonly service = inject(UserNotificationsService);
  readonly selected = signal('all');
  readonly options = [{ id: 'all', label: 'Todas' }, { id: 'unread', label: 'Sin leer' }, { id: 'order', label: 'Pedidos' }, { id: 'account', label: 'Cuenta' }];
  constructor() { effect(() => { this.service.session(); untracked(() => { this.selected.set('all'); this.reload(); }); }); }
  filters(): NotificationFilters { return this.selected() === 'unread' ? { read: false } : this.selected() === 'order' || this.selected() === 'account' ? { type: this.selected() as 'order' | 'account' } : {}; }
  filter(value: string): void { this.selected.set(value); this.reload(); }
  reload(): void { void this.service.load('history', this.filters()); void this.service.refreshCount(); }
  loadMore(): void { void this.service.load('history', this.filters(), true); }
}
