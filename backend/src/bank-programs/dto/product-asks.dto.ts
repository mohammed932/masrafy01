/**
 * What a no-payslip product ASKS the applicant — the board, and the two writes.
 *
 * Lives beside `program-name-income-rule.dto.ts` for the same reason that file states: the
 * enumeration ROW is the registry's, but everything that decides whether a write is
 * acceptable (the fact registry's own bindable types, the rule walk, the typed refusals) is
 * already here, and importing it the other way would close a module cycle.
 *
 * ONE RESPONSE SHAPE for the read and for both writes. The screen absorbs the whole board
 * after every click instead of re-reading three endpoints that can disagree — the fact
 * registry behind a per-session client cache, the question pool behind a stricter role, and
 * the product itself.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsEnum, IsOptional } from 'class-validator';
import { LoanCategory, QuestionType } from '@prisma/client';
import { ALL_LOAN_CATEGORIES } from '@/common/loan-category.util';

export class AttachProductAskDto {
  /**
   * Loan types this product needs the question ASKED in.
   *
   * ADDITIVE, never a replacement, and the two reasons are separate. One is the lost
   * update: `question_loan_category` has no additive endpoint besides this path, and a
   * four-tab screen is exactly where two whole-set writes interleave and one tick vanishes.
   * The other is ownership — the assignment is GLOBAL to the question and shared with every
   * other product and catalog name that reads it, so narrowing it from here would silently
   * stop asking somebody else's question. Narrowing lives on `/questionnaire/categories`.
   *
   * Optional and may be empty: attaching a fact whose question is already asked everywhere
   * it needs to be is a legitimate tick that widens nothing.
   */
  @ApiPropertyOptional({ enum: ALL_LOAN_CATEGORIES, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(ALL_LOAN_CATEGORIES.length)
  @IsEnum(LoanCategory, { each: true })
  askIn?: LoanCategory[];
}

/** Whether an ask can be removed here, and if not, what the operator must do instead. */
export interface ProductAskDetachabilityDto {
  ok: boolean;
  /**
   * `read_by_own_rule` — this product's calculation still reads it, so unticking it would
   * leave step ② reading an answer step ① no longer asks for. `fact_still_read` — nothing
   * else asks it and something outside still reads it, so the row cannot go; naming them is
   * what stops the operator hunting.
   *
   * There is deliberately no `blueprint_owned` any more. An ask that came with the product
   * is removable: the untick tombstones its row instead of deleting it, so the seed cannot
   * put it back. `ProductAskDto.source` still says where the ask came from.
   */
  reason?: 'read_by_own_rule' | 'fact_still_read';
  meta?: Record<string, unknown>;
}

/** One thing this product reads: a fact, the question behind it, and where it is asked. */
export interface ProductAskDto {
  factKey: string;
  source: 'blueprint' | 'operator';
  /** `null` when the fact exists but reads no question — broken, and shown as broken. */
  questionCode: string | null;
  questionLabelAr: string;
  questionLabelEn: string;
  questionType: QuestionType | null;
  /** `false` when somebody switched the question off elsewhere: the product quotes nothing. */
  questionActive: boolean;
  /** The loan categories that ASK the question. Empty = asked of nobody. */
  askedIn: LoanCategory[];
  /**
   * The registry list the question's options came from, when they came from one.
   *
   * Derived, never stored, and `null` for a question whose options are plain slugs — which
   * is legal and engine-safe (a bank's table is keyed by the question's own option codes),
   * but means there is no values panel and no per-answer amount to curate.
   */
  listType: string | null;
  parentListType: string | null;
  /** Other products reading the same fact. What makes an untick's consequence visible. */
  alsoAskedBy: string[];
  detach: ProductAskDetachabilityDto;
}

/** One pool question as the grid renders it. Every active question is listed. */
export interface AskPoolQuestionDto {
  code: string;
  labelAr: string;
  labelEn: string;
  type: QuestionType;
  isRequired: boolean;
  /** The loan categories that ASK it today. */
  categories: LoanCategory[];
  /**
   * Whether it could be ticked at all.
   *
   * Served rather than derived client-side: the card's reason and the server's refusal have
   * to be one statement, and the client cannot see the fact rows that decide the rest.
   */
  eligible: boolean;
  /**
   * Why not.
   *
   * One value left. The shape refusals are gone — a key table reads one option code or
   * several, a band table reads a number, and a text answer is read for its presence — and
   * so are the six domain refusals, which named questions that were the right shape and
   * (in somebody's judgement) the wrong figure. What remains is a question type the
   * platform has no reader for at all, which can only appear if the schema grows one.
   */
  ineligibleReason?: 'unsupported_type';
  /** The fact already reading this question, if any — what a tick would JOIN. */
  factKey: string | null;
  askedByThisProduct: boolean;
  askedByOtherProducts: string[];
}

/** Everything step ① renders, in one response. */
export interface ProductAsksResponseDto {
  productKey: string;
  labelAr: string;
  labelEn: string;
  active: boolean;
  /** A cap-only product works out no income: each bank states the maximum on its program. */
  capOnly: boolean;
  asks: ProductAskDto[];
  pool: AskPoolQuestionDto[];
  /**
   * Fact keys this product's own calculation reads.
   *
   * The half the ask set cannot answer: a rule may read a fact filed under nobody, and an
   * ask may exist that the calculation does not read yet. Both are legitimate and the
   * screen says which is which.
   */
  factsReadByRule: string[];
}

/** What one click changed, beside the board it produced. */
export interface AskWriteResultDto {
  changed: {
    factKey: string;
    factCreated: boolean;
    factBound: boolean;
    askAdded: boolean;
    askRemoved: boolean;
    factDeleted: boolean;
    /** Loan types this write STARTED asking the question in. Never a narrowing. */
    widened: LoanCategory[];
    /**
     * Whether a questionnaire version was cut.
     *
     * `false` with a non-empty `widened` is the one outcome a toast would lie about: the
     * assignment landed and the applicant is not being served it yet, which the screen has
     * to state persistently rather than flash.
     */
    published: boolean;
  };
  state: ProductAsksResponseDto;
}
