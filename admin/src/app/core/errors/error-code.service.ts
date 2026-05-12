import { inject, Injectable, LOCALE_ID } from '@angular/core';
import type { ErrorCode } from '../auth/auth.types';
import arEG from '../../../i18n/error-codes.ar-EG.json';
import enUS from '../../../i18n/error-codes.en-US.json';

type Catalog = Record<string, string>;

/**
 * Sole error-code → localized-message helper (Principle III, A22).
 * Components and interceptors MUST go through this service; per-component
 * mapping helpers are a review block.
 */
@Injectable({ providedIn: 'root' })
export class ErrorCodeService {
  private readonly locale = inject(LOCALE_ID);

  private get catalog(): Catalog {
    return this.locale.startsWith('en') ? (enUS as Catalog) : (arEG as Catalog);
  }

  toLocalizedMessage(code: ErrorCode, meta?: Record<string, unknown>): string {
    const template = this.catalog[code] ?? this.catalog['INTERNAL_ERROR'] ?? code;
    return this.interpolate(template, meta);
  }

  private interpolate(template: string, meta: Record<string, unknown> | undefined): string {
    if (!meta) return template;
    return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
      const value = meta[key];
      return value === undefined || value === null ? `{${key}}` : String(value);
    });
  }
}
