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
 *
 * NOTE — these are QUESTION codes, and the near-identical `BUILTIN_FACT_KEYS` in
 * `bank-programs.types.ts` holds FACT keys. They differ by one entry and it is not a typo:
 * the fact is `credit_card_limit`, the question it is bound to is `credit_card_total_limit`.
 * Two namespaces, joined by `platform_enumeration.boundQuestionId`. Neither list is the
 * other's copy, and "fixing" one to match the other breaks the join.
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

/**
 * The DERIVED facts — computed by the engine per quote rather than registered by an operator.
 *
 * `bank_relationship` is the only one: whether the applicant already banks with the bank being
 * quoted. It has no registry row and no bound question (the question behind it is bank-agnostic
 * and multi-pick), so every screen that lists "the facts this rule reads" has to know the two
 * things a registry row would otherwise have told it — its label, and the answers it can take.
 */
export const BANK_RELATIONSHIP_FACT_KEY = 'bank_relationship';

export const BANK_RELATIONSHIP_OPTION_CODES: readonly string[] = ['ntb', 'xsell'];

export function isDerivedFactKey(key: string): boolean {
  return key === BANK_RELATIONSHIP_FACT_KEY;
}
