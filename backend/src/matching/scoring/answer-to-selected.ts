/**
 * Normalised answer → `SelectedAnswer` (Constitution V, v14.0.0).
 *
 * ONE mapping, shared by the live preview (`matching-preview`) and the persisted
 * apply flow (`applications`). Both used to build this inline and both dropped
 * everything except SINGLE_SELECT; since every type now scores, a difference
 * here would move the number between preview and apply — the same class of drift
 * that pushed `isQuestionVisible` into a shared module in v13.0.0 (A25).
 *
 * Pure: no Prisma client, no HTTP.
 */
import type { QuestionType } from '@prisma/client';
import type { SelectedAnswer } from './approval-probability.scorer';

/**
 * The subset of `NormalisedAnswer` the scorer needs. `type` is optional because a
 * pre-feature-010 snapshot froze no type — those rows only ever carried
 * `selectedOptionCode`, so they read as SINGLE_SELECT (FR-045).
 */
export interface ScorableAnswer {
  questionCode: string;
  type?: QuestionType | string | null;
  selectedOptionCode: string | null;
  selectedOptionCodes?: readonly string[] | null;
  textValue?: string | null;
  numericValue?: string | null;
}

/**
 * The one variant this answer scores as, or `null` when it carries no value at
 * all (nothing to score — the question's weight still sits in the denominator
 * via the asked set, so a skip costs its weight and no more).
 */
export function toSelectedAnswer(answer: ScorableAnswer): SelectedAnswer | null {
  switch (resolveType(answer)) {
    case 'SINGLE_SELECT': {
      const optionCode = answer.selectedOptionCode ?? answer.selectedOptionCodes?.[0] ?? null;
      return optionCode ? { questionCode: answer.questionCode, kind: 'option', optionCode } : null;
    }

    case 'MULTI_SELECT': {
      const optionCodes =
        answer.selectedOptionCodes && answer.selectedOptionCodes.length > 0
          ? [...answer.selectedOptionCodes]
          : answer.selectedOptionCode
            ? [answer.selectedOptionCode]
            : [];
      return optionCodes.length > 0
        ? { questionCode: answer.questionCode, kind: 'options', optionCodes }
        : null;
    }

    case 'NUMERIC': {
      return answer.numericValue != null
        ? { questionCode: answer.questionCode, kind: 'numeric', value: answer.numericValue }
        : null;
    }

    case 'TEXT': {
      // `validateAnswer` already rejects a blank string, so anything stored is a
      // real answer; the trim guard covers legacy rows written before that check.
      const hasValue = (answer.textValue ?? '').trim().length > 0;
      return hasValue ? { questionCode: answer.questionCode, kind: 'text', hasValue } : null;
    }
  }
}

/** Map a batch, dropping the answers that carry no value. */
export function toSelectedAnswers(answers: readonly ScorableAnswer[]): SelectedAnswer[] {
  const out: SelectedAnswer[] = [];
  for (const a of answers) {
    const mapped = toSelectedAnswer(a);
    if (mapped) out.push(mapped);
  }
  return out;
}

/**
 * Trust the stored/frozen type when there is one; otherwise infer from whichever
 * value the row carries (pre-010 rows, and the admin simulator's hand-built
 * answers, only ever set one).
 */
function resolveType(answer: ScorableAnswer): QuestionType {
  const raw = answer.type;
  if (raw === 'SINGLE_SELECT' || raw === 'MULTI_SELECT' || raw === 'TEXT' || raw === 'NUMERIC') {
    return raw;
  }
  if (answer.numericValue != null) return 'NUMERIC';
  if (answer.textValue != null) return 'TEXT';
  if (answer.selectedOptionCode == null && (answer.selectedOptionCodes?.length ?? 0) > 1) {
    return 'MULTI_SELECT';
  }
  return 'SINGLE_SELECT';
}
