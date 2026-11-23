/**
 * The bank program's CASES (v36.4.0), between the wire and the stored column.
 *
 * The admin speaks the Loan Engine's criterion vocabulary (`criterion.ts`); the engine stores
 * a `FactGridKey`. Converted here both ways, refused with `VALIDATION_FAILED` + the path of
 * the offending case, so the form can point at the row.
 */
import { DomainException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';
import {
  CriterionError,
  criterionToKey,
  keyToCriterion,
  type Criterion,
} from '@/matching/pipeline/criterion';
import {
  asProgramCases,
  CASE_EFFECT_KEYS,
  type CaseEffects,
  type ProgramCase,
} from '@/matching/pipeline/program-cases';
import type { ProgramCaseDto } from '../dto/program-case.dto';

export interface ProgramCaseWire {
  id: string;
  allOf: Array<{ factKey: string; criterion: Criterion }>;
  effects: CaseEffects;
  refuse?: boolean;
}

function refuse(path: string, reason: string): never {
  throw new DomainException(ERROR_CODES.VALIDATION_FAILED, { field: path, reason });
}

/** Wire → stored. `null` when there are none, so the column stays NULL. */
export function casesFromWire(cases: readonly ProgramCaseDto[] | undefined): ProgramCase[] | null {
  if (cases === undefined || cases.length === 0) return null;
  const ids = new Set<string>();
  return cases.map((c, i) => {
    const path = `cases.${i}`;
    if (ids.has(c.id)) refuse(`${path}.id`, 'duplicate');
    ids.add(c.id);
    const allOf = c.allOf.map((cr, j) => {
      try {
        return { factKey: cr.factKey, key: criterionToKey(cr.criterion) };
      } catch (err) {
        if (err instanceof CriterionError) refuse(`${path}.allOf.${j}`, err.problem);
        throw err;
      }
    });
    if (c.refuse === true) return { id: c.id, allOf, effects: {}, refuse: true };
    const effects: Record<string, string | number> = {};
    for (const k of CASE_EFFECT_KEYS) {
      const v = c.effects?.[k];
      if (v !== undefined && v !== null && v !== '') effects[k] = v;
    }
    if (Object.keys(effects).length === 0) refuse(`${path}.effects`, 'empty');
    const e = effects as CaseEffects;
    if (e.ratePercent !== undefined && Number(e.ratePercent) > 100) {
      refuse(`${path}.effects.ratePercent`, 'range');
    }
    if (
      e.ltvCeilingPercent !== undefined &&
      !(Number(e.ltvCeilingPercent) > 0 && Number(e.ltvCeilingPercent) <= 100)
    ) {
      refuse(`${path}.effects.ltvCeilingPercent`, 'range');
    }
    if (e.minMonths !== undefined && e.maxMonths !== undefined && e.minMonths > e.maxMonths) {
      refuse(`${path}.effects.minMonths`, 'range');
    }
    if (
      e.minAmountEGP !== undefined &&
      e.maxAmountEGP !== undefined &&
      Number(e.minAmountEGP) > Number(e.maxAmountEGP)
    ) {
      refuse(`${path}.effects.minAmountEGP`, 'range');
    }
    return { id: c.id, allOf, effects: e };
  });
}

/** Stored → wire, in the operator's vocabulary. Malformed stored cases are dropped. */
export function casesToWire(raw: unknown): ProgramCaseWire[] {
  return asProgramCases(raw).flatMap((c) => {
    const allOf: ProgramCaseWire['allOf'] = [];
    for (const cr of c.allOf) {
      const criterion = keyToCriterion(cr.key);
      if (criterion === null) return [];
      allOf.push({ factKey: cr.factKey, criterion });
    }
    return [{ id: c.id, allOf, effects: c.effects, ...(c.refuse ? { refuse: true } : {}) }];
  });
}
