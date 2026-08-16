/**
 * "Which programs did this applicant actually ask about?" — the one place the
 * requested scope is turned into a filter.
 *
 * The scope is a TRIPLE: the loan category, plus (optionally) the catalog
 * program-name archetype the applicant picked from the program catalog, plus
 * (optionally) the income basis they said they can prove — the bank's own
 * `programType`. All three narrow, none ranks — ranking is the scorer's job
 * (Principle V).
 *
 * Pure and shared on purpose. Apply and matching-preview both filter the same
 * active-program list by the same triple, and preview exists to show what apply
 * would return; two copies of this rule is two chances for a previewed shortlist
 * to disappear at apply (A25).
 */

/** The only three program fields the scope reads. */
export interface ProgramScopeRow {
  /** Stored free-form-ish (`'personal'`, `'Personal'`), compared case-insensitively. */
  productCategory: string;
  /** Catalog archetype this program instantiates; null on pre-catalog rows. */
  programNameKey: string | null;
  /**
   * `income_proof` (reads a payslip) or `income_surrogate` (works the income out
   * some other way). NOT NULL on the model since the first migration, so unlike
   * the other two axes there is no "unclassified" program to reason about — every
   * active program falls in exactly one of the two.
   */
  programType: string;
}

/**
 * True when `program` is inside the requested (category, programNameKey,
 * programType) scope.
 *
 * A null on any side of the request means "not narrowed by this axis", NOT
 * "matches nothing":
 *  - `category` null — a category-less legacy submit, which was matched against
 *    every active program and must keep being;
 *  - `programNameKey` null — the client sent no catalog pick (an older app
 *    build, or the admin simulator), so the whole category is in scope;
 *  - `programType` null — the client never asked the customer how they prove
 *    their income (every build before the income-type step), so both bases are
 *    in scope, which is what those clients have always been served.
 *
 * A null on the PROGRAM side is different: a program with no `programNameKey`
 * predates the catalog and instantiates no archetype, so it can never satisfy a
 * request that names one. Treating it as a wildcard would put programs the
 * customer did not ask for into a shortlist they explicitly narrowed.
 */
export function matchesRequestedScope(
  program: ProgramScopeRow,
  category: string | null,
  programNameKey: string | null,
  programType: string | null = null,
): boolean {
  if (category != null && program.productCategory.toLowerCase() !== category.toLowerCase()) {
    return false;
  }
  if (programNameKey != null && program.programNameKey !== programNameKey) return false;
  if (programType != null && program.programType !== programType) return false;
  return true;
}
