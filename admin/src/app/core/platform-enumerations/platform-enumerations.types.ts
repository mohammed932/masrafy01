export type EnumerationType =
  | 'transfer_type'
  | 'employment_type'
  | 'property_type'
  | 'professor_rank'
  | 'military_grade'
  | 'product_category'
  | 'company_type'
  | 'required_document'
  | 'currency'
  | 'governorate'
  | 'program_name';

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
   * `program_name` only — how this name may be SOLD under each category it is offered
   * under: against a payslip, without one, or both. Chosen when the name is created and
   * edited per tab on the catalog detail screen.
   *
   * The bank-program form filters its name picker on this in BOTH directions, and the API
   * refuses a program whose basis is not in the set — so this is the pairing rule, not a
   * hint. A category absent from the map is one the name is not offered under at all.
   *
   * `undefined` means NOT LOADED, never "none": a backend that has not deployed the field
   * must leave the picker unfiltered rather than empty.
   */
  incomeBases?: Partial<Record<LoanCategory, IncomeBasis[]>>;
  /**
   * `program_name` only — the surrogate facts this name is ticked to read, per loan
   * category (see `core/surrogate-facts.ts`).
   *
   * NOT the basis above. This is the next question down: given that the name is sold
   * without a payslip here, WHICH fact do its banks look up, and does the questionnaire
   * ask it at all. The program form uses it to warn that a chosen method reads a fact
   * nobody is asked — a rule that resolves to no income, silently.
   *
   * `undefined` means NOT LOADED, never "none".
   */
  noPayslipFacts?: Partial<Record<LoanCategory, string[]>>;
}
