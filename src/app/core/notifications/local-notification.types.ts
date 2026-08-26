import type { UserNotification } from './user-notification.types';
import type { NotificationType } from './notification.types';

export const LOCAL_NOTIFICATION_CONFIG = {
  resource: 'activity', legacyStorageKey: 'mixsabor.notifications', version: 1, limit: 50,
  maxAgeMs: 30 * 24 * 60 * 60 * 1000, dedupeMs: 10_000
} as const;
export interface LocalNotification {
  source: 'local';
  id: string;
  type: Exclude<NotificationType, 'loading'>;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  action: { label: string; url: string } | null;
}
export type NotificationItem = LocalNotification | (UserNotification & { source: 'account' });
export type LocalNotificationInput = Pick<LocalNotification, 'type' | 'title'> & Partial<Pick<LocalNotification, 'message' | 'action'>>;
export const LOCAL_ACTION_URLS = ['/carrito', '/checkout', '/contacto'] as const;
