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

/**
 * Who answers for a row, which is the one thing an operator reads the panel to learn:
 * a gap to close here, a question this product adds, or one the platform asks everyone.
 */
export type NeededGroupKey = 'action' | 'product' | 'platform';

export interface NeededGroup {
  key: NeededGroupKey;
  rows: NeededRow[];
}

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
  group: NeededGroupKey;
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
    .map((fact): NeededRow => {
      const covered =
        fact.status === 'asked' || (fact.status === 'platform' && fact.missingIn.length === 0);
      return {
        factKey: fact.factKey,
        label: isAr ? fact.labelAr : fact.labelEn,
        status: fact.status,
        readers: fact.readBy,
        missingIn: fact.missingIn,
        derivedFrom: fact.derivedFrom,
        action: actionOf(fact),
        covered,
        group: !covered ? 'action' : fact.status === 'platform' ? 'platform' : 'product',
      };
    })
    .sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));
}

const GROUP_ORDER: readonly NeededGroupKey[] = ['action', 'product', 'platform'];

/** The rows split by who answers them, in that order, empty groups left out. */
export function neededGroups(rows: readonly NeededRow[]): NeededGroup[] {
  return GROUP_ORDER.map((key) => ({ key, rows: rows.filter((row) => row.group === key) })).filter(
    (group) => group.rows.length > 0,
  );
}

/** Rows the engine reads that nobody is asked for. */
export function neededGapCount(rows: readonly NeededRow[]): number {
  return rows.filter((row) => !row.covered).length;
}

/** Rows one "Fix all" would act on. */
export function neededFixableCount(rows: readonly NeededRow[]): number {
  return rows.filter((row) => row.action !== null).length;
}
