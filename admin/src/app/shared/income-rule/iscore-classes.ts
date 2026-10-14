import type { IncomeBand } from '@features/bank-programs/bank-programs.types';
import type { EnumerationRow } from '@features/lookups/lookups.api.service';

/** The I-Score classes lookup on Manage values. */
export const I_SCORE_CLASS_TYPE = 'i_score_class';

/**
 * An I-Score tier table built from the class lookup: one band per active class, in score
 * order, at the class's income percentage — the SHARED table every program reads when it
 * states none (v30.4.0). A class with no percentage yet reads 100%.
 *
 * The ends are opened (the first band from 0, the last with no top) because a tier table must
 * cover every score (the server's `coverAll`): a score outside the bureau's range reads as the
 * nearest class instead of refusing the quote. A class with no range is skipped; so is one
 * whose range starts inside the previous one, which the list would otherwise turn into a band
 * that ends before it begins. `[]` when nothing usable is left.
 */
export function bandsFromIScoreClasses(rows: readonly EnumerationRow[]): IncomeBand[] {
  const classes = rows
    .filter((r) => r.active && typeof r.rangeFrom === 'number' && typeof r.rangeTo === 'number')
    .sort((a, b) => (a.rangeFrom as number) - (b.rangeFrom as number));
  const kept: Array<{ from: number; percent: string }> = [];
  for (const cls of classes) {
    const from = cls.rangeFrom as number;
    const previous = kept[kept.length - 1];
    if (previous === undefined || from > previous.from) {
      kept.push({ from, percent: percentText(cls.incomePercent) });
    }
  }
  return kept.map((cls, index) => {
    const next = kept[index + 1];
    return {
      fromInclusive: index === 0 ? '0' : String(cls.from),
      toExclusive: next === undefined ? null : String(next.from),
      incomeEGP: cls.percent,
    };
  });
}

/** `'110.0000'` → `'110'`; absent → `'100'`. The table editor shows what it is given. */
export function percentText(raw: string | null | undefined): string {
  if (raw === null || raw === undefined || raw.trim() === '') return '100';
  const n = Number(raw);
  return Number.isFinite(n) ? String(n) : '100';
}
