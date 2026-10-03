/**
 * Feature 012 — "Use in calculation" on a question, and the "Used by" readout.
 *
 * Response shapes are plain interfaces (the convention `product-asks.dto.ts` follows); the one
 * request body is a validated class.
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import type { LoanCategory } from '@prisma/client';
import type { FactSurface } from '@/matching/pipeline/fact-readers';

export class LinkQuestionFactDto {
  @ApiPropertyOptional({
    description:
      'An EXISTING calculation figure (unbound `surrogate_fact` key) this question answers. ' +
      'Omit to create the figure from the question itself — its key is the question code.',
    example: 'employer_coding',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z0-9_]+$/)
  factKey?: string;
}

/**
 * How a question's answer reaches the money, one word per question.
 *
 *   engine         — the engine reads it by a code constant (amount, debts, employment …)
 *   calculation    — it answers a figure a live programme or product rule reads
 *   linked_unread  — it answers a figure nothing reads (yet)
 *   gate_only      — it only shows or hides other questions
 *   none           — its answer changes no figure and gates nothing
 */
export type QuestionUsageClass = 'engine' | 'calculation' | 'linked_unread' | 'gate_only' | 'none';

export interface QuestionUsageReaderDto {
  kind: 'program' | 'product_rule' | 'program_name_rule' | 'platform_iscore';
  /** Programme code, product key or name key; `i_score` for the shared bureau table. */
  ref: string;
  bankName?: string;
  programName?: string;
  category?: string;
  /** The product a programme sells, when it has one — where its plan tables live. */
  productKey?: string | null;
  /** The grids are the product's plan tables, inherited, not the programme's own. */
  inherited?: boolean;
  surfaces: FactSurface[];
  /** A blank answer refuses this programme's quote (a refuse-on-no-match table). */
  refusesWhenUnanswered: boolean;
}

export interface QuestionUsageDto {
  questionCode: string;
  labelAr: string;
  labelEn: string;
  type: string;
  isRequired: boolean;
  categories: LoanCategory[];
  class: QuestionUsageClass;
  /** Read by the engine through a code constant, whatever else reads it. */
  engineInput: boolean;
  /** The figure this question answers, if any. */
  factKey: string | null;
  /** Owned by the platform (`i_score`, the car figures …) — never unlinked from here. */
  factLocked: boolean;
  readers: QuestionUsageReaderDto[];
  /** Products that ASK the figure on their step ① even where no table reads it yet. */
  askedByProducts: string[];
  /** Questions whose visibility depends on this one. */
  gates: string[];
  /** Programmes a BLANK answer refuses, while the question is optional for the loan type. */
  blankRefuses: string[];
}

export interface QuestionFactCandidateDto {
  factKey: string;
  labelAr: string;
  labelEn: string;
  /** How its readers read it, when any do. */
  shape: 'choice' | 'number' | 'unknown' | 'unread';
  readerCount: number;
}

export interface QuestionUsageDetailDto extends QuestionUsageDto {
  /** Unbound, unreserved figures this question could answer instead of minting its own. */
  candidates: QuestionFactCandidateDto[];
  /** The key "create from this question" would mint, or why it cannot. */
  createKey: string;
}

export interface QuestionFactLinkResultDto {
  changed: {
    factKey: string | null;
    factCreated: boolean;
    factBound: boolean;
    factDeleted: boolean;
  };
  state: QuestionUsageDetailDto;
}
