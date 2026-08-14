/**
 * The constitution-locked loan categories (Principle II scope-lock, A26).
 * Single canonical admin source so the questionnaire, scoring, banks, and the
 * bank-program form all agree on the set and its labels. Adding a FIFTH here
 * requires a constitution amendment — do not extend casually.
 *
 * Every value names WHAT is financed. The no-payslip product is deliberately not one of
 * them: v15.0.0 shipped it as a fifth category (`fast`, "Fast Loans") and v16.0.0 removed
 * it again, because whether the bank reads a payslip or works an income out from a fact
 * about the applicant is an income BASIS — carried per program by
 * `bank_program.programType` — and the same personal or auto loan is sold both ways by
 * different banks. See `income-basis.ts`.
 */
export type LoanCategory = 'personal' | 'car' | 'mortgage' | 'business';

export const LOAN_CATEGORIES: LoanCategory[] = ['personal', 'car', 'mortgage', 'business'];

// NO SURROGATE-CAPABLE OR -REQUIRED LIST LIVES HERE (v16.0.0).
//
// v15.x had both, and every widening of the product needed a code change. Which categories
// can sell a no-payslip program is now DERIVED from whether their applicants are asked one
// of the four surrogate facts, which the admin controls on `/questionnaire/categories`.
// Ask `categoryAsksAnySurrogateFact(pool, category)` from `core/surrogate-facts.ts`.

/** Type guard: is an arbitrary string one of the four loan categories? */
export function isLoanCategory(value: string | null | undefined): value is LoanCategory {
  return value != null && (LOAN_CATEGORIES as string[]).includes(value);
}

/**
 * Canonical order + dedupe for a category set. A fact about `LOAN_CATEGORIES`,
 * not about whatever is being assigned, so it lives here rather than in each
 * assignment screen — two screens each sorting their own way would serialise
 * the same set differently.
 */
export function canonicalCategories(categories: readonly LoanCategory[]): LoanCategory[] {
  return LOAN_CATEGORIES.filter((c) => categories.includes(c));
}

/**
 * Friendly, localized label for a loan category. Single source so naming stays
 * consistent across surfaces (`car` → "Auto Loan"). Arabic lands in
 * messages.ar-EG.xlf on extraction.
 */
export function categoryLabel(cat: LoanCategory): string {
  switch (cat) {
    case 'personal':
      return $localize`:@@loan.cat.personal:Personal Loan`;
    case 'car':
      return $localize`:@@loan.cat.car:Auto Loan`;
    case 'mortgage':
      return $localize`:@@loan.cat.mortgage:Mortgage`;
    case 'business':
      return $localize`:@@loan.cat.business:Business Loan`;
  }
}
