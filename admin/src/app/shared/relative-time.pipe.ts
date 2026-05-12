import { inject, LOCALE_ID, Pipe, PipeTransform } from '@angular/core';

/**
 * "3 hours ago" via `Intl.RelativeTimeFormat`. Falls back to ISO when input is null.
 * Locale-aware: matches the active LOCALE_ID.
 */
@Pipe({ name: 'relativeTime', standalone: true, pure: true })
export class RelativeTimePipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);

  transform(value: string | Date | null | undefined, emDashOnNull = '—'): string {
    if (!value) return emDashOnNull;
    const date = value instanceof Date ? value : new Date(value);
    const diffMs = date.getTime() - Date.now();
    const diffSec = Math.round(diffMs / 1000);
    const abs = Math.abs(diffSec);
    const rtf = new Intl.RelativeTimeFormat(this.locale, { numeric: 'auto' });
    if (abs < 60) return rtf.format(diffSec, 'second');
    if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
    if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), 'day');
    if (abs < 86400 * 365) return rtf.format(Math.round(diffSec / (86400 * 30)), 'month');
    return rtf.format(Math.round(diffSec / (86400 * 365)), 'year');
  }
}
