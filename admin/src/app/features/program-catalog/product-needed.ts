/**
 * WHAT THE ENGINE NEEDS — step ①'s panel over the server's `needed` list, shaped.
 *
 * Pure, beside `product-asks.ts` and for its reason: the derivation is the part that fails
 * silently. The server decides every status (`ProductAsksService.neededFor`); this only
 * orders the rows, names the action each one offers, and counts the gaps.
 *
 * ORDER IS WHAT NEEDS DOING. A gap the operator can close sits first, then a gap they cannot
 * close here (a parked question, an answer whose shape nothing settles), then everything that
 * is already covered — so a product with nothing to do reads as a short, green list, and one
 * with work to do leads with the work.
 */
import type {
  NeededFact,
  NeededFactReader,
  NeededFactStatus,
  ProductAsksBoard,
} from '@features/bank-programs/bank-programs.types';
import type { LoanCategory } from '@core/loan-category';

export type NeededAction = 'ask' | 'create' | null;

export interface NeededRow {
  factKey: string;
  label: string;
  status: NeededFactStatus;
  readers: NeededFactReader[];
  missingIn: LoanCategory[];
  derivedFrom: string | null;
  action: NeededAction;
  /** Covered — asked by this product, or answered by a platform question everywhere. */
  covered: boolean;
}

function rank(row: NeededRow): number {
  if (row.action !== null) return 0;
  if (!row.covered) return 1;
  return 2;
}

function actionOf(fact: NeededFact): NeededAction {
  if (!fact.actionable) return null;
  if (fact.status === 'notAsked') return 'ask';
  if (fact.status === 'noQuestion' || fact.status === 'noFact') return 'create';
  return null;
}

export function neededRows(board: ProductAsksBoard | null, isAr: boolean): NeededRow[] {
  if (board === null) return [];
  // `?? []`: a backend that predates the field sends none, and the panel simply stays away.
  return (board.needed ?? [])
    .map(
      (fact): NeededRow => ({
        factKey: fact.factKey,
        label: isAr ? fact.labelAr : fact.labelEn,
        status: fact.status,
        readers: fact.readBy,
        missingIn: fact.missingIn,
        derivedFrom: fact.derivedFrom,
        action: actionOf(fact),
        covered:
          fact.status === 'asked' || (fact.status === 'platform' && fact.missingIn.length === 0),
      }),
    )
    .sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));
}

/** Rows the engine reads that nobody is asked for. */
export function neededGapCount(rows: readonly NeededRow[]): number {
  return rows.filter((row) => !row.covered).length;
}

/** Rows one "Fix all" would act on. */
export function neededFixableCount(rows: readonly NeededRow[]): number {
  return rows.filter((row) => row.action !== null).length;
}
