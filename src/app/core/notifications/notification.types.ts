export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'loading';
export type NotificationId = string | number;

export interface NotificationOptions {
  id?: NotificationId;
  /** Repeated calls with this key replace the visible notification. */
  key?: string;
  duration?: number;
  action?: { label: string; handler: () => void | Promise<unknown> };
}

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'default';
  closeOnEscape?: boolean;
}
