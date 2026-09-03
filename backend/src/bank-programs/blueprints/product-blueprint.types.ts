/**
 * A predefined no-payslip product — the shape of one, and what it asks.
 *
 * ─── Why this exists ──────────────────────────────────────────────────────────
 *
 * `product-template-starters.ts` offers eight SHAPES: "a table by a choice answer", "a
 * ceiling from an amount bracket". They are correct and they are anonymous. An operator
 * picking one still has to know that a doctors' product bands years in practice, that the
 * band edges are 3–5 / 5–8 / 8–11, that the second column is a city tier and not a bank
 * relationship, and that the tier is read through the class a governorate is filed under.
 * Then they have to author the question, the list and the fact by hand, in the right order.
 *
 * A BLUEPRINT is a starter with that knowledge attached: the whole template, the questions
 * it asks, the lists behind them, and the conditions the sheets state. Picking one writes
 * all of it in one transaction, so "add the doctors' product" stops being a release.
 *
 * ─── What a blueprint may and may not carry ───────────────────────────────────
 *
 * MAY carry the DB CONTENT it writes: a question's wording and a list value's label, in both
 * locales. It has to — it is the thing writing them, and a question with no Arabic label is
 * unusable in the primary locale. This is the same content `seed-questionnaire.ts` already
 * holds.
 *
 * MAY carry BAND EDGES (`suggestedBands`). An edge says which brackets exist, which is the
 * shape of the table and belongs with the mechanism. It is not a price, and it is never
 * persisted on its own: a band row with no figure beside it is refused by the validator
 * (`validateBands`), so the edges are offered to the form and stored only once an operator
 * has typed each figure.
 *
 * MUST NOT carry a bank's FIGURE or a bank's NAME. One product is sold by many banks off one
 * mechanism, so a bank baked in here would be a hardcoded bank (Principle II / A1), and a
 * figure would become a default that quietly turns into somebody's live table. The worked
 * examples an operator reads beside each empty box are SCREEN copy and live in the admin
 * bundle, keyed by these same blueprint keys — exactly where the starters' words already live.
 */

import type { LoanCategory } from '@prisma/client';
import type { GateReasonCode } from '../../matching/pipeline/product-rule';
import type { ProductTemplate } from '../../matching/pipeline/product-template';
import type { MaxLoanNoMatchAction } from '../../matching/pipeline/max-loan-by-fact';

/**
 * What the product produces, and therefore where it is configured.
 *
 * `cap` is not a lesser product: three of the source sheets guess no income at all — they
 * state a maximum keyed by an answer, over a real payslip. Those have no rule to hang a path
 * on (§10.2), so a `cap` blueprint builds the question and the list and then hands the
 * operator to the bank program's own cap table. It creates no surrogate product, because
 * there is no income to guess.
 */
export const BLUEPRINT_GROUPS = ['income', 'ceiling', 'cap'] as const;

export type BlueprintGroup = (typeof BLUEPRINT_GROUPS)[number];

/** One row of a list, as the sheet prints it. */
export interface BlueprintValue {
  key: string;
  labelEn: string;
  labelAr: string;
  /** The class it is filed under, when the list has a parent axis. */
  parentKey?: string;
}

/**
 * A list a question draws its answers from.
 *
 * `parent` is created FIRST when present, because `resolveParentKey` refuses to create a
 * filed-under value with no parent — a value of a filed kind is born filed.
 */
export interface BlueprintList {
  typeKey: string;
  labelEn: string;
  labelAr: string;
  values: BlueprintValue[];
  parent?: {
    typeKey: string;
    labelEn: string;
    labelAr: string;
    values: BlueprintValue[];
    /** Where an unfiled value lands, so `factParentTable` never answers `no_matching_row`. */
    fallbackParentKey?: string;
  };
}

/** Show this question only when another answer was given. */
export interface BlueprintGate {
  questionCode: string;
  optionCode: string;
}

/**
 * One thing the product asks the applicant.
 *
 * Four kinds, and the difference between them is what already exists:
 *
 *   `choice`         a new question over a new list, plus the fact that reads it
 *   `number`         a new numeric question, plus its fact
 *   `bindQuestion`   a fact over a question that ALREADY exists — the car instalment is
 *                    already asked as an obligation, and asking it twice would be two
 *                    answers to one question that can disagree
 *   `platformFact`   a fact that already exists, optionally widened to more loan categories
 *   `derivedFact`    an axis the platform computes (new-to-bank, top-up, holds-a-product);
 *                    it has no registry row and no bound question by construction
 */
/**
 * ─── Why a created question states no code ────────────────────────────────────
 *
 * A question's `code` is generated from its English wording and is immutable
 * (Principle V / A33 — codes are never hand-typed), so a code declared here would be a wish
 * the service could not grant: it slugs the wording and returns whatever that gives. The
 * blueprint therefore states the WORDING, and the code follows from it — which is also what
 * makes reuse work, since the same wording is the same question by construction.
 *
 * A FACT key is the opposite and is declared: it is what a stored rule names, an operator
 * reads on the product screen, and a bank's figures are filed under, so it is short and
 * stable and must not change when somebody rewords a question. `credit_card_limit` reading
 * `credit_card_total_limit` is the existing precedent.
 */
export type BlueprintAsk =
  | {
      kind: 'choice';
      factKey: string;
      questionEn: string;
      questionAr: string;
      helperEn?: string;
      helperAr?: string;
      list: BlueprintList;
      categories: readonly LoanCategory[];
      enabledWhen?: BlueprintGate;
    }
  | {
      kind: 'number';
      factKey: string;
      questionEn: string;
      questionAr: string;
      helperEn?: string;
      helperAr?: string;
      numeric: { min: number; max: number };
      categories: readonly LoanCategory[];
      enabledWhen?: BlueprintGate;
    }
  | {
      kind: 'bindQuestion';
      factKey: string;
      questionCode: string;
      alsoAskIn?: readonly LoanCategory[];
    }
  | {
      kind: 'platformFact';
      factKey: string;
      /** Categories the bound question must also be asked in for this product to work. */
      alsoAskIn?: readonly LoanCategory[];
      /** Values the sheets need that the existing list is missing. Added by key, never renamed. */
      addValues?: { typeKey: string; values: BlueprintValue[] };
    }
  | { kind: 'derivedFact'; factKey: string; alsoAskIn?: readonly LoanCategory[] };

/** The band edges a sheet prints, offered to the form for one way of the calculation. */
export interface BlueprintBands {
  /** Index into the template's ways — 0 is `primary`. */
  wayIndex: number;
  edges: Array<{ fromInclusive: string; toExclusive: string | null }>;
}

/**
 * The maximum-loan table this product implies, as a shape with no figures.
 *
 * Program configuration, not template data: what a bank caps a loan at is its own setting,
 * and two banks selling one product cap differently. The blueprint carries only which answer
 * keys the rows, which answer keys the columns, and what happens to an applicant with no row
 * — the last of which the platform must never infer (§10.2).
 */
export interface BlueprintCap {
  factKey: string;
  columnFactKey?: string;
  rowVia?: 'answer' | 'parentClass';
  columnVia?: 'answer' | 'parentClass';
  onNoMatch: MaxLoanNoMatchAction;
  /** Row keys in the order the sheet prints them, or the brackets when it bands. */
  rowKeys?: string[];
  bands?: Array<{ fromInclusive: string; toExclusive: string | null }>;
  columnKeys?: string[];
}

export interface ProductBlueprint {
  /** Stable forever: the admin's words and worked examples are keyed by it (A25). */
  key: string;
  group: BlueprintGroup;
  /**
   * The default product name, in both locales. A DEFAULT — the operator may rename it, and
   * the name they type is what every screen shows afterwards.
   */
  labelEn: string;
  labelAr: string;
  /** Every ask, in the order the form should present them. */
  asks: readonly BlueprintAsk[];
  /**
   * The calculation. `null` for a `cap` blueprint, which has none by definition.
   *
   * Every fact it names must be declared in `asks` — asserted by a test, because a template
   * reading a fact nothing creates is a product that saves clean and quotes nothing.
   */
  template: ProductTemplate | null;
  suggestedBands?: readonly BlueprintBands[];
  /** The cap table the sheets print under *Loan Amount — Maximum*, when there is one. */
  cap?: BlueprintCap;
  /**
   * A question only a bank can answer, and which changes every figure the product quotes.
   *
   * Rendered on the card and on the form as a warning. The product is still creatable — the
   * mechanism is not in doubt, the percentage is — and the form seeds no figure for it.
   */
  openQuestion?: 'PAID_SHARE_FORMULA_UNCONFIRMED' | 'DBR_PERCENT_UNCONFIRMED';
  /** Gate reason codes the conditions use, for the "what this asks" summary. */
  readonly usesReasonCodes?: readonly GateReasonCode[];
}
