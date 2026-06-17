import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SaveWeightsDto {
  @ApiProperty({
    description:
      'Nested per-answer points: questionCode → optionCode → points. Each point ' +
      'is 1–100 (decimals allowed); no sum constraint. Probability = Σ(points of ' +
      'picked answers) / max-achievable points.',
    example: { monthly_income: { less_than_egp_10_000: 20, more_than_egp_40_000: 100 } },
  })
  @IsObject()
  weights!: Record<string, Record<string, number>>;
}
