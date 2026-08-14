import type { LoanCategory } from './loan-category';

/**
 * The question codes a no-payslip income rule can read a FACT from — the fact the
 * bank's table looks up to produce an assumed income.
 *
 * Mirrors the backend `SURROGATE_FACT_SPECS`
 * (`matching/pipeline/surrogate-fact-bindings.ts`), which is a CODE CONSTANT there
 * for the same reason it is one here: A33 forbids a scoring or profile-mapping field
 * on `Question`, so the binding cannot be data. Duplicating four strings across the
 * two surfaces is the accepted cost — the backend asserts each one resolves to a
 * live question (`test/unit/surrogate-binding-codes.spec.ts`), so a rename fails
 * there, loudly, before this list can go quietly stale.
 *
 * `credit_card_total_limit` is not a new question: the card limit already feeds the
 * 5% obligation discount, and one fact asked once serves both.
 */
export const SURROGATE_FACT_QUESTION_CODES: readonly string[] = [
  'military_grade',
  'academic_rank',
  'years_in_practice',
  'credit_card_total_limit',
];

/**
 * The fact question each income method reads, mirroring the backend
 * `SURROGATE_FACTS_BY_STRATEGY`. Only four of the eleven methods read a question; the rest
 * read profile fields no question fills yet, and are listed with `null` rather than omitted
 * so a reader can tell "reads nothing askable" from "not a method".
 *
 * Duplicated across the two surfaces for the same reason the codes above are: A33 forbids
 * making the binding data, and the backend test asserts each code resolves to a live
 * question, so a rename fails there before this map can go stale.
 */
export const SURROGATE_FACT_BY_METHOD: Readonly<Record<string, string | null>> = {
  byMilitaryGrade: 'military_grade',
  byProfessorRank: 'academic_rank',
  byYearsInPractice: 'years_in_practice',
  byCreditCardLimit: 'credit_card_total_limit',
  byYearsInJob: null,
  byCDValue: null,
  byTotalDeposits: null,
  byCarInstallment: null,
  byCarLoanAmount: null,
  byBankStatementPercent: null,
  declared: null,
};

/** The shape every derivation below needs — a question and who is asked it. */
export interface FactAssignable {
  readonly code: string;
  readonly categories: readonly LoanCategory[];
}

/** The shape of a catalog name for the derivations below. */
export interface FactPickable {
  readonly questionsByCategory: Partial<Record<LoanCategory, readonly string[]>>;
}

/**
 * Which of the four facts a loan category's applicants are actually ASKED.
 *
 * THIS is what makes a category able to sell a no-payslip program, and it is why no
 * hardcoded capable-category list exists on either surface any more (v16.0.0). v15.x
 * froze the answer into a constant — first `['fast']`, then `['personal','car','fast']` —
 * so widening the product meant a release. It is now a plain consequence of the
 * questionnaire: a bank cannot work an income out from a fact nobody was asked, and the
 * admin turns any category on by assigning one of these questions to it on
 * `/questionnaire/categories`.
 */
export function surrogateFactsAskedIn(
  pool: readonly FactAssignable[],
  category: LoanCategory,
): string[] {
  return SURROGATE_FACT_QUESTION_CODES.filter((code) =>
    pool.some((q) => q.code === code && q.categories.includes(category)),
  );
}

/**
 * Can this category sell a no-payslip program at all? Derived, never declared.
 *
 * An empty pool answers `false`, which is the safe direction: the screens that ask this
 * question fetch the pool, so "not loaded yet" must not render a capability the operator
 * cannot then configure.
 */
export function categoryAsksAnySurrogateFact(
  pool: readonly FactAssignable[],
  category: LoanCategory,
): boolean {
  return surrogateFactsAskedIn(pool, category).length > 0;
}

/**
 * The facts a catalog NAME is marked as readable under one category — the overlap of the
 * questions ticked for that (name, category) pair with the four facts.
 *
 * A non-empty result is the statement "this name may be sold without a payslip here".
 * Nothing new is stored to say so: the tick-list on the catalog screen IS the switch, and
 * the bank-program wizard offers only fact-carrying names when the no-payslip basis is
 * picked. One function, so the list, the detail screen and the wizard cannot each derive
 * it their own way — the drift v13.0.0 had to undo for the two weighting axes.
 */
export function noPayslipFactsFor(row: FactPickable, category: LoanCategory): string[] {
  const picked = row.questionsByCategory[category] ?? [];
  return SURROGATE_FACT_QUESTION_CODES.filter((code) => picked.includes(code));
}

/** Is this name marked as sellable without a payslip under ANY loan category? */
export function sellsWithoutPayslip(
  row: FactPickable,
  categories: readonly LoanCategory[],
): boolean {
  return categories.some((c) => noPayslipFactsFor(row, c).length > 0);
}
