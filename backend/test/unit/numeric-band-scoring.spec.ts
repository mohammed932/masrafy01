/**
 * NUMERIC scoring by admin-defined bands (Constitution V, v14.0.0).
 *
 * A number has no options to look a score up from, which is why NUMERIC used to
 * score nothing at all — and why monthly income, existing debts, requested amount
 * and term moved the instalment but never the match. A program now bands the
 * value: ordered, gapless, half-open `[from, to)` intervals, each with a score
 * 0–100.
 *
 * Half-open is the whole point of the interval choice: with inclusive-inclusive
 * bounds two adjacent bands both claim the edge and which one wins depends on
 * iteration order. Every boundary case below pins that down.
 */
import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { ScoringService } from '@/scoring/scoring.service';
import type { SaveWeightsPayload } from '@/scoring/dto/scoring.dto';
import {
  answerScoreFor,
  bandFor,
  computeProbability,
  type NumericBand,
  type ProgramScoring,
} from '@/matching/scoring/approval-probability.scorer';

const BANDS: NumericBand[] = [
  { from: null, to: '5000', score: 20 },
  { from: '5000', to: '15000', score: 60 },
  { from: '15000', to: null, score: 100 },
];

const SCORING: ProgramScoring = {
  questionWeights: { monthly_income: 100 },
  answerScores: {},
  numericBands: { monthly_income: BANDS },
};

const numeric = (value: string) =>
  ({ questionCode: 'monthly_income', kind: 'numeric', value }) as const;

describe('a value lands in exactly one band', () => {
  it('scores the band it falls inside', () => {
    expect(answerScoreFor(SCORING, numeric('0'))).toBe(20);
    expect(answerScoreFor(SCORING, numeric('4999.99'))).toBe(20);
    expect(answerScoreFor(SCORING, numeric('9000'))).toBe(60);
    expect(answerScoreFor(SCORING, numeric('1000000'))).toBe(100);
  });

  it('gives a boundary value to the band that OPENS on it, not the one that closes', () => {
    // [from, to): 5000 belongs to the 5000–15000 band, not to the one ending at 5000.
    expect(answerScoreFor(SCORING, numeric('5000'))).toBe(60);
    expect(answerScoreFor(SCORING, numeric('15000'))).toBe(100);
  });

  it('separates decimal neighbours of a boundary', () => {
    expect(answerScoreFor(SCORING, numeric('4999.99'))).toBe(20);
    expect(answerScoreFor(SCORING, numeric('5000.00'))).toBe(60);
    expect(answerScoreFor(SCORING, numeric('5000.01'))).toBe(60);
    // Decimal, not float: 0.1 + 0.2 arithmetic must not shift a band edge.
    const cents: NumericBand[] = [
      { from: null, to: '0.3', score: 10 },
      { from: '0.3', to: null, score: 90 },
    ];
    expect(bandFor(cents, '0.30')?.score).toBe(90);
    expect(bandFor(cents, '0.29999')?.score).toBe(10);
  });

  it('reaches -∞ and +∞ through the open-ended first and last bands', () => {
    expect(answerScoreFor(SCORING, numeric('-1000000'))).toBe(20);
    expect(answerScoreFor(SCORING, numeric('999999999.99'))).toBe(100);
  });
});

describe('an unscoreable numeric answer earns nothing but still costs its weight', () => {
  it('returns null when the program banded nothing for this question', () => {
    const unbanded: ProgramScoring = { questionWeights: { monthly_income: 100 }, answerScores: {} };
    expect(answerScoreFor(unbanded, numeric('9000'))).toBeNull();
    // Asked and answered, but the program cannot credit it → 0 over a denominator
    // of 100. This is the shape `WEIGHTS_MISSING_RULE` now rejects on save.
    expect(computeProbability(unbanded, [numeric('9000')], ['monthly_income'])).toBe(0);
  });

  it('returns null for a value no band covers, rather than guessing a neighbour', () => {
    const holed: NumericBand[] = [
      { from: null, to: '1000', score: 10 },
      { from: '5000', to: null, score: 90 },
    ];
    expect(bandFor(holed, '3000')).toBeNull();
    expect(
      answerScoreFor({ ...SCORING, numericBands: { monthly_income: holed } }, numeric('3000')),
    ).toBeNull();
  });

  it('never throws on a malformed value or edge', () => {
    expect(answerScoreFor(SCORING, numeric('not-a-number'))).toBeNull();
    expect(bandFor([{ from: 'abc', to: null, score: 50 }], '10')).toBeNull();
    expect(bandFor(BANDS, 'Infinity')).toBeNull();
  });

  it('clamps a stored score that escaped validation', () => {
    const wild: NumericBand[] = [{ from: null, to: null, score: 999 }];
    expect(answerScoreFor({ ...SCORING, numericBands: { monthly_income: wild } }, numeric('1'))).toBe(
      100,
    );
    const negative: NumericBand[] = [{ from: null, to: null, score: -50 }];
    expect(
      answerScoreFor({ ...SCORING, numericBands: { monthly_income: negative } }, numeric('1')),
    ).toBe(0);
  });
});

describe('a banded numeric question scores through the formula like any other', () => {
  it('weights the band score against the asked-weight denominator', () => {
    const mixed: ProgramScoring = {
      questionWeights: { monthly_income: 60, own_property: 40 },
      answerScores: { own_property: { yes: 100, no: 0 } },
      numericBands: { monthly_income: BANDS },
    };
    // 60 × 0.60 + 40 × 1.00 = 76 over 100.
    expect(
      computeProbability(
        mixed,
        [numeric('9000'), { questionCode: 'own_property', kind: 'option', optionCode: 'yes' }],
        ['monthly_income', 'own_property'],
      ),
    ).toBeCloseTo(0.76, 10);
  });
});

// ---------------------------------------------------------------------------
// Save-time band validation.
// ---------------------------------------------------------------------------

function makeService(): ScoringService {
  const questionnaire = {
    questionsWithOptions: async () => [
      {
        code: 'monthly_income',
        type: 'NUMERIC' as const,
        questionAr: 'الدخل الشهري',
        questionEn: 'Monthly income',
        categories: ['personal' as const],
        numericMinValue: '0.00',
        numericMaxValue: '500000.00',
        numericStep: null,
        numericUnitAr: 'جنيه',
        numericUnitEn: 'EGP',
        textMaxLength: null,
        options: [],
      },
    ],
  };
  return new ScoringService(
    { activeSet: async () => null } as never,
    { write: async () => undefined } as never,
    { findById: async () => ({ productCategory: 'personal' }) } as never,
    questionnaire as never,
  );
}

function validate(bands: unknown): Promise<void> {
  const weights = {
    questionWeights: { monthly_income: 100 },
    answerScores: {},
    numericBands: { monthly_income: bands as NumericBand[] },
  } satisfies SaveWeightsPayload;
  return (
    makeService() as unknown as {
      assertKnownStructure(w: SaveWeightsPayload): Promise<void>;
    }
  ).assertKnownStructure(weights);
}

describe('bands must tile the number line before they can be saved', () => {
  it('accepts an ordered, gapless, open-ended set', async () => {
    await expect(validate(BANDS)).resolves.toBeUndefined();
  });

  it('accepts a single band covering everything', async () => {
    await expect(validate([{ from: null, to: null, score: 50 }])).resolves.toBeUndefined();
  });

  const rejected: ReadonlyArray<[string, unknown[], string]> = [
    ['an empty set', [], 'no_bands'],
    [
      'a gap between two bands',
      [
        { from: null, to: '1000', score: 10 },
        { from: '5000', to: null, score: 90 },
      ],
      'gap_before_band',
    ],
    [
      'an overlap between two bands',
      [
        { from: null, to: '6000', score: 10 },
        { from: '5000', to: null, score: 90 },
      ],
      'overlapping_band',
    ],
    [
      'a first band that does not open at -∞',
      [
        { from: '0', to: '5000', score: 10 },
        { from: '5000', to: null, score: 90 },
      ],
      'first_band_must_open_at_minus_infinity',
    ],
    [
      'a last band that does not close at +∞',
      [
        { from: null, to: '5000', score: 10 },
        { from: '5000', to: '15000', score: 90 },
      ],
      'last_band_must_close_at_plus_infinity',
    ],
    [
      'a reversed band',
      [
        { from: null, to: '5000', score: 10 },
        { from: '5000', to: '2000', score: 90 },
      ],
      'empty_or_reversed_band',
    ],
    [
      'an unparseable edge',
      [
        { from: null, to: 'lots', score: 10 },
        { from: 'lots', to: null, score: 90 },
      ],
      'unparseable_to',
    ],
    [
      'a mid-set band left open at +∞',
      [
        { from: null, to: '5000', score: 10 },
        { from: '5000', to: null, score: 50 },
        { from: '15000', to: null, score: 90 },
      ],
      'only_the_last_band_may_close_at_plus_infinity',
    ],
  ];

  for (const [label, bands, reason] of rejected) {
    it(`rejects ${label}`, async () => {
      await expect(validate(bands)).rejects.toMatchObject({
        code: ERROR_CODES.WEIGHTS_NUMERIC_BANDS_INVALID,
        meta: { questionCode: 'monthly_income', reason },
      });
    });
  }

  it('rejects a band score outside 0–100', async () => {
    const weights = {
      questionWeights: { monthly_income: 100 },
      answerScores: {},
      numericBands: {
        monthly_income: [
          { from: null, to: '5000', score: 20 },
          { from: '5000', to: null, score: 140 },
        ],
      },
    } satisfies SaveWeightsPayload;
    expect(() =>
      (
        makeService() as unknown as {
          assertAnswerScoresInRange(w: SaveWeightsPayload): void;
        }
      ).assertAnswerScoresInRange(weights),
    ).toThrowError(
      expect.objectContaining({ code: ERROR_CODES.WEIGHTS_ANSWER_SCORE_OUT_OF_RANGE }),
    );
  });
});
