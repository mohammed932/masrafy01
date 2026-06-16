import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SaveWeightsDto {
  @ApiProperty({
    description: 'Map of questionCode → weight points; must sum to exactly 100 (v5.0.0).',
    example: { employment_status: 30, monthly_income: 40, salary_transferred: 30 },
  })
  @IsObject()
  weights!: Record<string, number>;
}
