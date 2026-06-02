import { Pipe, type PipeTransform } from '@angular/core';

/**
 * Turns raw enum/registry codes into readable labels for admin display:
 *   'income_proof'        → 'Income Proof'
 *   'government_employee' → 'Government Employee'
 *   ['gov', 'private']    → 'Gov, Private'
 *
 * Underscores/hyphens become spaces; each word is capitalized. Accepts a single
 * code or an array (joined with ', '). Presentation-only — the stored code is
 * never mutated.
 */
@Pipe({ name: 'humanize', standalone: true })
export class HumanizePipe implements PipeTransform {
  transform(value: string | readonly string[] | null | undefined): string {
    if (value == null) return '';
    const items = Array.isArray(value) ? value : [value as string];
    return items.map(humanizeOne).filter((s) => s.length > 0).join(', ');
  }
}

function humanizeOne(raw: string): string {
  return String(raw)
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
