import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * What picking an answer does to EVERY offer (v31.2.0) — the admin's setting on each answer
 * of a choice question. Mirrors `backend/src/matching/pipeline/answer-effects.ts`; the
 * server refuses anything outside these bounds, so they are repeated here only to say so
 * before Save instead of after.
 */
export interface AnswerEffectLevers {
  /** Signed % of the program's max loan: "-10" lowers it 10%, "10" raises it 10%. */
  maxLoanPercent?: string;
  /** Signed points added to the annual rate. */
  ratePoints?: string;
  /** Longest term this answer allows, in months. */
  maxTenorMonths?: number;
}

/** The request body's effect: an object replaces the whole effect, null clears it. */
export interface AnswerEffectBody {
  maxLoanPercent: string | null;
  ratePoints: string | null;
  maxTenorMonths: number | null;
}

export const ANSWER_EFFECT_LIMITS = {
  maxLoanPercent: { min: -90, max: 100 },
  ratePoints: { min: -20, max: 20 },
  maxTenorMonths: { min: 1, max: 480 },
} as const;

/** The three stored columns of an option row → its levers, each present only when set. */
export function leversOfOption(o: {
  effectMaxLoanPercent?: string | null;
  effectRatePoints?: string | null;
  effectMaxTenorMonths?: number | null;
}): AnswerEffectLevers {
  return {
    ...(o.effectMaxLoanPercent != null ? { maxLoanPercent: o.effectMaxLoanPercent } : {}),
    ...(o.effectRatePoints != null ? { ratePoints: o.effectRatePoints } : {}),
    ...(o.effectMaxTenorMonths != null ? { maxTenorMonths: o.effectMaxTenorMonths } : {}),
  };
}

export function hasAnyLever(l: AnswerEffectLevers): boolean {
  return (
    l.maxLoanPercent !== undefined || l.ratePoints !== undefined || l.maxTenorMonths !== undefined
  );
}

/** A signed figure as the admin reads it: "+10", "−10" (a real minus sign), "1.5". */
function signed(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  const abs = String(Math.abs(n));
  return n > 0 ? `+${abs}` : n < 0 ? `−${abs}` : abs;
}

/** One short phrase per lever set, in a fixed order: max loan, rate, term. */
export function effectParts(l: AnswerEffectLevers): string[] {
  const out: string[] = [];
  if (l.maxLoanPercent !== undefined) {
    const pct = signed(l.maxLoanPercent);
    out.push($localize`:@@answer_effect.part_loan:Max loan ${pct}:pct:%`);
  }
  if (l.ratePoints !== undefined) {
    const pts = signed(l.ratePoints);
    out.push($localize`:@@answer_effect.part_rate:Rate ${pts}:pts: pts`);
  }
  if (l.maxTenorMonths !== undefined) {
    const months = l.maxTenorMonths;
    out.push($localize`:@@answer_effect.part_term:Term up to ${months}:months: months`);
  }
  return out;
}

/**
 * True when the effect makes an offer BETTER than the bank's own figures — a bigger max loan
 * or a lower rate. Allowed (the operator's call: "everything dynamic"); the editor warns.
 */
export function betterThanBank(l: AnswerEffectLevers): boolean {
  return (
    (l.maxLoanPercent !== undefined && Number(l.maxLoanPercent) > 0) ||
    (l.ratePoints !== undefined && Number(l.ratePoints) < 0)
  );
}

const SIGNED_2DP = /^-?\d+(\.\d{1,2})?$/;

/** Empty is fine (lever unset); otherwise a signed number with ≤2 decimals, in range, not 0. */
export function signedEffectValidator(min: number, max: number): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    const raw = String(c.value ?? '').trim();
    if (raw === '') return null;
    if (!SIGNED_2DP.test(raw)) return { effect: true };
    const n = Number(raw);
    return n === 0 || n < min || n > max ? { effect: true } : null;
  };
}

/** Empty is fine (lever unset); otherwise whole months in range. */
export function monthsEffectValidator(min: number, max: number): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    const raw = String(c.value ?? '').trim();
    if (raw === '') return null;
    if (!/^\d+$/.test(raw)) return { effect: true };
    const n = Number(raw);
    return n < min || n > max ? { effect: true } : null;
  };
}
