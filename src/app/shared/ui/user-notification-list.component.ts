import { DatePipe } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { IconComponent } from './icon.component';
import { NotificationCenterService } from '../../core/services/notification-center.service';
import { NotificationItem } from '../../core/notifications/local-notification.types';

@Component({
  selector: 'app-user-notification-list', standalone: true, imports: [DatePipe, IconComponent],
  template: `
    <ul class="notification-list">
      @for (item of items(); track item.id) {
        <li [class.unread]="!item.read">
          <div class="item-icon" aria-hidden="true"><app-icon [name]="item.type === 'order' ? 'cart' : item.type === 'account' ? 'user' : 'gift'" [size]="20" /></div>
          <div class="item-body">
            <div class="item-meta"><span>{{ typeLabel(item.type) }}</span><span>{{ item.read ? 'Leída' : 'Sin leer' }}</span></div>
            <h3>{{ item.title }}</h3>
            <p>{{ item.message }}</p>
            <time [attr.datetime]="item.createdAt">{{ item.createdAt | date:'dd/MM/yyyy · HH:mm' }}</time>
            <div class="item-actions">
              @if (destination(item)) {
                <button type="button" class="action" [disabled]="service.busy()" (click)="open(item)">{{ item.action!.label }}</button>
              }
              @if (!item.read) {
                <button type="button" [disabled]="service.busy()" (click)="service.markRead(item)" [attr.aria-label]="'Marcar como leída: ' + item.title">Marcar leída</button>
              }
              <button type="button" [disabled]="service.busy()" (click)="service.remove(item)" [attr.aria-label]="'Eliminar notificación: ' + item.title">Eliminar</button>
            </div>
          </div>
        </li>
      }
    </ul>
  `,
  styles: [`
    .notification-list{list-style:none;margin:0;padding:0;display:grid;gap:.65rem}
    li{display:flex;gap:.75rem;padding:1rem;border:1px solid var(--border-soft);border-radius:14px;background:var(--surface-0);color:var(--text-main)}
    li.unread{border-inline-start:3px solid var(--accent-green);background:color-mix(in srgb,var(--accent-green) 6%,var(--surface-1))}
    .item-icon{display:grid;place-items:center;width:36px;height:36px;flex:0 0 36px;border-radius:12px;background:var(--surface-2);color:var(--accent-green)}
    .item-body{min-width:0;flex:1;overflow-wrap:anywhere}.item-meta{display:flex;flex-wrap:wrap;gap:.3rem .7rem;justify-content:space-between;color:var(--text-soft);font-size:.72rem}
    h3{font-size:1rem;line-height:1.3;margin:.35rem 0}p{font-size:.88rem;line-height:1.5;margin:.25rem 0;color:var(--text-soft)}time{font-size:.73rem;color:var(--text-soft)}
    .item-actions{display:flex;flex-wrap:wrap;gap:.25rem .65rem;margin-top:.4rem}button{font:inherit;font-size:.78rem;font-weight:700;border:0;background:transparent;color:var(--text-soft);padding:.25rem 0;min-height:44px;cursor:pointer;text-align:start}.action{color:var(--accent-green)}button:hover{text-decoration:underline}button:focus-visible{outline:2px solid var(--accent-green);outline-offset:3px;border-radius:3px}button:disabled{opacity:.55;cursor:wait}
    @media(max-width:380px){li{padding:.75rem;gap:.5rem}.item-icon{display:none}}
  `]
})
export class UserNotificationListComponent {
  readonly items = input.required<NotificationItem[]>();
  readonly service = inject(NotificationCenterService);
  private readonly router = inject(Router);
  readonly destination = (item: NotificationItem) => this.service.destination(item);
  typeLabel(type: string): string { return ({ order: 'Pedido', account: 'Cuenta', system: 'Sistema', promotion: 'Promoción', success: 'Completado', error: 'Error', warning: 'Aviso', info: 'Información' } as Record<string, string>)[type] ?? 'Información'; }
  async open(item: NotificationItem): Promise<void> {
    const session = this.service.session();
    const url = this.destination(item);
    if (url && await this.service.markRead(item) && session === this.service.session()) await this.router.navigateByUrl(url);
  }
}
