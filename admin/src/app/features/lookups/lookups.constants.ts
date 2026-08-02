/**
 * The enumeration types the platform actually reads at runtime — matching,
 * bank programs, the document pipeline and the customer wizard. Every other
 * seeded type is deactivated in the DB (migration 20260616120000), so the rail
 * renders exactly this list, in this order; the API summary is only used for
 * the per-type counts.
 */
export interface LookupType {
  /** `enumeration.type` — the machine key the API is queried with. */
  readonly type: string;
  readonly label: string;
  /** One line telling the operator what these values actually drive. */
  readonly description: string;
  /** ng-zorro icon `nzType`. */
  readonly icon: string;
}

export const LOOKUP_TYPES: readonly LookupType[] = [
  {
    type: 'transfer_type',
    label: $localize`:@@lookups.type.transferType:Salary transfer types`,
    description: $localize`:@@lookups.type.transferType.desc:How the applicant's income reaches the bank account.`,
    icon: 'swap',
  },
  {
    type: 'employment_type',
    label: $localize`:@@lookups.type.employmentType:Employment types`,
    description: $localize`:@@lookups.type.employmentType.desc:Top-level employment buckets shown on the mobile wizard.`,
    icon: 'solution',
  },
  {
    type: 'product_category',
    label: $localize`:@@lookups.type.productCategory:Product categories`,
    description: $localize`:@@lookups.type.productCategory.desc:Top-level product taxonomy on the bank-programs catalog.`,
    icon: 'appstore',
  },
  {
    type: 'required_document',
    label: $localize`:@@lookups.type.requiredDocument:Required documents`,
    description: $localize`:@@lookups.type.requiredDocument.desc:Document-type keys referenced by bank programs and the upload pipeline.`,
    icon: 'file-text',
  },
  {
    type: 'governorate',
    label: $localize`:@@lookups.type.governorate:Governorates`,
    description: $localize`:@@lookups.type.governorate.desc:Egyptian governorates — the address picker in the mobile app and the mortgage wizard.`,
    icon: 'environment',
  },
  {
    type: 'currency',
    label: $localize`:@@lookups.type.currency:Currencies`,
    description: $localize`:@@lookups.type.currency.desc:Currencies a bank program can lend in — checked against the amount the applicant asks for.`,
    icon: 'dollar',
  },
];

const BY_TYPE = new Map(LOOKUP_TYPES.map((t) => [t.type, t]));

export function isLookupType(type: string): boolean {
  return BY_TYPE.has(type);
}

/** Meta for a type, falling back to the raw key so an unmapped type still renders. */
export function lookupType(type: string): LookupType {
  return BY_TYPE.get(type) ?? { type, label: type, description: '', icon: 'unordered-list' };
}
