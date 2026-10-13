import type { LoanCategory } from '@prisma/client';

/** One `question_loan_category` row as a replace writer pre-reads it. */
export interface HeldCategoryRow {
  category: LoanCategory;
  optIn: boolean;
}

/** What one replace leaves the question holding. */
export interface AssignmentPlan {
  /** Written as ordinary rows: asked of every program name. */
  ordinary: LoanCategory[];
  /** Kept as OPT-IN rows: asked only where a program name adds the question. */
  optIn: LoanCategory[];
  /** Categories the question leaves ENTIRELY — their addition rows go with it. */
  leaving: LoanCategory[];
}

/**
 * The replace `setCategories` and `setCategoriesBulk` perform, decided without touching the
 * database. The repository writes it; the engine-input contract plays it forward in memory to
 * see what a write would leave behind BEFORE the write lands. One function, so the guard can
 * never judge a different outcome from the one the write produces.
 *
 *   - `ordinary` is written as ordinary rows. A category that was OPT-IN and is listed here
 *     becomes ordinary — "ask it in this category" is a statement about every name there.
 *   - OPT-IN rows are a program name's "ask this too" and are not this screen's to lose by
 *     accident: carried over unless `optIn` is given, in which case it says which of them to
 *     keep. It never creates one — except that an ordinary row dropped from `ordinary` while
 *     program names still ADD the question falls back to opt-in when `optIn` is absent:
 *     "stop asking every name" must not also take it away from the names that picked it.
 */
export function planAssignment(
  held: readonly HeldCategoryRow[],
  ordinary: readonly LoanCategory[],
  optIn: readonly LoanCategory[] | undefined,
  /** Categories where some program name adds this question — what an opt-in row is FOR. */
  addedIn: ReadonlySet<LoanCategory>,
): AssignmentPlan {
  const heldOptIn = held.filter((row) => row.optIn).map((row) => row.category);
  // An explicit set can keep or drop an opt-in row, never mint one: opt-in rows are born only
  // from a program name's addition, which is what gives them a reader. Without one, an
  // ordinary row leaving `ordinary` stays in the category as opt-in if a name still adds it.
  const keepOptIn =
    optIn === undefined
      ? held
          .map((row) => row.category)
          .filter(
            (category) =>
              !ordinary.includes(category) &&
              (heldOptIn.includes(category) || addedIn.has(category)),
          )
      : optIn.filter((category) => heldOptIn.includes(category) && !ordinary.includes(category));
  const leaving = held
    .map((row) => row.category)
    .filter((category) => !ordinary.includes(category) && !keepOptIn.includes(category));
  return { ordinary: [...ordinary], optIn: keepOptIn, leaving };
}
