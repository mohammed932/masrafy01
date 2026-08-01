import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { DecimalRange } from '@/common/decorators/decimal-range.decorator';

/**
 * Feature 010 — the shared PARTIAL bank-program shape used by every prefill layer.
 *
 * Three hosts store this exact shape (FR-021a):
 *   1. `PlatformEnumeration.defaults[category]` — predefined-program catalog defaults (FR-001)
 *   2. `Bank.policyDefaults`                    — bank lending policy (FR-005, US6)
 *   3. the `GET /admin/bank-programs/prefill` response body (FR-008)
 *
 * Every leaf is optional (FR-003): a name with no defaults behaves exactly like the
 * name-only catalog behaves today. Values are COPIED into the bank program on save
 * (FR-009) and are NEVER consulted at match time (FR-021b) — matching reads the
 * bank program alone.
 *
 * Field selection follows FR-011 (Essentials) + FR-015b (kept settings): only settings
 * that change an offer are prefillable. Pruned eligibility settings (FR-015a) are
 * deliberately absent.
 */

export class DbrBandDto {
  /** Inclusive upper bound on recognised monthly income; `null` = the open-ended final band. */
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @DecimalRange({ min: '0', max: '99999999999.99', precision: 13, scale: 2, nullable: true })
  upToIncomeEGP!: string | null;

  @DecimalRange({ min: '1', max: '100', precision: 7, scale: 4 })
  capPercent!: string;
}

export class ProgramDefaultsTenorDto {
  @IsOptional() @IsInt() @Min(1) @Max(480) minMonths?: number;
  @IsOptional() @IsInt() @Min(1) @Max(480) maxMonths?: number;
}

export class ProgramDefaultsAmountRangeDto {
  @IsOptional()
  @DecimalRange({ min: '0', max: '99999999999.99', precision: 13, scale: 2, nullable: true })
  minAmount?: string;

  @IsOptional()
  @DecimalRange({ min: '0', max: '99999999999.99', precision: 13, scale: 2, nullable: true })
  maxAmount?: string;
}

export class ProgramDefaultsLoanLimitsDto {
  /** Currency-keyed amount range, e.g. `{ EGP: { minAmount, maxAmount } }`. */
  @IsOptional()
  @IsObject()
  perCurrency?: Record<string, ProgramDefaultsAmountRangeDto>;
}

export class ProgramDefaultsEligibilityDto {
  @IsOptional() @IsInt() @Min(18) @Max(80) ageMin?: number;
  @IsOptional() @IsInt() @Min(18) @Max(80) ageMax?: number;

  @IsOptional()
  @DecimalRange({ min: '0', max: '99999999999.99', precision: 13, scale: 2, nullable: true })
  minMonthlyIncomeEGP?: string;

  @IsOptional()
  @DecimalRange({ min: '1', max: '100', precision: 7, scale: 4, nullable: true })
  dbrCapPercent?: string;

  /** Ordered income-band table (FR-016). Validated by `validateDbrBands` at the service layer. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DbrBandDto)
  dbrBands?: DbrBandDto[];

  @IsOptional() @IsBoolean() skipDbrCheck?: boolean;

  /** Kept per FR-015b — drives the collateral fee. */
  @IsOptional() @IsBoolean() requiresCollateral?: boolean;

  /** Kept per FR-015b — the two bank-staff percentages scale recognised income. */
  @IsOptional()
  @DecimalRange({ min: '0', max: '100', precision: 7, scale: 4, nullable: true })
  commercialBankIncomePercent?: string;

  @IsOptional()
  @DecimalRange({ min: '0', max: '100', precision: 7, scale: 4, nullable: true })
  publicBankIncomePercent?: string;
}

export class ProgramDefaultsPricingDto {
  @IsOptional() @IsBoolean() isVariableRate?: boolean;

  @IsOptional()
  @DecimalRange({ min: '0', max: '999.9999', precision: 7, scale: 4, nullable: true })
  baseRatePercent?: string;

  @IsOptional()
  @DecimalRange({ min: '0', max: '999.9999', precision: 7, scale: 4, nullable: true })
  currentEffectiveRatePercent?: string;
}

export class ProgramDefaultsFeesDto {
  @IsOptional()
  @DecimalRange({ min: '0', max: '100', precision: 7, scale: 4, nullable: true })
  adminFeePercent?: string;

  @IsOptional()
  @DecimalRange({ min: '0', max: '100', precision: 7, scale: 4, nullable: true })
  stampDutyPercent?: string;

  @IsOptional()
  @DecimalRange({ min: '0', max: '100', precision: 7, scale: 4, nullable: true })
  lifeInsurancePercent?: string;

  @IsOptional()
  @DecimalRange({ min: '0', max: '99999999999.99', precision: 13, scale: 2, nullable: true })
  lifeInsuranceMinLoanEGP?: string;
}

/** The partial program shape stored per category / per bank and returned by prefill. */
export class ProgramDefaultsDto {
  @IsOptional() @ValidateNested() @Type(() => ProgramDefaultsTenorDto)
  tenor?: ProgramDefaultsTenorDto;

  @IsOptional() @ValidateNested() @Type(() => ProgramDefaultsLoanLimitsDto)
  loanLimits?: ProgramDefaultsLoanLimitsDto;

  @IsOptional() @ValidateNested() @Type(() => ProgramDefaultsEligibilityDto)
  eligibility?: ProgramDefaultsEligibilityDto;

  @IsOptional() @ValidateNested() @Type(() => ProgramDefaultsPricingDto)
  pricing?: ProgramDefaultsPricingDto;

  @IsOptional() @ValidateNested() @Type(() => ProgramDefaultsFeesDto)
  fees?: ProgramDefaultsFeesDto;

  /** Keys validated against the `required_document` enumeration at the service layer. */
  @IsOptional() @IsArray() @IsString({ each: true })
  requiredDocuments?: string[];
}

/**
 * Leaf paths the prefill merge walks, in `origin`-map order (FR-010).
 * `loanLimits.perCurrency` and `eligibility.dbrBands` merge as whole leaves —
 * an amount range and a band table are only meaningful intact.
 */
export const PROGRAM_DEFAULT_LEAF_PATHS = [
  'tenor.minMonths',
  'tenor.maxMonths',
  'loanLimits.perCurrency',
  'eligibility.ageMin',
  'eligibility.ageMax',
  'eligibility.minMonthlyIncomeEGP',
  'eligibility.dbrCapPercent',
  'eligibility.dbrBands',
  'eligibility.skipDbrCheck',
  'eligibility.requiresCollateral',
  'eligibility.commercialBankIncomePercent',
  'eligibility.publicBankIncomePercent',
  'pricing.isVariableRate',
  'pricing.baseRatePercent',
  'pricing.currentEffectiveRatePercent',
  'fees.adminFeePercent',
  'fees.stampDutyPercent',
  'fees.lifeInsurancePercent',
  'fees.lifeInsuranceMinLoanEGP',
  'requiredDocuments',
] as const;

export type ProgramDefaultLeafPath = (typeof PROGRAM_DEFAULT_LEAF_PATHS)[number];

/** Where a prefilled leaf came from (FR-010). */
export type PrefillOrigin = 'CATALOG' | 'BANK_POLICY' | 'EMPTY';

export type PrefillOriginMap = Partial<Record<ProgramDefaultLeafPath, PrefillOrigin>>;
