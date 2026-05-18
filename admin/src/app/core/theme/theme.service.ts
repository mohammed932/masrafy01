import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'masrafy.theme';

// Dark mode is gated until ng-zorro-antd.dark.min.css is wired alongside
// the variable theme. Custom CSS vars adapt via [data-theme='dark'], but
// NG-ZORRO components stay on light defaults and clash visually. Lock light.
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _current = signal<Theme>('light');
  readonly current = this._current.asReadonly();

  constructor() {
    this.apply('light');
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // localStorage unavailable (private mode) — best-effort.
    }
  }

  toggle(): void {
    // no-op until ng-zorro dark CSS bundle is integrated.
  }

  set(_theme: Theme): void {
    // no-op until ng-zorro dark CSS bundle is integrated.
  }

  private apply(theme: Theme): void {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }
  }
}
