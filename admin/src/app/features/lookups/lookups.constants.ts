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
  // The collateral products' own lists. `compound` rows carry their CLASS in `parentKey` —
  // the registry's generic single-parent scope — which is what lets a bank key its cap table
  // by five classes while the customer picks one of hundreds of compounds by name.
  {
    type: 'compound_category',
    label: $localize`:@@lookups.type.compound_category.label:Compound classes`,
    description: $localize`:@@lookups.type.compound_category.desc:The classes banks key their compound cap tables by.`,
    icon: 'apartment',
  },
  {
    type: 'compound',
    label: $localize`:@@lookups.type.compound.label:Compounds`,
    description: $localize`:@@lookups.type.compound.desc:The compounds a customer can pick, each filed under its class.`,
    icon: 'home',
  },
  {
    type: 'club_class',
    label: $localize`:@@lookups.type.club_class.label:Club membership classes`,
    description: $localize`:@@lookups.type.club_class.desc:The membership classes the club loan is priced from.`,
    icon: 'trophy',
  },
];

/** One realistic value of a type, shown as the label placeholders in the add/edit dialog. */
export interface LookupExample {
  readonly en: string;
  readonly ar: string;
}

/**
 * Examples are PER TYPE, not one generic sample: the add dialog is the same form
 * for every enumeration, so "English label" alone never said whether the box wants
 * a governorate, a document type or a catalog product name. A shared example is
 * worse than none — under "Governorates" it reads as an instruction to type a job
 * title. `program_name` is here too although it has no rail entry: the same dialog
 * creates catalog names from the program-catalog screen.
 */
const EXAMPLES: Readonly<Record<string, LookupExample>> = {
  transfer_type: {
    en: $localize`:@@lookups.example.transferType.en:e.g. Salary transferred to the bank`,
    ar: $localize`:@@lookups.example.transferType.ar:مثال: تحويل الراتب على البنك`,
  },
  employment_type: {
    en: $localize`:@@lookups.example.employmentType.en:e.g. Private sector employee`,
    ar: $localize`:@@lookups.example.employmentType.ar:مثال: موظف قطاع خاص`,
  },
  product_category: {
    en: $localize`:@@lookups.example.productCategory.en:e.g. Personal loans`,
    ar: $localize`:@@lookups.example.productCategory.ar:مثال: قروض شخصية`,
  },
  required_document: {
    en: $localize`:@@lookups.example.requiredDocument.en:e.g. Bank statement — last 6 months`,
    ar: $localize`:@@lookups.example.requiredDocument.ar:مثال: كشف حساب بنكي — آخر ٦ شهور`,
  },
  governorate: {
    en: $localize`:@@lookups.example.governorate.en:e.g. Giza`,
    ar: $localize`:@@lookups.example.governorate.ar:مثال: الجيزة`,
  },
  program_name: {
    en: $localize`:@@lookups.example.programName.en:e.g. Personal Loan Plus`,
    ar: $localize`:@@lookups.example.programName.ar:مثال: قرض شخصي بلس`,
  },
};

const FALLBACK_EXAMPLE: LookupExample = {
  en: $localize`:@@lookups.example.fallback.en:e.g. Salaried employee`,
  ar: $localize`:@@lookups.example.fallback.ar:مثال: موظف براتب`,
};

/** Example value for a type — falls back to a neutral one for an unmapped type. */
export function lookupExample(type: string): LookupExample {
  return EXAMPLES[type] ?? FALLBACK_EXAMPLE;
}

const BY_TYPE = new Map(LOOKUP_TYPES.map((t) => [t.type, t]));

export function isLookupType(type: string): boolean {
  return BY_TYPE.has(type);
}

/** Meta for a type, falling back to the raw key so an unmapped type still renders. */
export function lookupType(type: string): LookupType {
  return BY_TYPE.get(type) ?? { type, label: type, description: '', icon: 'unordered-list' };
}
