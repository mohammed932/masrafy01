import { LOAN_CATEGORIES, canonicalCategories, type LoanCategory } from '@core/loan-category';
import type { EnumerationRow } from '../lookups/lookups.api.service';

/** The `platform_enumeration` type the whole catalog feature is about. */
export const ENUM_TYPE = 'program_name';

/** Question codes a name suggests scoring on, per loan category. */
export type QuestionsByCategory = Readonly<Record<LoanCategory, readonly string[]>>;

/**
 * A catalog name as the detail screen and the list need it. Narrower than
 * `EnumerationRow` on purpose: most of its twelve fields are irrelevant here, and
 * mapping at the boundary gives the optional wire fields one place to be
 * normalised instead of a `?? []` at every read site.
 */
export interface ProgramNameRow {
  id: string;
  key: string;
  labelEn: string;
  labelAr: string;
  active: boolean;
  /** Loan categories this name may be OFFERED under. Empty = parked. */
  categories: LoanCategory[];
  /**
   * Question codes this name SUGGESTS scoring on, per category. Always has all
   * four keys — see `fillCategories`.
   */
  questions: QuestionsByCategory;
  usage: { programs: number; banks: number };
}

/**
 * Wire map → all four keys present, missing ones as `[]`.
 *
 * The server omits a category with nothing suggested, which is correct on the
 * wire (absent and empty mean the same thing on this axis) and hostile in a
 * template: every tab would need `?? []` and the one that forgot would render
 * `undefined.length`. Filled once, here.
 */
function fillCategories(
  byCategory: Partial<Record<LoanCategory, readonly string[]>> | undefined,
): QuestionsByCategory {
  const out = {} as Record<LoanCategory, readonly string[]>;
  for (const category of LOAN_CATEGORIES) out[category] = [...(byCategory?.[category] ?? [])];
  return out;
}

/**
 * Wire rows → board rows.
 *
 * Deprecated names are dropped: they can never be picked again, so configuring
 * them is busywork. Inactive ones are kept — an operator reactivates a name and
 * expects its configuration to already be right, not to have to redo it.
 *
 * `deprecatedCount` is returned rather than discarded so the list can footnote
 * the difference; otherwise its count silently disagrees with the stat strip and
 * someone files a bug.
 */
export function absorbProgramNames(list: EnumerationRow[]): {
  rows: ProgramNameRow[];
  deprecatedCount: number;
} {
  return {
    deprecatedCount: list.filter((r) => r.deprecatedAt).length,
    rows: list
      .filter((r) => !r.deprecatedAt)
      .map((r) => ({
        id: r.id,
        key: r.key,
        labelEn: r.labelEn,
        labelAr: r.labelAr,
        active: r.active,
        categories: canonicalCategories(r.categories ?? []),
        questions: fillCategories(r.questionsByCategory),
        usage: r.usage ?? { programs: 0, banks: 0 },
      })),
  };
}
