import type { Criterion } from '@features/loan-engine/loan-engine.api.service';

/**
 * A bank program's CASES (v36.4.0), as the form holds and posts them — the server's
 * `ProgramCaseWire`. A case is "these answers together → these figures" (or a refusal); the
 * first case whose every answer matches is the one applied.
 */
export interface ProgramCaseEffects {
  ratePercent?: string;
  ltvCeilingPercent?: string;
  minAmountEGP?: string;
  maxAmountEGP?: string;
  minMonths?: number;
  maxMonths?: number;
}

export interface ProgramCase {
  id: string;
  allOf: Array<{ factKey: string; criterion: Criterion }>;
  effects: ProgramCaseEffects;
  refuse?: boolean;
}

export type CaseProblem = 'no_answers' | 'no_figures' | 'months_order' | 'amounts_order' | 'range';

export const CASE_FIGURES = [
  'ratePercent',
  'ltvCeilingPercent',
  'minAmountEGP',
  'maxAmountEGP',
  'minMonths',
  'maxMonths',
] as const satisfies ReadonlyArray<keyof ProgramCaseEffects>;

export type CaseFigure = (typeof CASE_FIGURES)[number];

/** What is wrong with one case, said before Save in the server's own terms. */
export function caseProblem(c: ProgramCase): CaseProblem | null {
  if (c.allOf.length === 0) return 'no_answers';
  if (c.refuse === true) return null;
  const e = c.effects;
  if (CASE_FIGURES.every((k) => e[k] === undefined)) return 'no_figures';
  const pct = (v: string | undefined) => v !== undefined && !(Number(v) > 0 && Number(v) <= 100);
  if (pct(e.ratePercent) || pct(e.ltvCeilingPercent)) return 'range';
  if (e.minMonths !== undefined && e.maxMonths !== undefined && e.minMonths > e.maxMonths) {
    return 'months_order';
  }
  if (
    e.minAmountEGP !== undefined &&
    e.maxAmountEGP !== undefined &&
    Number(e.minAmountEGP) > Number(e.maxAmountEGP)
  ) {
    return 'amounts_order';
  }
  return null;
}

export function casesHaveProblem(cases: readonly ProgramCase[]): boolean {
  return cases.some((c) => caseProblem(c) !== null);
}

/** A fresh id, unique within the program. */
export function nextCaseId(cases: readonly ProgramCase[]): string {
  let n = cases.length + 1;
  while (cases.some((c) => c.id === `case_${n}`)) n += 1;
  return `case_${n}`;
}
