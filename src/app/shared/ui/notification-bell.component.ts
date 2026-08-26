import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, OnDestroy, afterRenderEffect, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router, RouterLink } from '@angular/router';
import { LucideBell } from '@lucide/angular';
import { NotificationCenterService } from '../../core/services/notification-center.service';
import { notificationBadge } from '../../core/notifications/user-notification.types';
import { UserNotificationListComponent } from './user-notification-list.component';
import { IconComponent } from './icon.component';
import { NotificationSourceSelectorComponent } from './notification-source-selector.component';

@Component({
  selector: 'app-notification-bell', standalone: true,
  imports: [LucideBell, RouterLink, UserNotificationListComponent, IconComponent, NotificationSourceSelectorComponent],
  template: `
    <button #trigger type="button" class="bell" (click)="show(trigger)" [attr.aria-label]="service.unreadCount() ? 'Notificaciones: ' + service.unreadCount() + ' sin leer' : 'Notificaciones'" aria-haspopup="dialog" aria-controls="notification-panel" [attr.aria-expanded]="opened()">
      <svg lucideBell [size]="22" />
      @if (badge(service.unreadCount())) { <span class="count" aria-hidden="true">{{ badge(service.unreadCount()) }}</span> }
    </button>
    <dialog #panel id="notification-panel" aria-labelledby="notification-panel-title" (cancel)="$event.preventDefault(); close()" (keydown.escape)="$event.preventDefault(); $event.stopPropagation(); close()" (keydown)="trapFocus($event)" (click)="backdrop($event)">
      @if (opened() && panelOwner === service.session()) {
        <header><div><span class="eyebrow">CENTRO DE AVISOS</span><h2 id="notification-panel-title">{{ service.isAccount() ? 'Notificaciones' : 'Actividad reciente' }}</h2></div><button autofocus class="close" type="button" aria-label="Cerrar notificaciones" (click)="close()"><app-icon name="close" /></button></header>
        <app-notification-source-selector />
        <div class="toolbar"><span aria-live="polite">{{ service.sourceUnreadCount() }} sin leer</span><button type="button" [disabled]="!service.sourceUnreadCount() || service.busy()" (click)="service.markAllRead()">{{ service.isAccountSource() ? 'Marcar notificaciones como leídas' : 'Marcar actividad como leída' }}</button></div>
        <div class="content" [attr.aria-busy]="service.loading().recent">
          @if (service.storageWarning()) { <p class="state" role="status">{{ service.storageWarning() }}</p> }
          @if (service.error()) { <div role="alert" class="state"><p>{{ service.error() }}</p><button type="button" (click)="reload()">Reintentar</button></div> }
          @if (service.loading().recent) { <p class="state" role="status">Cargando notificaciones…</p> }
          @else if (!service.error() && !service.recent().length) { <div class="state"><svg lucideBell [size]="32" /><h3>{{ service.isAccountSource() ? 'No hay notificaciones de cuenta' : 'No tienes actividad reciente' }}</h3><p>{{ service.isAccountSource() ? 'Aquí aparecerán las novedades de tus pedidos y tu cuenta.' : 'Aquí aparecerán las acciones importantes de esta identidad.' }}</p></div> }
          <app-user-notification-list [items]="service.recent()" />
        </div>
        <footer><a routerLink="/mis-notificaciones" (click)="close()">{{ service.isAccount() ? 'Ver todas las notificaciones' : 'Ver toda la actividad' }} <span aria-hidden="true">→</span></a></footer>
      }
    </dialog>
  `,
  styleUrl: './notification-bell.component.scss'
})
export class NotificationBellComponent implements OnDestroy {
  readonly service = inject(NotificationCenterService);
  readonly badge = notificationBadge;
  readonly opened = signal(false);
  readonly panel = viewChild<ElementRef<HTMLDialogElement>>('panel');
  private readonly document = inject(DOCUMENT);
  private trigger: HTMLElement | null = null;
  private previousOverflow = '';
  private focusedOpening = false;
  panelOwner = '';
  constructor() {
    afterRenderEffect(() => {
      if (this.opened() && !this.focusedOpening) {
        const close = this.panel()?.nativeElement.querySelector<HTMLButtonElement>('.close');
        if (close) { close.focus(); this.focusedOpening = true; }
      }
    });
    effect(() => { if (this.opened() && this.panelOwner !== this.service.session()) this.close(); });
    effect(() => {
      const opened = this.opened();
      this.service.source();
      if (opened) untracked(() => this.reload());
    });
    inject(Router).events.pipe(takeUntilDestroyed()).subscribe(event => { if (event instanceof NavigationStart) this.close(); });
  }
  show(trigger: HTMLElement): void {
    this.trigger = trigger;
    this.panelOwner = this.service.session();
    this.focusedOpening = false;
    this.previousOverflow = this.document.body.style.overflow;
    this.document.body.style.overflow = 'hidden';
    this.opened.set(true);
    this.panel()?.nativeElement.showModal();
    const panel = this.panel()?.nativeElement;
    if (panel) panel.scrollTop = 0;
  }
  reload(): void { void this.service.load('recent'); void this.service.refreshCount(); }
  close(): void {
    if (!this.opened()) return;
    this.panel()?.nativeElement.close();
    this.opened.set(false);
    this.document.body.style.overflow = this.previousOverflow;
    if (this.trigger?.isConnected) this.trigger.focus();
  }
  backdrop(event: MouseEvent): void {
    const panel = this.panel()?.nativeElement;
    if (event.target !== panel || !panel) return;
    const rect = panel.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) this.close();
  }
  trapFocus(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const controls = Array.from(this.panel()?.nativeElement.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]') ?? []);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && this.document.activeElement === first && last) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && this.document.activeElement === last && first) { event.preventDefault(); first.focus(); }
  }
  ngOnDestroy(): void { this.close(); }
}
