/**
 * Feature 010 — per-type question rules (contracts/questionnaire.md).
 *
 * Pure: no Prisma, no HTTP. The service calls `assertQuestionTypeRules` before
 * every create/update so the rules are enforced in one place and unit-testable.
 *
 * These are CONTENT rules (option count, bounds, unit, length). There is no
 * scoring and no eligibility here, and no money-field binding — A33 forbids all
 * three on `Question` / `QuestionOption`.
 */
import { QuestionType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { DomainException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';

export const CHOICE_TYPES: readonly QuestionType[] = ['SINGLE_SELECT', 'MULTI_SELECT'];
export const VALUE_TYPES: readonly QuestionType[] = ['TEXT', 'NUMERIC'];

/**
 * EVERY type is scoreable (Constitution V, v14.0.0). Each one resolves to a
 * single 0..100 answer score by its own admin-configured rule — option scores,
 * multi-select aggregation, numeric bands, text presence — so the formula itself
 * is unchanged. Before v14.0.0 this was `['SINGLE_SELECT']`, which silently
 * excluded income, existing debts, requested amount and term from every match.
 */
export const SCOREABLE_TYPES: readonly QuestionType[] = [
  'SINGLE_SELECT',
  'MULTI_SELECT',
  'NUMERIC',
  'TEXT',
];

/**
 * A choice question needs two answers. There is deliberately NO maximum.
 *
 * The asymmetry is intentional and is worth stating, because it looks like an oversight.
 * `CreateQuestionWithOptionsDto.options` carries `@ArrayMaxSize(50)` — a bound on what a
 * person types into a form. A MIRRORED list (`optionsFromEnumerationType`) bypasses it, and
 * must: the options are the registry, an operator legitimately fills a registry with every
 * residential compound in the country, and a cap here would be the questionnaire refusing a
 * list the platform asked them to build, with "delete some values" as the only remedy.
 *
 * The real consequence of a very long option list is a very long picker on a phone. That is a
 * mobile rendering decision, and it belongs there, not in a server-side refusal.
 */
export const MIN_CHOICE_OPTIONS = 2;
export const TEXT_MAX_LENGTH_CEILING = 2000;

export function isChoiceType(type: QuestionType): boolean {
  return CHOICE_TYPES.includes(type);
}

export function isScoreableType(type: QuestionType): boolean {
  return SCOREABLE_TYPES.includes(type);
}

export interface NumericRulesInput {
  minValue?: string | null;
  maxValue?: string | null;
  step?: string | null;
  unitAr?: string | null;
  unitEn?: string | null;
}

export interface TextRulesInput {
  maxLength?: number | null;
}

export interface QuestionTypeRulesInput {
  type: QuestionType;
  numeric?: NumericRulesInput | null;
  text?: TextRulesInput | null;
  /** Count of ACTIVE options the question will have after this write. */
  activeOptionCount: number;
}

/**
 * Throws `QUESTION_TYPE_RULES_INVALID` with `meta.field` naming the offending
 * setting. Ordered so the most specific complaint wins.
 */
export function assertQuestionTypeRules(input: QuestionTypeRulesInput): void {
  const { type, numeric, text, activeOptionCount } = input;

  const fail = (field: string, reason: string): never => {
    throw new DomainException(ERROR_CODES.QUESTION_TYPE_RULES_INVALID, { field, reason, type });
  };

  // 1. Options belong to choice types only.
  if (isChoiceType(type)) {
    if (activeOptionCount < MIN_CHOICE_OPTIONS) {
      fail('options', 'choice_types_need_at_least_two_active_options');
    }
  } else if (activeOptionCount > 0) {
    fail('options', 'value_types_must_have_no_options');
  }

  // 2. Numeric bounds belong to NUMERIC only.
  const hasNumeric =
    numeric != null &&
    (numeric.minValue != null ||
      numeric.maxValue != null ||
      numeric.step != null ||
      numeric.unitAr != null ||
      numeric.unitEn != null);
  if (hasNumeric && type !== 'NUMERIC') {
    fail('numeric', 'numeric_rules_only_on_numeric_questions');
  }
  if (type === 'NUMERIC' && numeric) {
    const min = numeric.minValue != null ? new Prisma.Decimal(numeric.minValue) : null;
    const max = numeric.maxValue != null ? new Prisma.Decimal(numeric.maxValue) : null;
    if (min && max && max.lessThan(min)) {
      fail('numeric.maxValue', 'max_below_min');
    }
    if (numeric.step != null) {
      const step = new Prisma.Decimal(numeric.step);
      if (step.lessThanOrEqualTo(0)) {
        fail('numeric.step', 'step_must_be_positive');
      }
      // A step wider than the whole range leaves exactly one legal value at the
      // minimum, which is a configuration mistake rather than a bound.
      if (min && max && step.greaterThan(max.minus(min)) && !max.equals(min)) {
        fail('numeric.step', 'step_wider_than_range');
      }
    }
  }

  // 3. Text length belongs to TEXT only.
  const hasText = text != null && text.maxLength != null;
  if (hasText && type !== 'TEXT') {
    fail('text', 'text_rules_only_on_text_questions');
  }
  if (type === 'TEXT' && text?.maxLength != null) {
    if (text.maxLength < 1 || text.maxLength > TEXT_MAX_LENGTH_CEILING) {
      fail('text.maxLength', 'max_length_out_of_range');
    }
  }
}

/**
 * `enabledWhen` compares an option code, so a branch may only depend on a choice
 * question. Depending on TEXT or NUMERIC is `QUESTION_TYPE_RULES_INVALID`.
 */
export function assertBranchSourceIsChoice(refType: QuestionType, refCode: string): void {
  if (!isChoiceType(refType)) {
    throw new DomainException(ERROR_CODES.QUESTION_TYPE_RULES_INVALID, {
      field: 'enabledWhen.questionCode',
      reason: 'branch_source_must_be_a_choice_question',
      questionCode: refCode,
      type: refType,
    });
  }
}
