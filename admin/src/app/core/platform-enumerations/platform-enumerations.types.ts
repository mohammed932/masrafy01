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
   * `program_name` only — the surrogate facts this name is ticked to read, per loan
   * category (see `core/surrogate-facts.ts`). A category with a non-empty list is one
   * under which the name is sold WITHOUT a payslip.
   *
   * Derived server-side from the ticks, so no flag can disagree with the catalog screen.
   * The bank-program form filters its name picker on this the moment the operator chooses
   * the no-payslip basis — which is what makes no-payslip programs their own set of names
   * — and reads the codes to say whether the fact a chosen method needs is set up.
   *
   * `undefined` means NOT LOADED, never "none": a backend that has not deployed the field
   * must leave the picker unfiltered rather than empty.
   */
  noPayslipFacts?: Partial<Record<LoanCategory, string[]>>;
}
