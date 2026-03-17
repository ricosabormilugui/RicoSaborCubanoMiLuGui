import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside class="notify-wrap" aria-live="polite" aria-atomic="true">
      <article
        class="notify"
        *ngFor="let item of notifications.notifications()"
        [class]="'notify ' + item.type"
      >
        <button class="close" type="button" (click)="notifications.dismiss(item.id)">×</button>
        <strong>{{ item.title }}</strong>
        <p *ngIf="item.message">{{ item.message }}</p>
      </article>
    </aside>
  `,
  styles: [
    `.notify-wrap{position:fixed;top:78px;right:16px;display:grid;gap:.55rem;z-index:60;max-width:min(92vw,360px)}`,
    `.notify{position:relative;padding:.7rem .85rem;border-radius:12px;border:1px solid var(--border-soft);background:var(--surface-0);color:var(--text-main);box-shadow:0 10px 24px rgba(0,0,0,.25);animation:slideIn .2s ease}`,
    `.notify strong{display:block;font-size:.92rem}`,
    `.notify p{margin:.25rem 0 0;color:var(--text-soft);font-size:.88rem}`,
    `.notify.success{border-color:color-mix(in srgb, var(--accent-green) 35%, var(--border-soft));background:color-mix(in srgb, var(--accent-green) 12%, var(--surface-0))}`,
    `.notify.error{border-color:color-mix(in srgb, #ef4444 45%, var(--border-soft));background:color-mix(in srgb, #ef4444 15%, var(--surface-0))}`,
    `.notify.info{border-color:color-mix(in srgb, #60a5fa 40%, var(--border-soft));background:color-mix(in srgb, #60a5fa 13%, var(--surface-0))}`,
    `.notify.warning{border-color:color-mix(in srgb, #f59e0b 45%, var(--border-soft));background:color-mix(in srgb, #f59e0b 14%, var(--surface-0))}`,
    `.close{position:absolute;top:6px;right:8px;border:0;background:transparent;color:var(--text-soft);cursor:pointer;font-size:1.05rem}`,
    `@keyframes slideIn{from{opacity:0;transform:translateY(-6px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}`
  ]
})
export class NotificationsComponent {
  readonly notifications = inject(NotificationService);
}
