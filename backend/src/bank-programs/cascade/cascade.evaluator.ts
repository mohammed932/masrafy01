import { Prisma } from '@prisma/client';
import {
  ApplicantContext,
  CascadeTraceStep,
  DerivationChain,
  LoanLimitCascadeLevel,
  LoanLimitResult,
  PRICING_CASCADE_ORDER,
  PricingCascadeLevel,
  PricingResult,
  RateBandValue,
  TENOR_CASCADE_ORDER,
  TenorCascadeLevel,
  TenorResult,
} from './cascade.types';
import { resolveFactGrid, type FactGridConfig } from '../../matching/pipeline/fact-grid';

/**
 * Pure cascade evaluator. No I/O, no DI, no clocks, no randomness.
 *
 * Spec: FR-008a/b/c/d/e/o.1/p.1, FR-003a (post-cascade uplift), FR-005c.1 wealth gate.
 * Research R2 + R15.
 *
 * The future matching engine imports this directly. The admin's what-if preview imports
 * a TypeScript-port subset (or this module compiled for the browser) — same shape, same rules.
 */

type RateBandMap = Record<string, RateBandValue>;

interface PricingConfig {
  isVariableRate: boolean;
  /** The N-axis grid — see `fact-grid.ts`. Absent on every program stored before it existed. */
  rateByFact?: FactGridConfig;
  baseRatePercent?: string;
  currentEffectiveRatePercent?: string;
  rateByEmploymentType?: RateBandMap;
  rateBySeniority?: RateBandMap;
  rateByTransferType?: RateBandMap;
  rateByTenor?: RateBandMap;
  rateByDownPaymentPercent?: RateBandMap;
  rateByCustomerProgramTier?: RateBandMap;
  rateByAssetValueBand?: RateBandMap;
  rateByLoanAmountBand?: RateBandMap;
}

interface LoanLimitsConfig {
  minAmountEGP: string;
  maxAmountEGP: string;
  maxByCDTier?: Array<{ minCDValueEGP: string; maxAmountEGP: string }>;
  maxByPropertyType?: Record<string, string>;
  maxByCityTier?: Record<string, string>;
  maxByTransferType?: Record<string, string>;
  maxBySalaryCategory?: Record<string, string>;
  maxByEmploymentType?: Record<string, string>;
  qualitativeReviewMaxEGP?: string;
}

interface TenorConfig {
  minMonths: number;
  maxMonths: number;
  maxMonthsByEmploymentType?: Record<string, number>;
  /**
   * A term ceiling read from the applicant's answers — a model year, a country of origin,
   * the share they are putting down.
   *
   * Deliberately NOT a `TENOR_CASCADE_ORDER` level. That cascade is first-match-wins, so a
   * level would make a vehicle ceiling REPLACE `maxMonthsByEmploymentType` rather than
   * compose with it, and a bank that caps self-employed applicants at 84 months means that
   * as well as, not instead of, "this car is too old for ten years". `quote.ts` reads it as
   * a CLAMP beside the age-at-maturity one, composing by `min`, which is what both mean.
   */
  maxMonthsByFact?: FactGridConfig;
}

interface EligibilityConfig {
  requiresQualitativeReview: boolean;
  requiresNoDocuments: boolean;
  minBankStatementBalanceEGP?: string;
  minAssetsValueEGP?: string;
}

export interface BankProgramConfig {
  pricing: PricingConfig;
  loanLimits: LoanLimitsConfig;
  tenor: TenorConfig;
  eligibility: EligibilityConfig;
}

// --- Pricing cascade ------------------------------------------------------

export function evaluatePricing(config: BankProgramConfig, ctx: ApplicantContext): PricingResult {
  const pricing = config.pricing;
  const trace: CascadeTraceStep[] = [];

  for (const level of PRICING_CASCADE_ORDER) {
    // The grid is the one level that is not a flat key→rate map, so it resolves through its
    // own module rather than `selectFromTierMap`. Handled inside the loop, not before it, so
    // it stays an ordinary cascade level that the trace records like any other.
    if (level === 'rateByFact') {
      const grid = pricing.rateByFact;
      if (grid === undefined || !Array.isArray(grid.cells) || grid.cells.length === 0) {
        trace.push({ level, matched: false, reason: 'not configured' });
        continue;
      }
      const hit = resolveFactGrid({
        config: grid,
        facts: ctx.facts ?? {},
        parentKeyByValue: ctx.parentKeyByValue,
      });
      if (hit.matched) {
        trace.push({
          level,
          matched: true,
          value: hit.value.toString(),
          reason: `cell=${hit.cellIndex}`,
          keys: hit.keys,
        });
        return { effectiveRatePercent: hit.value.toString(), matchedLevel: level, trace };
      }
      trace.push({ level, matched: false, reason: hit.reason });
      // `reject` STOPS the cascade. It must not fall through to a lower level or to the base
      // rate: the bank printed no price for this combination, and any figure the platform
      // reached for instead would be one nobody stated — frozen onto an immutable offer, and
      // measured against by the DBR and the whole affordability loop (`fact-grid.ts`).
      if (hit.action === 'reject') {
        return {
          effectiveRatePercent: '0',
          matchedLevel: level,
          trace,
          refusal: { reason: hit.reason, missingFactKeys: hit.missingFactKeys },
        };
      }
      continue;
    }
    const map = pricing[level] as RateBandMap | undefined;
    if (!map || Object.keys(map).length === 0) {
      trace.push({ level, matched: false, reason: 'not configured' });
      continue;
    }
    const matched = selectFromTierMap(level, map, ctx);
    if (matched) {
      trace.push({ level, matched: true, value: matched.band.value, reason: `key=${matched.key}` });
      return {
        effectiveRatePercent: matched.band.value,
        matchedLevel: level,
        derivationChain: matched.band.derivation,
        trace,
      };
    }
    trace.push({ level, matched: false, reason: 'no key matched' });
  }

  // Bottom of cascade — base or current effective.
  const finalLevel: PricingCascadeLevel = 'baseOrCurrentEffectiveRate';
  const finalValue = pricing.isVariableRate
    ? pricing.currentEffectiveRatePercent
    : pricing.baseRatePercent;
  trace.push({
    level: finalLevel,
    matched: true,
    value: finalValue ?? '0',
    reason: 'fallback base/variable',
  });
  return {
    effectiveRatePercent: finalValue ?? '0',
    matchedLevel: finalLevel,
    trace,
  };
}

interface TierMatch {
  key: string;
  band: RateBandValue;
}

function selectFromTierMap(
  level: PricingCascadeLevel,
  map: RateBandMap,
  ctx: ApplicantContext,
): TierMatch | null {
  switch (level) {
    case 'rateByEmploymentType':
      return ctx.employmentType ? exactKey(map, ctx.employmentType) : null;
    case 'rateBySeniority':
      return ctx.seniorityYears !== undefined ? exactKey(map, String(ctx.seniorityYears)) : null;
    case 'rateByTransferType':
      return ctx.transferType ? exactKey(map, ctx.transferType) : null;
    // FR-008o.2 — BANDED, not exact-keyed, like every other numeric axis here.
    //
    // This is the code conforming to the spec rather than the spec being widened to fit it:
    // FR-004 has always described this map as "bucketed, e.g. 1–6 years → 27%, 7 years →
    // 29%", and a bucket is a floor. Exact matching was never what it asked for, and the
    // resolution rule simply had no FR of its own next to FR-008o.1 / FR-008p.1 to be
    // checked against.
    //
    // What it cost: the customer picks a term off a 6-month grid spanning 6…120 months — 20
    // reachable values — while a bank's card prints three or four, so a program's own rate
    // was skipped for every term in between and the applicant silently got
    // `baseRatePercent`, which is not a price any bank stated. Measured on the one program
    // in the repo that states a tenor table (`ABK-CLUBS`, keys 12/60/84 over a 30% base):
    // its card was honoured on 3 of 10 reachable terms, and the other 7 were quoted 30% — up
    // to 3 percentage points above the bank's own figure. `abk-egypt-2026.ts`'s
    // `expectedRates` recorded that fall-through as if it were correct, and could not have
    // caught it: that check reads `baseRatePercent` and never runs the cascade.
    //
    // A bank that genuinely sells only discrete terms states that in `tenor.minMonths` /
    // `maxMonths`, where it is ENFORCED, not by leaving a rate table to miss.
    case 'rateByTenor':
      return ctx.tenorMonths !== undefined ? floorBand(map, ctx.tenorMonths) : null;
    case 'rateByDownPaymentPercent':
      return ctx.downPaymentPercent !== undefined ? floorBand(map, ctx.downPaymentPercent) : null;
    case 'rateByAssetValueBand':
      return ctx.assetValueEGP !== undefined ? floorBand(map, ctx.assetValueEGP) : null;
    case 'rateByLoanAmountBand':
      return ctx.loanAmountEGP !== undefined ? floorBand(map, ctx.loanAmountEGP) : null;
    default:
      return null;
  }
}

function exactKey(map: RateBandMap, key: string): TierMatch | null {
  const band = map[key];
  return band ? { key, band } : null;
}

/** FR-008o.1 / FR-008p.1: floor-to-nearest-band-≤-applicant-value. */
function floorBand(map: RateBandMap, applicantValue: number): TierMatch | null {
  let bestKey: string | null = null;
  let bestKeyNum = -Infinity;
  for (const key of Object.keys(map)) {
    const k = Number(key);
    if (!Number.isFinite(k)) continue;
    if (k <= applicantValue && k > bestKeyNum) {
      bestKey = key;
      bestKeyNum = k;
    }
  }
  if (bestKey === null) {
    return null;
  }
  const band = map[bestKey];
  return band ? { key: bestKey, band } : null;
}

// --- Loan-limit cascade ---------------------------------------------------

export function evaluateLoanLimit(
  config: BankProgramConfig,
  ctx: ApplicantContext,
): LoanLimitResult {
  const ll = config.loanLimits;
  const trace: CascadeTraceStep[] = [];

  const checks: Array<{
    level: LoanLimitCascadeLevel;
    key: string | undefined;
    map?: Record<string, string> | Array<{ minCDValueEGP: string; maxAmountEGP: string }>;
  }> = [
    { level: 'maxByCDTier', key: undefined, map: ll.maxByCDTier },
    { level: 'maxByPropertyType', key: ctx.propertyType, map: ll.maxByPropertyType },
    { level: 'maxByTransferType', key: ctx.transferType, map: ll.maxByTransferType },
    { level: 'maxByEmploymentType', key: ctx.employmentType, map: ll.maxByEmploymentType },
  ];

  for (const c of checks) {
    if (!c.map) {
      trace.push({ level: c.level, matched: false, reason: 'not configured' });
      continue;
    }
    if (c.level === 'maxByCDTier') {
      // Range-keyed by CD value; left for matching feature (no CD value in basic ApplicantContext).
      trace.push({ level: c.level, matched: false, reason: 'CD tier evaluation deferred' });
      continue;
    }
    if (c.key && typeof c.map === 'object' && !Array.isArray(c.map)) {
      const value = (c.map as Record<string, string>)[c.key];
      if (value) {
        trace.push({ level: c.level, matched: true, value, reason: `key=${c.key}` });
        return {
          maxAmount: applyUpliftIfApproved(value, ll, ctx, config.eligibility, trace),
          matchedLevel: c.level,
          upliftApplied:
            ctx.qualitativeReviewApproved === true && Boolean(ll.qualitativeReviewMaxEGP),
          trace,
        };
      }
    }
    trace.push({ level: c.level, matched: false, reason: 'no key matched' });
  }

  // Fallback to the program's own ceiling.
  const baseMax = ll.maxAmountEGP ?? '0';
  trace.push({ level: 'maxEGP', matched: true, value: baseMax, reason: 'base ceiling' });
  return {
    maxAmount: applyUpliftIfApproved(baseMax, ll, ctx, config.eligibility, trace),
    matchedLevel: 'maxEGP',
    upliftApplied: ctx.qualitativeReviewApproved === true && Boolean(ll.qualitativeReviewMaxEGP),
    trace,
  };
}

/** FR-003a: post-cascade per-offer uplift when operator approves the qualitative-review badge. */
function applyUpliftIfApproved(
  baseValue: string,
  ll: LoanLimitsConfig,
  ctx: ApplicantContext,
  eligibility: EligibilityConfig,
  trace: CascadeTraceStep[],
): string {
  if (!eligibility.requiresQualitativeReview) {
    return baseValue;
  }
  if (!ll.qualitativeReviewMaxEGP) {
    return baseValue;
  }
  if (!ctx.qualitativeReviewApproved) {
    trace.push({
      level: 'maxEGP',
      matched: false,
      reason: 'qualitativeReviewMaxEGP available but operator approval missing',
    });
    return baseValue;
  }
  trace.push({
    level: 'maxEGP',
    matched: true,
    value: ll.qualitativeReviewMaxEGP,
    reason: 'qualitative-review uplift applied',
  });
  return ll.qualitativeReviewMaxEGP;
}

// --- Tenor cascade --------------------------------------------------------

export function evaluateTenor(config: BankProgramConfig, ctx: ApplicantContext): TenorResult {
  const t = config.tenor;
  const trace: CascadeTraceStep[] = [];

  for (const level of TENOR_CASCADE_ORDER) {
    const map = (t[level as keyof TenorConfig] as Record<string, number> | undefined) ?? undefined;
    if (!map) {
      trace.push({ level, matched: false, reason: 'not configured' });
      continue;
    }
    const key = level === 'maxMonthsByEmploymentType' ? ctx.employmentType : undefined;
    if (key && map[key] !== undefined) {
      trace.push({ level, matched: true, value: String(map[key]), reason: `key=${key}` });
      return {
        maxMonths: map[key]!,
        matchedLevel: level as TenorCascadeLevel,
        trace,
      };
    }
    trace.push({ level, matched: false, reason: 'no key matched' });
  }

  trace.push({
    level: 'maxMonths',
    matched: true,
    value: String(t.maxMonths),
    reason: 'fallback base',
  });
  return {
    maxMonths: t.maxMonths,
    matchedLevel: 'maxMonths',
    trace,
  };
}

// --- Wealth-gate AND combination (FR-005c.1) ------------------------------

export function evaluateWealthGate(
  config: BankProgramConfig,
  ctx: ApplicantContext,
): { passes: boolean; failingGate?: 'minBankStatementBalance' | 'minAssetsValue' } {
  const e = config.eligibility;
  if (e.minBankStatementBalanceEGP) {
    const min = new Prisma.Decimal(e.minBankStatementBalanceEGP);
    const have = new Prisma.Decimal(ctx.bankStatementBalanceEGP ?? 0);
    if (have.lessThan(min)) {
      return { passes: false, failingGate: 'minBankStatementBalance' };
    }
  }
  if (e.minAssetsValueEGP) {
    const min = new Prisma.Decimal(e.minAssetsValueEGP);
    const have = new Prisma.Decimal(ctx.assetsValueEGP ?? 0);
    if (have.lessThan(min)) {
      return { passes: false, failingGate: 'minAssetsValue' };
    }
  }
  return { passes: true };
}

// --- Helpers --------------------------------------------------------------

export function derivationDescription(d: DerivationChain | undefined): string | undefined {
  if (!d) return undefined;
  return `${d.sourceRatePercent} + ${d.deltaPercent} (${d.reason})`;
}
