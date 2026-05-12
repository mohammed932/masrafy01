import { IsOptional, IsString, MaxLength } from 'class-validator';
import { DecimalRange } from '../../../common/decorators/decimal-range.decorator';

/**
 * Per-tier-band derivation chain (FR-008s).
 * Documentation only — the matching engine ignores this; only `value` participates.
 */
export class DerivationDto {
  @DecimalRange({ min: '0', max: '999.9999', precision: 7, scale: 4 })
  sourceRatePercent!: string;

  /** Signed — `−1.0000` allowed (e.g., car > 4M discount). */
  @DecimalRange({ min: '-999.9999', max: '999.9999', precision: 7, scale: 4 })
  deltaPercent!: string;

  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class RateBandValueDto {
  @DecimalRange({ min: '0', max: '999.9999', precision: 7, scale: 4 })
  value!: string;

  @IsOptional()
  derivation?: DerivationDto;
}
