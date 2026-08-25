/**
 * Lookup pieces shared BEYOND the Manage-values screen.
 *
 * Split out of `features/lookups/lookups.constants.ts` because two other features now
 * render lookup values: the program catalog creates catalog names through the same edit
 * dialog, and a surrogate product's workspace embeds the very lists its calculation reads.
 * A feature importing from another feature's `components/` folder is the Angular shape of
 * the Principle IX violation `common/` is forbidden from making.
 *
 * What stays behind in the feature: `LOOKUP_TYPES` and the rail metadata, which describe
 * the Manage-values SCREEN rather than the registry.
 */
/**
 * Which list a type's values are FILED UNDER — the registry's generic single-parent scope.
 *
 * `compound` is the only entry today: a bank keys its cap table by the five compound CLASSES
 * while the customer picks one of hundreds of compounds by name, and `factParentTable` is the
 * step that crosses between them. A value with no parent is invisible to that derivation, so
 * both the list and the edit dialog have to be able to show and set one.
 */
export const PARENT_TYPE_BY_TYPE: Readonly<Record<string, string | undefined>> = {
  compound: 'compound_category',
};

/**
 * What each registry list is CALLED, for every type — including the ones the Manage-values
 * rail no longer shows.
 *
 * Separate from `LOOKUP_TYPES`, which describes the rail. That distinction became load-bearing
 * when `compound` and `compound_category` left the rail for the surrogate product that reads
 * them: their labels are still needed, by a different screen. Keeping the names on the rail
 * definition would have meant the product page rendering a raw key like `compound_category` as
 * a heading.
 *
 * The `@@lookups.type.*` ids are the ORIGINAL ones, so every existing translation carries over
 * rather than being orphaned and re-authored.
 */
export const ENUMERATION_TYPE_LABELS: Readonly<Record<string, string>> = {
  compound: $localize`:@@lookups.type.compound.label:Compounds`,
  compound_category: $localize`:@@lookups.type.compound_category.label:Compound classes`,
  military_grade: $localize`:@@lookups.type.military_grade.label:Military grades`,
  professor_rank: $localize`:@@lookups.type.professor_rank.label:Academic ranks`,
  property_type: $localize`:@@lookups.type.property_type.label:Property types`,
  company_type: $localize`:@@lookups.type.company_type.label:Company types`,
};

/**
 * A registry list's name, falling back to the raw type.
 *
 * The fallback is the honest answer, not a failure: a type nobody has named yet still has to
 * render as something, and the key is what an operator would search for.
 */
export function enumerationTypeLabel(type: string): string {
  return ENUMERATION_TYPE_LABELS[type] ?? type;
}

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
