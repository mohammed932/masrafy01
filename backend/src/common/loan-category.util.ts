import { LoanCategory } from '@prisma/client';

/**
 * Canonical loan-category set and ordering, shared by every module that stores
 * a category assignment.
 *
 * Promoted out of `questionnaire.service.ts` when the program-name catalog
 * gained its own assignment axis: two modules that must serialise the same set
 * the same way cannot each own a private copy of the ordering. That is exactly
 * the drift v13.0.0 was written to fix — two assignment axes set on different
 * screens with nothing comparing them.
 */

/**
 * The scope-locked categories, in the order the admin sees them (Principle II /
 * A26). Derived from the Prisma enum so a fifth cannot be added here without the
 * amendment the enum itself requires.
 */
export const ALL_LOAN_CATEGORIES: readonly LoanCategory[] = [
  LoanCategory.personal,
  LoanCategory.car,
  LoanCategory.mortgage,
  LoanCategory.business,
];

// NO SURROGATE-CAPABLE LIST LIVES HERE (v16.0.0).
//
// v15.x hardcoded which categories could sell a no-payslip program — first `['fast']`,
// then `['personal','car','fast']`. Both were product opinions frozen into code, and
// each widening needed a release.
//
// Capability is now DERIVED and admin-configurable: a category can sell a no-payslip
// program exactly when its applicants are ASKED at least one of the four surrogate facts
// (`matching/pipeline/surrogate-fact-bindings.ts`), which is recorded per question in
// `question_loan_category` and edited on the admin questionnaire screen. That is not a
// proxy for the old list — it is the real precondition: a bank cannot work an income out
// from a fact nobody was asked, whatever a constant says.
//
// So there is no `isSurrogateCapableCategory(category)` to call. Callers that need the
// question is one of: derive it from the assignments they already hold (admin, publish
// warnings), or drop the category term entirely because the engine gate is
// `bank_program.programType` alone (`quote.ts#shouldConsultIncomeRule`).

const CATEGORY_ORDER = new Map(ALL_LOAN_CATEGORIES.map((c, i) => [c, i]));

/** Canonical display order, so the same set always serialises the same way. */
export function sortCategories(categories: readonly LoanCategory[]): LoanCategory[] {
  return [...categories].sort(
    (a, b) => (CATEGORY_ORDER.get(a) ?? 0) - (CATEGORY_ORDER.get(b) ?? 0),
  );
}

export function dedupeCategories(categories: readonly LoanCategory[]): LoanCategory[] {
  return sortCategories([...new Set(categories)]);
}

/**
 * A free-form string → a loan category, or `null`.
 *
 * `bank_program.productCategory` is a plain column, so every consumer that scopes
 * by it has to narrow the value first. One implementation, because a caller that
 * forgot `.toLowerCase()` would silently treat "Personal" as "no category" and
 * scope to nothing — which reads as an empty configuration, not as a bad input.
 */
export function asLoanCategory(raw: string | null | undefined): LoanCategory | null {
  if (!raw) return null;
  const value = raw.toLowerCase();
  return (ALL_LOAN_CATEGORIES as readonly string[]).includes(value)
    ? (value as LoanCategory)
    : null;
}
