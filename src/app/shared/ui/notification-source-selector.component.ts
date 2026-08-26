import { Component, inject } from '@angular/core';
import { NotificationCenterService } from '../../core/services/notification-center.service';

@Component({
  selector: 'app-notification-source-selector', standalone: true,
  template: `
    @if (service.isAccount()) {
      <div class="sources" role="group" aria-label="Origen de los avisos">
        <button type="button" [attr.aria-pressed]="!service.isAccountSource()" (click)="service.selectSource('local')">Actividad <span>{{ service.localUnreadCount() }}</span></button>
        <button type="button" [attr.aria-pressed]="service.isAccountSource()" (click)="service.selectSource('account')">Mi cuenta <span>{{ service.accountUnreadCount() }}</span></button>
      </div>
    }
    <p class="origin">{{ service.isAccountSource() ? 'Notificaciones privadas de tu cuenta' : 'Actividad de este dispositivo · no se guarda en tu cuenta' }}</p>
  `,
  styles: [`
    :host{display:block}.sources{display:flex;gap:.4rem}.sources button{flex:1;min-width:0;min-height:44px;padding:.5rem;font:inherit;font-size:.85rem;font-weight:700;border:1px solid var(--border-soft);border-radius:12px;background:var(--surface-2);color:var(--text-main);cursor:pointer}.sources button[aria-pressed=true]{background:var(--brand-blue);color:var(--on-accent);border-color:var(--brand-blue)}.sources span{margin-inline-start:.25rem;font-variant-numeric:tabular-nums}.origin{margin:.6rem 0;font-size:.8rem;line-height:1.5;color:var(--text-soft)}button:focus-visible{outline:2px solid var(--accent-green);outline-offset:2px}
  `]
})
export class NotificationSourceSelectorComponent {
  readonly service = inject(NotificationCenterService);
}
