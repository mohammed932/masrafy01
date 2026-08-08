/**
 * Read-only consumer interface for the platform enumeration registry.
 * Feature 002 (this feature) consumes via an in-memory stub.
 * Feature 003 (planned) replaces the stub behind THIS interface — DI swap, zero call-site changes.
 *
 * Spec anchors: FR-010, FR-010a, FR-010b, FR-010c. Research R4.
 */

import type { LoanCategory } from '@prisma/client';

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
 * One catalog name's suggested question sets — one per loan category, keyed by
 * it. `Partial` because an absent key and an empty array mean the same thing
 * here ("nothing suggested for this category"), unlike the category ASSIGNMENT
 * axis where an empty set is the meaningful "parked" state.
 */
export type QuestionCodesByCategory = Partial<Record<LoanCategory, string[]>>;

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
}
