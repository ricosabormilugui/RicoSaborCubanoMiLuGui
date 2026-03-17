import { Injectable, signal } from '@angular/core';

export type AppNotificationType = 'success' | 'error' | 'info' | 'warning';

export interface AppNotification {
  id: string;
  title: string;
  message?: string;
  type: AppNotificationType;
  timeoutMs: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  readonly notifications = signal<AppNotification[]>([]);

  success(title: string, message?: string, timeoutMs = 3500): void {
    this.push({ title, message, timeoutMs, type: 'success' });
  }

  error(title: string, message?: string, timeoutMs = 5000): void {
    this.push({ title, message, timeoutMs, type: 'error' });
  }

  info(title: string, message?: string, timeoutMs = 3500): void {
    this.push({ title, message, timeoutMs, type: 'info' });
  }

  warning(title: string, message?: string, timeoutMs = 4500): void {
    this.push({ title, message, timeoutMs, type: 'warning' });
  }

  dismiss(id: string): void {
    this.notifications.update((items) => items.filter((item) => item.id !== id));
  }

  private push(input: Omit<AppNotification, 'id'>): void {
    const notification: AppNotification = {
      id: crypto.randomUUID(),
      ...input
    };

    this.notifications.update((items) => [...items, notification]);

    globalThis.setTimeout(() => this.dismiss(notification.id), notification.timeoutMs);
  }
}
