import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { LoanEngineOverrideDto } from '@/bank-programs/loan-engine/dto/loan-engine.dto';
import { PreviewMatchesDto } from '@/questionnaire/dto/questionnaire.dto';

/**
 * Admin simulator body. Identical to the customer preview body plus the sample
 * applicant's `age` — the admin types a hypothetical applicant, so there is no
 * `birthday` to derive from.
 *
 * `age` deliberately lives HERE and not on `PreviewMatchesDto`: on the customer
 * endpoint age is derived from the authenticated caller's `birthday` and must
 * never be accepted from the body (Principle XXXVII / A31).
 */
export class SimulateMatchesDto extends PreviewMatchesDto {
  @ApiPropertyOptional({
    example: 34,
    description: 'Sample applicant age. Defaults to the youngest adult (18) when omitted.',
  })
  @IsOptional()
  @IsInt()
  @Min(18)
  @Max(80)
  age?: number;

  /**
   * Feature 013 — the Loan Engine's UNSAVED drafts, priced in memory for this one preview and
   * never written. Each is checked exactly as its save would be.
   */
  @ApiPropertyOptional({ type: [LoanEngineOverrideDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => LoanEngineOverrideDto)
  programOverrides?: LoanEngineOverrideDto[];
}
