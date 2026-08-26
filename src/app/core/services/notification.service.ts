import { Injectable, Injector } from '@angular/core';
import { CustomerAuthService } from './customer-auth.service';
import { NOTIFICATION_DURATIONS } from '../notifications/notification.config';
import { NotificationId, NotificationOptions, NotificationType } from '../notifications/notification.types';
import { getUserFriendlyError } from '../utils/user-friendly-error';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(private readonly injector?: Injector) {}
  historySession(): number { return this.injector?.get(CustomerAuthService).sessionVersion() ?? -1; }

  private record(type: NotificationType, title: string, options: NotificationOptions): void {
    const injector = this.injector;
    if (!options.saveToHistory || type === 'loading' || !injector) return;
    const auth = injector.get(CustomerAuthService);
    const version = options.history?.sessionVersion ?? auth.sessionVersion();
    if (version !== auth.sessionVersion() || (auth.isAuthenticated() && options.history?.accountEquivalent)) return;
    const createdAt = Date.now();
    void import('./notification-history.service').then(({ NotificationHistoryService }) => {
      if (auth.sessionVersion() === version) injector.get(NotificationHistoryService).add({ type, title, message: options.history?.message, action: options.history?.action }, createdAt);
    }).catch(() => { /* A storage/chunk failure must not prevent immediate feedback. */ });
  }
  // Keep the toast library out of the initial SPA bundle. Calls made while it
  // loads are applied in order; callers still receive their ID synchronously.
  private library?: Promise<typeof import('ngx-sonner')>;

  private dispatch(operation: (library: typeof import('ngx-sonner')) => void): void {
    this.library ??= import('ngx-sonner');
    void this.library.then(operation).catch(error => {
      this.library = undefined;
      console.error('No se pudo cargar el sistema de notificaciones.', error);
    });
  }
  success(title: string, description?: string, options?: NotificationOptions): NotificationId {
    return this.show('success', title, description, options);
  }

  error(title: string, description?: string, options?: NotificationOptions): NotificationId {
    return this.show('error', title, description, options);
  }

  info(title: string, description?: string, options?: NotificationOptions): NotificationId {
    return this.show('info', title, description, options);
  }

  warning(title: string, description?: string, options?: NotificationOptions): NotificationId {
    return this.show('warning', title, description, options);
  }

  loading(title: string, description?: string, options?: NotificationOptions): NotificationId {
    return this.show('loading', title, description, options);
  }

  updateSuccess(id: NotificationId, title: string, description?: string, options?: NotificationOptions): NotificationId {
    return this.success(title, description, { ...options, id });
  }

  updateError(id: NotificationId, title: string, description?: string, options?: NotificationOptions): NotificationId {
    return this.error(title, description, { ...options, id });
  }

  dismiss(id: NotificationId): void { this.dispatch(({ toast }) => toast.dismiss(id)); }
  dismissAll(): void { this.dispatch(({ toast }) => toast.dismiss()); }

  private show(type: NotificationType, title: string, description?: string, options: NotificationOptions = {}): NotificationId {
    this.record(type, title, options);
    const id = options.id ?? (options.key ? `key:${options.key}` : `message:${JSON.stringify([type, title, description])}`);
    this.dispatch(({ toast, toastState }) => {
      // Sonner 3.1 restarts timers on updates: avoid setTimeout(Infinity).
      const existing = toastState.toasts().find(item => item.id === id);
      if (type === 'loading' && existing?.type === 'loading') return;
      if (existing && (type === 'loading' || options.duration === Number.POSITIVE_INFINITY)) toast.dismiss(id);
      const action = options.action;
      toast[type](title, {
        id,
        description,
        duration: options.duration ?? NOTIFICATION_DURATIONS[type],
        important: type === 'error',
        dismissible: type !== 'loading',
        closeButton: type !== 'loading',
        action: action ? {
          label: action.label,
          onClick: () => {
            Promise.resolve().then(() => action.handler()).catch(error => {
              this.error('No se pudo completar la acción', getUserFriendlyError(error));
            });
          }
        } : undefined
      });
    });
    return id;
  }
}
