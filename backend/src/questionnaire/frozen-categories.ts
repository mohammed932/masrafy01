import type { LoanCategory } from '@prisma/client';

/**
 * A question's category assignment as a published snapshot FREEZES it — the one shape both
 * publishers write (`QuestionnaireService.publish` and the seed's own `publishVersion`), so the
 * two cannot drift the way `categoryOrder` already has between them.
 *
 *   - `categories`: the ORDINARY rows — asked of every program name in the category.
 *   - `optInCategories`: the OPT-IN rows (`question_loan_category.optIn`) — in the category, but
 *     asked only where a program name adds the question or a programme under the name reads it.
 *
 * DISJOINT on purpose. A reader that has never heard of opt-in rows then treats one as not
 * assigned — not served, not required — which is the safe way to be wrong. `optInCategories` is
 * emitted only when there is one, so a snapshot with no opt-in row is byte-identical to one
 * published before they existed.
 *
 * Order follows `all`: the caller sorts it the way it always has.
 *
 * Dependency-free (a type import only) because `prisma/seed-questionnaire.ts` imports it by a
 * relative path, where the `@/` alias does not resolve.
 */
export function frozenCategories(
  all: readonly LoanCategory[],
  optIn: readonly LoanCategory[],
): { categories: LoanCategory[]; optInCategories?: LoanCategory[] } {
  const ordinary = all.filter((c) => !optIn.includes(c));
  const optInHere = all.filter((c) => optIn.includes(c));
  return optInHere.length > 0
    ? { categories: ordinary, optInCategories: optInHere }
    : { categories: ordinary };
}
