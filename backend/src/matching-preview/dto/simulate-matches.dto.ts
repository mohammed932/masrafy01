import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
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
}
