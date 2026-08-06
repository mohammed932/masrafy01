/**
 * TEXT scoring — presence only (Constitution V, v14.0.0).
 *
 * A free-text answer is scored on whether it was given, not on what it says.
 * Pattern/keyword matching was considered and deliberately rejected: it is
 * defeated by spelling, diacritics and typos in Arabic, it is gameable by the
 * applicant once the rule is guessed, and it hides a bank's judgement inside a
 * regex nobody backtests. Presence is the only signal free text carries that the
 * admin screen can honestly show.
 *
 * A blank answer never reaches here — `validateAnswer` rejects an empty string
 * and an omitted optional answer produces no row at all — so a skipped text
 * question costs its weight through the asked-set denominator, like any skip.
 */
import { describe, expect, it } from 'vitest';
import { toSelectedAnswer } from '@/matching/scoring/answer-to-selected';
import {
  answerScoreFor,
  computeProbability,
  type ProgramScoring,
} from '@/matching/scoring/approval-probability.scorer';

const SCORING: ProgramScoring = {
  questionWeights: { employer_name: 100 },
  answerScores: {},
  textRules: { employer_name: { answeredScore: 80 } },
};

const text = (hasValue: boolean) =>
  ({ questionCode: 'employer_name', kind: 'text', hasValue }) as const;

describe('a text answer earns its presence score', () => {
  it('scores the configured value when the answer is there', () => {
    expect(answerScoreFor(SCORING, text(true))).toBe(80);
  });

  it('earns nothing when the value is absent', () => {
    expect(answerScoreFor(SCORING, text(false))).toBeNull();
  });

  it('scores 0 when the program set the presence score to 0', () => {
    // Legal and meaningful: "we collect it, it earns nothing".
    const zero: ProgramScoring = { ...SCORING, textRules: { employer_name: { answeredScore: 0 } } };
    expect(answerScoreFor(zero, text(true))).toBe(0);
  });

  it('returns null when the program configured no text rule', () => {
    const unruled: ProgramScoring = { questionWeights: { employer_name: 100 }, answerScores: {} };
    expect(answerScoreFor(unruled, text(true))).toBeNull();
    expect(computeProbability(unruled, [text(true)], ['employer_name'])).toBe(0);
  });

  it('clamps a stored presence score that escaped validation', () => {
    const wild: ProgramScoring = {
      ...SCORING,
      textRules: { employer_name: { answeredScore: 250 } },
    };
    expect(answerScoreFor(wild, text(true))).toBe(100);
  });
});

describe('blank text is not an answer', () => {
  it('maps a whitespace-only stored value to no answer at all', () => {
    // Defensive: current validation trims and rejects blanks, but a row written
    // before that check must not earn the presence score for an empty string.
    for (const textValue of ['', '   ', '\n\t']) {
      expect(
        toSelectedAnswer({
          questionCode: 'employer_name',
          type: 'TEXT',
          selectedOptionCode: null,
          textValue,
        }),
      ).toBeNull();
    }
  });

  it('maps a real value to a present text answer', () => {
    expect(
      toSelectedAnswer({
        questionCode: 'employer_name',
        type: 'TEXT',
        selectedOptionCode: null,
        textValue: 'شركة النيل',
      }),
    ).toEqual({ questionCode: 'employer_name', kind: 'text', hasValue: true });
  });

  it('charges an asked-but-skipped text question its full weight', () => {
    const mixed: ProgramScoring = {
      questionWeights: { employer_name: 30, own_property: 70 },
      answerScores: { own_property: { yes: 100 } },
      textRules: { employer_name: { answeredScore: 100 } },
    };
    const asked = ['employer_name', 'own_property'];
    const property = { questionCode: 'own_property', kind: 'option', optionCode: 'yes' } as const;
    expect(computeProbability(mixed, [property, text(true)], asked)).toBe(1);
    expect(computeProbability(mixed, [property], asked)).toBeCloseTo(0.7, 10);
  });
});
