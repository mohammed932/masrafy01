/**
 * Feature 013 — every word the Loan Engine screen and its two sheets share, said once.
 * Pure: no Angular, so the page and both sheets read identical copy.
 */
import type {
  Criterion,
  EffectReadOnlyReason,
  GateReasonCode,
  LoanEngineEffect,
  NumberOp,
} from './loan-engine.api.service';

export function effectLabel(effect: LoanEngineEffect): string {
  switch (effect) {
    case 'rate':
      return $localize`:@@lengine.eff.rate:Rate`;
    case 'cap':
      return $localize`:@@lengine.eff.cap:Loan cap`;
    case 'financed_share':
      return $localize`:@@lengine.eff.financed_share:Financed share`;
    case 'min_amount':
      return $localize`:@@lengine.eff.min_amount:Smallest loan`;
    case 'min_term':
      return $localize`:@@lengine.eff.min_term:Shortest term`;
    case 'max_term':
      return $localize`:@@lengine.eff.max_term:Longest term`;
    case 'extra_income':
      return $localize`:@@lengine.eff.extra_income:Extra income`;
  }
}

/** What the figure in a row is, so the operator never types a rate into a months box. */
export function effectUnit(effect: LoanEngineEffect): string {
  switch (effect) {
    case 'rate':
    case 'financed_share':
    case 'extra_income':
      return '%';
    case 'cap':
    case 'min_amount':
      return $localize`:@@lengine.unit.egp:EGP`;
    case 'min_term':
    case 'max_term':
      return $localize`:@@lengine.unit.months:months`;
  }
}

export function effectIsMoney(effect: LoanEngineEffect): boolean {
  return effect === 'cap' || effect === 'min_amount';
}

export function readOnlyLabel(reason: EffectReadOnlyReason | undefined): string {
  switch (reason) {
    case 'inherited_plan':
      return $localize`:@@lengine.ro.inherited_plan:From the product's plans`;
    case 'multi_axis':
      return $localize`:@@lengine.ro.multi_axis:Table on several answers`;
    case 'class_axis':
      return $localize`:@@lengine.ro.class_axis:Keyed by class`;
    case 'other_fact':
      return $localize`:@@lengine.ro.other_fact:Keyed on another answer`;
    case 'two_axis_cap':
      return $localize`:@@lengine.ro.two_axis_cap:Two-column cap`;
    case 'not_numeric':
      return $localize`:@@lengine.ro.not_numeric:Number answers only`;
    default:
      return $localize`:@@lengine.ro.none:Not editable here`;
  }
}

export function opLabel(op: NumberOp): string {
  switch (op) {
    case 'lt':
      return $localize`:@@lengine.op.lt:less than`;
    case 'lte':
      return $localize`:@@lengine.op.lte:at most`;
    case 'gte':
      return $localize`:@@lengine.op.gte:at least`;
    case 'gt':
      return $localize`:@@lengine.op.gt:more than`;
    case 'eq':
      return $localize`:@@lengine.op.eq:exactly`;
    case 'between':
      return $localize`:@@lengine.op.between:between (both included)`;
    case 'range':
      return $localize`:@@lengine.op.range:from … up to, not including`;
  }
}

export const NUMBER_OPS: readonly NumberOp[] = ['lt', 'lte', 'gte', 'gt', 'eq', 'between', 'range'];

export function opTakesTwo(op: NumberOp): boolean {
  return op === 'between' || op === 'range';
}

/** A criterion as one short line — the matrix cell's summary and the condition list. */
export function criterionText(
  criterion: Criterion | null,
  optionLabel: (code: string) => string,
): string {
  if (criterion === null) return $localize`:@@lengine.crit.any:any answer`;
  if ('option' in criterion) return optionLabel(criterion.option);
  if ('answered' in criterion) return $localize`:@@lengine.crit.answered:answered`;
  if (criterion.op === 'custom') {
    return $localize`:@@lengine.crit.custom:a custom band`;
  }
  if (criterion.op === 'between' || criterion.op === 'range') {
    return `${opLabel(criterion.op)} ${criterion.a} – ${criterion.b}`;
  }
  return `${opLabel(criterion.op)} ${criterion.a}`;
}

/** `LOAN_ENGINE_RULE_INVALID`'s `meta.problem`, said in words (A2: never the raw token). */
export function problemText(problem: unknown): string | null {
  switch (problem) {
    case 'both_edges':
      return $localize`:@@lengine.prob.both_edges:A band states one of its edges twice.`;
    case 'empty_band':
      return $localize`:@@lengine.prob.empty_band:No number can fall in this band — check the two edges.`;
    case 'unknown_option':
      return $localize`:@@lengine.prob.unknown_option:That answer is not one of the question's options.`;
    case 'engine_input':
      return $localize`:@@lengine.prob.engine_input:Amount, term, income, debts, employment, age and I-Score shape the amount; they can't be a condition.`;
    case 'shape':
      return $localize`:@@lengine.prob.shape:That kind of rule doesn't fit this question's answer type.`;
    case 'read_only_surface':
      return $localize`:@@lengine.prob.read_only_surface:This table is edited somewhere else.`;
    case 'not_linked':
      return $localize`:@@lengine.prob.not_linked:The question doesn't answer a figure yet — link it first.`;
    default:
      return null;
  }
}

/** The admin error-code JSON keys each gate reason under `GATE_…` (except GATE_NOT_MET). */
export function gateReasonErrorCode(code: GateReasonCode): string {
  return code === 'GATE_NOT_MET' ? code : `GATE_${code}`;
}
