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
   * The COLLATERAL products' lists (the compound-ownership guarantee).
   *
   * A `compound` row's `parentKey` names its class, and that is load-bearing rather than
   * decorative: a bank keys its cap table by the five CLASSES while the customer picks one of
   * hundreds of compounds by NAME, and `factParentTable` walks one to the other. It is also
   * why `compound` is NOT in `UNSCOPED_ENUMERATION_TYPES` — force-nulling the parent there
   * would silently disconnect every compound from the table that prices it.
   */
  | 'compound_category'
  | 'compound';

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

/** True when members of `type` carry no scoping parent (see above). */
export function isUnscopedEnumerationType(type: string): boolean {
  return (UNSCOPED_ENUMERATION_TYPES as readonly string[]).includes(type);
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

  /** True when key is BOTH present AND active for the given enumeration type. */
  abstract isActiveMember(type: EnumerationType, key: string): Promise<boolean>;

  /** True when key is present BUT deprecated (FR-010c — show warning, do NOT auto-mutate programs). */
  abstract isDeprecatedMember(type: EnumerationType, key: string): Promise<boolean>;

  /** Active members of a given type — used to populate tier-key pickers in the admin form. */
  abstract getActiveMembers(type: EnumerationType): Promise<EnumerationMember[]>;

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
  abstract memberCategories(type: EnumerationType, key: string): Promise<LoanCategory[]>;

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
   * Uncached by contract, like `surrogateFactRegistry`: it feeds a quote. A 60s window
   * in which an edited table still quotes the old figure is a wrong loan amount, not a
   * stale picker.
   */
  abstract programNameIncomeRules(): Promise<ReadonlyMap<string, IncomeAssumptionConfig>>;

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
}

/** A catalog program name as the income-rule endpoints read it. */
export interface ProgramNameIncomeRuleRow {
  id: string;
  key: string;
  labelAr: string;
  labelEn: string;
  incomeRule: IncomeAssumptionConfig | null;
  valueSources: Record<string, 'team_estimated'>;
}

/** One surrogate bank program filed under a catalog name. */
export interface ProgramUnderName {
  programCode: string;
  /** The proof it reads — `IncomeAssumptionConfig['strategy']`, normalized. */
  strategy: string;
  /** `false` when it takes the catalog's figures. */
  ownAmounts: boolean;
}
