/**
 * "Which programs did this applicant actually ask about?" — the one place the
 * requested scope is turned into a filter.
 *
 * The scope is a PAIR: the loan category, plus (optionally) the catalog
 * program-name archetype the applicant picked from the program catalog. Both
 * halves narrow, neither ranks — ranking is the scorer's job (Principle V).
 *
 * Pure and shared on purpose. Apply and matching-preview both filter the same
 * active-program list by the same pair, and preview exists to show what apply
 * would return; two copies of this rule is two chances for a previewed shortlist
 * to disappear at apply (A25).
 */

/** The only two program fields the scope reads. */
export interface ProgramScopeRow {
  /** Stored free-form-ish (`'personal'`, `'Personal'`), compared case-insensitively. */
  productCategory: string;
  /** Catalog archetype this program instantiates; null on pre-catalog rows. */
  programNameKey: string | null;
}

/**
 * True when `program` is inside the requested (category, programNameKey) scope.
 *
 * A null on either side of the request means "not narrowed by this axis", NOT
 * "matches nothing":
 *  - `category` null — a category-less legacy submit, which was matched against
 *    every active program and must keep being;
 *  - `programNameKey` null — the client sent no catalog pick (an older app
 *    build, or the admin simulator), so the whole category is in scope.
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
): boolean {
  if (category != null && program.productCategory.toLowerCase() !== category.toLowerCase()) {
    return false;
  }
  if (programNameKey != null && program.programNameKey !== programNameKey) return false;
  return true;
}
