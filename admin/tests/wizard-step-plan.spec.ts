/**
 * The wizard's step list is conditional — a `calculation` step exists only for a surrogate
 * program — and the page holds step IDS, not indices. Both halves are pinned here because
 * each fails silently: an index that is off by one renders the wrong step's body with the
 * right step lit on the rail, and a "furthest reached" that collapses to 0 re-locks five
 * steps an operator had already walked.
 */
import { describe, expect, it } from 'vitest';
import {
  STEP_ORDER,
  indexOfOrPreceding,
  indexOfStep,
  isLaterStep,
  stepIdsFor,
} from '../src/app/features/bank-programs/form/wizard-step-plan';

const asSteps = (ids: readonly string[]) => ids.map((id) => ({ id: id as (typeof STEP_ORDER)[number] }));

describe('which steps a program walks', () => {
  it('gives a surrogate program eight steps and a payslip program seven', () => {
    expect(stepIdsFor(true)).toHaveLength(8);
    expect(stepIdsFor(false)).toHaveLength(7);
  });

  it('puts the calculation between Program and Amount, and only for a surrogate program', () => {
    const surrogate = stepIdsFor(true);
    expect(surrogate.indexOf('calculation')).toBe(surrogate.indexOf('program') + 1);
    expect(surrogate.indexOf('terms')).toBe(surrogate.indexOf('calculation') + 1);
    expect(stepIdsFor(false)).not.toContain('calculation');
  });

  it('keeps the payslip list a subsequence of the surrogate one, so every id maps', () => {
    const surrogate = stepIdsFor(true);
    let cursor = -1;
    for (const id of stepIdsFor(false)) {
      const at = surrogate.indexOf(id);
      expect(at).toBeGreaterThan(cursor);
      cursor = at;
    }
  });

  it('starts and ends the same for both — the rail has one first and one last step', () => {
    expect(stepIdsFor(true)[0]).toBe('income');
    expect(stepIdsFor(false)[0]).toBe('income');
    expect(stepIdsFor(true).at(-1)).toBe('review');
    expect(stepIdsFor(false).at(-1)).toBe('review');
  });
});

describe('an id becomes a position', () => {
  const surrogate = asSteps(stepIdsFor(true));
  const payslip = asSteps(stepIdsFor(false));

  it('finds a present step, and answers -1 for an absent one', () => {
    expect(indexOfStep(surrogate, 'calculation')).toBe(2);
    expect(indexOfStep(payslip, 'calculation')).toBe(-1);
    expect(indexOfStep(payslip, 'terms')).toBe(2);
  });

  it('falls back to the nearest EARLIER step when the list no longer carries the id', () => {
    // The operator had reached the calculation on a surrogate program, then switched to
    // payslip on step 0. Program stays unlocked; nothing is thrown back to income.
    expect(indexOfOrPreceding(payslip, 'calculation')).toBe(indexOfStep(payslip, 'program'));
    expect(indexOfOrPreceding(payslip, 'calculation')).not.toBe(0);
    expect(indexOfOrPreceding(payslip, 'calculation')).not.toBe(-1);
  });

  it('is the plain position when the id is present', () => {
    for (const id of STEP_ORDER) expect(indexOfOrPreceding(surrogate, id)).toBe(indexOfStep(surrogate, id));
  });

  it('orders ids canonically for the furthest-reached marker', () => {
    expect(isLaterStep('terms', 'calculation')).toBe(true);
    expect(isLaterStep('calculation', 'terms')).toBe(false);
    expect(isLaterStep('review', 'income')).toBe(true);
    expect(isLaterStep('income', 'income')).toBe(false);
  });
});
