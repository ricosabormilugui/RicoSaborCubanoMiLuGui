import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

export type ThemeMode = 'dark' | 'light';

const THEME_STORAGE_KEY = 'theme-mode';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly windowRef = this.document.defaultView;
  private readonly storedTheme = this.readStoredTheme();
  private hasExplicitPreference = this.storedTheme !== null;

  readonly mode = signal<ThemeMode>(this.storedTheme ?? this.getPreferredTheme());

  constructor() {
    effect(() => this.applyTheme(this.mode()));
    this.listenForExternalChanges();
    this.listenForSystemPreferenceChanges();
  }

  toggle(): void {
    this.hasExplicitPreference = true;
    this.mode.set(this.mode() === 'dark' ? 'light' : 'dark');
  }

  setTheme(theme: ThemeMode): void {
    this.hasExplicitPreference = true;
    this.mode.set(theme);
  }

  private getPreferredTheme(): ThemeMode {
    return this.windowRef?.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  private readStoredTheme(): ThemeMode | null {
    try {
      const stored = this.windowRef?.localStorage.getItem(THEME_STORAGE_KEY);
      return stored === 'light' || stored === 'dark' ? stored : null;
    } catch {
      return null;
    }
  }

  private applyTheme(theme: ThemeMode): void {
    const root = this.document.documentElement;
    const body = this.document.body;

    root.setAttribute('data-theme', theme);
    root.classList.toggle('theme-light', theme === 'light');
    root.classList.toggle('theme-dark', theme === 'dark');
    root.style.colorScheme = theme;

    body?.setAttribute('data-theme', theme);
    body?.classList.toggle('theme-light', theme === 'light');
    body?.classList.toggle('theme-dark', theme === 'dark');
    if (body) body.style.colorScheme = theme;

    if (!this.hasExplicitPreference) return;

    try {
      this.windowRef?.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage failures; the in-memory theme still updates immediately.
    }
  }

  private listenForExternalChanges(): void {
    this.windowRef?.addEventListener('storage', (event) => {
      if (event.key !== THEME_STORAGE_KEY) return;

      if (event.newValue === 'light' || event.newValue === 'dark') {
        this.hasExplicitPreference = true;
        this.mode.set(event.newValue);
        return;
      }

      this.hasExplicitPreference = false;
      this.mode.set(this.getPreferredTheme());
    });
  }

  private listenForSystemPreferenceChanges(): void {
    const media = this.windowRef?.matchMedia?.('(prefers-color-scheme: light)');
    media?.addEventListener?.('change', (event) => {
      if (!this.hasExplicitPreference) {
        this.mode.set(event.matches ? 'light' : 'dark');
      }
    });
  }
}
