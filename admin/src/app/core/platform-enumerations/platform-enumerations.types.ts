export type EnumerationType =
  | 'transfer_type'
  | 'employment_type'
  | 'property_type'
  | 'professor_rank'
  | 'military_grade'
  | 'product_category'
  | 'company_type'
  | 'required_document'
  | 'governorate'
  | 'program_name'
  /** The income FACTS a no-payslip rule can be keyed by — operator-managed since v16.2.0. */
  | 'surrogate_fact';

import type { LoanCategory } from '@core/loan-category';
import type { IncomeBasis } from '@core/income-basis';

export interface EnumerationMember {
  type: EnumerationType;
  key: string;
  labelAr: string;
  labelEn: string;
  /** Optional single scoping parent (generic; unused by `program_name`). */
  parentKey: string | null;
  active: boolean;
  deprecated: boolean;
  /**
   * `program_name` only — the loan categories this name may be offered under.
   * A present `[]` means PARKED: pickable nowhere. Optional so the bundle keeps
   * working against a backend that has not deployed the assignment yet, and
   * because the other ten types never carry it.
   */
  categories?: LoanCategory[];
  /**
   * `program_name` only — what this name IS under each category it is offered under:
   * a product sold against a payslip, or one whose income the bank works out. Chosen
   * when the name is created and edited per tab on the catalog detail screen.
   *
   * INTENT, and read-only everywhere else. It filters no picker and refuses no save:
   * v16.4.0 deleted the save-time rejection because a stale mark here could block a
   * program the bank was entitled to create, and the API now checks only that the name
   * is offered under the category (`assertProgramNameKey`). What it DOES do is pre-fill
   * step 1 of the bank-program wizard, which the operator may then override — that is
   * where "another bank sells this name the other way" is expressed. A category absent
   * from the map is one the name is not offered under at all.
   *
   * The catalog writes exactly ONE basis per pair; the array predates that rule and
   * legacy rows may hold two, which reads as "unsettled", never as "take the first".
   *
   * `undefined` means NOT LOADED, never "none": a backend that has not deployed the field
   * must leave the wizard asking rather than assert an answer.
   */
  incomeBases?: Partial<Record<LoanCategory, IncomeBasis[]>>;
  /**
   * `surrogate_fact` only — the question whose ANSWER is this fact, with the option
   * codes a bank's table for it may be keyed by.
   *
   * `null` is a fact nobody has pointed at a question yet: real, and unpriceable, so
   * the program form must be able to say so rather than offer the method. `undefined`
   * means NOT LOADED.
   */
  boundQuestion?: {
    code: string;
    type: 'SINGLE_SELECT' | 'NUMERIC';
    labelAr: string;
    labelEn: string;
    active: boolean;
    /** Active options in display order; empty for a NUMERIC fact. */
    options: Array<{ code: string; labelAr: string; labelEn: string }>;
    /**
     * Loan categories whose applicants are ASKED this question — the questionnaire's
     * own assignment, not a per-name tick. A program in a category outside this list
     * reads an answer that never arrives, so its table quotes nothing.
     */
    askedIn: LoanCategory[];
  } | null;
}
