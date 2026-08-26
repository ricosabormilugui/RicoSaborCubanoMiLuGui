import { Injectable, computed, effect, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { CustomerAuthService } from './customer-auth.service';
import { NotificationService } from './notification.service';
import { resolveApiBaseUrl } from '../config/api.config';
import { ApiRequestError, requestJson } from '../utils/api-client';
import { getUserFriendlyError } from '../utils/user-friendly-error';
import { NotificationFilters, NotificationPage, UserNotification } from '../notifications/user-notification.types';

type View = 'recent' | 'history';
const emptyPage = (): NotificationPage => ({ notifications: [], nextCursor: null });

@Injectable({ providedIn: 'root' })
export class UserNotificationsService {
  private readonly endpoint = `${resolveApiBaseUrl()}/notifications`;
  private readonly owner = signal('');
  private readonly recentState = signal<NotificationPage>(emptyPage());
  private readonly historyState = signal<NotificationPage>(emptyPage());
  private readonly countState = signal(0);
  private readonly errorState = signal('');
  private readonly loadingState = signal({ recent: false, history: false });
  private readonly busyState = signal(false);
  private sequence = { recent: 0, history: 0, count: 0 };
  private mutationSequence = 0;
  private filters: NotificationFilters = {};
  private historyRequested = false;
  readonly session = computed(() => this.auth.token() && this.auth.profile()?.userId
    ? `${this.auth.sessionVersion()}:${this.auth.profile()!.userId}:${this.auth.token()}` : '');
  private readonly current = computed(() => !!this.session() && this.session() === this.owner());
  readonly recent = computed(() => this.current() ? this.recentState().notifications : []);
  readonly history = computed(() => this.current() ? this.historyState().notifications : []);
  readonly nextCursor = computed(() => this.current() ? this.historyState().nextCursor : null);
  readonly unreadCount = computed(() => this.current() ? this.countState() : 0);
  readonly error = computed(() => this.current() ? this.errorState() : '');
  readonly loading = computed(() => this.current() ? this.loadingState() : { recent: false, history: false });
  readonly busy = computed(() => this.current() && this.busyState());

  constructor(private readonly auth: CustomerAuthService, private readonly toasts: NotificationService, router: Router) {
    effect(() => { this.session(); untracked(() => { this.synchronize(); void this.refreshCount(); }); });
    router.events.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event instanceof NavigationEnd) void this.refreshCount();
    });
  }

  private synchronize(): string {
    const key = this.session();
    if (this.owner() !== key) {
      this.owner.set(key);
      this.recentState.set(emptyPage());
      this.historyState.set(emptyPage());
      this.countState.set(0);
      this.errorState.set('');
      this.busyState.set(false);
      this.loadingState.set({ recent: false, history: false });
      this.filters = {};
      this.historyRequested = false;
      this.invalidate();
    }
    return key;
  }
  private invalidate(): void { this.sequence.recent++; this.sequence.history++; this.sequence.count++; }
  private isCurrent(key: string): boolean { return !!key && this.session() === key && this.owner() === key; }
  private request<T>(path: string, method = 'GET'): Promise<T> {
    return requestJson<T>(this.endpoint + path, {
      method, cache: 'no-store', headers: { Authorization: `Bearer ${this.auth.token()}` }
    }, 'No se pudieron actualizar tus notificaciones.');
  }
  private failed(error: unknown, key: string, announce = false): void {
    if (!this.isCurrent(key)) return;
    if (error instanceof ApiRequestError && [401, 403].includes(error.status)) {
      this.auth.logout();
      this.synchronize();
      this.toasts.warning('Sesión caducada', 'Inicia sesión nuevamente.', { key: 'session-expired' });
      return;
    }
    const message = getUserFriendlyError(error, 'No se pudieron cargar tus notificaciones. Inténtalo de nuevo.');
    this.errorState.set(message);
    if (announce) this.toasts.error('Notificaciones', message, { key: 'notification-action' });
  }
  async refreshCount(): Promise<void> {
    const key = this.synchronize();
    if (!key || this.busyState()) return;
    const sequence = ++this.sequence.count;
    try {
      const result = await this.request<{ unreadCount: number }>('/unread-count');
      if (this.isCurrent(key) && sequence === this.sequence.count) this.countState.set(result.unreadCount);
    } catch (error) { if (sequence === this.sequence.count) this.failed(error, key); }
  }
  async load(view: View, filters: NotificationFilters = {}, append = false): Promise<void> {
    const key = this.synchronize();
    if (!key || this.busyState()) return;
    if (view === 'history') { this.filters = filters; this.historyRequested = true; }
    const state = view === 'recent' ? this.recentState : this.historyState;
    const cursor = append ? state().nextCursor : null;
    if (append && !cursor) return;
    const sequence = ++this.sequence[view];
    this.loadingState.update(value => ({ ...value, [view]: true }));
    this.errorState.set('');
    if (!append) state.set(emptyPage());
    const query = new URLSearchParams({ limit: view === 'recent' ? '5' : '20' });
    if (filters.read !== undefined) query.set('read', String(filters.read));
    if (filters.type) query.set('type', filters.type);
    if (cursor) query.set('cursor', cursor);
    try {
      const page = await this.request<NotificationPage>('?' + query);
      if (!this.isCurrent(key) || sequence !== this.sequence[view]) return;
      const previous = append ? state().notifications : [];
      const ids = new Set(previous.map(item => item.id));
      state.set({ ...page, notifications: [...previous, ...page.notifications.filter(item => !ids.has(item.id))] });
    } catch (error) { if (sequence === this.sequence[view]) this.failed(error, key); }
    finally {
      if (this.isCurrent(key) && sequence === this.sequence[view]) this.loadingState.update(value => ({ ...value, [view]: false }));
    }
  }
  markRead(item: UserNotification): Promise<boolean> {
    return item.read ? Promise.resolve(!!this.synchronize()) : this.mutate(`/${encodeURIComponent(item.id)}/read`, 'PATCH');
  }
  markAllRead(): Promise<boolean> { return this.mutate('/read-all', 'PATCH'); }
  remove(item: UserNotification): Promise<boolean> { return this.mutate(`/${encodeURIComponent(item.id)}`, 'DELETE'); }
  private async mutate(path: string, method: string): Promise<boolean> {
    const key = this.synchronize();
    if (!key || this.busyState()) return false;
    const mutation = ++this.mutationSequence;
    this.busyState.set(true);
    this.invalidate();
    this.loadingState.set({ recent: false, history: false });
    this.errorState.set('');
    try {
      await this.request(path, method);
      if (!this.isCurrent(key)) return false;
      this.busyState.set(false);
      await Promise.all([this.refreshCount(), this.load('recent'), ...(this.historyRequested ? [this.load('history', this.filters)] : [])]);
      return this.isCurrent(key);
    } catch (error) { this.failed(error, key, true); return false; }
    finally { if (this.isCurrent(key) && mutation === this.mutationSequence) this.busyState.set(false); }
  }
}
