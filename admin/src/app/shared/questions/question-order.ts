/**
 * One loan type's question order, split into the steps the app pages it in — and the one rule a
 * move inside a step has to keep.
 *
 * Read by both screens that reorder: Questionnaire → Categories (the loan type's whole list) and
 * a program name's step 2 (what that name is served). The server takes the loan type's WHOLE
 * asked set in one list (`questions/categories/:category/reorder`), so both build it here.
 *
 * The rule: a question asked only after an answer to another question on the same step stays
 * BELOW that question. The app shows a gated question the moment its source is answered, in
 * place, so a follow-up drawn above the question it follows would appear over the applicant's
 * head. A source on an earlier step is already answered and binds nothing here; a source on a
 * later step cannot be fixed by an in-step move and is not this rule's to refuse.
 *
 * No Angular. The refusal's words are `moveBlockText`, so both screens say the same thing.
 */
import type { LoanCategory } from '@core/loan-category';
import type { EnabledWhenLike } from './enabled-when';

/** What a move needs to know about a question. */
export interface OrderRow {
  readonly id: string;
  readonly code: string;
  readonly questionAr: string;
  readonly questionEn: string;
  readonly enabledWhen: EnabledWhenLike | null;
}

/** One app step: a group's asked questions, in the loan type's order. */
export interface OrderStep {
  /** The group's code — the served snapshot's page code. */
  readonly code: string;
  readonly rows: readonly OrderRow[];
}

/** The draft tree, structurally — `GroupTreeRow[]` satisfies it. */
interface GroupLike {
  readonly code: string;
  readonly displayOrder: number;
  readonly isActive?: boolean;
  readonly questions: readonly (OrderRow & {
    readonly isActive: boolean;
    readonly displayOrder: number;
    readonly categories: readonly LoanCategory[];
    readonly categoryOrder?: Partial<Record<LoanCategory, number>>;
  })[];
}

/**
 * The loan type's asked set, per step, in its own order: the position on the assignment row,
 * then the pool's, then the code — the chain `orderedForCategory` serves by. Steps with nothing
 * asked are dropped, as the publish drops them.
 */
export function stepsForCategory(
  groups: readonly GroupLike[],
  category: LoanCategory,
): OrderStep[] {
  return [...groups]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((g) => ({
      code: g.code,
      rows: g.questions
        .filter((q) => q.isActive && q.categories.includes(category))
        .sort(
          (a, b) =>
            (a.categoryOrder?.[category] ?? a.displayOrder) -
              (b.categoryOrder?.[category] ?? b.displayOrder) ||
            a.displayOrder - b.displayOrder ||
            a.code.localeCompare(b.code),
        ),
    }))
    .filter((s) => s.rows.length > 0);
}

/** Why a move was refused: `row` would sit above `above`, which it has to stay below. */
export interface MoveBlock<T> {
  readonly row: T;
  readonly above: T;
}

type Gated = { readonly code: string; readonly enabledWhen?: EnabledWhenLike | null };

/**
 * Does the step's NEW order break the rule for the question that moved? Only pairs with the
 * moved question are checked: a pair that was already out of order is not this move's doing,
 * and refusing an unrelated move over it would leave the operator nothing they can fix here.
 */
export function moveBlock<T extends Gated>(
  rows: readonly T[],
  movedCode: string,
): MoveBlock<T> | null {
  const at = rows.findIndex((r) => r.code === movedCode);
  const moved = rows[at];
  if (moved === undefined) return null;
  const source = moved.enabledWhen?.questionCode;
  if (source) {
    const s = rows.findIndex((r) => r.code === source);
    const sourceRow = rows[s];
    if (sourceRow !== undefined && s > at) return { row: moved, above: sourceRow };
  }
  for (let i = 0; i < at; i++) {
    const r = rows[i];
    if (r !== undefined && r.enabledWhen?.questionCode === movedCode)
      return { row: r, above: moved };
  }
  return null;
}

/** The refusal, in words: which question has to stay below which. */
export function moveBlockText(
  block: MoveBlock<{ readonly questionAr: string; readonly questionEn: string }>,
  isAr: boolean,
): string {
  const row = isAr ? block.row.questionAr : block.row.questionEn;
  const above = isAr ? block.above.questionAr : block.above.questionEn;
  return $localize`:@@qorder.blocked:“${row}:QUESTION:” is asked only after an answer to “${above}:SOURCE:”, so it has to stay below it.`;
}

/**
 * A new order for SOME of a step's questions, written into the slots those questions hold in
 * the whole step. A program name is served a subset of what its loan type asks; moving one of
 * them must not drag along, or jump over, the questions this name never sees.
 */
export function placeSubset(rows: readonly OrderRow[], subset: readonly string[]): OrderRow[] {
  const inSubset = new Set(subset);
  const byCode = new Map(rows.map((r) => [r.code, r]));
  const queue = subset
    .map((code) => byCode.get(code))
    .filter((r): r is OrderRow => r !== undefined);
  let next = 0;
  return rows.map((r) => (inSubset.has(r.code) ? (queue[next++] ?? r) : r));
}

/** The whole asked set as the reorder endpoint wants it: every id once, in step order. */
export function orderedIds(steps: readonly OrderStep[]): string[] {
  return steps.flatMap((s) => s.rows.map((r) => r.id));
}
