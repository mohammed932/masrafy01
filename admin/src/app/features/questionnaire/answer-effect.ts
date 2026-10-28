import {
  FormControl,
  FormGroup,
  type AbstractControl,
  type ValidationErrors,
  type ValidatorFn,
} from '@angular/forms';
import { formatGroupedNumber } from '@core/directives/money-format';

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

/**
 * One range of a FIXED number question's answer and what it does (v31.3.0): half-open
 * `[fromInclusive, toExclusive)`, null edge = open — `question.numberEffects` as stored.
 */
export interface NumberEffectRange extends AnswerEffectLevers {
  fromInclusive: string | null;
  toExclusive: string | null;
}

/** `PUT …/number-effects` — one range, every lever stated (null = unset). */
export interface NumberEffectRangeBody extends AnswerEffectBody {
  fromInclusive: string | null;
  toExclusive: string | null;
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

/** `question.numberEffects` as the tree serves it → its ranges. Tolerant: odd entries drop. */
export function numberRangesOf(raw: unknown): NumberEffectRange[] {
  if (!Array.isArray(raw)) return [];
  const edge = (v: unknown): string | null | undefined =>
    v === null || v === undefined ? null : typeof v === 'string' ? v : undefined;
  const out: NumberEffectRange[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    const fromInclusive = edge(e['fromInclusive']);
    const toExclusive = edge(e['toExclusive']);
    if (fromInclusive === undefined || toExclusive === undefined) continue;
    const loan = e['maxLoanPercent'];
    const rate = e['ratePoints'];
    const term = e['maxTenorMonths'];
    out.push({
      fromInclusive,
      toExclusive,
      ...(typeof loan === 'string' ? { maxLoanPercent: loan } : {}),
      ...(typeof rate === 'string' ? { ratePoints: rate } : {}),
      ...(typeof term === 'number' ? { maxTenorMonths: term } : {}),
    });
  }
  return out;
}

/** A range → its request body: both edges and every lever stated. */
export function rangeBodyOf(r: NumberEffectRange): NumberEffectRangeBody {
  return {
    fromInclusive: r.fromInclusive,
    toExclusive: r.toExclusive,
    maxLoanPercent: r.maxLoanPercent ?? null,
    ratePoints: r.ratePoints ?? null,
    maxTenorMonths: r.maxTenorMonths ?? null,
  };
}

/** "0 to under 12 months", "60 months and above", "Under 12 months". */
export function rangeText(r: NumberEffectRange, unit: string | null): string {
  const u = unit ?? '';
  const from = formatGroupedNumber(r.fromInclusive);
  const to = formatGroupedNumber(r.toExclusive);
  const text =
    r.fromInclusive !== null && r.toExclusive !== null
      ? $localize`:@@answer_effect.range_between:${from}:from: to under ${to}:to: ${u}:unit:`
      : r.fromInclusive !== null
        ? $localize`:@@answer_effect.range_from:${from}:from: ${u}:unit: and above`
        : $localize`:@@answer_effect.range_under:Under ${to}:to: ${u}:unit:`;
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Why a list of ranges cannot be saved, or null — the server's `numberEffectRangesProblem`,
 * repeated to say it before Save (the server re-checks with decimals).
 */
export function rangesProblem(
  ranges: readonly NumberEffectRange[],
): 'no_bounds' | 'order' | 'overlap' | 'no_lever' | null {
  const edges: { from: number | null; to: number | null }[] = [];
  for (const r of ranges) {
    if (r.fromInclusive === null && r.toExclusive === null) return 'no_bounds';
    const from = r.fromInclusive === null ? null : Number(r.fromInclusive);
    const to = r.toExclusive === null ? null : Number(r.toExclusive);
    if (from !== null && to !== null && !(from < to)) return 'order';
    if (!hasAnyLever(r)) return 'no_lever';
    edges.push({ from, to });
  }
  const sorted = [...edges].sort((a, b) =>
    a.from === null ? -1 : b.from === null ? 1 : a.from - b.from,
  );
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1]!;
    const next = sorted[i]!;
    if (prev.to === null || next.from === null || next.from < prev.to) return 'overlap';
  }
  return null;
}

/** What the admin is told about a problem, in plain words. */
export function rangesProblemText(p: 'no_bounds' | 'order' | 'overlap' | 'no_lever'): string {
  switch (p) {
    case 'no_bounds':
      return $localize`:@@answer_effect.range_no_bounds:Type a From, an upper number, or both.`;
    case 'order':
      return $localize`:@@answer_effect.range_order:From must be lower than the upper number.`;
    case 'overlap':
      return $localize`:@@answer_effect.range_overlap:This range shares numbers with another one. Ranges can't overlap.`;
    case 'no_lever':
      return $localize`:@@answer_effect.range_no_lever:Type at least one change: max loan, rate or term.`;
  }
}

/** The three lever boxes as one typed group — the option editor's and the range editor's. */
export interface EffectLeverControls {
  loan: FormControl<string>;
  rate: FormControl<string>;
  term: FormControl<string>;
}

export function effectLeversGroup(): FormGroup<EffectLeverControls> {
  return new FormGroup<EffectLeverControls>({
    loan: new FormControl('', {
      nonNullable: true,
      validators: [
        signedEffectValidator(
          ANSWER_EFFECT_LIMITS.maxLoanPercent.min,
          ANSWER_EFFECT_LIMITS.maxLoanPercent.max,
        ),
      ],
    }),
    rate: new FormControl('', {
      nonNullable: true,
      validators: [
        signedEffectValidator(
          ANSWER_EFFECT_LIMITS.ratePoints.min,
          ANSWER_EFFECT_LIMITS.ratePoints.max,
        ),
      ],
    }),
    term: new FormControl('', {
      nonNullable: true,
      validators: [
        monthsEffectValidator(
          ANSWER_EFFECT_LIMITS.maxTenorMonths.min,
          ANSWER_EFFECT_LIMITS.maxTenorMonths.max,
        ),
      ],
    }),
  });
}

/** The boxes as typed → the levers set; an empty box is unset. */
export function leversFromForm(v: {
  loan: string;
  rate: string;
  term: string;
}): AnswerEffectLevers {
  const loan = v.loan.trim();
  const rate = v.rate.trim();
  const term = v.term.trim();
  return {
    ...(loan !== '' ? { maxLoanPercent: loan } : {}),
    ...(rate !== '' ? { ratePoints: rate } : {}),
    ...(term !== '' ? { maxTenorMonths: Number(term) } : {}),
  };
}

/** Levers → the boxes, for opening an editor on a saved effect. */
export function formFromLevers(l: AnswerEffectLevers): {
  loan: string;
  rate: string;
  term: string;
} {
  return {
    loan: l.maxLoanPercent ?? '',
    rate: l.ratePoints ?? '',
    term: l.maxTenorMonths !== undefined ? String(l.maxTenorMonths) : '',
  };
}

/** An edge box: empty (open) or a plain non-negative number as the money input reports it. */
export function rangeEdgeValidator(c: AbstractControl): ValidationErrors | null {
  const raw = String(c.value ?? '').trim();
  return raw === '' || /^\d+(\.\d{1,4})?$/.test(raw) ? null : { edge: true };
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
