import { Injectable, computed, signal } from '@angular/core';

export type CookieCategory = 'necessary' | 'analytics' | 'marketing';

export interface CookieConsentPreferences {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  decidedAt: string;
  version: 1;
}

const STORAGE_KEY = 'ricosabor-cookie-consent-v1';

function readStoredPreferences(): CookieConsentPreferences | null {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CookieConsentPreferences>;
    if (parsed.version !== 1 || parsed.necessary !== true) return null;

    return {
      necessary: true,
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      decidedAt: String(parsed.decidedAt ?? new Date().toISOString()),
      version: 1
    };
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class CookieConsentService {
  private readonly preferencesSignal = signal<CookieConsentPreferences | null>(readStoredPreferences());

  readonly preferences = this.preferencesSignal.asReadonly();
  readonly hasDecision = computed(() => this.preferencesSignal() !== null);

  acceptAll(): void {
    this.save({ analytics: true, marketing: true });
  }

  rejectOptional(): void {
    this.save({ analytics: false, marketing: false });
  }

  save(options: { analytics: boolean; marketing: boolean }): void {
    const preferences: CookieConsentPreferences = {
      necessary: true,
      analytics: options.analytics,
      marketing: options.marketing,
      decidedAt: new Date().toISOString(),
      version: 1
    };

    this.preferencesSignal.set(preferences);

    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {}
  }

  reset(): void {
    this.preferencesSignal.set(null);
    try {
      globalThis.localStorage?.removeItem(STORAGE_KEY);
    } catch {}
  }

  canUse(category: CookieCategory): boolean {
    if (category === 'necessary') return true;
    return Boolean(this.preferencesSignal()?.[category]);
  }
}
