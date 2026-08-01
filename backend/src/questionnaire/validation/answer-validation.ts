/**
 * Feature 010 — typed answer validation (contracts/questionnaire.md, R8).
 *
 * Pure: given the published question definition and a submitted answer, either
 * return the normalised typed value or throw a typed error. No Prisma, no HTTP,
 * so the 4-types × right/wrong matrix is unit-testable.
 *
 * Errors: ANSWER_TYPE_MISMATCH (wrong value key for the type),
 * ANSWER_OUT_OF_RANGE (number outside [min,max] or off step),
 * ANSWER_TOO_LONG (text over maxLength), ANSWER_REQUIRED (missing answer),
 * UNKNOWN_OPTION_CODE (a code that is not an option of this question).
 */
import { QuestionType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { DomainException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { TEXT_MAX_LENGTH_DEFAULT } from '../dto/questionnaire.dto';
import { isChoiceType } from './question-type-rules';

/** The question as it appears in the published snapshot (or the live row). */
export interface AnswerableQuestion {
  code: string;
  /** A snapshot written before feature 010 has no `type` — read it as SINGLE_SELECT (FR-045). */
  type?: QuestionType | string | null;
  isRequired?: boolean;
  optionCodes: readonly string[];
  numeric?: {
    minValue?: string | null;
    maxValue?: string | null;
    step?: string | null;
  } | null;
  text?: { maxLength?: number | null } | null;
}

export interface SubmittedAnswerValue {
  questionCode: string;
  optionCode?: string | null;
  optionCodes?: readonly string[] | null;
  textValue?: string | null;
  numericValue?: string | null;
}

/** Normalised answer, ready for `application_answer`. */
export interface NormalisedAnswer {
  questionCode: string;
  type: QuestionType;
  /** Canonical for both choice types; single choice yields one element. */
  selectedOptionCodes: string[];
  /** Populated for SINGLE_SELECT only, so the scorer and admin views are untouched. */
  selectedOptionCode: string | null;
  textValue: string | null;
  /** Decimal string, 2 dp. */
  numericValue: string | null;
}

/** A missing `type` key means the snapshot predates feature 010 (FR-045). */
export function resolveQuestionType(raw: AnswerableQuestion['type']): QuestionType {
  if (raw === 'MULTI_SELECT' || raw === 'TEXT' || raw === 'NUMERIC' || raw === 'SINGLE_SELECT') {
    return raw;
  }
  return 'SINGLE_SELECT';
}

function mismatch(question: AnswerableQuestion, expectedType: QuestionType): never {
  throw new DomainException(ERROR_CODES.ANSWER_TYPE_MISMATCH, {
    questionCode: question.code,
    expectedType,
  });
}

/**
 * Validate one answer against one question. `answer` may be undefined, which is
 * only legal when the question is not required (visibility is decided by the
 * caller — a question hidden by `enabledWhen` is never required).
 */
export function validateAnswer(
  question: AnswerableQuestion,
  answer: SubmittedAnswerValue | undefined,
): NormalisedAnswer | null {
  const type = resolveQuestionType(question.type);

  const present =
    answer !== undefined &&
    (answer.optionCode != null ||
      (answer.optionCodes != null && answer.optionCodes.length > 0) ||
      answer.textValue != null ||
      answer.numericValue != null);

  if (!present) {
    if (question.isRequired) {
      throw new DomainException(ERROR_CODES.ANSWER_REQUIRED, { questionCode: question.code });
    }
    return null;
  }
  // `present` guarantees answer is defined.
  const a = answer as SubmittedAnswerValue;

  switch (type) {
    case 'SINGLE_SELECT': {
      if (a.optionCode == null) mismatch(question, type);
      assertKnownOption(question, a.optionCode);
      return {
        questionCode: question.code,
        type,
        selectedOptionCodes: [a.optionCode],
        selectedOptionCode: a.optionCode,
        textValue: null,
        numericValue: null,
      };
    }

    case 'MULTI_SELECT': {
      if (a.optionCodes == null || a.optionCodes.length === 0) mismatch(question, type);
      // De-duplicate but keep the submitted order, so the stored list reads the
      // way the customer picked it.
      const picked = [...new Set(a.optionCodes)];
      for (const code of picked) assertKnownOption(question, code);
      return {
        questionCode: question.code,
        type,
        selectedOptionCodes: picked,
        selectedOptionCode: null,
        textValue: null,
        numericValue: null,
      };
    }

    case 'TEXT': {
      if (a.textValue == null) mismatch(question, type);
      const trimmed = a.textValue.trim();
      if (trimmed.length === 0) {
        throw new DomainException(ERROR_CODES.ANSWER_REQUIRED, { questionCode: question.code });
      }
      const maxLength = question.text?.maxLength ?? TEXT_MAX_LENGTH_DEFAULT;
      if (trimmed.length > maxLength) {
        throw new DomainException(ERROR_CODES.ANSWER_TOO_LONG, {
          questionCode: question.code,
          maxLength,
        });
      }
      return {
        questionCode: question.code,
        type,
        selectedOptionCodes: [],
        selectedOptionCode: null,
        textValue: trimmed,
        numericValue: null,
      };
    }

    case 'NUMERIC': {
      if (a.numericValue == null) mismatch(question, type);
      return {
        questionCode: question.code,
        type,
        selectedOptionCodes: [],
        selectedOptionCode: null,
        textValue: null,
        numericValue: validateNumeric(question, a.numericValue),
      };
    }

    default:
      return mismatch(question, type);
  }
}

function assertKnownOption(question: AnswerableQuestion, code: string): void {
  if (!question.optionCodes.includes(code)) {
    throw new DomainException(ERROR_CODES.UNKNOWN_OPTION_CODE, {
      questionCode: question.code,
      code,
    });
  }
}

/**
 * Bounds are INCLUSIVE. `step` is measured from `minValue` (or from zero when no
 * minimum is set), matching the number field the app renders.
 */
function validateNumeric(question: AnswerableQuestion, raw: string): string {
  let value: Prisma.Decimal;
  try {
    value = new Prisma.Decimal(raw);
  } catch {
    throw new DomainException(ERROR_CODES.ANSWER_TYPE_MISMATCH, {
      questionCode: question.code,
      expectedType: 'NUMERIC',
    });
  }
  if (!value.isFinite()) {
    throw new DomainException(ERROR_CODES.ANSWER_TYPE_MISMATCH, {
      questionCode: question.code,
      expectedType: 'NUMERIC',
    });
  }

  const rules = question.numeric ?? {};
  const min = rules.minValue != null ? new Prisma.Decimal(rules.minValue) : null;
  const max = rules.maxValue != null ? new Prisma.Decimal(rules.maxValue) : null;
  const step = rules.step != null ? new Prisma.Decimal(rules.step) : null;

  const outOfRange = (): never => {
    throw new DomainException(ERROR_CODES.ANSWER_OUT_OF_RANGE, {
      questionCode: question.code,
      min: min ? min.toFixed(2) : null,
      max: max ? max.toFixed(2) : null,
      step: step ? step.toFixed(2) : null,
    });
  };

  if (min && value.lessThan(min)) outOfRange();
  if (max && value.greaterThan(max)) outOfRange();
  if (step && step.greaterThan(0)) {
    const offset = value.minus(min ?? new Prisma.Decimal(0));
    if (!offset.modulo(step).isZero()) outOfRange();
  }

  return value.toFixed(2);
}
