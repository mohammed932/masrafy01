/**
 * THE ORDER STEP ① SHOWS AND EDITS — a product's asked questions, in its loan type's order.
 *
 * There is no per-product order. What an applicant is served is the CATEGORY's order
 * (`question_loan_category.displayOrder`, edited on /questionnaire/categories), narrowed to
 * what the picked name reads. So this screen edits that same order, restricted to the rows
 * this product reads: a move re-slots the product's questions among THEMSELVES, inside the
 * positions they already hold, and every other question in the category keeps its place.
 *
 * WITHIN A STEP, for the reason the categories screen states: the app pages one step per
 * question group and sorts inside it, so a position only means anything among one group.
 */
import type { LoanCategory } from '@core/loan-category';
import type { GroupTreeRow, QuestionRow } from '@features/questionnaire/questionnaire.api.service';

export interface OrderStep {
  id: string;
  titleAr: string;
  titleEn: string;
  /** This product's questions in the step, in the category's order. */
  rows: QuestionRow[];
}

function positionIn(q: QuestionRow, category: LoanCategory): number {
  return q.categoryOrder?.[category] ?? q.displayOrder;
}

/**
 * Every active question the category asks, split by step, each step in the category's order.
 * The same sort the categories screen uses, so the two screens cannot disagree about it.
 */
function categorySteps(tree: readonly GroupTreeRow[], category: LoanCategory): OrderStep[] {
  return [...tree]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((g) => ({
      id: g.id,
      titleAr: g.titleAr,
      titleEn: g.titleEn,
      rows: g.questions
        .filter((q) => q.isActive && q.categories.includes(category))
        .sort(
          (a, b) =>
            positionIn(a, category) - positionIn(b, category) ||
            a.displayOrder - b.displayOrder ||
            a.code.localeCompare(b.code),
        ),
    }));
}

/** The product's questions (by code), by step, in the order the category serves them. */
export function productOrderSteps(
  tree: readonly GroupTreeRow[],
  category: LoanCategory,
  codes: ReadonlySet<string>,
): OrderStep[] {
  return categorySteps(tree, category)
    .map((step) => ({ ...step, rows: step.rows.filter((q) => codes.has(q.code)) }))
    .filter((step) => step.rows.length > 0);
}

/**
 * The category's WHOLE asked set, in its new order, after moving one of the product's
 * questions from `from` to `to` among the product's own rows of step `stepId`.
 *
 * The product's rows are pulled out, reordered, and written back into the SAME slots they
 * came out of — so a question this product does not read never moves. `null` when the move
 * is a no-op or names a step/index that is not there.
 */
export function categoryOrderAfterMove(
  tree: readonly GroupTreeRow[],
  category: LoanCategory,
  codes: ReadonlySet<string>,
  stepId: string,
  from: number,
  to: number,
): string[] | null {
  if (from === to) return null;
  const steps = categorySteps(tree, category);
  const step = steps.find((s) => s.id === stepId);
  if (!step) return null;

  const mine = step.rows.filter((q) => codes.has(q.code));
  if (from < 0 || to < 0 || from >= mine.length || to >= mine.length) return null;
  const moved = [...mine];
  const [row] = moved.splice(from, 1);
  if (!row) return null;
  moved.splice(to, 0, row);

  let next = 0;
  const reslotted = step.rows.map((q) => (codes.has(q.code) ? (moved[next++] ?? q) : q));
  return steps.flatMap((s) => (s.id === stepId ? reslotted : s.rows)).map((q) => q.id);
}
