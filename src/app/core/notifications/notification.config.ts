import { NotificationType } from './notification.types';

export const NOTIFICATION_DURATIONS: Readonly<Record<NotificationType, number>> = {
  success: 3500,
  info: 4000,
  warning: 5500,
  error: 7000,
  loading: Number.POSITIVE_INFINITY
};
