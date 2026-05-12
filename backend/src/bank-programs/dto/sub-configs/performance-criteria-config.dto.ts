import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

/**
 * Spec anchor: FR-005a + FR-005b. Optional sub-config — only buyout + cross-sell programs configure.
 * Hybrid evidence source (applicant-declared + optional bureau verify) is matching-engine concern, not this DTO.
 */
export class PerformanceCriteriaConfigDto {
  @IsInt() @Min(0) requiredMOBMonths!: number;
  @IsBoolean() iScoreMOBPerformanceCheck!: boolean;
  @IsOptional() @IsInt() @Min(0) bkt1NoHitWithinMonths?: number;
  @IsOptional() @IsInt() @Min(0) bkt2NoHitWithinMonths?: number;
  @IsBoolean() requireCurrentLoanStatus!: boolean;
}
