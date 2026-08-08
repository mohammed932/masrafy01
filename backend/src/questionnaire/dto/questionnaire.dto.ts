import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
  ValidationArguments,
  ValidationOptions,
  registerDecorator,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LoanCategory, QuestionType } from '@prisma/client';
import { IsDecimalString } from '@/common/validators/is-decimal-string.validator';

export class EnabledWhenDto {
  @ApiProperty() @IsString() @Length(1, 64) questionCode!: string;
  @ApiProperty({ enum: ['equals', 'not_equals'] })
  @IsIn(['equals', 'not_equals'])
  operator!: 'equals' | 'not_equals';
  @ApiProperty() @IsString() @Length(1, 64) optionCode!: string;
}

export class CreateGroupDto {
  @ApiProperty() @IsString() @Length(1, 160) titleAr!: string;
  @ApiProperty() @IsString() @Length(1, 160) titleEn!: string;
  @ApiProperty() @IsInt() @Min(0) displayOrder!: number;
}

export class UpdateGroupDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 160) titleAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 160) titleEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) displayOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

/**
 * Feature 010 — NUMERIC question rules. Pure CONTENT (bounds, unit): no scoring
 * and no eligibility, so A33 stays satisfied. Bounds are decimal strings because
 * a number question can carry money (Principle I).
 */
export class NumericRulesDto {
  @ApiPropertyOptional({ description: 'Inclusive minimum, decimal string' })
  @IsOptional()
  @IsDecimalString({ scale: 2, min: 0 })
  minValue?: string;

  @ApiPropertyOptional({ description: 'Inclusive maximum, decimal string; MUST be >= minValue' })
  @IsOptional()
  @IsDecimalString({ scale: 2, min: 0 })
  maxValue?: string;

  @ApiPropertyOptional({ description: 'Increment from minValue; MUST be > 0' })
  @IsOptional()
  @IsDecimalString({ scale: 2, min: 0, allowZero: false })
  step?: string;

  @ApiPropertyOptional({ description: 'Display unit, Arabic (e.g. "جنيه")' })
  @IsOptional()
  @IsString()
  @Length(1, 24)
  unitAr?: string;

  @ApiPropertyOptional({ description: 'Display unit, English (e.g. "EGP")' })
  @IsOptional()
  @IsString()
  @Length(1, 24)
  unitEn?: string;
}

/** Feature 010 — TEXT question rules. Free text may carry PII (Principle VI). */
export class TextRulesDto {
  @ApiPropertyOptional({ default: 500, minimum: 1, maximum: 2000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2000)
  maxLength?: number;
}

export const TEXT_MAX_LENGTH_DEFAULT = 500;

export class CreateQuestionDto {
  /**
   * Optional: the pool is authored FLAT, so the admin editor never names a group.
   * Omitted → the service resolves one (first active group, else a default), which
   * is why a flat client can create a question with no notion of grouping at all.
   */
  @ApiPropertyOptional({ description: 'Omit to let the server place the question' })
  @IsOptional()
  @IsString()
  @Length(1, 30)
  groupId?: string;
  @ApiPropertyOptional({ enum: QuestionType, default: 'SINGLE_SELECT' })
  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;
  @ApiProperty() @IsString() @Length(1, 500) questionAr!: string;
  @ApiProperty() @IsString() @Length(1, 500) questionEn!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 500) helperTextAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 500) helperTextEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isRequired?: boolean;
  /** Omitted → appended to the end of the pool. Order is set by drag, not typed. */
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) displayOrder?: number;
  @ApiPropertyOptional({ type: EnabledWhenDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EnabledWhenDto)
  enabledWhen?: EnabledWhenDto;

  // Per-type rules. Cross-checked against `type` in the service, which throws
  // QUESTION_TYPE_RULES_INVALID with meta.field. No binding field is accepted —
  // the money bindings are code constants (A33).
  @ApiPropertyOptional({ type: NumericRulesDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => NumericRulesDto)
  numeric?: NumericRulesDto | null;

  @ApiPropertyOptional({ type: TextRulesDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => TextRulesDto)
  text?: TextRulesDto | null;

  /**
   * Which loan categories this question is asked for. Omitted → all four, so a
   * newly added question is never invisible; narrow it on the assignment tab.
   */
  @ApiPropertyOptional({ enum: LoanCategory, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsEnum(LoanCategory, { each: true })
  categories?: LoanCategory[];
}

/**
 * Replace one question's loan-category assignment. The submitted array IS the new
 * set (not a delta), and MAY be empty — an empty set parks the question: kept and
 * editable, asked for nothing.
 */
export class SetQuestionCategoriesDto {
  @ApiProperty({ enum: LoanCategory, isArray: true })
  @IsArray()
  @ArrayMaxSize(4)
  @IsEnum(LoanCategory, { each: true })
  categories!: LoanCategory[];
}

export class QuestionCategoryAssignmentDto {
  @ApiProperty() @IsString() @Length(1, 30) questionId!: string;
  @ApiProperty({ enum: LoanCategory, isArray: true })
  @IsArray()
  @ArrayMaxSize(4)
  @IsEnum(LoanCategory, { each: true })
  categories!: LoanCategory[];
}

/** Reassign many questions in ONE transaction + ONE publish (column actions). */
export class SetQuestionCategoriesBulkDto {
  @ApiProperty({ type: [QuestionCategoryAssignmentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => QuestionCategoryAssignmentDto)
  assignments!: QuestionCategoryAssignmentDto[];
}

export class UpdateQuestionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 500) questionAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 500) questionEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 500) helperTextAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 500) helperTextEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isRequired?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) displayOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional({ type: EnabledWhenDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => EnabledWhenDto)
  enabledWhen?: EnabledWhenDto | null;

  /** `type` is mutable only while the question carries no answers (checked in the service). */
  @ApiPropertyOptional({ enum: QuestionType })
  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @ApiPropertyOptional({ type: NumericRulesDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => NumericRulesDto)
  numeric?: NumericRulesDto | null;

  @ApiPropertyOptional({ type: TextRulesDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => TextRulesDto)
  text?: TextRulesDto | null;
}

export class CreateOptionDto {
  @ApiProperty() @IsString() @Length(1, 200) labelAr!: string;
  @ApiProperty() @IsString() @Length(1, 200) labelEn!: string;
  /** Omitted → appended after the question's existing options. */
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) displayOrder?: number;
}

/**
 * Reorder the whole flat pool in one call: `ids` is the new order, front to back,
 * and `displayOrder` becomes each id's index. Sent as a full sequence rather than
 * a single moved id so a drag can never leave two questions sharing an order.
 */
export class ReorderQuestionsDto {
  @ApiProperty({ type: [String], description: 'Question ids in their new order' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @Length(1, 30, { each: true })
  ids!: string[];
}

export class UpdateOptionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 200) labelAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 200) labelEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) displayOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

/** The four exclusive value keys an answer may carry (R8 / contracts/questionnaire.md). */
export const ANSWER_VALUE_KEYS = [
  'optionCode',
  'optionCodes',
  'textValue',
  'numericValue',
] as const;

export type AnswerValueKey = (typeof ANSWER_VALUE_KEYS)[number];

/**
 * Exactly one of `optionCode` | `optionCodes` | `textValue` | `numericValue` must
 * be present. Zero or more than one is a shape failure (VALIDATION_FAILED); the
 * WRONG key for the question's type is a separate, service-level
 * `ANSWER_TYPE_MISMATCH` — this decorator cannot know the question's type.
 */
function HasExactlyOneAnswerValue(validation?: ValidationOptions): PropertyDecorator {
  return function (object, propertyName) {
    registerDecorator({
      name: 'hasExactlyOneAnswerValue',
      target: object.constructor,
      propertyName: propertyName as string,
      options: validation,
      validator: {
        validate(_value: unknown, args: ValidationArguments): boolean {
          const dto = args.object as Record<string, unknown>;
          return (
            ANSWER_VALUE_KEYS.filter(
              (key) => dto[key] !== undefined && dto[key] !== null,
            ).length === 1
          );
        },
        defaultMessage(): string {
          return `exactly one of ${ANSWER_VALUE_KEYS.join(' | ')} must be provided`;
        },
      },
    });
  };
}

export class SubmittedAnswerDto {
  @ApiProperty() @IsString() @Length(1, 64) questionCode!: string;

  /** SINGLE_SELECT. Carries the exactly-one-value-key guard for the whole DTO. */
  @ApiPropertyOptional({ description: 'SINGLE_SELECT answer' })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  @HasExactlyOneAnswerValue()
  optionCode?: string;

  /** MULTI_SELECT — every code must belong to the question. */
  @ApiPropertyOptional({ type: [String], description: 'MULTI_SELECT answer' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Length(1, 64, { each: true })
  optionCodes?: string[];

  /** TEXT — length checked against the question's `textMaxLength` in the service. */
  @ApiPropertyOptional({ description: 'TEXT answer' })
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  textValue?: string;

  /** NUMERIC — a decimal STRING, never a JS number (Principle I). */
  @ApiPropertyOptional({ description: 'NUMERIC answer as a decimal string' })
  @IsOptional()
  @IsDecimalString({ scale: 2 })
  numericValue?: string;
}

export class PreviewMatchesDto {
  @ApiProperty({ enum: LoanCategory }) @IsEnum(LoanCategory) category!: LoanCategory;

  /**
   * Catalog program-name archetype to narrow to, on top of `category` (see
   * `ApplyRequestDto.programNameKey`). Same field, same validation, same
   * meaning-of-null on both endpoints — preview exists to show what apply would
   * return, so a shortlist it produces has to survive the apply that follows.
   */
  @ApiPropertyOptional({ description: 'Catalog `program_name` key to narrow the matched set to' })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  programNameKey?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() questionnaireVersionId?: string;
  @ApiProperty({ type: [SubmittedAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmittedAnswerDto)
  answers!: SubmittedAnswerDto[];
}
