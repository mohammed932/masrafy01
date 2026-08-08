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
}
