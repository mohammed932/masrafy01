/**
 * The operator's vocabulary for one answer criterion, and its storage form (feature 013).
 *
 * Pure module (Principle V). The Loan Engine speaks in the six operators an operator thinks
 * in — less than, at most, at least, more than, between, equals — plus one choice option or
 * "answered" for a text question. The engine stores a `FactGridKey`. This file is the ONE
 * place the two are converted, both ways, so the admin never builds a storage shape and the
 * engine never reads an operator word.
 *
 * Lossless both ways. Two extra spellings exist only so every STORED key reads back:
 *   · `range`  — `[a, b)`, the half-open band every table written before 013 uses;
 *   · `custom` — any other mix of open and closed edges.
 * The admin may write them too; nothing here prefers one spelling over another, so a key
 * read back and saved unchanged is stored byte-identical.
 */
import { bandEdgesOf, bandIsEmpty, type FactGridBand, type FactGridKey } from './fact-grid';
import { PRESENCE_FACT_LOOKUP_KEY } from './fact-value';

export type NumberOp = 'lt' | 'lte' | 'gte' | 'gt' | 'eq';

export type Criterion =
  | { op: NumberOp; a: string }
  /** `a ≤ x ≤ b` — "between", both ends included, as an operator reads it. */
  | { op: 'between'; a: string; b: string }
  /** `a ≤ x < b` — the stored half-open band. */
  | { op: 'range'; a: string; b: string }
  /** Any other mix of edges; `a`/`b` absent = open on that side. */
  | { op: 'custom'; a?: string; aInclusive: boolean; b?: string; bInclusive: boolean }
  | { option: string }
  | { answered: true };

export type CriterionProblem = 'both_edges' | 'empty_band' | 'shape';

export class CriterionError extends Error {
  constructor(readonly problem: CriterionProblem) {
    super(problem);
  }
}

const DECIMAL = /^-?\d+(\.\d+)?$/;

function decimalOrThrow(raw: unknown): string {
  if (typeof raw !== 'string' || !DECIMAL.test(raw.trim())) throw new CriterionError('shape');
  return raw.trim();
}

/** Operator criterion → the key the engine stores. Throws `CriterionError` on a bad shape. */
export function criterionToKey(criterion: Criterion): Exclude<FactGridKey, null> {
  if ('option' in criterion) {
    if (typeof criterion.option !== 'string' || criterion.option === '') {
      throw new CriterionError('shape');
    }
    return { key: criterion.option };
  }
  if ('answered' in criterion) return { key: PRESENCE_FACT_LOOKUP_KEY };

  let band: FactGridBand;
  switch (criterion.op) {
    case 'lt':
      band = { toExclusive: decimalOrThrow(criterion.a) };
      break;
    case 'lte':
      band = { toInclusive: decimalOrThrow(criterion.a) };
      break;
    case 'gte':
      band = { fromInclusive: decimalOrThrow(criterion.a) };
      break;
    case 'gt':
      band = { fromExclusive: decimalOrThrow(criterion.a) };
      break;
    case 'eq': {
      const a = decimalOrThrow(criterion.a);
      band = { fromInclusive: a, toInclusive: a };
      break;
    }
    case 'between':
      band = {
        fromInclusive: decimalOrThrow(criterion.a),
        toInclusive: decimalOrThrow(criterion.b),
      };
      break;
    case 'range':
      band = {
        fromInclusive: decimalOrThrow(criterion.a),
        toExclusive: decimalOrThrow(criterion.b),
      };
      break;
    case 'custom': {
      band = {};
      if (criterion.a !== undefined) {
        const a = decimalOrThrow(criterion.a);
        if (criterion.aInclusive) band.fromInclusive = a;
        else band.fromExclusive = a;
      }
      if (criterion.b !== undefined) {
        const b = decimalOrThrow(criterion.b);
        if (criterion.bInclusive) band.toInclusive = b;
        else band.toExclusive = b;
      }
      break;
    }
    default:
      throw new CriterionError('shape');
  }
  const edges = bandEdgesOf(band);
  if (edges === 'invalid') throw new CriterionError('both_edges');
  if (bandIsEmpty(edges)) throw new CriterionError('empty_band');
  return band;
}

/**
 * Stored key → operator criterion. `null` for the explicit wildcard (`null` key) and for a
 * band that states one edge twice — neither is something an operator criterion can say.
 */
export function keyToCriterion(key: FactGridKey): Criterion | null {
  if (key === null) return null;
  if ('key' in key) {
    return key.key === PRESENCE_FACT_LOOKUP_KEY ? { answered: true } : { option: key.key };
  }
  if (bandEdgesOf(key) === 'invalid') return null;
  const fromI = present(key.fromInclusive);
  const fromE = present(key.fromExclusive);
  const toE = present(key.toExclusive);
  const toI = present(key.toInclusive);
  if (fromI === undefined && fromE === undefined && toE !== undefined && toI === undefined) {
    return { op: 'lt', a: toE };
  }
  if (fromI === undefined && fromE === undefined && toI !== undefined) return { op: 'lte', a: toI };
  if (fromI !== undefined && toE === undefined && toI === undefined) return { op: 'gte', a: fromI };
  if (fromE !== undefined && toE === undefined && toI === undefined) return { op: 'gt', a: fromE };
  if (fromI !== undefined && toI !== undefined) {
    return fromI === toI ? { op: 'eq', a: fromI } : { op: 'between', a: fromI, b: toI };
  }
  if (fromI !== undefined && toE !== undefined) return { op: 'range', a: fromI, b: toE };
  return {
    op: 'custom',
    ...(fromI !== undefined || fromE !== undefined ? { a: (fromI ?? fromE) as string } : {}),
    aInclusive: fromE === undefined,
    ...(toI !== undefined || toE !== undefined ? { b: (toI ?? toE) as string } : {}),
    bInclusive: toI !== undefined,
  };
}

function present(raw: string | null | undefined): string | undefined {
  return typeof raw === 'string' && raw.trim() !== '' ? raw : undefined;
}
