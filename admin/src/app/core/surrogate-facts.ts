import type { LoanCategory } from './loan-category';

/**
 * The question codes the FOUR BUILT-IN methods read.
 *
 * No longer the whole list. Which questions are facts is the registry's answer now
 * (`surrogate_fact` members and their bound question), read from the API by the screens
 * that need it — this constant survives only because four income methods
 * (`byMilitaryGrade` &c.) are frozen onto live offers and read these questions by name.
 *
 * Anything that prices a rule must read the registry, not this: a fact beyond the four is
 * absent here and always will be. Legitimate uses left are the coarse ones — "does this
 * loan type ask ANY income fact at all", where the four are the practical set, since no
 * admin screen creates a fifth any more (v16.3.0). The backend asserts each of the four
 * resolves to a live question (`test/unit/surrogate-binding-codes.spec.ts`).
 */
export const BUILTIN_FACT_QUESTION_CODES: readonly string[] = [
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
  factCodes: readonly string[],
): string[] {
  return factCodes.filter((code) =>
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
  factCodes: readonly string[],
): boolean {
  return surrogateFactsAskedIn(pool, category, factCodes).length > 0;
}
