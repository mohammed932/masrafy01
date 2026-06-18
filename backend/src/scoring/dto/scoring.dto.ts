import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SaveWeightsDto {
  @ApiProperty({
    description:
      'Two-level scoring (v8): questionWeights (questionCode → weight, all summing ' +
      'to 100) + answerScores (questionCode → optionCode → score 0–100). ' +
      'Probability = Σ_question(questionWeight ÷ 100 × pickedAnswerScore ÷ 100).',
    example: {
      questionWeights: { monthly_income: 60, employment_status: 40 },
      answerScores: {
        monthly_income: { less_than_egp_10_000: 20, more_than_egp_40_000: 100 },
        employment_status: { employed: 100, unemployed: 0 },
      },
    },
  })
  @IsObject()
  weights!: {
    questionWeights: Record<string, number>;
    answerScores: Record<string, Record<string, number>>;
  };
}
