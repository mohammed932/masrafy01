import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'masrafy.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _current = signal<Theme>(this.resolveInitial());
  readonly current = this._current.asReadonly();

  constructor() {
    this.apply(this._current());
  }

  toggle(): void {
    this.set(this._current() === 'dark' ? 'light' : 'dark');
  }

  set(theme: Theme): void {
    this._current.set(theme);
    this.apply(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage unavailable (private mode) — best-effort.
    }
  }

  private apply(theme: Theme): void {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }
  }

  private resolveInitial(): Theme {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') return stored;
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }
}
