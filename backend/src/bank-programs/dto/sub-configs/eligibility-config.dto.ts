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
  ValidateNested,
} from 'class-validator';
import { DecimalRange } from '../../../common/decorators/decimal-range.decorator';

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

  @IsInt() @Min(18) @Max(80) ageMin!: number;
  @IsInt() @Min(18) @Max(80) ageMax!: number;

  @IsOptional() @IsInt() @Min(18) @Max(80) ageMinSelfEmployed?: number;
  @IsOptional() @IsInt() @Min(18) @Max(80) ageMaxSelfEmployed?: number;

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
