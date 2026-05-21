import { IsArray, IsObject, IsOptional } from 'class-validator';
import { DecimalRange } from '../../../common/decorators/decimal-range.decorator';

/**
 * Spec anchors: FR-003, FR-003a (qualitativeReviewMaxEGP semantics).
 * `perCurrency` keys MUST be a superset of the program's `currencies[]` list — enforced at service layer.
 */
export class LoanLimitsConfigDto {
  /** Per-currency min/max. Shape: { EGP: { minAmount, maxAmount }, USD?: { ... }, EUR?: { ... } } */
  @IsObject()
  perCurrency!: Record<string, { minAmount: string; maxAmount: string }>;

  @IsOptional()
  @IsArray()
  maxByCDTier?: Array<{ minCDValueEGP: string; maxAmountEGP: string }>;

  @IsOptional()
  @IsObject()
  maxByPropertyType?: Record<string, string>;

  @IsOptional()
  @IsObject()
  maxByCityTier?: Record<string, string>;

  @IsOptional()
  @IsObject()
  maxByTransferType?: Record<string, string>;

  @IsOptional()
  @IsObject()
  maxBySalaryCategory?: Record<string, string>;

  @IsOptional()
  @IsObject()
  maxByEmploymentType?: Record<string, string>;

  @IsOptional()
  @IsObject()
  maxByPerformanceTier?: Record<string, string>;

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
}
