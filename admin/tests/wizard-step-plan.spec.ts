/**
 * The wizard's step list is conditional — a `calculation` step exists only for a surrogate
 * program — and the page holds step IDS, not indices. Both halves are pinned here because
 * each fails silently: an index that is off by one renders the wrong step's body with the
 * right step lit on the rail, and a "furthest reached" that collapses to 0 re-locks the
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

const asSteps = (ids: readonly string[]) =>
  ids.map((id) => ({ id: id as (typeof STEP_ORDER)[number] }));

describe('which steps a program walks', () => {
  it('gives a surrogate program five steps and a payslip program four', () => {
    expect(stepIdsFor(true)).toHaveLength(5);
    expect(stepIdsFor(false)).toHaveLength(4);
  });

  it('puts the calculation between Program and the money, and only for a surrogate program', () => {
    const surrogate = stepIdsFor(true);
    expect(surrogate.indexOf('calculation')).toBe(surrogate.indexOf('program') + 1);
    expect(surrogate.indexOf('money')).toBe(surrogate.indexOf('calculation') + 1);
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
    expect(stepIdsFor(true)[0]).toBe('program');
    expect(stepIdsFor(false)[0]).toBe('program');
    expect(stepIdsFor(true).at(-1)).toBe('review');
    expect(stepIdsFor(false).at(-1)).toBe('review');
  });

  it('carries no step that owns nothing an operator can be blocked on', () => {
    // The three that went: `income` asked one question and owned no control, `documents`
    // held two fields with no validator between them, and `terms` was four numbers the
    // pricing bands then cross-reference. Each is a card now. Asserted as an absence so a
    // future "just add a small step" has to argue with this line first.
    for (const gone of ['income', 'terms', 'pricing', 'eligibility', 'documents']) {
      expect(STEP_ORDER).not.toContain(gone);
    }
  });
});

describe('an id becomes a position', () => {
  const surrogate = asSteps(stepIdsFor(true));
  const payslip = asSteps(stepIdsFor(false));

  it('finds a present step, and answers -1 for an absent one', () => {
    expect(indexOfStep(surrogate, 'calculation')).toBe(1);
    expect(indexOfStep(payslip, 'calculation')).toBe(-1);
    expect(indexOfStep(payslip, 'money')).toBe(1);
  });

  it('falls back to the nearest EARLIER step when the list no longer carries the id', () => {
    // The operator had reached the calculation on a surrogate program, then switched to
    // payslip while standing on `program`. The fallback is `program` — index 0 — which is
    // where they already are, so the switch moves nobody. That it EQUALS 0 is incidental
    // to `calculation` sitting second; what is pinned is that it resolves to `program`
    // rather than to -1, which a plain findIndex would answer and which the caller would
    // then have to clamp by hand.
    expect(indexOfOrPreceding(payslip, 'calculation')).toBe(indexOfStep(payslip, 'program'));
    expect(indexOfOrPreceding(payslip, 'calculation')).not.toBe(-1);
  });

  it('is the plain position when the id is present', () => {
    for (const id of STEP_ORDER)
      expect(indexOfOrPreceding(surrogate, id)).toBe(indexOfStep(surrogate, id));
  });

  it('orders ids canonically for the furthest-reached marker', () => {
    expect(isLaterStep('money', 'calculation')).toBe(true);
    expect(isLaterStep('calculation', 'money')).toBe(false);
    expect(isLaterStep('review', 'program')).toBe(true);
    expect(isLaterStep('program', 'program')).toBe(false);
  });
});
