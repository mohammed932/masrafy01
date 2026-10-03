/**
 * Feature 013 — the Loan Engine admin API (`/api/admin/loan-engine`).
 *
 * Shallow at the wire, deep in the service: the folder's convention (`fact-grid.dto.ts`). A
 * criterion is a small discriminated union whose legality depends on the QUESTION's type and
 * options, which only the service can see — so the DTO checks it is an object and the
 * service parses it (`parseCriterion`), refusing with `LOAN_ENGINE_RULE_INVALID` and the row.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { Criterion } from '../../../matching/pipeline/criterion';
import { GATE_REASON_CODES, type GateReasonCode } from '../../../matching/pipeline/product-rule';

/** The effects the Loan Engine can write — research R5, data-model §3. */
export const LOAN_ENGINE_EFFECTS = [
  'rate',
  'cap',
  'financed_share',
  'min_amount',
  'min_term',
  'max_term',
  'extra_income',
] as const;
export type LoanEngineEffect = (typeof LOAN_ENGINE_EFFECTS)[number];

const DECIMAL = /^\d+(\.\d+)?$/;
const CODE = /^[a-z0-9][a-z0-9_]{0,63}$/;
const PROGRAM_CODE = /^[A-Za-z0-9_-]{1,64}$/;

export class LoanEngineQuestionsQueryDto {
  @ApiPropertyOptional({ example: 'personal' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;
}

export class LoanEngineQuestionParamDto {
  @IsString()
  @Matches(CODE)
  questionCode!: string;
}

export class LoanEngineEffectParamsDto extends LoanEngineQuestionParamDto {
  @IsString()
  @Matches(PROGRAM_CODE)
  programCode!: string;

  @IsIn(LOAN_ENGINE_EFFECTS)
  effect!: LoanEngineEffect;
}

export class EffectRowDto {
  @ApiPropertyOptional({
    description:
      '`{op, a, b?}` (lt/lte/gte/gt/eq/between/range/custom), `{option}` or `{answered: true}`. ' +
      'Absent only for `extra_income`, whose one row is the percent the bank counts.',
    example: { op: 'between', a: '1', b: '100' },
  })
  @IsOptional()
  @IsObject()
  criterion?: Record<string, unknown>;

  /** The bank's figure: %, EGP or months depending on the effect (contract). */
  @ApiProperty({ example: '22' })
  @IsString()
  @Matches(DECIMAL)
  value!: string;
}

export class PutEffectRowsDto {
  /** The program's `version`, as read — a stale one is 409 `CONFLICT_STALE_DATA`. */
  @ApiProperty({ example: 7 })
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiProperty({ type: [EffectRowDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => EffectRowDto)
  rows!: EffectRowDto[];

  @ApiPropertyOptional({ enum: ['useFallback', 'reject', 'useProgramMax'] })
  @IsOptional()
  @IsIn(['useFallback', 'reject', 'useProgramMax'])
  onNoMatch?: 'useFallback' | 'reject' | 'useProgramMax';
}

export class ConditionCriterionDto {
  @ApiProperty({ example: 'business_months' })
  @IsString()
  @Matches(CODE)
  questionCode!: string;

  @ApiProperty({ example: { option: '24m_or_more' } })
  @IsObject()
  criterion!: Record<string, unknown>;
}

export class ProgramConditionDto {
  /** A stable slug, unique within the program; reported as `gateId: condition:<id>`. */
  @ApiProperty({ example: 'min_business_age' })
  @IsString()
  @Matches(CODE)
  id!: string;

  @ApiProperty({ enum: GATE_REASON_CODES })
  @IsIn(GATE_REASON_CODES)
  reasonCode!: GateReasonCode;

  /** Passes when ANY matches. */
  @ApiProperty({ type: [ConditionCriterionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ConditionCriterionDto)
  anyOf!: ConditionCriterionDto[];
}

export class PutProgramConditionsDto {
  @ApiProperty({ example: 7 })
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  /** The program's WHOLE list; every one must pass. `[]` removes them all. */
  @ApiProperty({ type: [ProgramConditionDto] })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ProgramConditionDto)
  conditions!: ProgramConditionDto[];
}

/**
 * One UNSAVED draft for the admin simulator (`POST admin/matching/simulate`, US3): the body
 * its write would take, plus which program and which effect. Checked exactly as that write.
 */
export class LoanEngineOverrideDto {
  @ApiProperty({ example: 'ABK-PER-BANKERS' })
  @IsString()
  @Matches(PROGRAM_CODE)
  programCode!: string;

  @ApiProperty({ enum: [...LOAN_ENGINE_EFFECTS, 'conditions'] })
  @IsIn([...LOAN_ENGINE_EFFECTS, 'conditions'])
  target!: LoanEngineEffect | 'conditions';

  /** Required for an effect; ignored for `conditions`. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(CODE)
  questionCode?: string;

  @ApiPropertyOptional({ type: [EffectRowDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => EffectRowDto)
  rows?: EffectRowDto[];

  @ApiPropertyOptional({ enum: ['useFallback', 'reject', 'useProgramMax'] })
  @IsOptional()
  @IsIn(['useFallback', 'reject', 'useProgramMax'])
  onNoMatch?: 'useFallback' | 'reject' | 'useProgramMax';

  @ApiPropertyOptional({ type: [ProgramConditionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ProgramConditionDto)
  conditions?: ProgramConditionDto[];
}

export class LoanEngineProgramParamDto {
  @IsString()
  @Matches(PROGRAM_CODE)
  programCode!: string;
}

// ---- Responses (data-model §4) -------------------------------------------------------------

export type EffectReadOnlyReason =
  | 'inherited_plan'
  | 'multi_axis'
  | 'class_axis'
  | 'other_fact'
  | 'two_axis_cap'
  | 'not_numeric';

export interface EffectRow {
  /** `null` only for `extra_income`'s single row. */
  criterion: Criterion | null;
  value: string;
}

export interface EffectState {
  editable: boolean;
  readOnlyReason?: EffectReadOnlyReason;
  /** Which fact the table reads when it is keyed on another one. */
  otherFactKey?: string;
  rows: EffectRow[];
  onNoMatch: 'useFallback' | 'reject' | 'useProgramMax' | null;
}

export interface LoanEngineQuestionSummary {
  questionCode: string;
  type: string;
  labelAr: string;
  labelEn: string;
  categories: string[];
  factKey: string | null;
  /** Active programs in the question's loan types that read its figure today. */
  readingProgramCount: number;
}

export interface ProgramConditionView {
  id: string;
  reasonCode: GateReasonCode;
  anyOf: { questionCode: string | null; factKey: string; criterion: Criterion | null }[];
}

export interface LoanEngineProgramSlice {
  programCode: string;
  bankName: string;
  friendlyName: string;
  category: string;
  version: number;
  programNameKey: string | null;
  effects: Record<LoanEngineEffect, EffectState>;
  /** The program's WHOLE list — the conditions sheet replaces it whole. */
  conditions: ProgramConditionView[];
}

export interface LoanEngineQuestionDetail {
  questionCode: string;
  type: string;
  labelAr: string;
  labelEn: string;
  categories: string[];
  factKey: string | null;
  options: { code: string; labelAr: string; labelEn: string }[];
  programs: LoanEngineProgramSlice[];
}

export interface LoanEngineWriteResult {
  changed: boolean;
  program: LoanEngineProgramSlice;
}

export interface LoanEngineConditionsResult extends LoanEngineWriteResult {
  /**
   * The questions the conditions read, now REQUIRED wherever this program is quoted — under
   * its program name (FR-008). Said back so the operator sees what applicants now face.
   */
  requiredQuestionCodes: string[];
  requiredUnderProgramName: string | null;
}
