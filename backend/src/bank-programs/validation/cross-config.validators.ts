import { Prisma } from '@prisma/client';
import type { EnumerationType } from '../../platform-enumerations/platform-enumerations.repository';
import type { CreateBankProgramDto } from '../dto/create-bank-program.dto';
import type { PricingConfigDto } from '../dto/sub-configs/pricing-config.dto';

const TOLERANCE = new Prisma.Decimal('0.0001');

export interface ValidationContext {
  isActiveMember(type: EnumerationType, key: string): Promise<boolean>;
  isDeprecatedMember(type: EnumerationType, key: string): Promise<boolean>;
}

export interface RegistryValidationResult {
  unknownKey?: { enumerationType: EnumerationType; key: string };
  deprecatedKey?: { enumerationType: EnumerationType; key: string };
}

interface KeyToCheck {
  enumerationType: EnumerationType;
  key: string;
}

/**
 * Walk the DTO and collect every (enumerationType, key) pair that needs registry validation.
 * Returns the first unknown OR deprecated key encountered (fail-fast at the boundary).
 *
 * Spec anchors: FR-010, FR-010a, FR-010c.
 */
export async function validateAgainstRegistry(
  dto: CreateBankProgramDto,
  ctx: ValidationContext,
): Promise<RegistryValidationResult> {
  const checks: KeyToCheck[] = [];

  // Top-level
  checks.push({ enumerationType: 'product_category', key: dto.productCategory });
  for (const d of dto.requiredDocuments ?? []) {
    checks.push({ enumerationType: 'required_document', key: d });
  }

  // Tenor overrides
  if (dto.tenor.maxMonthsByEmploymentType) {
    for (const k of Object.keys(dto.tenor.maxMonthsByEmploymentType)) {
      checks.push({ enumerationType: 'employment_type', key: k });
    }
  }

  // Loan-limits tier maps
  pushKeys(checks, dto.loanLimits.maxByPropertyType, 'property_type');
  pushKeys(checks, dto.loanLimits.maxByTransferType, 'transfer_type');
  pushKeys(checks, dto.loanLimits.maxByEmploymentType, 'employment_type');

  // Pricing tier maps
  pushKeys(checks, dto.pricing.rateByEmploymentType, 'employment_type');
  pushKeys(checks, dto.pricing.rateByTransferType, 'transfer_type');

  // Eligibility
  for (const t of dto.eligibility.acceptedEmploymentTypes) {
    checks.push({ enumerationType: 'employment_type', key: t });
  }
  for (const t of dto.eligibility.acceptedTransferTypes) {
    checks.push({ enumerationType: 'transfer_type', key: t });
  }
  for (const c of dto.eligibility.companyType ?? []) {
    checks.push({ enumerationType: 'company_type', key: c });
  }

  // Income-assumption
  if (dto.incomeAssumption.rankIncomeMap) {
    for (const k of Object.keys(dto.incomeAssumption.rankIncomeMap)) {
      checks.push({ enumerationType: 'professor_rank', key: k });
    }
  }
  if (dto.incomeAssumption.gradeIncomeMap) {
    for (const k of Object.keys(dto.incomeAssumption.gradeIncomeMap)) {
      checks.push({ enumerationType: 'military_grade', key: k });
    }
  }

  for (const check of checks) {
    const active = await ctx.isActiveMember(check.enumerationType, check.key);
    if (active) {
      continue;
    }
    const deprecated = await ctx.isDeprecatedMember(check.enumerationType, check.key);
    if (deprecated) {
      return { deprecatedKey: { enumerationType: check.enumerationType, key: check.key } };
    }
    return { unknownKey: { enumerationType: check.enumerationType, key: check.key } };
  }

  return {};
}

function pushKeys(
  out: KeyToCheck[],
  map: Record<string, unknown> | undefined,
  type: EnumerationType,
): void {
  if (!map) {
    return;
  }
  for (const k of Object.keys(map)) {
    out.push({ enumerationType: type, key: k });
  }
}

// --- FR-014 range sanity (feature 010) ------------------------------------

export interface RangeViolation {
  /** Dot path of the offending range, e.g. `loanLimits`, `tenor`, `eligibility`. */
  field: string;
  min: string | number | null;
  max: string | number | null;
}

interface RangeCheckable {
  tenor: { minMonths?: number; maxMonths?: number };
  loanLimits: { minAmountEGP?: string; maxAmountEGP?: string };
  eligibility: { ageMin: number; ageMax: number };
}

/**
 * FR-014 — a program MUST NOT save with an inverted or empty amount, tenor, or age range.
 * Returns the FIRST offending range so the client can name one field (`meta.field`).
 *
 * "Inverted" is `min > max`. "Empty" is an amount ceiling of zero — a program that can
 * never lend. Single-point ranges (`min === max`) are legitimate and pass.
 *
 * THE DURATION IS NOW OPTIONAL, and this function is what keeps "optional" from meaning
 * "absent is fine". Both months blank is how a program says "read the surrogate product's"
 * (`effectiveTenor`), so it is legal only when a product actually stands behind the
 * program's catalog name — `productStatesTenor`. Blank with nothing behind it would reach
 * the engine as a loan with no term, which `quoteProgram` reports as `tenor.maxMonths` at a
 * customer; refusing it here means the operator hears it while they are still on the screen
 * that can fix it.
 *
 * A HALF-STATED PAIR is refused in both directions. A floor read off the product and a
 * ceiling typed by the bank is a range neither of them stated, and it would also sail past
 * the inversion check below — `undefined > 84` is `false`, which is exactly how a bad range
 * gets saved looking valid.
 *
 * THE LOAN SIZE is optional on exactly the same terms, and is checked the same three ways —
 * see `productStatesLoanAmounts` and the block that reads it.
 */
export function validateRanges(
  dto: RangeCheckable,
  opts?: { productStatesTenor?: boolean; productStatesLoanAmounts?: boolean },
): RangeViolation | undefined {
  const minMonths = dto.tenor.minMonths;
  const maxMonths = dto.tenor.maxMonths;
  const statesMin = minMonths !== undefined;
  const statesMax = maxMonths !== undefined;
  if (statesMin !== statesMax) {
    return { field: 'tenor', min: minMonths ?? null, max: maxMonths ?? null };
  }
  if (!statesMin && !statesMax && opts?.productStatesTenor !== true) {
    return { field: 'tenor', min: null, max: null };
  }
  if (statesMin && statesMax && minMonths > maxMonths) {
    return { field: 'tenor', min: minMonths, max: maxMonths };
  }
  if (dto.eligibility.ageMin > dto.eligibility.ageMax) {
    return { field: 'eligibility', min: dto.eligibility.ageMin, max: dto.eligibility.ageMax };
  }
  const limits = dto.loanLimits ?? {};
  // THE SIZE IS NOW OPTIONAL TOO, on exactly the terms the duration above is, and these
  // three lines are what keep "optional" from meaning "absent is fine": both amounts blank
  // is how a program says "read the surrogate product's" (`effectiveLoanAmounts`), legal
  // only when a product actually stands behind the name. A half-stated pair is refused in
  // both directions — and it would also sail past the comparison below, because
  // `new Prisma.Decimal(undefined)` throws and would be reported as a malformed amount
  // rather than as the missing half it is.
  const statesMinAmount = limits.minAmountEGP !== undefined;
  const statesMaxAmount = limits.maxAmountEGP !== undefined;
  if (statesMinAmount !== statesMaxAmount) {
    return {
      field: 'loanLimits',
      min: limits.minAmountEGP ?? null,
      max: limits.maxAmountEGP ?? null,
    };
  }
  if (!statesMinAmount && !statesMaxAmount) {
    return opts?.productStatesLoanAmounts === true
      ? undefined
      : { field: 'loanLimits', min: null, max: null };
  }
  let min: Prisma.Decimal;
  let max: Prisma.Decimal;
  try {
    min = new Prisma.Decimal(limits.minAmountEGP as string);
    max = new Prisma.Decimal(limits.maxAmountEGP as string);
  } catch {
    return {
      field: 'loanLimits',
      min: limits.minAmountEGP ?? null,
      max: limits.maxAmountEGP ?? null,
    };
  }
  if (max.lessThanOrEqualTo(0) || min.greaterThan(max)) {
    return {
      field: 'loanLimits',
      min: limits.minAmountEGP ?? null,
      max: limits.maxAmountEGP ?? null,
    };
  }
  return undefined;
}

// --- FR-008s derivation arithmetic --------------------------------------

export interface DerivationMismatch {
  fieldPath: string;
  value: string;
  sourceRatePercent: string;
  deltaPercent: string;
}

const DERIVATION_BEARING_TIER_MAPS: Array<keyof PricingConfigDto> = [
  'rateByDownPaymentPercent',
  'rateByAssetValueBand',
  'rateByLoanAmountBand',
];

/**
 * Walks the pricing tier maps that may carry derivation chains and asserts:
 *   |sourceRatePercent + deltaPercent − value| ≤ 0.0001 %
 * Returns the first mismatch or undefined.
 */
export function validateDerivationArithmetic(
  pricing: PricingConfigDto,
): DerivationMismatch | undefined {
  for (const mapKey of DERIVATION_BEARING_TIER_MAPS) {
    const map = pricing[mapKey] as
      | Record<
          string,
          {
            value: string;
            derivation?: { sourceRatePercent: string; deltaPercent: string; reason: string };
          }
        >
      | undefined;
    if (!map) {
      continue;
    }
    for (const [bandKey, band] of Object.entries(map)) {
      if (!band?.derivation) {
        continue;
      }
      try {
        const v = new Prisma.Decimal(band.value);
        const s = new Prisma.Decimal(band.derivation.sourceRatePercent);
        const d = new Prisma.Decimal(band.derivation.deltaPercent);
        const diff = s.add(d).minus(v).abs();
        if (diff.greaterThan(TOLERANCE)) {
          return {
            fieldPath: `pricing.${String(mapKey)}.${bandKey}`,
            value: band.value,
            sourceRatePercent: band.derivation.sourceRatePercent,
            deltaPercent: band.derivation.deltaPercent,
          };
        }
      } catch {
        return {
          fieldPath: `pricing.${String(mapKey)}.${bandKey}`,
          value: String(band.value),
          sourceRatePercent: String(band.derivation.sourceRatePercent),
          deltaPercent: String(band.derivation.deltaPercent),
        };
      }
    }
  }
  return undefined;
}
