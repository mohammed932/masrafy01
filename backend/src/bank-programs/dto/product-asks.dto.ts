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

import { LoanCategory, QuestionType } from '@prisma/client';

/**
 * The tick's body: nothing (v32.0.0). Until then it carried the loan types the product needed
 * the question asked in (`askIn`); a question carries no loan type any more, and the product's
 * programs ask what the product asks (`question-scope.ts`). Kept as a class so the route keeps
 * its validated (empty) body.
 */
export class AttachProductAskDto {}

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

/**
 * What an applicant who picks one of this product's catalog names is actually asked.
 *
 * Counted off the very payload the customer would receive — `activeSnapshot(category, name)`
 * — and never re-derived here. A second derivation on an operator screen is how a screen
 * comes to report a narrowing other than the one being served.
 *
 * One row per (catalog name, loan type) the product is sold under, because that pair is what
 * the applicant picks and what the narrowing keys off. A product backing two names has two
 * rows and they may legitimately differ.
 */
export interface ProductAskServedDto {
  programNameKey: string;
  category: LoanCategory;
  /** What an applicant picking this name answers. */
  servedTotal: number;
  servedRequired: number;
  /** The served codes, in the order the applicant meets them. */
  servedQuestionCodes: string[];
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
   * The consequence of the ticks above, per catalog name and loan type: how many questions
   * an applicant who picks that name actually answers, and how many of them they must.
   * Empty for a product no catalog name is linked to, and for one whose names have no
   * active program — in both cases nothing narrows, so there is nothing to report.
   */
  served: ProductAskServedDto[];
  /**
   * Fact keys this product's own calculation reads.
   *
   * The half the ask set cannot answer: a rule may read a fact filed under nobody, and an
   * ask may exist that the calculation does not read yet. Both are legitimate and the
   * screen says which is which.
   */
  factsReadByRule: string[];
  /**
   * Every fact the ENGINE needs answered for this product — its calculation, its plan
   * tables, its cap, its selling programmes' own tables, and the answers behind a derived
   * key — with whether each is covered and what would cover it. See
   * `matching/pipeline/product-needed-facts.ts`.
   */
  needed: NeededFactDto[];
  /** Loan types a live catalog name sells this product in — for display. */
  soldIn: LoanCategory[];
}

/**
 * `asked` — covered. `platform` — a key the platform answers itself (money, car figures).
 * `notAsked` — a question exists; the product does not ask it. `parked` — the bound question
 * is switched off. `noQuestion` — the fact exists
 * with no question behind it. `noFact` — read by a table or rule, with no registry row.
 */
export type NeededFactStatus =
  | 'asked'
  | 'platform'
  | 'notAsked'
  | 'parked'
  | 'noQuestion'
  | 'noFact';

export type NeededFactReaderDto =
  | { kind: 'calculation' }
  | { kind: 'plan'; table: string }
  | { kind: 'cap' }
  | { kind: 'program'; programCode: string; table: string };

export interface NeededFactDto {
  factKey: string;
  status: NeededFactStatus;
  questionCode: string | null;
  labelAr: string;
  labelEn: string;
  readBy: NeededFactReaderDto[];
  /** How the answer is read — what an auto-created question would be. */
  shape: 'choice' | 'number' | 'unknown';
  /** Needed only because this derived key is read (e.g. `car_down_payment_percent`). */
  derivedFrom: string | null;
  /** Whether "Ask it" / "Create question" can act on it right now. */
  actionable: boolean;
}

/** What "ask it" / "fix all" did. */
export interface NeededWriteResultDto {
  asked: string[];
  created: string[];
  /** Facts left alone, with the typed reason. */
  skipped: Array<{ factKey: string; code: string }>;
  published: boolean;
  state: ProductAsksResponseDto;
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
    /** Whether a questionnaire version was cut. */
    published: boolean;
  };
  state: ProductAsksResponseDto;
}
