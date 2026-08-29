import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { DecimalRange } from '../../../common/decorators/decimal-range.decorator';
import {
  COARSE_EMPLOYMENT_TYPES,
  isCoarseEmploymentType,
} from '../../../matching/pipeline/employment-type';

/**
 * `{ salaried: '50', self_employed: '40' }` — a percentage per underwriting bucket.
 *
 * Both halves are refused, and each for its own reason. An unknown KEY is a cap the engine
 * will never look up, so it reads as configured on screen and is dead at quote time. A
 * value outside `(0, 100]` is worse than dead: `resolveDbrCap` re-checks the bounds and
 * falls through, so a typed `0` would look like "this bank caps the self-employed at
 * nothing" while quietly quoting them at the flat rate instead.
 */
@ValidatorConstraint({ name: 'coarseEmploymentPercentMap', async: false })
export class CoarseEmploymentPercentMap implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    return Object.entries(value as Record<string, unknown>).every(([key, percent]) => {
      if (!isCoarseEmploymentType(key)) return false;
      if (typeof percent !== 'string' || !/^\d+(\.\d{1,4})?$/.test(percent)) return false;
      const parsed = Number(percent);
      return Number.isFinite(parsed) && parsed > 0 && parsed <= 100;
    });
  }

  /**
   * Names the property. The envelope keys its `fields` map off the first word of the
   * message, so a message opening with "each" surfaced as `eligibility.each` — an error the
   * form could not attach to any control.
   */
  defaultMessage(args: ValidationArguments): string {
    return `${args.property} keys must be one of ${COARSE_EMPLOYMENT_TYPES.join(', ')}, each with a percentage in (0, 100]`;
  }
}

/** One row of a bank program's banded DBR table (FR-016). */
export class DbrBandDto {
  /** Inclusive upper bound on recognised monthly income; `null` = the open-ended final band. */
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @DecimalRange({ min: '0', max: '99999999999.99', precision: 13, scale: 2, nullable: true })
  upToIncomeEGP!: string | null;

  @DecimalRange({ min: '1', max: '100', precision: 7, scale: 4 })
  capPercent!: string;
}

/**
 * Spec anchors: FR-005, FR-005c (wealth gates), FR-005c.1 (AND combination),
 *   FR-005d (no-documents flag).
 *
 * Keys in array fields are validated against the relevant enumeration at service layer.
 */
export class EligibilityConfigDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  acceptedEmploymentTypes!: string[];

  // 90, not 80: one seeded partner underwrites a collateral product from 30 to 90, and a
  // bound the operator cannot reach is a row the seed can plant and no admin can ever fix.
  @IsInt() @Min(18) @Max(90) ageMin!: number;
  @IsInt() @Min(18) @Max(90) ageMax!: number;

  @IsOptional() @IsInt() @Min(18) @Max(90) ageMinSelfEmployed?: number;
  @IsOptional() @IsInt() @Min(18) @Max(90) ageMaxSelfEmployed?: number;

  @DecimalRange({ min: '0', max: '99999999999.99', precision: 13, scale: 2 })
  minMonthlyIncomeEGP!: string;

  @IsOptional()
  @DecimalRange({ min: '0', max: '99999999999.99', precision: 13, scale: 2, nullable: true })
  minMonthlyIncomeSelfEmployedEGP?: string;

  @IsInt()
  @Min(0)
  minMonthsInJob!: number;

  @DecimalRange({ min: '0', max: '100', precision: 7, scale: 4 })
  dbrCapPercent!: string;

  /**
   * Feature 010 (FR-016) — optional income-band table that overrides the flat
   * `dbrCapPercent` when present. Ordered, inclusive upper bounds, final band
   * open-ended (`upToIncomeEGP: null`). Programs without one keep working
   * unchanged (FR-020). Structure validated by `validateDbrBands` at the
   * service layer, which is where the typed error codes live.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DbrBandDto)
  dbrBands?: DbrBandDto[];

  /**
   * A cap that depends on WHO the applicant is rather than on what they earn — the
   * "50% salaried / 40% self-employed" every second bank sheet states.
   *
   * Sits between the rule override and the income bands in `resolveDbrCap`, and that order
   * is the meaning: a bank stating both means "40% for the self-employed, whatever they
   * earn". Keys are the COARSE buckets the engine folds a detailed answer into — a bank
   * never writes the questionnaire's own vocabulary.
   *
   * The engine has read this since v18.1.0 and nothing could write it: the field was absent
   * here, so `forbidNonWhitelisted` rejected it on the wire and no editor offered it. A
   * setting the engine honours and no operator can reach is worse than one that does not
   * exist, because the sheets say it is there.
   */
  @IsOptional()
  @IsObject()
  @Validate(CoarseEmploymentPercentMap)
  dbrCapPercentByEmploymentType?: Record<string, string>;

  @IsBoolean()
  skipDbrCheck!: boolean;

  @IsArray()
  @IsString({ each: true })
  acceptedTransferTypes!: string[];

  // Required-X flags (FR-005)
  @IsBoolean() requiresCD!: boolean;
  @IsBoolean() requiresAutoLoanAtABK!: boolean;
  @IsBoolean() requiresAutoLoanAtOtherBank!: boolean;
  @IsBoolean() requiresCreditCardAtOtherBank!: boolean;
  @IsBoolean() requiresCompoundProperty!: boolean;
  @IsBoolean() requiresCollateral!: boolean;
  @IsBoolean() requiresClubMembership!: boolean;
  @IsBoolean() requiresExistingLoan!: boolean;
  @IsBoolean() requiresFRMUVerification!: boolean;
  @IsBoolean() requiresQualitativeReview!: boolean;
  @IsBoolean() requiresNoDocuments!: boolean;

  // Numeric / typed eligibility (FR-005 continued)
  @IsOptional() @IsInt() @Min(0) minimumCreditCardHoldingMonths?: number;
  @IsOptional() @IsBoolean() competitorCardMustBeUnsecured?: boolean;
  @IsOptional()
  @DecimalRange({ min: '0', max: '99999999999.99', precision: 13, scale: 2, nullable: true })
  eligibleCarPriceMinEGP?: string;
  @IsOptional()
  @DecimalRange({ min: '0', max: '100', precision: 7, scale: 4, nullable: true })
  eligibleDownPaymentPercent?: string;
  @IsOptional() @IsString() clubClass?: string;
  @IsOptional() @IsString() compoundClass?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) companyType?: string[];

  @IsOptional()
  @DecimalRange({ min: '0', max: '100', precision: 7, scale: 4, nullable: true })
  commercialBankIncomePercent?: string;

  @IsOptional()
  @DecimalRange({ min: '0', max: '100', precision: 7, scale: 4, nullable: true })
  publicBankIncomePercent?: string;

  // Wealth-tier gates (FR-005c + FR-005c.1)
  @IsOptional()
  @DecimalRange({ min: '0', max: '99999999999.99', precision: 13, scale: 2, nullable: true })
  minBankStatementBalanceEGP?: string;

  @IsOptional()
  @DecimalRange({ min: '0', max: '99999999999.99', precision: 13, scale: 2, nullable: true })
  minAssetsValueEGP?: string;
}
