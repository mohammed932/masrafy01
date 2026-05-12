export type EnumerationType =
  | 'salary_category'
  | 'transfer_type'
  | 'employment_type'
  | 'loan_purpose'
  | 'property_type'
  | 'city_tier'
  | 'professor_rank'
  | 'military_grade'
  | 'product_category'
  | 'customer_program_tier'
  | 'performance_tier'
  | 'company_type'
  | 'required_document'
  | 'currency';

export interface EnumerationMember {
  type: EnumerationType;
  key: string;
  labelAr: string;
  labelEn: string;
  active: boolean;
  deprecated: boolean;
}
