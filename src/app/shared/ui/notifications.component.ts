import { Component, ElementRef, afterEveryRender, inject } from '@angular/core';
import { NgxSonnerToaster } from 'ngx-sonner';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [NgxSonnerToaster],
  template: `
    @defer (on immediate) {
      <ngx-sonner-toaster class="mixsabor-toaster" position="top-right"
        [theme]="theme.mode()" [visibleToasts]="3" [closeButton]="true" />
    }
  `,
  styles: [':host { display: contents; }']
})
export class NotificationsComponent {
  readonly theme = inject(ThemeService);

  constructor() {
    const host: HTMLElement = inject(ElementRef).nativeElement;
    // ngx-sonner 3.1 has no label/role inputs; keep this adapter in the host.
    afterEveryRender(() => {
      host.querySelector('section[aria-label]')?.setAttribute('aria-label', 'Notificaciones (Alt + T)');
      host.querySelectorAll('[data-close-button]').forEach(button => button.setAttribute('aria-label', 'Cerrar notificación'));
      host.querySelectorAll('[data-sonner-toast]').forEach(item => {
        item.setAttribute('role', item.getAttribute('data-type') === 'error' ? 'alert' : 'status');
      });
    });
  }
}
