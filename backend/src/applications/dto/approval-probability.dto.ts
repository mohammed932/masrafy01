/**
 * Swagger documentation surface for the structured `approvalProbability` object
 * returned on every matched offer.
 *
 * Constitution Principle XIV — API contract. Mirrors
 * specs/004-approval-probability-display/contracts/openapi.yaml#ApprovalProbability.
 */
import { ApiProperty } from '@nestjs/swagger';

export class FactorImpactDto {
  @ApiProperty({
    description:
      'Stable factor code resolved against the offer engine version factor catalog (e.g. PAYROLL_TRANSFER, HAS_CD_AT_ABK, PREVIOUS_REJECTION, CLAMPED_TO_FLOOR).',
  })
  code!: string;

  @ApiProperty({
    description: 'Signed integer. Positive entries strictly > 0; negative entries strictly < 0.',
  })
  impact!: number;
}

export class ApprovalFactorsDto {
  @ApiProperty({ type: [FactorImpactDto], description: 'Sorted by |impact| desc.' })
  positive!: FactorImpactDto[];

  @ApiProperty({ type: [FactorImpactDto], description: 'Sorted by |impact| desc.' })
  negative!: FactorImpactDto[];

  @ApiProperty({
    required: false,
    description: 'True only on backfilled offers (engineVersion=1.0.0-legacy).',
  })
  legacy?: boolean;
}

export class ApprovalProbabilityDto {
  @ApiProperty({ minimum: 0, maximum: 100 })
  score!: number;

  @ApiProperty({ enum: ['excellent', 'good', 'moderate', 'low', 'very_low'] })
  tier!: 'excellent' | 'good' | 'moderate' | 'low' | 'very_low';

  @ApiProperty({
    description: 'Stable i18n key, pattern approval.tier.<tier>. Client localizes.',
    example: 'approval.tier.excellent',
  })
  tierLabelCode!: string;

  @ApiProperty({ type: ApprovalFactorsDto })
  factors!: ApprovalFactorsDto;

  @ApiProperty({
    description: 'Semver of the scoring engine that produced this score.',
    example: '1.1.0-init',
  })
  engineVersion!: string;
}
