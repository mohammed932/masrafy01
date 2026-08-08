/**
 * The four constitution-locked loan categories (Principle II scope-lock, A26).
 * Single canonical admin source so the questionnaire, scoring, banks, and the
 * bank-program form all agree on the set and its labels. Adding a fifth here
 * requires a constitution amendment — do not extend casually.
 */
export type LoanCategory = 'personal' | 'car' | 'mortgage' | 'business';

export const LOAN_CATEGORIES: LoanCategory[] = ['personal', 'car', 'mortgage', 'business'];

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
