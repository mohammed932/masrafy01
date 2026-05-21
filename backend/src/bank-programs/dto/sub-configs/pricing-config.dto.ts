import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { DecimalRange } from '../../../common/decorators/decimal-range.decorator';

/** Sharia-compliant contract types (Islamic finance instruments). */
export const SHARIA_CONTRACT_TYPES = ['murabaha', 'ijara', 'tawarruq'] as const;
export type ShariaContractType = (typeof SHARIA_CONTRACT_TYPES)[number];

/**
 * Spec anchors: FR-004, FR-008b (frozen cascade order), FR-008o + FR-008o.1 (down-payment band floor-≤),
 *   FR-008p + FR-008p.1 (asset-value / loan-amount band floor-≤), FR-008q (customer program tier),
 *   FR-008r (insurance-waiver penalty), FR-011a (variable-rate consistency).
 *
 * Tier-map shape: Record<string, { value: string; derivation?: {...} }>. The map shape uses
 * a plain object validator at the DTO boundary; deep validation of each RateBandValueDto +
 * derivation arithmetic happens at the service layer (uses @ValidDerivationChain on each band).
 */
export class PricingConfigDto {
  @IsBoolean()
  isVariableRate!: boolean;

  @IsOptional()
  @DecimalRange({ min: '0', max: '999.9999', precision: 7, scale: 4, nullable: true })
  baseRatePercent?: string;

  @IsOptional()
  @DecimalRange({ min: '0', max: '999.9999', precision: 7, scale: 4, nullable: true })
  currentEffectiveRatePercent?: string;

  @IsOptional()
  @IsString()
  variableRateNote?: string;

  @IsOptional()
  @DecimalRange({ min: '0', max: '999.9999', precision: 7, scale: 4, nullable: true })
  spreadMinPercent?: string;

  @IsOptional()
  @DecimalRange({ min: '0', max: '999.9999', precision: 7, scale: 4, nullable: true })
  spreadMaxPercent?: string;

  // Tier maps — keys validated against the relevant enumeration at service layer.
  @IsOptional() @IsObject() rateByEmploymentType?: Record<string, RateBandLike>;
  @IsOptional() @IsObject() rateBySeniority?: Record<string, RateBandLike>;
  @IsOptional() @IsObject() rateByTransferType?: Record<string, RateBandLike>;
  @IsOptional() @IsObject() rateByTenor?: Record<string, RateBandLike>;
  @IsOptional() @IsObject() rateByTenorAndCustomerType?: Record<string, RateBandLike>;
  @IsOptional() @IsObject() rateByDownPaymentPercent?: Record<string, RateBandLike>;
  @IsOptional() @IsObject() rateByCustomerProgramTier?: Record<string, RateBandLike>;
  @IsOptional() @IsObject() rateByAssetValueBand?: Record<string, RateBandLike>;
  @IsOptional() @IsObject() rateByLoanAmountBand?: Record<string, RateBandLike>;

  // Buyout rate computation (FR-008m).
  @IsOptional()
  @DecimalRange({ min: '-999.9999', max: '999.9999', precision: 7, scale: 4, nullable: true })
  buyoutRateDeltaPercent?: string;

  @IsOptional()
  @DecimalRange({ min: '0', max: '999.9999', precision: 7, scale: 4, nullable: true })
  buyoutRateMinFloorPercent?: string;

  // Fee-waiver mechanics (FR-008j + FR-008k).
  @IsOptional()
  @DecimalRange({ min: '0', max: '999.9999', precision: 7, scale: 4, nullable: true })
  feeWaiverEnabledAtRatePercent?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  feeWaiverMinTenorMonths?: number;

  @IsOptional()
  @DecimalRange({ min: '0', max: '999.9999', precision: 7, scale: 4, nullable: true })
  feeWaiverPenaltyRatePercent?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  feeWaiverPenaltyMinTenorMonths?: number;

  // Insurance-waiver penalty (FR-008r).
  @IsOptional()
  @DecimalRange({ min: '0', max: '999.9999', precision: 7, scale: 4, nullable: true })
  insuranceWaiverPenaltyRatePercent?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  insuranceWaiverPenaltyMinTenorMonths?: number;

  // Sharia / Islamic banking (feature 008). When the parent program's
  // `isShariaCompliant=true`, the contract instrument is specified here.
  // Pricing semantics shift from interest-rate → profit-rate, but the
  // numeric fields stay identical so the matching engine remains generic.
  @IsOptional()
  @IsIn(SHARIA_CONTRACT_TYPES as unknown as string[])
  shariaContractType?: ShariaContractType;
}

/** Loose shape — the service layer enforces RateBandValueDto + ValidDerivationChain. */
interface RateBandLike {
  value: string;
  derivation?: {
    sourceRatePercent: string;
    deltaPercent: string;
    reason: string;
  };
}
