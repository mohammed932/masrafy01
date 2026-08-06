import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type {
  MultiSelectRule,
  NumericBand,
  TextRule,
} from '@/matching/scoring/approval-probability.scorer';

/**
 * The `weights` blob a program's scoring version stores. Deep validation lives in
 * `ScoringService` (it needs the question pool to resolve codes and types), so
 * this stays `@IsObject()` — the shape is documented here and in OpenAPI.
 */
export interface SaveWeightsPayload {
  /** questionCode → weight. Over the ASSIGNED questions these sum to exactly 100. */
  questionWeights: Record<string, number>;
  /** questionCode → optionCode → score 0–100. SINGLE_SELECT and MULTI_SELECT. */
  answerScores: Record<string, Record<string, number>>;
  /** questionCode → how several picks combine. MULTI_SELECT only; default AVERAGE. */
  multiSelectRules?: Record<string, MultiSelectRule>;
  /** questionCode → ordered, gapless, non-overlapping `[from, to)` bands. NUMERIC only. */
  numericBands?: Record<string, NumericBand[]>;
  /** questionCode → what a non-blank answer earns. TEXT only. */
  textRules?: Record<string, TextRule>;
}

export class SaveWeightsDto {
  @ApiProperty({
    description:
      'Two-level scoring: questionWeights (questionCode → weight, all summing to 100) ' +
      'plus the per-type rule that turns one answer into a 0–100 score — answerScores ' +
      'for both choice types, multiSelectRules (AVERAGE|SUM_CAPPED|MAX|MIN) for ' +
      'MULTI_SELECT, numericBands (half-open [from, to)) for NUMERIC, textRules ' +
      '(presence) for TEXT. probability = Σ_answered(weight × answerScore ÷ 100) ÷ ' +
      'Σ_asked(weight).',
    example: {
      questionWeights: { monthly_income: 50, other_income_sources: 30, employer_name: 20 },
      answerScores: {
        other_income_sources: { salary: 100, rental: 70, freelance: 40 },
      },
      multiSelectRules: { other_income_sources: { aggregation: 'SUM_CAPPED' } },
      numericBands: {
        monthly_income: [
          { from: null, to: '5000', score: 20 },
          { from: '5000', to: '15000', score: 60 },
          { from: '15000', to: null, score: 100 },
        ],
      },
      textRules: { employer_name: { answeredScore: 100 } },
    },
  })
  @IsObject()
  weights!: SaveWeightsPayload;
}
