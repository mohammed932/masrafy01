/**
 * One program's question order, page by page — and the one rule a move inside a page has to keep.
 *
 * Read by a program name's step 2 (v32.0.0), where the operator changes the order ONE program
 * asks its questions in. The server takes the program's whole served list in one write
 * (`program-names/:key/question-order`), so the screen builds it here: `pagesAfterMove` gives the
 * pages a move leaves behind, `servedOrder` the list the write sends.
 *
 * The rule: a question asked only after an answer to another question on the same page stays
 * BELOW that question. The app shows a gated question the moment its source is answered, in
 * place, so a follow-up drawn above the question it follows would appear over the applicant's
 * head. A source on an earlier page is already answered and binds nothing here; a source on a
 * later page cannot be fixed by an in-page move and is not this rule's to refuse.
 *
 * No Angular. The refusal's words are `moveBlockText`, so every screen says the same thing.
 */
import type { EnabledWhenLike } from './enabled-when';

/** Why a move was refused: `row` would sit above `above`, which it has to stay below. */
export interface MoveBlock<T> {
  readonly row: T;
  readonly above: T;
}

type Gated = { readonly code: string; readonly enabledWhen?: EnabledWhenLike | null };

/**
 * Does the page's NEW order break the rule for the question that moved? Only pairs with the
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

/** A page of served questions, structurally — `ServedPage` satisfies it. */
interface PageLike<Q extends { readonly code: string; readonly displayOrder: number }> {
  readonly code: string;
  readonly displayOrder: number;
  readonly questions: readonly Q[];
}

/** One move on one page: the question at `from` (the page's own order, 0-based) goes to `to`. */
export interface PageMove {
  readonly page: string;
  readonly from: number;
  readonly to: number;
}

/**
 * The pages a move leaves behind: the moved page's questions in their new order, each
 * `displayOrder` re-numbered 0..n-1 the way the served questionnaire numbers them; every other
 * page as it was. `null` when the move moves nothing (same place, unknown page, out of range).
 * Returns the moved question's code with it, for the rule check and the status line.
 */
export function pagesAfterMove<
  Q extends { readonly code: string; readonly displayOrder: number },
  P extends PageLike<Q>,
>(pages: readonly P[], move: PageMove): { pages: P[]; movedCode: string } | null {
  if (move.from === move.to) return null;
  const at = pages.findIndex((p) => p.code === move.page);
  const page = pages[at];
  if (page === undefined) return null;
  const rows = [...page.questions].sort((a, b) => a.displayOrder - b.displayOrder);
  const moved = rows[move.from];
  if (moved === undefined || move.to < 0 || move.to >= rows.length) return null;
  rows.splice(move.from, 1);
  rows.splice(move.to, 0, moved);
  const next = [...pages];
  next[at] = { ...page, questions: rows.map((q, i) => ({ ...q, displayOrder: i })) };
  return { pages: next, movedCode: moved.code };
}

/** The whole served list as the order write wants it: every code once, page by page. */
export function servedOrder(
  pages: readonly PageLike<{ readonly code: string; readonly displayOrder: number }>[],
): string[] {
  return [...pages]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .flatMap((p) => [...p.questions].sort((a, b) => a.displayOrder - b.displayOrder))
    .map((q) => q.code);
}
