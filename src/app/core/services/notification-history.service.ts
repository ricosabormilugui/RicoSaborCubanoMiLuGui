import { Inject, Injectable, InjectionToken, OnDestroy, computed, signal } from '@angular/core';
import { LOCAL_ACTION_URLS, LOCAL_NOTIFICATION_CONFIG as config, LocalNotification, LocalNotificationInput } from '../notifications/local-notification.types';

type HistoryStorage = Pick<Storage, 'getItem' | 'setItem'>;
export const LOCAL_NOTIFICATION_STORAGE = new InjectionToken<HistoryStorage | null>('Local notification storage', {
  providedIn: 'root', factory: () => { try { return globalThis.localStorage ?? null; } catch { return null; } }
});
const types = ['success', 'error', 'warning', 'info'];
// Presentation-only copy. Reject common sensitive/technical values, never serialize toast objects.
function safeText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (text.length > max || /[<>]|https?:|\bBearer\b|\beyJ[\w-]+\.[\w-]+\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\d[\s()+-]*){7,}/i.test(text)) return '';
  return text;
}
function safeAction(value: unknown): LocalNotification['action'] {
  const action = value as Partial<NonNullable<LocalNotification['action']>> | null;
  const label = safeText(action?.label, 60);
  return label && LOCAL_ACTION_URLS.includes(action?.url as typeof LOCAL_ACTION_URLS[number]) ? { label, url: action!.url! } : null;
}

@Injectable({ providedIn: 'root' })
export class NotificationHistoryService implements OnDestroy {
  private readonly state = signal<LocalNotification[]>([]);
  readonly items = this.state.asReadonly();
  readonly unreadCount = computed(() => this.items().filter(item => !item.read).length);
  readonly storageWarning = signal('');
  private dirty = false;
  private readonly onStorage = (event: StorageEvent): void => {
    if (event.key === config.storageKey || event.key === null) this.reload();
  };
  constructor(@Inject(LOCAL_NOTIFICATION_STORAGE) private readonly storage: HistoryStorage | null) {
    this.reload();
    globalThis.addEventListener?.('storage', this.onStorage);
  }
  ngOnDestroy(): void { globalThis.removeEventListener?.('storage', this.onStorage); }

  private normalize(values: unknown, now = Date.now()): LocalNotification[] {
    if (!Array.isArray(values)) return [];
    const ids = new Set<string>();
    return values.slice(0, 500).flatMap(value => {
      if (!value || typeof value !== 'object') return [];
      const title = safeText(value.title, 120), message = safeText(value.message, 300);
      const at = Date.parse(value.createdAt);
      if (!title || !types.includes(value.type) || typeof value.id !== 'string' || !/^local-[a-z0-9-]{1,80}$/i.test(value.id) || ids.has(value.id) || !Number.isFinite(at) || at > now || now - at >= config.maxAgeMs || typeof value.read !== 'boolean') return [];
      ids.add(value.id);
      return [{ source: 'local' as const, id: value.id, type: value.type, title, message, read: value.read, createdAt: new Date(at).toISOString(), action: safeAction(value.action) }];
    }).sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0, config.limit);
  }
  reload(): void {
    if (this.dirty) { this.persist(); return; }
    try {
      if (!this.storage) throw new Error('Storage unavailable');
      const raw = this.storage.getItem(config.storageKey);
      if (raw && raw.length > 100_000) throw new Error('Invalid storage');
      const data = raw ? JSON.parse(raw) : null;
      const rows = this.normalize(data?.version === config.version ? data.items : []);
      this.state.set(rows);
      if (raw && JSON.stringify({ version: config.version, items: rows }) !== raw) this.persist();
      else this.storageWarning.set('');
    } catch {
      // Keep in-memory activity if the browser blocks access; malformed JSON is replaced on the next write.
      this.storageWarning.set('La actividad solo se conservará durante esta sesión si el navegador no permite guardarla.');
    }
  }
  private persist(): void {
    try {
      if (!this.storage) throw new Error('Storage unavailable');
      this.storage.setItem(config.storageKey, JSON.stringify({ version: config.version, items: this.state() }));
      this.dirty = false;
      this.storageWarning.set('');
    } catch { this.dirty = true; this.storageWarning.set('No se pudo guardar la actividad en este navegador. Se mantiene solo en esta sesión.'); }
  }
  add(input: LocalNotificationInput, createdAt = Date.now()): void {
    const title = safeText(input.title, 120), message = safeText(input.message, 300);
    if (!title || !types.includes(input.type)) return;
    const now = Date.now();
    if (createdAt > now || now - createdAt >= config.maxAgeMs) return;
    const items = this.normalize(this.state(), now);
    // Identical presentation within ten seconds remains one activity, even after marking it read.
    if (items.some(item => item.type === input.type && item.title === title && item.message === message && Math.abs(createdAt - Date.parse(item.createdAt)) < config.dedupeMs)) return;
    const id = `local-${globalThis.crypto?.randomUUID?.() ?? `${now.toString(36)}-${Math.random().toString(36).slice(2)}`}`;
    this.state.set(this.normalize([{ source: 'local', id, type: input.type, title, message, createdAt: new Date(createdAt).toISOString(), read: false, action: safeAction(input.action) }, ...items], now));
    this.persist();
  }
  markRead(id: string): boolean {
    if (!this.state().some(item => item.id === id)) return false;
    this.state.update(items => items.map(item => item.id === id ? { ...item, read: true } : item));
    this.persist(); return true;
  }
  markAllRead(): void { this.state.update(items => items.map(item => ({ ...item, read: true }))); this.persist(); }
  remove(id: string): boolean {
    if (!this.state().some(item => item.id === id)) return false;
    this.state.update(items => items.filter(item => item.id !== id)); this.persist(); return true;
  }
  clear(): void { this.state.set([]); this.persist(); }
}
