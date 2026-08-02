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

export interface EnumerationMember {
  type: EnumerationType;
  key: string;
  labelAr: string;
  labelEn: string;
  /** Optional single scoping parent (generic; unused by `program_name`). */
  parentKey: string | null;
  active: boolean;
  deprecated: boolean;
}
