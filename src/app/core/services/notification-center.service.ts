import { Injectable, computed, signal } from '@angular/core';
import { CustomerAuthService } from './customer-auth.service';
import { UserNotificationsService } from './user-notifications.service';
import { NotificationHistoryService } from './notification-history.service';
import { ConfirmDialogService } from './confirm-dialog.service';
import { NotificationItem, LOCAL_ACTION_URLS } from '../notifications/local-notification.types';
import { NotificationFilters, UserNotification, notificationDestination } from '../notifications/user-notification.types';

export interface ActivityFilters { read?: boolean; type?: NotificationItem['type'] }
@Injectable({ providedIn: 'root' })
export class NotificationCenterService {
  readonly isAccount = computed(() => this.auth.isAuthenticated());
  readonly session = computed(() => `${this.auth.sessionVersion()}:${this.isAccount() ? 'account:' + this.account.session() : 'guest'}`);
  private readonly filters = signal<ActivityFilters>({});
  private readonly limit = signal(20);
  private readonly filtered = computed(() => this.local.items().filter(item => (this.filters().read === undefined || item.read === this.filters().read) && (!this.filters().type || item.type === this.filters().type)));
  readonly recent = computed<NotificationItem[]>(() => this.isAccount() ? this.account.recent().map(item => ({ ...item, source: 'account' })) : this.local.items().slice(0,5));
  readonly history = computed<NotificationItem[]>(() => this.isAccount() ? this.account.history().map(item => ({ ...item, source: 'account' })) : this.filtered().slice(0,this.limit()));
  readonly unreadCount = computed(() => this.isAccount() ? this.account.unreadCount() : this.local.unreadCount());
  readonly nextCursor = computed(() => this.isAccount() ? this.account.nextCursor() : this.filtered().length > this.limit() ? 'local-more' : null);
  readonly busy = computed(() => this.isAccount() && this.account.busy());
  readonly loading = computed(() => this.isAccount() ? this.account.loading() : { recent: false, history: false });
  readonly error = computed(() => this.isAccount() ? this.account.error() : '');
  readonly storageWarning = computed(() => this.isAccount() ? '' : this.local.storageWarning());
  readonly localCount = computed(() => this.isAccount() ? 0 : this.local.items().length);
  constructor(private readonly auth: CustomerAuthService, private readonly account: UserNotificationsService, private readonly local: NotificationHistoryService, private readonly confirm: ConfirmDialogService) {}
  async load(view: 'recent' | 'history', filters: ActivityFilters = {}, append = false): Promise<void> {
    if (this.isAccount()) return this.account.load(view, filters as NotificationFilters, append);
    this.local.reload();
    if (view === 'history') { this.filters.set(filters); this.limit.update(limit => append ? limit + 20 : 20); }
  }
  async refreshCount(): Promise<void> { if (this.isAccount()) await this.account.refreshCount(); }
  async markRead(item: NotificationItem): Promise<boolean> {
    return item.source === 'local' ? !this.isAccount() && this.local.markRead(item.id) : this.isAccount() && this.account.markRead(item);
  }
  async markAllRead(): Promise<boolean> {
    if (this.isAccount()) return this.account.markAllRead();
    this.local.markAllRead(); return true;
  }
  async remove(item: NotificationItem): Promise<boolean> {
    return item.source === 'local' ? !this.isAccount() && this.local.remove(item.id) : this.isAccount() && this.account.remove(item);
  }
  destination(item: NotificationItem): string | null {
    if (item.source === 'account') return notificationDestination(item as UserNotification);
    return item.action && LOCAL_ACTION_URLS.includes(item.action.url as typeof LOCAL_ACTION_URLS[number]) ? item.action.url : null;
  }
  async clearLocal(): Promise<void> {
    if (this.isAccount()) return;
    const session = this.session();
    const confirmed = await this.confirm.open({ title: '¿Limpiar actividad reciente?', message: 'Se eliminarán los avisos guardados en este navegador. Tus notificaciones de cuenta no se modificarán.', confirmText: 'Limpiar actividad', variant: 'danger' });
    if (confirmed && !this.isAccount() && session === this.session()) this.local.clear();
  }
}
