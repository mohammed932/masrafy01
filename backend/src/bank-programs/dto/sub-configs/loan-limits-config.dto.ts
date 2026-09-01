import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { DecimalRange } from '../../../common/decorators/decimal-range.decorator';
import {
  MAX_LOAN_NO_MATCH_ACTIONS,
  type MaxLoanNoMatchAction,
} from '../../../matching/pipeline/max-loan-by-fact';
import {
  MAX_LOAN_ADJUSTMENT_KINDS,
  type MaxLoanAdjustmentKind,
} from '../../../matching/pipeline/max-loan-adjustments';

/** Fact keys become dot-path segments in stored config, so keep them boring. */
const FACT_KEY = /^[a-z0-9][a-z0-9_]{0,60}$/;

/**
 * One cell of a program's maximum-loan table.
 *
 * Keyed EITHER by an option code (`rowKey`) or by a half-open numeric band
 * (`[fromInclusive, toExclusive)`, `toExclusive: null` = open-ended last band). Which of the
 * two a row uses is decided by the FACT the table is keyed on, and is checked at the service
 * layer against the registry — not here, where the fact is not in scope.
 */
export class MaxLoanByFactRowDto {
  /** Choice facts: the option code this row prices. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(FACT_KEY)
  rowKey?: string;

  /** Numeric facts: inclusive lower edge. */
  @ApiPropertyOptional()
  @IsOptional()
  @DecimalRange({ min: '0', max: '99999999999.99', precision: 13, scale: 2, nullable: true })
  fromInclusive?: string;

  /** Numeric facts: EXCLUSIVE upper edge. `null` marks the open-ended last band. */
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @DecimalRange({ min: '0', max: '99999999999.99', precision: 13, scale: 2, nullable: true })
  toExclusive?: string | null;

  /** The second axis. Absent = this row applies to every column. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(FACT_KEY)
  columnKey?: string;

  /** > 0. A zero would be a blank card with no stated reason — see `onNoMatch`. */
  @DecimalRange({ min: '0.01', max: '99999999999.99', precision: 13, scale: 2 })
  maxAmountEGP!: string;
}

/**
 * One adjustment to the program's cap.
 *
 * `upliftPercent` ADDS the percentage ("Program loan amounts can be increased by 10% in case
 * applicants provide more than one residential unit"); `sharePercent` TAKES it ("jointly
 * owned accepted at 50% of the loan amount"). Two kinds rather than one signed number,
 * because an operator should be able to type what the sheet says.
 *
 * The SCOPE is the point of this class existing at all: the same sheet line applied to the
 * income and applied to the cap give answers 300,000 apart on one ABK applicant, and 50%
 * apart on another. An adjustment configured inside the income rule lifts the income; one
 * configured here lifts the cap; a bank that means both states both.
 */
export class MaxLoanAdjustmentDto {
  @IsIn(MAX_LOAN_ADJUSTMENT_KINDS as readonly string[])
  kind!: MaxLoanAdjustmentKind;

  /**
   * `upliftPercent`: how much to ADD, so 10 means +10%. `sharePercent`: what share to KEEP,
   * so 50 means half. Bounded above 0 in both cases — a zero uplift is a no-op the operator
   * should delete, and a zero share is a cap of zero, which is a blank card.
   */
  @DecimalRange({ min: '0.0001', max: '1000', precision: 8, scale: 4 })
  percent!: string;

  /** The fact whose answer switches this adjustment on. */
  @IsString()
  @Matches(FACT_KEY)
  whenFactKey!: string;

  /**
   * The one answer it applies to. Every other answer, and an unanswered fact, mean NO
   * adjustment — never "for everyone".
   */
  @IsString()
  @Matches(FACT_KEY)
  whenOptionCode!: string;
}

/**
 * The program's maximum loan, keyed by an answer — the second table nine source sheets
 * print under "Loan Amount — Maximum".
 *
 * The general form of `maxByPropertyType` / `maxByTransferType` / `maxByEmploymentType`,
 * which are three fixed axes and cannot reach a fourth (a city, a school type, a branch, a
 * company coding, a unit-price bracket). Applied in `quote.ts` after the DBR-derived amount
 * and after the collateral ceiling, so all three ceilings compose and the lowest wins.
 *
 * Reachability note, and it is the reason this class exists rather than a loose `IsObject`:
 * `forbidNonWhitelisted: true` rejects any field absent from a DTO on the wire. That is
 * exactly what made `dbrCapPercentByEmploymentType` an engine setting no operator could
 * reach for two versions.
 */
export class MaxLoanByFactDto {
  /** The fact whose answer picks the row. */
  @IsString()
  @Matches(FACT_KEY)
  factKey!: string;

  /** Optional second axis — new loan vs top-up, holds-another-product, employment type. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(FACT_KEY)
  columnFactKey?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => MaxLoanByFactRowDto)
  rows!: MaxLoanByFactRowDto[];

  /**
   * What happens to an applicant whose answer has no row. MANDATORY and never defaulted by
   * the platform: "no cap" quotes far above the bank's policy, and "cap zero" is a blank
   * card. Which of the two a bank means is a bank's answer, not a fallback.
   */
  @IsIn(MAX_LOAN_NO_MATCH_ACTIONS as readonly string[])
  onNoMatch!: MaxLoanNoMatchAction;
}

/**
 * Spec anchors: FR-003, FR-003a (qualitativeReviewMaxEGP semantics).
 *
 * EGP-only: the platform lends in one currency, so the floor and ceiling are two
 * scalars rather than the per-currency map they used to be
 * (`20260815140000_drop_currency`).
 */
export class LoanLimitsConfigDto {
  @DecimalRange({ min: '0', max: '99999999999.99', precision: 13, scale: 2 })
  minAmountEGP!: string;

  @DecimalRange({ min: '0', max: '99999999999.99', precision: 13, scale: 2 })
  maxAmountEGP!: string;

  @IsOptional()
  @IsArray()
  maxByCDTier?: Array<{ minCDValueEGP: string; maxAmountEGP: string }>;

  @IsOptional()
  @IsObject()
  maxByPropertyType?: Record<string, string>;

  @IsOptional()
  @IsObject()
  maxByTransferType?: Record<string, string>;

  @IsOptional()
  @IsObject()
  maxByEmploymentType?: Record<string, string>;

  @IsOptional()
  @DecimalRange({ min: '0', max: '99999999999.99', precision: 13, scale: 2, nullable: true })
  maxTopUpEGP?: string;

  @IsOptional()
  @DecimalRange({ min: '0', max: '999.9999', precision: 7, scale: 4, nullable: true })
  ltvCeilingPercent?: string;

  /** Minimum down-payment percent (feature 008). Auto + mortgage programs. */
  @IsOptional()
  @DecimalRange({ min: '0', max: '100', precision: 5, scale: 2, nullable: true })
  minDownPaymentPercent?: string;

  /** Operator-uplift ceiling (FR-003a). Service enforces requiresQualitativeReview=true. */
  @IsOptional()
  @DecimalRange({ min: '0', max: '99999999999.99', precision: 13, scale: 2, nullable: true })
  qualitativeReviewMaxEGP?: string;

  @IsOptional()
  @DecimalRange({ min: '0', max: '99999999999.99', precision: 13, scale: 2, nullable: true })
  otherCitiesMaxEGP?: string;

  /**
   * The program's maximum loan keyed by an answer. See `MaxLoanByFactDto`.
   *
   * Composes with the three fixed `maxBy…` axes above rather than replacing them: a program
   * may carry both, and `quote.ts` takes the lowest ceiling that applies.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => MaxLoanByFactDto)
  maxLoanByFact?: MaxLoanByFactDto;

  /**
   * Adjustments that act on the CAP rather than on the income. See
   * `MaxLoanAdjustmentDto` and `matching/pipeline/max-loan-adjustments.ts`.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => MaxLoanAdjustmentDto)
  maxLoanAdjustments?: MaxLoanAdjustmentDto[];
}
