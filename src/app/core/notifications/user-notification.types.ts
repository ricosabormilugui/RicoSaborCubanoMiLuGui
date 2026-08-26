export type UserNotificationType = 'order' | 'account' | 'system' | 'promotion' | 'warning' | 'info';
export interface UserNotification {
  id: string;
  type: UserNotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  readAt: string | null;
  action: { label: string; url: string } | null;
  entity: { type: string; id: string } | null;
}
export interface NotificationFilters { read?: boolean; type?: UserNotificationType }
export interface NotificationPage { notifications: UserNotification[]; nextCursor: string | null }
export const notificationBadge = (count: number): string => count > 99 ? '99+' : count > 0 ? String(count) : '';
// Server actions are local destinations; never turn stored content into an external redirect.
export const notificationDestination = (item: UserNotification): string | null =>
  item.action && ['/mis-pedidos', '/mis-notificaciones', '/contacto'].includes(item.action.url) ? item.action.url : null;
