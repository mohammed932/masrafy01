import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'masrafy.theme';

/**
 * Dark mode driven by `[data-theme='dark']` on `<html>`. NG-ZORRO uses the
 * variable theme (`ng-zorro-antd.variable.min.css`) so all `--ant-*` overrides
 * cascade through component internals — no separate dark CSS bundle needed.
 *
 * Resolution order: localStorage → system `prefers-color-scheme` → default light.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _current = signal<Theme>('light');
  readonly current = this._current.asReadonly();

  constructor() {
    this.apply(this.initial());
  }

  toggle(): void {
    this.set(this._current() === 'dark' ? 'light' : 'dark');
  }

  set(theme: Theme): void {
    this.apply(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // best-effort
    }
  }

  private initial(): Theme {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  private apply(theme: Theme): void {
    this._current.set(theme);
    const root = document.documentElement;
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }
  }
}
