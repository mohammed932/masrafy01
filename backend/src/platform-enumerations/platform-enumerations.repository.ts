/**
 * Read-only consumer interface for the platform enumeration registry.
 * Feature 002 (this feature) consumes via an in-memory stub.
 * Feature 003 (planned) replaces the stub behind THIS interface — DI swap, zero call-site changes.
 *
 * Spec anchors: FR-010, FR-010a, FR-010b, FR-010c. Research R4.
 */

import type { LoanCategory } from '@prisma/client';
import type { IncomeBasis } from '@/common/income-basis.util';
import type {
  BindableQuestionType,
  SurrogateFactBinding,
} from '@/matching/pipeline/surrogate-fact-registry';
import type { ProductTemplate } from '@/matching/pipeline/product-template';
import type { CatalogIncomeRules } from '@/matching/pipeline/income-rule-inherit';
import type { IncomeAssumptionConfig } from '@/matching/types';

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
  /**
   * The surrogate income FACTS a no-payslip rule can be keyed by — military grade,
   * academic rank, years in practice, card limit, and whatever the next bank's table
   * reads. Was a code constant with four entries; a fifth needed a release, while the
   * table keyed by it was already data.
   */
  | 'surrogate_fact'
  /**
   * A no-payslip PRODUCT: a named, reusable income calculation, carried in this row's
   * own `incomeRule`.
   *
   * The archetype a catalog `program_name` links to via `surrogateProductKey`. It exists
   * because the calculation is the reusable half and the name is not: several catalog
   * names are sold against one way of working an income out, and before this each of them
   * held its own copy of the rule with nothing keeping the copies in step.
   *
   * NOT in `UNSCOPED_ENUMERATION_TYPES`, deliberately: a product has no parent axis at
   * all, so leaving it out means `resolveParentKey` REFUSES a stray `parentKey` with
   * `ENUMERATION_PARENT_NOT_APPLICABLE` instead of force-nulling it and saying nothing.
   *
   * NOT in `CATEGORISED_ENUMERATION_TYPES` either: which loan types a product may be
   * offered under is a property of the NAME that sells it, not of the calculation.
   */
  | 'surrogate_product';

/**
 * Types whose members carry no scoping PARENT. `parentKey` is force-nulled on
 * write for these (see `PlatformEnumerationsAdminService`) so the generic CRUD
 * cannot quietly re-bind one.
 *
 * Orthogonal to `CATEGORISED_ENUMERATION_TYPES` below, and both are true of
 * `program_name`: a catalog archetype ("Doctor Loans") is owned by no single
 * loan type, but it IS assignable to the several categories banks may offer it
 * under. Scope is one parent; assignment is many categories.
 */
export const UNSCOPED_ENUMERATION_TYPES: readonly EnumerationType[] = ['program_name'];

/**
 * The ONLY types a customer may read over `GET /v1/platform-enumerations/:type`.
 *
 * That endpoint takes the type as a path parameter and, until this list existed,
 * validated nothing: any authenticated customer could name any type and get every
 * active row back, with `Cache-Control: public, max-age=300` on the response. That was
 * survivable while every type held labels a customer sees anyway. It stopped being
 * survivable with `surrogate_product`, whose rows carry `incomeRule` — a bank's cap
 * tables, its band edges, its DBR overrides. One request away from a competitor.
 *
 * AN ALLOW-LIST, not a deny-list, and the direction is the point: the next type someone
 * adds is private until a person decides otherwise, rather than public until someone
 * remembers. A type the app genuinely needs is one line and a review.
 *
 * These three are what the Flutter client actually reads (`EnumerationTypes` in
 * `platform_enumerations_usecase.dart`). Everything else it renders — employment types,
 * compounds, transfer types — reaches it inside the QUESTIONNAIRE SNAPSHOT as
 * materialised question options, not through this endpoint.
 */
export const CUSTOMER_READABLE_ENUMERATION_TYPES: readonly EnumerationType[] = [
  'governorate',
  'required_document',
  'program_name',
];

/** True when a customer may read `type` over the mobile endpoint (see above). */
export function isCustomerReadableEnumerationType(type: string): boolean {
  return (CUSTOMER_READABLE_ENUMERATION_TYPES as readonly string[]).includes(type);
}

/** True when members of `type` carry no scoping parent (see above). */
export function isUnscopedEnumerationType(type: string): boolean {
  return (UNSCOPED_ENUMERATION_TYPES as readonly string[]).includes(type);
}

/**
 * What is true of a KIND of list — the registry's own taxonomy, one row per `type`.
 *
 * WAS four hardcoded maps (`PARENT_TYPE_BY_TYPE` here, `ENUMERATION_TYPE_LABELS`,
 * `LOOKUP_TYPES` and `EXAMPLES` in the admin) plus `DELETABLE_TYPES` in the Postgres
 * repository. The type STRING was already data — nothing validates it on write and
 * `listTypeStats` is a `GROUP BY type` — so every one of those maps was a statement about
 * data, held in code, that a new kind could not extend. A bank keying its cap table by a
 * new set of classes is a pricing decision; it should not be a release.
 *
 * Still hardcoded, and deliberately: `UNSCOPED_ENUMERATION_TYPES`,
 * `CATEGORISED_ENUMERATION_TYPES`, `QUESTION_TEMPLATE_ENUMERATION_TYPES`,
 * `QUESTION_BOUND_ENUMERATION_TYPES` and `CUSTOMER_READABLE_ENUMERATION_TYPES`. Each names
 * a behaviour that only a builtin has — a code path reads that type by name — so making one
 * of them settable would let an operator claim a capability nothing implements. The customer
 * allow-list is the sharpest case: it must not be widenable from a browser, and its
 * exact-equality test is the guard.
 *
 * Two things still follow from a kind naming a `parentTypeKey`, both enforced in the admin
 * service and now read from here rather than from a constant:
 *   · a new member of it MUST name a parent (an unfiled value is invisible to the derivation
 *     that reads it, so it quotes nothing for whoever picks it), and
 *   · a PARENT may not be retired while a member still points at it.
 */
export interface EnumerationTypeDefinition {
  key: string;
  labelAr: string;
  labelEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  icon: string | null;
  exampleAr: string | null;
  exampleEn: string | null;
  /** The kind whose values these are filed under, by key. `null` = no parent axis. */
  parentTypeKey: string | null;
  /**
   * Where a value of this kind goes when an operator UNFILES it, by key of the `parentTypeKey`
   * list. `null` = no fallback declared, and `null` stays a reachable stored `parentKey`.
   *
   * Read by `resolveParentKey` under `allowUnfiled`, and by nothing else — never on create,
   * where a blank class is a typo rather than a decision.
   */
  fallbackParentKey: string | null;
  deletable: boolean;
  /** Shown on the operator's Manage-values rail. Off for kinds with a screen of their own. */
  onValuesRail: boolean;
  /** A builtin the code names by string: relabel yes, rename or delete no. */
  systemOnly: boolean;
  active: boolean;
  sortOrder: number;
  /**
   * The `surrogate_product` that authored this kind, or `null` for a shared list.
   *
   * Provenance only — it answers "which lists did this product make?" on a product that has
   * no rule yet, which is the one moment the coverage derivation cannot. Nothing gates on it.
   */
  surrogateProductKey: string | null;
  /**
   * The question whose OPTIONS are this list, one-for-one, `question_option.code` === `key`.
   *
   * When set, a write to any value of this kind re-syncs that question's options and
   * republishes the questionnaire. `null` = a list no question mirrors.
   */
  mirrorQuestionId: string | null;
}

/** Definitions by key, as every reader below expects them. */
export type EnumerationTypeDefinitions = ReadonlyMap<string, EnumerationTypeDefinition>;

/**
 * The list `type`'s values are filed under, or `null` when the type has no parent axis.
 *
 * PURE, and takes the definitions rather than reading them: the three call sites are all
 * inside one already-async service method that has other reasons to hold the map, and a
 * function that fetched its own would turn a single decision into three round trips.
 *
 * Reads a definition WHATEVER its `active` state, deliberately. `active` governs whether a
 * kind is OFFERED to an operator; retiring one must not silently strip the parent axis from
 * values that already carry a `parentKey`, because `factParentTable` goes on walking it and
 * the only visible symptom would be a quote of nothing.
 */
export function parentTypeOf(defs: EnumerationTypeDefinitions, type: string): string | null {
  return defs.get(type)?.parentTypeKey ?? null;
}

/** The types filed under `parentType` — the inverse of the relation above. */
export function childTypesOf(defs: EnumerationTypeDefinitions, parentType: string): string[] {
  const out: string[] = [];
  for (const def of defs.values()) {
    if (def.parentTypeKey === parentType) out.push(def.key);
  }
  return out;
}

/**
 * Whether a value of `type` may be hard-deleted. Replaces the `DELETABLE_TYPES` constant.
 *
 * An UNDEFINED type answers `false`, which is the safe direction: `countReferences` returns
 * `null` for it and the delete is refused in words rather than performed against a type
 * nothing can count the references of.
 */
export function isDeletableType(defs: EnumerationTypeDefinitions, type: string): boolean {
  return defs.get(type)?.deletable ?? false;
}

/**
 * Types whose members are ASSIGNED to loan categories, via the join table
 * `platform_enumeration_loan_category`. For every other type the assignment is
 * always the empty set and nothing reads it.
 *
 * On a categorised type the empty set means PARKED — offerable nowhere — not
 * "unrestricted". The bank-program builder filters its picker on this and the
 * service rejects an unassigned pair on write.
 */
export const CATEGORISED_ENUMERATION_TYPES: readonly EnumerationType[] = ['program_name'];

/** True when members of `type` are assignable to loan categories (see above). */
export function isCategorisedEnumerationType(type: string): boolean {
  return (CATEGORISED_ENUMERATION_TYPES as readonly string[]).includes(type);
}

/**
 * Types whose members carry a suggested QUESTION set — the archetype's house
 * opinion about what a bank should score that product on, via the join table
 * `platform_enumeration_question`.
 *
 * Advisory only. The set pre-ticks the per-program scoring wizard and is read by
 * nothing at runtime; `ScoringWeightSet.weights.questionWeights` remains the sole
 * authority on what a bank program actually scores.
 */
export const QUESTION_TEMPLATE_ENUMERATION_TYPES: readonly EnumerationType[] = ['program_name'];

/** True when members of `type` carry a question template (see above). */
export function isQuestionTemplateEnumerationType(type: string): boolean {
  return (QUESTION_TEMPLATE_ENUMERATION_TYPES as readonly string[]).includes(type);
}

/**
 * Types whose members BIND ONE QUESTION — the answer that IS the member.
 *
 * Exactly one type today, and the reason it exists at all: a surrogate income fact
 * is not a label, it is "the thing the bank's table is keyed by", which is
 * meaningless without saying which question answers it. The other ten types are
 * pickable values in their own right and bind nothing.
 *
 * Orthogonal to `QUESTION_TEMPLATE_ENUMERATION_TYPES`, which is a `program_name`
 * SUGGESTING many questions to score on. This is one member reading one answer, and
 * the engine reads it at quote time — an advisory template never is.
 */
export const QUESTION_BOUND_ENUMERATION_TYPES: readonly EnumerationType[] = ['surrogate_fact'];

/** True when members of `type` bind a single question (see above). */
export function isQuestionBoundEnumerationType(type: string): boolean {
  return (QUESTION_BOUND_ENUMERATION_TYPES as readonly string[]).includes(type);
}

/**
 * Which question types may be bound, and the fact shape the engine reads — both owned
 * by `matching/pipeline/surrogate-fact-registry.ts` and re-exported here.
 *
 * The engine may not import from this layer (Principle V), so the contract lives on its
 * side and the registry that fills it lives here. Re-exported rather than redeclared so
 * the admin's validation and the resolver's lookup cannot disagree about what "bindable"
 * means.
 */
export {
  BINDABLE_QUESTION_TYPES,
  isBindableQuestionType,
} from '@/matching/pipeline/surrogate-fact-registry';
export type {
  BindableQuestionType,
  SurrogateFactBinding,
} from '@/matching/pipeline/surrogate-fact-registry';

/**
 * The question a `surrogate_fact` member reads, resolved.
 *
 * Carries the CODE as well as the id because the code is what every downstream
 * reader speaks — answers arrive keyed by question code, and the publish check
 * compares codes. `active` is carried rather than filtered on: a fact bound to a
 * deactivated question must render as broken, not as unbound, because those have
 * different fixes.
 */
export interface BoundQuestion {
  id: string;
  code: string;
  type: BindableQuestionType;
  labelAr: string;
  labelEn: string;
  active: boolean;
  /**
   * The question's ACTIVE options, in display order — the keys a bank's table for this
   * fact may carry. Empty for a NUMERIC fact (its table is bands over the answer).
   *
   * Carried on the member so the bank-program key-table editor can offer the rows
   * WITHOUT a second lookup, and — the point of FR-017 — so the keys it offers are the
   * same list the applicant picks from, by construction rather than by a mapping someone
   * has to keep in step.
   */
  options: Array<{ code: string; labelAr: string; labelEn: string }>;
  /**
   * The list the question's options are FILED UNDER, when they are enumeration rows that
   * carry a `parentKey` — the keys a `factParentTable` step is keyed by.
   *
   * Derived on read, never stored. A parent table crosses from the value the customer
   * picks (one of hundreds of compounds) to the short list the bank states figures against
   * (five classes), and the crossing is `platform_enumeration.parentKey` — a bare key with
   * no type beside it. So the only honest way to name the parent LIST is to walk it: take
   * the option codes, find the rows they are, read the parents those rows point at, and
   * label them from whichever list actually holds those keys.
   *
   * TWO sources, in order. When the option list declares an axis (`parentAxisType`), this is
   * EVERY live member of it — the full class list, including classes nothing is filed under
   * yet, because that is the list a bank must state a figure for. Only when no axis is
   * declared does it fall back to the walk described above, over the parents the options
   * happen to reference.
   *
   * `undefined` when neither answers — options that are not enumeration rows, or rows filed
   * under nothing. The editor then says the keys cannot be listed, rather than offering to
   * seed a row per key over an empty list, which is a button that does nothing.
   */
  parentOptions?: Array<{ code: string; labelAr: string; labelEn: string }>;
  /**
   * The operator-managed LIST this question's options come from — `compound` for
   * `compound_name`, `military_grade` for the grade question, and so on.
   *
   * DERIVED ON READ, never stored, and that is the design rather than a shortcut. The
   * source type is already stated twice — once as `optionsFromEnum` in the questionnaire
   * seed, once as the materialised `question_option` rows — and a third, stored copy
   * would be the one that drifts: an operator adding an option by hand through the
   * questionnaire screen would leave the column still claiming the list. It would also be
   * on the wrong row, since the QUESTION owns its options and a question bound by two
   * facts would carry the claim twice.
   *
   * Derived by coverage: the type whose active rows cover EVERY one of the question's
   * option codes. Coverage-of-all is the honest bar — a hand-authored question covers
   * nothing and correctly gets `undefined`, which the admin renders as "this fact reads
   * no operator-managed list" rather than as an empty list it could offer to edit.
   */
  optionsEnumerationType?: string;
  /**
   * The list `parentOptions` are members of — `compound_category` where the options are
   * compounds. Derived in the same pass, from the same walk.
   *
   * Separate from `optionsEnumerationType` because they answer different questions and a
   * caller needs both: a `factParentTable` step is keyed by the PARENT list while the
   * customer picks from the CHILD one, and a screen showing "the lists this product
   * reads" has to show both or the operator cannot file a new value.
   */
  parentEnumerationType?: string;
  /**
   * The parent AXIS declared by the list this question's options come from — read straight
   * off `enumeration_type_def.parentTypeKey`, not walked from the values.
   *
   * Distinct from `parentEnumerationType`, and the distinction is load-bearing. That one is
   * derived from DATA: the parents the options ACTUALLY reference. This one is derived from
   * the AXIS: what the list SAYS its values are filed under, whether or not any of them are
   * filed yet.
   *
   * Two states separate them, and both are states a screen must get right:
   *   · a list with a declared axis and nothing filed yet — the moment a product is being
   *     authored. Data-derived says "no classes", so a picker filtering on it would hide the
   *     class mechanism at exactly the moment the operator reached for it.
   *   · a list whose values sit in four of six classes. Data-derived says four, so the bank
   *     could never state a figure for the other two and "two classes have no row" would be
   *     unreachable for the classes that need it most.
   *
   * `undefined` when the options come from no recognised list, or from one filed under
   * nothing.
   */
  parentAxisType?: string;
  /**
   * The loan categories whose applicants are ASKED this question — the questionnaire's
   * own answer, read straight off `question_loan_category`.
   *
   * Carried here because it is the only honest source for "can a program in this
   * category be priced off this fact at all". The bank-program form used to ask a
   * catalog NAME instead (a per-name tick-list the operator had to keep in step by
   * hand, which no quote, publish check or save validation ever read); the question's
   * own assignment is the thing the engine actually depends on.
   */
  askedIn: LoanCategory[];
}

/**
 * One catalog name's suggested question sets — one per loan category, keyed by
 * it. `Partial` because an absent key and an empty array mean the same thing
 * here ("nothing suggested for this category"), unlike the category ASSIGNMENT
 * axis where an empty set is the meaningful "parked" state.
 */
export type QuestionCodesByCategory = Partial<Record<LoanCategory, string[]>>;

/**
 * One catalog name's income BASES, per loan category — how the name is MEANT to be
 * sold under each: against a payslip, without one, or both.
 *
 * `Partial` because a category the name is not assigned to has no basis at all; an
 * assigned category ALWAYS has at least one (the writers reject the empty set, which
 * would be a pair offerable under no basis).
 *
 * This states INTENT and is carried on the member for READING only: nothing in the
 * matching or bank-program write path consults it, so it can never refuse a program the
 * bank is entitled to save (v16.4.0's point, kept). What a bank actually did is counted
 * from `bank_program.programType` — see `ProgramNameUsage.byCategory`.
 */
export type IncomeBasesByCategory = Partial<Record<LoanCategory, IncomeBasis[]>>;

/** One catalog name's suggested question set for ONE loan category, by key. */
export interface EnumerationQuestionTemplate {
  key: string;
  labelAr: string;
  labelEn: string;
  /** The category the codes below were suggested for. */
  category: LoanCategory;
  /** Question CODES, in pool display order. Empty = not configured. */
  questionCodes: string[];
}

export interface EnumerationMember {
  type: EnumerationType;
  key: string;
  labelAr: string;
  labelEn: string;
  /** Optional single scoping parent key (generic; always null for the unscoped
   *  types above). */
  parentKey: string | null;
  active: boolean;
  deprecated: boolean;
  /** Loan categories this member may be offered under. Always `[]` outside
   *  `CATEGORISED_ENUMERATION_TYPES`; `[]` on a categorised type means parked. */
  categories: LoanCategory[];
  /**
   * `program_name` only — how the catalog says this name is MEANT to be sold under
   * each category it is assigned to: `['payslip']`, `['no_payslip']`, or both.
   *
   * READ-ONLY here. Nothing in the bank-program write path consults it and no picker
   * filters on it: the bank states the basis on its own program, and a stale value
   * here used to refuse a save the bank was entitled to make (v16.4.0). What banks
   * actually picked is counted separately (`ProgramNameUsage.byCategory`), and the
   * two are allowed to disagree.
   *
   * `undefined` means "not loaded" (a caller that did not `include` the relation) and
   * must never be read as "none".
   */
  incomeBases?: IncomeBasesByCategory;
  /**
   * On a `program_name` — the `surrogate_product` its calculation comes from.
   * On a `surrogate_fact` — the product that AUTHORED it.
   *
   * `null` on both is a real state and means neither. See the column's own doc in
   * `schema.prisma`; nothing gates on it, it is provenance an admin screen groups by.
   */
  surrogateProductKey?: string | null;
  /**
   * `surrogate_fact` only — the question whose answer IS this fact.
   *
   * `null` is a real, representable state, not a loading artefact: a fact can be
   * created before its question exists, and a bound question can be deleted out from
   * under it (`ON DELETE SET NULL`). Both read as "no bank can price this fact yet",
   * which the questionnaire's publish check reports and the bank-program form warns
   * on. `undefined` still means "not loaded".
   */
  boundQuestion?: BoundQuestion | null;
}

export abstract class PlatformEnumerationsRepository {
  /** Fail-closed health check. Returns false when the underlying store is unreachable. */
  abstract isAvailable(): Promise<boolean>;

  /**
   * Every KIND of list the registry knows, by key — including inactive ones.
   *
   * INACTIVE KINDS ARE INCLUDED, and that is the whole reason this returns a map rather than
   * a filtered list. `active` says whether a kind is OFFERED to an operator; it must not
   * decide whether an existing value still has a parent axis or is still undeletable, or
   * retiring a kind would quietly change how the rows already under it behave. Callers that
   * are building a picker filter on `active` themselves.
   *
   * CACHED, unlike `memberCategories` and `surrogateFactRegistry`. Those are uncached
   * because they back a rejection or a quote. This one backs neither: no figure is read from
   * it and no customer-facing answer depends on it, and it is consulted on nearly every
   * registry write. The write paths invalidate it, so an operator never sees their own edit
   * lag.
   */
  abstract typeDefinitions(): Promise<EnumerationTypeDefinitions>;

  /** Create a KIND. `key` is immutable thereafter — values carry the string. */
  abstract insertTypeDefinition(
    input: Omit<EnumerationTypeDefinition, 'active'> & { active?: boolean },
  ): Promise<EnumerationTypeDefinition>;

  /** Patch a KIND. `key` is deliberately absent: renaming would strand every value. */
  abstract updateTypeDefinition(
    key: string,
    patch: Partial<Omit<EnumerationTypeDefinition, 'key'>>,
  ): Promise<EnumerationTypeDefinition | null>;

  /** Remove a KIND. The caller has already proved nothing carries the string. */
  abstract deleteTypeDefinition(key: string): Promise<void>;

  /** How many `platform_enumeration` rows carry this type — the delete gate for a KIND. */
  abstract countRowsOfType(type: string): Promise<number>;

  /** True when key is BOTH present AND active for the given enumeration type. */
  abstract isActiveMember(type: string, key: string): Promise<boolean>;

  /** True when key is present BUT deprecated (FR-010c — show warning, do NOT auto-mutate programs). */
  abstract isDeprecatedMember(type: string, key: string): Promise<boolean>;

  /** Active members of a given type — used to populate tier-key pickers in the admin form. */
  abstract getActiveMembers(type: string): Promise<EnumerationMember[]>;

  /**
   * Loan categories a member may be offered under, by key. Empty = parked.
   *
   * Returns the LIST rather than a boolean because the only actionable error a
   * caller can raise ("this name is offered under Personal and Car, not
   * Mortgage") needs the set, and re-reading it would be a second round-trip.
   *
   * Uncached by contract — this backs a write-time rejection, and a 60s window
   * in which an unassigned pair still saves is a correctness bug, not a stale
   * picker.
   */
  abstract memberCategories(type: string, key: string): Promise<LoanCategory[]>;

  /**
   * A catalog name's SUGGESTED question set for ONE loan category, by key.
   * `null` when the key names nothing — a legacy bank program whose
   * `programNameKey` predates the catalog.
   *
   * The category is a required argument, not an optional filter over a flat set:
   * the caller is always a bank program, which always has a `productCategory`,
   * and a default that merged every category's suggestions would hand the wizard
   * questions the applicant is never asked.
   *
   * Uncached, like `memberCategories` — but for the opposite reason. That one is
   * uncached because it backs a rejection. This one is uncached because it costs
   * one indexed read per scoring-wizard open, and a template lagging the catalog
   * by 60s would have an admin edit a name and then not see their own edit.
   *
   * Deliberately NOT folded into `EnumerationMember`: that payload is cached for
   * 60s and served to the mobile controller and the bank-program picker, neither
   * of which wants it.
   */
  abstract memberQuestionTemplate(
    type: EnumerationType,
    key: string,
    category: LoanCategory,
  ): Promise<EnumerationQuestionTemplate | null>;

  /**
   * The surrogate income FACT registry — every ACTIVE fact with a resolvable bound
   * question, as the engine needs it.
   *
   * Narrower than `getActiveMembers('surrogate_fact')` on purpose. That returns what
   * the ADMIN must see, including the facts that are broken (unbound question, question
   * deactivated) because those are the ones needing a fix. This returns what can
   * actually be READ off an applicant, so the answer-to-fact mapping cannot silently
   * produce a fact no question fills.
   *
   * Uncached by contract, like `memberCategories`: it feeds a quote, and a 60s window
   * in which a repointed fact still resolves against the old question is a wrong
   * income, not a stale picker.
   */
  abstract surrogateFactRegistry(): Promise<SurrogateFactBinding[]>;

  /**
   * The option codes one SINGLE_SELECT question offers, in display order.
   *
   * Here rather than in the questionnaire repository because the only caller is the
   * income-rule validator, reached from bank-programs, which already depends on this
   * module and does not depend on the questionnaire — and because the question is
   * asked ABOUT a fact ("what keys may this fact's table use?"), which is this
   * registry's business. Options of a non-select question, or of no question at all,
   * are the empty list: every table row is then unknown, which is the correct
   * rejection rather than a silent pass.
   */
  abstract questionOptionCodes(questionCode: string): Promise<string[]>;

  /**
   * Every catalog program name's income rule, keyed by the name's `key`.
   *
   * The catalog name states the ONE income proof and the figures a bank starts from;
   * a program on `amounts: 'catalog'` is quoted off exactly this. Returned as a map
   * because the caller merges it across the whole active book in one pass
   * (`toBankProgramSnapshot`), and a per-program lookup would be a query per program
   * on the apply path.
   *
   * Names with no rule are ABSENT from the map rather than present-and-empty: "nobody
   * has decided" and "an operator decided `declared`" are different answers, and the
   * second one is a stored `{"strategy":"declared"}` that must come back as such.
   *
   * An entry is a RESOLUTION and not a rule, because one of the answers is "the platform
   * is withholding it": a name whose linked surrogate product is switched off resolves to
   * a `withheld` marker, which the quote refuses on. Spelling that as an absent rule
   * instead would let a single-fact product quote off the applicant's declared payslip.
   *
   * Uncached by contract, like `surrogateFactRegistry`: it feeds a quote. A 60s window
   * in which an edited table still quotes the old figure is a wrong loan amount, not a
   * stale picker. It is also what makes switching a product off take effect on the very
   * next quote rather than up to a minute later.
   */
  abstract programNameIncomeRules(): Promise<CatalogIncomeRules>;

  /**
   * Every ACTIVE registry value that is filed under a parent, as `key → parentKey`.
   *
   * Feeds a product rule's `factParentTable` step: the customer picks a compound by NAME
   * and the bank keys its cap table by the five compound CATEGORIES, so something has to
   * carry the value to its parent. `parentKey` already is that column — the registry's
   * generic single-parent scope — so this adds no schema and no second list to maintain.
   *
   * ONE flat map, not one per lookup type. A rule names the FACT, the fact's bound question
   * supplies the option codes, and those codes ARE registry keys; a value is only ever
   * looked up when a rule asked for its parent, so a same-key collision across two types
   * cannot reach a rule that named neither.
   *
   * Uncached by contract, like `surrogateFactRegistry` and `programNameIncomeRules`: it
   * feeds a quote, and a 60s window in which a recategorised compound still prices against
   * its old category is a wrong loan amount frozen onto an offer, not a stale picker.
   */
  abstract enumerationParentKeys(): Promise<Readonly<Record<string, string>>>;

  /**
   * One catalog program name, with the two fields its income rule needs.
   *
   * By KEY, not by id: the key is what a bank program stores, what the URL carries and
   * what an operator recognises. `null` when the name does not exist or is not a
   * `program_name` — the caller turns that into `PROGRAM_NAME_KEY_UNKNOWN` rather than
   * writing a rule onto a row of some other type.
   */
  abstract findProgramName(key: string): Promise<ProgramNameIncomeRuleRow | null>;

  /**
   * Write (or clear, with `null`) a program name's income rule and the estimate
   * markers that address its figures.
   *
   * Both in one call because they describe the same numbers: a save that replaced the
   * table but kept the old markers would leave `incomeRule.bands.3.incomeEGP` pointing
   * at a band that no longer exists, and the marker map is what the activation gate
   * reads.
   */
  abstract setProgramNameIncomeRule(
    key: string,
    rule: IncomeAssumptionConfig | null,
    valueSources: Record<string, 'team_estimated'>,
    updatedBy: string,
  ): Promise<ProgramNameIncomeRuleRow>;

  /**
   * The surrogate programs filed under a name, with the proof each reads and whether
   * its figures are its own.
   *
   * Backs two refusals on the catalog write, so it is UNCACHED: changing a name's proof
   * while banks read it (`INCOME_PROOF_IN_USE`), and clearing a rule that programs still
   * inherit. A stale answer here lets a live program lose its table.
   */
  abstract programsUnderName(key: string): Promise<ProgramUnderName[]>;

  /**
   * What a set of catalog names is CALLED, in both locales, keyed by name key.
   *
   * One query for the whole set, not one per name: the caller already fans out per name to
   * read the programmes under it, and a second N round trips to fetch two strings each is
   * latency nobody sees a reason for on a page load.
   *
   * Deliberately NOT filtered to active rows. A deprecated name that is still linked is
   * still quoting through the product, which is the reasoning `catalog-board.ts` already
   * writes out for resolving names from every row including deprecated ones — withholding
   * its label here would render it as a bare key and read as broken.
   *
   * A key with no row at all is simply absent from the map rather than mapped to a blank:
   * the caller renders the key itself, which is the only honest thing to show for a link
   * pointing at something that is not there (the state `orphanNameKeys` reports).
   */
  abstract programNameLabels(
    keys: readonly string[],
  ): Promise<Map<string, { labelEn: string; labelAr: string }>>;

  /**
   * Re-file many members onto a parent in ONE transaction.
   *
   * One call rather than N patches because a bulk mistake is N rows: half-applied, the
   * registry has some values reading one bank figure and some another, and the only record of
   * how far it got is the audit trail. Returns the rows whose parent actually MOVED, so the
   * caller audits a change per change rather than per request.
   */
  abstract setParentKeysBulk(
    assignments: readonly { id: string; parentKey: string | null }[],
  ): Promise<ParentKeyMove[]>;

  /**
   * How many members of `childType` are filed under `parentKey`.
   *
   * Backs the refusal to retire a parent that still has children. Counts NON-DEPRECATED
   * children only: a deprecated value can never be offered again, so it cannot carry an
   * applicant to a cap row that no longer exists, while a merely deactivated one can be
   * switched back on.
   */
  abstract countChildren(childType: string, parentKey: string): Promise<number>;

  /**
   * The catalog program names taking their calculation from `productKey`.
   *
   * Named rather than counted: the refusal it backs (`SURROGATE_PRODUCT_IN_USE`) has to
   * tell the operator which names to move, and they are on a different screen from the
   * product being retired.
   */
  abstract programNamesLinkedTo(productKey: string): Promise<string[]>;

  /** One surrogate product's own row, carrying the calculation every linked name quotes off. */
  abstract findSurrogateProduct(key: string): Promise<ProgramNameIncomeRuleRow | null>;

  /**
   * Write a surrogate product's calculation, and — in the SAME statement — the form it was
   * compiled from.
   *
   * `template` has three spellings and they are three different intentions:
   *   `undefined`  leave the stored form alone (a figures-only write)
   *   `null`       clear it — this calculation was authored by hand, so there is no form
   *   an object    the form the operator just filled in
   *
   * One `update`, so the rule and the form it claims to be compiled from cannot land apart.
   */
  abstract setSurrogateProductIncomeRule(
    key: string,
    rule: IncomeAssumptionConfig | null,
    valueSources: Record<string, 'team_estimated'>,
    updatedBy: string,
    template?: ProductTemplate | null,
  ): Promise<ProgramNameIncomeRuleRow>;

  /**
   * Which `stepParams` boxes each bank program under this product has actually typed into.
   *
   * Backs the one refusal that protects live figures: recompiling a changed form can stop
   * emitting a step, and every number filed under that id is then orphaned — the program
   * still reads as configured and quotes nothing. Two hops, product -> names -> programs,
   * because a product is read through the names linked to it.
   *
   * Only keys carrying a FIGURE count. An empty params entry is a box nobody filled in, and
   * refusing a save over one would block the operator on nothing.
   */
  abstract programFigureKeysUnderProduct(
    productKey: string,
  ): Promise<Array<{ programCode: string; keys: string[] }>>;

  /**
   * Every surrogate product, active or not.
   *
   * Inactive ones are FLAGGED, not filtered: a name linked to a retired product must
   * still render as linked to something. Callers offering a CHOICE filter to active.
   */
  abstract listSurrogateProducts(): Promise<SurrogateProductListRow[]>;
}

/**
 * A row that CARRIES an income rule, as the rule endpoints read it — a catalog program
 * name or a surrogate product. One shape for both, because they hold the same columns:
 * the archetype and the name that links to it store the calculation identically, which is
 * what lets the migration move it between them by copying.
 */
export interface ProgramNameIncomeRuleRow {
  id: string;
  key: string;
  labelAr: string;
  labelEn: string;
  incomeRule: IncomeAssumptionConfig | null;
  /**
   * `surrogate_product` only — the friendly form `incomeRule` was compiled from.
   *
   * `null` is the ADVANCED state, not an empty one: this calculation was authored through
   * the raw step editor and there is no form that describes it.
   */
  templateSpec: ProductTemplate | null;
  valueSources: Record<string, 'team_estimated'>;
  /**
   * `program_name` only — the product this name takes its calculation from.
   *
   * `null` on a surrogate product's own row by construction: a product IS the source, so
   * it cannot link to one. Load-bearing on a name: `incomeRule` is NULL both when nobody
   * has decided and when the name is LINKED, and this column is the only thing that tells
   * those apart.
   */
  surrogateProductKey: string | null;
}

/** One member whose parent actually changed — what a bulk re-file audits. */
export interface ParentKeyMove {
  id: string;
  type: string;
  key: string;
  from: string | null;
  /** `null` when the value was UNFILED — an operator saying it is priced nowhere. */
  to: string | null;
}

/**
 * One surrogate product as the library list reads it.
 *
 * Carries the rule and the linked names so the list needs no follow-up query per row — the
 * page shows both for every product, and asking per row was 2N+1 round trips.
 */
export interface SurrogateProductListRow {
  key: string;
  labelAr: string;
  labelEn: string;
  active: boolean;
  sortOrder: number;
  incomeRule: IncomeAssumptionConfig | null;
  /**
   * The friendly form behind it, when there is one.
   *
   * Carried so the list can say what SHAPE each product is — every pipeline product reads as
   * the same generic sentence otherwise, which is how two products that are really one read
   * as duplicates of each other. `null` for a hand-built calculation, which has no form.
   */
  templateSpec: ProductTemplate | null;
  /** Catalog names taking their calculation from it. Empty = nothing sells it yet. */
  usedBy: string[];
}

/** One surrogate bank program filed under a catalog name. */
export interface ProgramUnderName {
  programCode: string;
  /**
   * What the bank calls it, in both locales, and who the bank is.
   *
   * Carried because a CODE is not an identity an operator holds. One product is deliberately
   * sold as several programmes off one mechanism — ABK files both `ABK-PER-DOCTORS_CLINIC`
   * (30,000-300,000, capped by city tier) and `ABK-PER-DOCTORS_PRACTICE` (half that, no cap)
   * under the one doctors name — and a screen printing only the codes says nothing about
   * which is which. `friendlyNameAr` is nullable on the column, so it is nullable here; the
   * reader falls back rather than the writer inventing one.
   */
  friendlyName: string;
  friendlyNameAr: string | null;
  /**
   * The bank, in both locales. Both, not one: `Bank` stores `nameEnglish` and `nameArabic`
   * and the caller renders whichever locale the operator is reading, exactly as every other
   * surface does (Principle III / A2).
   *
   * `bankId` is nullable and most rows on a real database do not carry one, so the English
   * side falls back to the deprecated denormalised `bank_program.bankName`. `bankNameAr` has
   * no such fallback — that column holds one untranslated string — so an Arabic reader gets
   * the English name rather than a blank, resolved by the caller.
   */
  bankNameEn: string | null;
  bankNameAr: string | null;
  /** The proof it reads — `IncomeAssumptionConfig['strategy']`, normalized. */
  strategy: string;
  /** `false` when it takes the catalog's figures. */
  ownAmounts: boolean;
}
