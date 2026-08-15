import { LOAN_CATEGORIES, canonicalCategories, type LoanCategory } from '@core/loan-category';
import type { IncomeBasis } from '@core/income-basis';
import type { EnumerationRow } from '../lookups/lookups.api.service';

/** The `platform_enumeration` type the whole catalog feature is about. */
export const ENUM_TYPE = 'program_name';

/** Question codes a name suggests scoring on, per loan category. */
export type QuestionsByCategory = Readonly<Record<LoanCategory, readonly string[]>>;

/**
 * How a name may be sold, per loan category — `[]` for a category it is not
 * offered under, which is why this is filled for all four keys like the questions
 * map rather than left partial.
 */
export type BasesByCategory = Readonly<Record<LoanCategory, readonly IncomeBasis[]>>;

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
   * How this name is SOLD under each category — `['payslip']`, `['no_payslip']`,
   * or both. Empty for a category it is not offered under. Always has all four
   * keys, like `questions`.
   */
  bases: BasesByCategory;
  /**
   * Question codes this name SUGGESTS scoring on, per category. Always has all
   * four keys — see `fillCategories`.
   */
  questions: QuestionsByCategory;
  /**
   * The no-payslip counters are carried through rather than dropped at this boundary:
   * the detail screen has to be able to say "2 bank programs read these facts and have
   * no table yet", and it used to be structurally unable to, because this row narrowed
   * `usage` to two fields while the LIST badged the gap from the other two.
   */
  usage: {
    programs: number;
    banks: number;
    noPayslipPrograms: number;
    noPayslipProgramsWithoutTable: number;
  };
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
 * Same fill for the basis map, and for the same reason — except here an empty
 * array carries a meaning the questions map does not have: "not offered under
 * this loan type". Both readings agree that there is nothing to render, so the
 * screens never have to tell them apart.
 */
function fillBases(
  byCategory: Partial<Record<LoanCategory, readonly IncomeBasis[]>> | undefined,
): BasesByCategory {
  const out = {} as Record<LoanCategory, readonly IncomeBasis[]>;
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
        bases: fillBases(r.incomeBasesByCategory),
        questions: fillCategories(r.questionsByCategory),
        usage: r.usage ?? {
          programs: 0,
          banks: 0,
          noPayslipPrograms: 0,
          noPayslipProgramsWithoutTable: 0,
        },
      })),
  };
}
