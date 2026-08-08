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
 * The four scope-locked categories, in the order the admin sees them (Principle
 * II / A26). Derived from the Prisma enum so a fifth cannot be added here
 * without the amendment the enum itself requires.
 */
export const ALL_LOAN_CATEGORIES: readonly LoanCategory[] = [
  LoanCategory.personal,
  LoanCategory.car,
  LoanCategory.mortgage,
  LoanCategory.business,
];

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
