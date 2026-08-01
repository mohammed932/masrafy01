/**
 * Read-only consumer interface for the platform enumeration registry.
 * Feature 002 (this feature) consumes via an in-memory stub.
 * Feature 003 (planned) replaces the stub behind THIS interface — DI swap, zero call-site changes.
 *
 * Spec anchors: FR-010, FR-010a, FR-010b, FR-010c. Research R4.
 */

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
  | 'currency'
  | 'governorate'
  | 'program_name';

export interface EnumerationMember {
  type: EnumerationType;
  key: string;
  labelAr: string;
  labelEn: string;
  /** Optional single scoping parent key (generic; unused by `program_name` — see `categories`). */
  parentKey: string | null;
  /** Multi-category scoping for `program_name` members (e.g. `['personal','car']`); empty otherwise. */
  categories: string[];
  /**
   * Feature 010 (FR-001): per-category lending defaults for `program_name` members,
   * shape `{ "<loanCategory>": <partial program> }`. Empty `{}` for every other type.
   * PREFILL ONLY — copied into the program on save (FR-009), never read at match time (FR-021b).
   */
  defaults: Record<string, unknown>;
  active: boolean;
  deprecated: boolean;
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
   * Single member lookup regardless of active/deprecated state (feature 010).
   * The prefill service needs one member's `categories` + `defaults` without
   * pulling the whole type. Returns `null` when the key is unknown.
   */
  abstract findMember(type: EnumerationType, key: string): Promise<EnumerationMember | null>;
}
