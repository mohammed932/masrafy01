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
  perCurrency: Record<string, { minAmount: string; maxAmount: string }>;
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
  maxMonthsBySalaryCategory?: Record<string, number>;
  maxMonthsByEmploymentType?: Record<string, number>;
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
    case 'rateByTenor':
      return ctx.tenorMonths !== undefined ? exactKey(map, String(ctx.tenorMonths)) : null;
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
  currency = 'EGP',
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

  // Fallback to base perCurrency.maxAmount.
  const baseMax = ll.perCurrency[currency]?.maxAmount ?? '0';
  trace.push({ level: 'maxEGP', matched: true, value: baseMax, reason: `currency=${currency}` });
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
