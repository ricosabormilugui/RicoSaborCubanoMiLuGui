export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'loading';
export type NotificationId = string | number;

export interface NotificationOptions {
  /** Explicit opt-in for device activity, with or without login; descriptions are never copied. */
  saveToHistory?: boolean;
  history?: {
    message?: string;
    action?: { label: string; url: string };
    sessionVersion?: number;
    /** Only when this exact event already creates its account notification on the backend. */
    accountEquivalent?: boolean;
  };
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
