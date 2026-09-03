/**
 * The predefined-product library, on the wire.
 *
 * Structure and EXISTENCE, never words. The product's own name and its worked examples are
 * screen copy in the admin bundle, keyed by the same `key` — exactly where the eight shapes'
 * words already live, and for the same two reasons: an English label here would be English
 * on the wire (Principle III / A2), and a bank's figure here would become a default that
 * quietly turned into somebody's live table.
 *
 * The bilingual product NAME is the one exception, and it is not a label: it is the name the
 * seed writes onto the product row, so it has to be the same in both locales wherever the
 * library is built from.
 *
 * READ-ONLY on the wire now. The request DTOs went with the create endpoint: products are
 * built by `npm run seed:blueprints`, and an operator's one decision about one is whether it
 * is switched on. What is left here is what the screens READ — the library's structure, and
 * what a build would have to create — which is also what the seed's `--dry` reports.
 */

import type { LoanCategory } from '@prisma/client';
import type { BlueprintGroup } from '../blueprints/product-blueprint.types';

/** One thing a product asks, and whether the platform can already ask it. */
export interface ProductBlueprintAskDto {
  factKey: string;
  kind: 'choice' | 'number' | 'bindQuestion' | 'platformFact' | 'derivedFact';
  /** Absent when the blueprint does not name one and no fact is bound yet. */
  questionCode?: string;
  listTypeKey?: string;
  factExists: boolean;
  questionExists: boolean;
  listExists: boolean;
  /**
   * Loan categories the question is NOT asked in yet.
   *
   * The half of "is this set up?" that is invisible on every other screen: a question that
   * exists but is assigned to no category is asked by nobody, so a product reading it quotes
   * the standard column for every applicant and says nothing about why.
   */
  missingCategories: LoanCategory[];
}

/** What creating this product would write. Reported before anything is written. */
export interface ProductBlueprintCreatesDto {
  lists: number;
  values: number;
  questions: number;
  facts: number;
  widens: number;
}

export interface ProductBlueprintDto {
  key: string;
  group: BlueprintGroup;
  labelEn: string;
  labelAr: string;
  /** `null` for a cap-only product: there is no income and no ceiling to work out. */
  outputKind: 'monthlyIncome' | 'maxAmount' | null;
  /** How many ways of reaching the figure the product offers. Each bank fills the ones it sells. */
  wayCount: number;
  hasSecondColumn: boolean;
  conditionCount: number;
  hasCap: boolean;
  /** A question only a bank can answer, which changes every figure the product quotes. */
  openQuestion?: string;
  asks: ProductBlueprintAskDto[];
  creates: ProductBlueprintCreatesDto;
  /**
   * The brackets a published sheet prints, offered to the form.
   *
   * Edges, never amounts: which brackets exist is the shape of the table. They are not
   * persisted on their own either — a band row with no figure beside it is refused by the
   * validator, so these reach the form and are stored only once an operator has typed each
   * figure.
   */
  suggestedBands: Array<{
    wayIndex: number;
    /**
     * The step id those brackets belong to, resolved here.
     *
     * Resolved SERVER-side because `waySlot` is the authority on slot naming and the screen
     * must not re-derive it: a slot the admin worked out for itself would be a second
     * statement of the rule that decides where a bank's figures live, free to disagree the
     * day a way is added. With the id on the wire the form matches a suggestion to the box it
     * belongs in by string equality and nothing else.
     */
    slotId: string;
    edges: Array<{ fromInclusive: string; toExclusive: string | null }>;
  }>;
}

/** What was written, and what was already there. */
export interface CreateFromBlueprintResultDto {
  blueprintKey: string;
  /** `null` for a cap-only product — it builds the question and the list and no product. */
  productKey: string | null;
  /**
   * The fact a cap-only product's table is keyed by, so the screen can hand the operator
   * straight to the bank program's own maximum-loan table with the axis already chosen.
   */
  capFactKey: string | null;
  created: {
    lists: string[];
    values: number;
    questions: string[];
    facts: string[];
    widened: string[];
    /**
     * Questions that existed, switched off, and were switched back on.
     *
     * Reported rather than silent: a purge leaves soft-deleted questions behind (an answer's
     * foreign key onto a question is RESTRICT), and reviving one puts a question back in
     * front of applicants — which the operator should read on the screen that did it.
     */
    revived: string[];
  };
  reused: { typeKeys: string[]; questionCodes: string[]; factKeys: string[]; valueKeys: string[] };
  publishedQuestionnaire: boolean;
}
