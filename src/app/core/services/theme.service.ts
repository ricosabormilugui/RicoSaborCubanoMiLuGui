import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

export type ThemeMode = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'theme-mode';
export const DEFAULT_THEME: ThemeMode = 'light';

export function parseThemeMode(value: string | null | undefined): ThemeMode | null {
  return value === 'light' || value === 'dark' ? value : null;
}

export function resolveThemeMode(value: string | null | undefined): ThemeMode {
  return parseThemeMode(value) ?? DEFAULT_THEME;
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly windowRef = this.document.defaultView;
  private readonly storedTheme = this.readStoredTheme();
  private hasExplicitPreference = this.storedTheme !== null;

  readonly mode = signal<ThemeMode>(this.storedTheme ?? DEFAULT_THEME);

  constructor() {
    effect(() => this.applyTheme(this.mode()));
    this.listenForExternalChanges();
  }

  toggle(): void {
    this.setTheme(this.mode() === 'dark' ? 'light' : 'dark');
  }

  setTheme(theme: ThemeMode): void {
    this.hasExplicitPreference = true;
    this.mode.set(theme);
  }

  private readStoredTheme(): ThemeMode | null {
    try {
      return parseThemeMode(this.windowRef?.localStorage.getItem(THEME_STORAGE_KEY));
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

      const stored = parseThemeMode(event.newValue);
      this.hasExplicitPreference = stored !== null;
      this.mode.set(stored ?? DEFAULT_THEME);
    });
  }
}
