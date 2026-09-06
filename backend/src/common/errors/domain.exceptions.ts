import { HttpException } from '@nestjs/common';
import { ERROR_CODES, ERROR_HTTP_STATUS, type ErrorCode } from './error-codes';

/**
 * Carries a typed `code` and optional structured `meta`.
 * The HTTP exception filter serializes both into the response envelope.
 * Never put English message strings here destined for the client.
 */
export class DomainException extends HttpException {
  public readonly code: ErrorCode;
  public readonly meta?: Record<string, unknown>;

  constructor(code: ErrorCode, meta?: Record<string, unknown>) {
    super({ success: false, code, ...(meta ? { meta } : {}) }, ERROR_HTTP_STATUS[code]);
    this.code = code;
    this.meta = meta;
  }
}

// --- Convenience subclasses -------------------------------------------------

export class AuthInvalidCredentialsException extends DomainException {
  constructor() {
    super(ERROR_CODES.AUTH_INVALID_CREDENTIALS);
  }
}

export class AuthAccountInactiveException extends DomainException {
  constructor() {
    super(ERROR_CODES.AUTH_ACCOUNT_INACTIVE);
  }
}

export class AuthRefreshInvalidException extends DomainException {
  constructor() {
    super(ERROR_CODES.AUTH_REFRESH_INVALID);
  }
}

export class MustChangePasswordException extends DomainException {
  constructor() {
    super(ERROR_CODES.MUST_CHANGE_PASSWORD);
  }
}

export class InvalidCurrentPasswordException extends DomainException {
  constructor() {
    super(ERROR_CODES.INVALID_CURRENT_PASSWORD);
  }
}

export class PasswordTooShortException extends DomainException {
  constructor(min = 12) {
    super(ERROR_CODES.PASSWORD_TOO_SHORT, { min });
  }
}

export class PasswordTooLongException extends DomainException {
  constructor(max = 128) {
    super(ERROR_CODES.PASSWORD_TOO_LONG, { max });
  }
}

export class PasswordBreachedException extends DomainException {
  constructor() {
    super(ERROR_CODES.PASSWORD_BREACHED);
  }
}

export class PasswordOnCommonListException extends DomainException {
  constructor() {
    super(ERROR_CODES.PASSWORD_ON_COMMON_LIST);
  }
}

export class PasswordBreachCheckUnavailableException extends DomainException {
  constructor() {
    super(ERROR_CODES.PASSWORD_BREACH_CHECK_UNAVAILABLE);
  }
}

export class PasswordReusesResetValueException extends DomainException {
  constructor() {
    super(ERROR_CODES.PASSWORD_REUSES_RESET_VALUE);
  }
}

export class DuplicateEntryException extends DomainException {
  constructor(field: string) {
    super(ERROR_CODES.DUPLICATE_ENTRY, { field });
  }
}

export class NotFoundException extends DomainException {
  constructor() {
    super(ERROR_CODES.NOT_FOUND);
  }
}

export class CannotSelfModifyException extends DomainException {
  constructor() {
    super(ERROR_CODES.CANNOT_SELF_MODIFY);
  }
}

export class SuperAdminFloorViolatedException extends DomainException {
  constructor() {
    super(ERROR_CODES.SUPER_ADMIN_FLOOR_VIOLATED);
  }
}

export class ForbiddenException extends DomainException {
  constructor() {
    super(ERROR_CODES.FORBIDDEN);
  }
}

export class RateLimitedException extends DomainException {
  constructor() {
    super(ERROR_CODES.RATE_LIMITED);
  }
}

// --- Bank programs (feature 002) -------------------------------------------

export class BankProgramNotFoundException extends DomainException {
  constructor(meta?: { programCode?: string; id?: string }) {
    super(ERROR_CODES.BANK_PROGRAM_NOT_FOUND, meta);
  }
}

export class ProgramCodeAlreadyInUseException extends DomainException {
  constructor(programCode: string) {
    super(ERROR_CODES.PROGRAM_CODE_ALREADY_IN_USE, { programCode });
  }
}

export class InvalidVariableRateConfigurationException extends DomainException {
  constructor(field: 'currentEffectiveRate' | 'baseRate', reason: string) {
    super(ERROR_CODES.INVALID_VARIABLE_RATE_CONFIGURATION, { field, reason });
  }
}

export class InvalidQualitativeReviewCeilingException extends DomainException {
  constructor() {
    super(ERROR_CODES.INVALID_QUALITATIVE_REVIEW_CEILING, { field: 'qualitativeReviewMaxEGP' });
  }
}

export class QualitativeReviewCeilingBelowBaseException extends DomainException {
  constructor(meta: { qualitativeReviewMaxEGP: string; maxEGP: string }) {
    super(ERROR_CODES.QUALITATIVE_REVIEW_CEILING_BELOW_BASE, meta);
  }
}

export class DerivationArithmeticMismatchException extends DomainException {
  constructor(meta: {
    fieldPath: string;
    value: string;
    sourceRatePercent: string;
    deltaPercent: string;
  }) {
    super(ERROR_CODES.DERIVATION_ARITHMETIC_MISMATCH, meta);
  }
}

export class ConflictStaleDataException extends DomainException {
  constructor(meta: { submittedVersion: number; currentVersion: number }) {
    super(ERROR_CODES.CONFLICT_STALE_DATA, meta);
  }
}

export class BankProgramHasOffersException extends DomainException {
  constructor(meta: { programCode: string; offerCount: number }) {
    super(ERROR_CODES.BANK_PROGRAM_HAS_OFFERS, meta);
  }
}

// --- Banks (feature 007) ---------------------------------------------------

export class BankNotFoundException extends DomainException {
  constructor(meta?: { id?: string; code?: string }) {
    super(ERROR_CODES.BANK_NOT_FOUND, meta);
  }
}

export class BankNameDuplicateException extends DomainException {
  constructor(nameEnglish: string) {
    super(ERROR_CODES.BANK_NAME_DUPLICATE, { nameEnglish });
  }
}

export class BankHasProgramsException extends DomainException {
  constructor(meta: { bankId: string; programCount: number }) {
    super(ERROR_CODES.BANK_HAS_PROGRAMS, meta);
  }
}

export class BankConflictStaleDataException extends DomainException {
  constructor(meta: { submittedVersion: number; currentVersion: number }) {
    super(ERROR_CODES.BANK_CONFLICT_STALE_DATA, meta);
  }
}

export class UnknownEnumerationKeyException extends DomainException {
  constructor(meta: { enumerationType: string; offendingKey: string; activeMembers: string[] }) {
    super(ERROR_CODES.UNKNOWN_ENUMERATION_KEY, meta);
  }
}

export class DeprecatedEnumerationKeyException extends DomainException {
  constructor(meta: { enumerationType: string; deprecatedKey: string }) {
    super(ERROR_CODES.DEPRECATED_ENUMERATION_KEY, meta);
  }
}

export class SurrogateProductRequiredException extends DomainException {
  constructor(meta: {
    type: string;
    key: string;
    category?: string;
    activeProducts: readonly string[];
  }) {
    super(ERROR_CODES.SURROGATE_PRODUCT_REQUIRED, meta);
  }
}

export class ProgramNameRuleLinkedException extends DomainException {
  constructor(meta: { programNameKey: string; surrogateProductKey: string }) {
    super(ERROR_CODES.PROGRAM_NAME_RULE_LINKED, meta);
  }
}

export class SurrogateProductInUseException extends DomainException {
  /**
   * `names` says WHICH to move; `count` is what the message interpolates.
   *
   * Both, deliberately. `String(['a','b'])` renders "a,b" where the sentence reads as a
   * number — in Arabic that lands between an existential and a singular counted noun and
   * is simply broken. The list still travels for the screen and the log.
   */
  constructor(meta: { key: string; names: readonly string[]; programCodes?: readonly string[] }) {
    super(ERROR_CODES.SURROGATE_PRODUCT_IN_USE, { ...meta, count: meta.names.length });
  }
}

export class ProgramNameHasOwnRuleException extends DomainException {
  constructor(meta: { type: string; key: string; strategy: string | null }) {
    super(ERROR_CODES.PROGRAM_NAME_HAS_OWN_RULE, meta);
  }
}

export class SurrogateProductNotFoundException extends DomainException {
  constructor(meta: { key: string; activeKeys: readonly string[] }) {
    super(ERROR_CODES.SURROGATE_PRODUCT_NOT_FOUND, meta);
  }
}

/**
 * A catalog program name was linked to a product that works out no income.
 *
 * `linkableProducts` is what WOULD have worked — the live products that hold a
 * calculation — the same shape `SurrogateProductRequiredException` carries, because it is
 * the same select on the same drawer and the same fix.
 */
/** A value of a kind only the predefined-product library may create. */
export class EnumerationCreateNotApplicableException extends DomainException {
  constructor(meta: { type: string }) {
    super(ERROR_CODES.ENUMERATION_CREATE_NOT_APPLICABLE, meta);
  }
}

export class SurrogateProductCapOnlyException extends DomainException {
  constructor(meta: {
    type: string;
    key: string;
    surrogateProductKey: string;
    linkableProducts: readonly string[];
  }) {
    super(ERROR_CODES.SURROGATE_PRODUCT_CAP_ONLY, meta);
  }
}

export class EnumerationRegistryUnavailableException extends DomainException {
  constructor() {
    super(ERROR_CODES.ENUMERATION_REGISTRY_UNAVAILABLE);
  }
}

export class SeedRateVerificationFailedException extends DomainException {
  constructor(meta: {
    catalogName: string;
    mismatches: Array<{ programCode: string; expected: string; actual: string }>;
  }) {
    super(ERROR_CODES.SEED_RATE_VERIFICATION_FAILED, meta);
  }
}

export class SeedRequiresSuperAdminException extends DomainException {
  constructor(endpoint: string) {
    super(ERROR_CODES.SEED_REQUIRES_SUPER_ADMIN, { endpoint });
  }
}

// --- Matching engine (feature 003) -----------------------------------------

export class NoMatchingProgramsException extends DomainException {
  constructor(meta: { primaryReason: string; details: unknown[]; suggestions: unknown[] }) {
    super(ERROR_CODES.NO_MATCHING_PROGRAMS, meta);
  }
}

export class MatchingEngineErrorException extends DomainException {
  constructor(meta: { correlationId: string }) {
    super(ERROR_CODES.MATCHING_ENGINE_ERROR, meta);
  }
}

export class IdempotencyKeyMismatchException extends DomainException {
  constructor(meta: { idempotencyKey: string }) {
    super(ERROR_CODES.IDEMPOTENCY_KEY_MISMATCH, meta);
  }
}

export class UnauthenticatedException extends DomainException {
  constructor() {
    super(ERROR_CODES.UNAUTHENTICATED);
  }
}

// --- Mobile rate limiting --------------------------------------------------

export class RateLimitedBucketException extends DomainException {
  constructor(bucket: 'customer' | 'applicant_fingerprint', retryAfterSeconds: number) {
    super(ERROR_CODES.RATE_LIMITED, { bucket, retryAfterSeconds });
  }
}

// --- Platform enumerations (feature 006) -----------------------------------

export class EnumerationKeyDuplicateException extends DomainException {
  constructor(meta: { type: string; key: string }) {
    super(ERROR_CODES.ENUMERATION_KEY_DUPLICATE, meta);
  }
}

export class EnumerationSystemOnlyException extends DomainException {
  constructor(meta: { type: string; key: string }) {
    super(ERROR_CODES.ENUMERATION_SYSTEM_ONLY, meta);
  }
}

/**
 * An income basis was submitted for a (name, category) pair that does not exist —
 * the name is not offered under that loan type.
 *
 * 422 rather than 404: the name and the category both exist, it is their PAIRING
 * that does not, and a 404 would read as "this catalog entry is gone".
 */
export class EnumerationCategoryNotAssignedException extends DomainException {
  constructor(meta: { type: string; key: string; category: string }) {
    super(ERROR_CODES.ENUMERATION_CATEGORY_NOT_ASSIGNED, meta);
  }
}

/**
 * Loan categories were submitted for an enumeration type that has no such axis
 * (only `CATEGORISED_ENUMERATION_TYPES` do). 422 rather than 404: the row
 * exists, the request is well-formed, the content is meaningless for it.
 */
export class EnumerationCategoriesNotApplicableException extends DomainException {
  constructor(meta: { type: string }) {
    super(ERROR_CODES.ENUMERATION_CATEGORIES_NOT_APPLICABLE, meta);
  }
}

// NOTE (v25.0.0): `EnumerationQuestionsNotApplicableException` was deleted with the
// catalog question TEMPLATE. It refused a suggested question set on a type carrying no
// such axis, and no type carries one now — the rule ceased to exist, so the code went
// with it rather than being retired (see `error-codes.ts`).

/** A question binding was submitted for a type that binds none (only facts do). */
export class EnumerationQuestionBindingNotApplicableException extends DomainException {
  constructor(meta: { type: string }) {
    super(ERROR_CODES.ENUMERATION_QUESTION_BINDING_NOT_APPLICABLE, meta);
  }
}

/**
 * A fact was pointed at a TEXT or MULTI_SELECT question — nothing a bank's table can
 * be keyed by. `allowed` rides along so the screen can say what would work.
 */
export class SurrogateFactQuestionTypeInvalidException extends DomainException {
  /**
   * `key` is OPTIONAL because the other caller has no fact key to name: an operator
   * ticking a question on a product's step ① is refused BEFORE any row is minted, and a
   * fabricated key in the meta would be worse than an absent one — it would name a row
   * that does not exist and never will.
   */
  constructor(meta: { key?: string; questionCode: string; type: string; allowed: string[] }) {
    super(ERROR_CODES.SURROGATE_FACT_QUESTION_TYPE_INVALID, meta);
  }
}

/**
 * Two facts already answer the ticked question, so which key the product's rule should
 * name has no single answer. `factKeys` names them so the operator can retire the spare.
 */
export class SurrogateFactAmbiguousForQuestionException extends DomainException {
  constructor(meta: { questionCode: string; factKeys: string[] }) {
    super(ERROR_CODES.SURROGATE_FACT_AMBIGUOUS_FOR_QUESTION, meta);
  }
}

/**
 * The key a tick would mint is held by a fact bound to another question. Never suffixed
 * into `<key>_2`: stored rules name a fact key, and bank figures are filed under it.
 */
export class SurrogateFactKeyTakenException extends DomainException {
  constructor(meta: { questionCode: string; factKey: string; boundQuestionCode: string | null }) {
    super(ERROR_CODES.SURROGATE_FACT_KEY_TAKEN, meta);
  }
}

/**
 * The key a tick would mint belongs to a fact the platform computes for itself — a derived
 * per-bank axis, or `i_score`. A row under one would read as configured and carry nothing.
 */
export class SurrogateFactKeyReservedException extends DomainException {
  constructor(meta: { factKey: string; questionCode: string; reservedKeys: string[] }) {
    super(ERROR_CODES.SURROGATE_FACT_KEY_RESERVED, meta);
  }
}

/** The ticked question is retired or parked, so a fact bound to it would answer nobody. */
export class SurrogateFactQuestionInactiveException extends DomainException {
  constructor(meta: { questionCode: string }) {
    super(ERROR_CODES.SURROGATE_FACT_QUESTION_INACTIVE, meta);
  }
}

/**
 * RETIRED, RETAINED. Thrown by nothing since every pool question became tickable: the six
 * domain refusals this carried (the declared salary and the other money bindings, the
 * itemised debts, the derived bank axes, the debt-types multi-pick) were removed on the
 * operator's call. Kept because it has shipped and the code is still in both locale
 * dictionaries, which a parity check reads in both directions.
 */
export class SurrogateFactQuestionNotEligibleException extends DomainException {
  constructor(meta: { questionCode: string; reason: string }) {
    super(ERROR_CODES.SURROGATE_FACT_QUESTION_NOT_ELIGIBLE, meta);
  }
}

/**
 * Ticking would start asking a REQUIRED question of a loan type that does not ask it yet,
 * which refuses every application in that loan type until the new snapshot is published.
 */
export class SurrogateFactWidenRequiredException extends DomainException {
  constructor(meta: { questionCode: string; categories: string[] }) {
    super(ERROR_CODES.SURROGATE_FACT_WIDEN_REQUIRED, meta);
  }
}

/**
 * RETIRED BUT RETAINED. An ask the predefined library owns used to be unremovable here, on
 * the reasoning that `npm run seed:blueprints` would put it back. The removal is durable
 * now — `surrogate_product_ask.detachedAt` is the tombstone the seed's insert collides with
 * — so nothing throws this. The code has shipped and the backend/dictionary parity check is
 * bidirectional, so it stays declared and translated.
 */
export class ProductAskBlueprintOwnedException extends DomainException {
  constructor(meta: { productKey: string; factKey: string }) {
    super(ERROR_CODES.PRODUCT_ASK_BLUEPRINT_OWNED, meta);
  }
}

/** The product's own calculation still reads the fact being unticked. */
export class ProductAskReadByOwnRuleException extends DomainException {
  constructor(meta: { productKey: string; factKey: string; stepIds: string[] }) {
    super(ERROR_CODES.PRODUCT_ASK_READ_BY_OWN_RULE, meta);
  }
}

/**
 * A hard delete was refused: something still names this registry key.
 *
 * The per-surface breakdown rides in the meta alongside the total, and it is
 * needed — a value with no live bank programs but 40 stored applications behind
 * it is still undeletable, and an operator told only "in use" would go repoint
 * the programs and try again for nothing.
 */
export class EnumerationInUseException extends DomainException {
  constructor(meta: {
    type: string;
    key: string;
    /** Total across every surface — what the operator-facing message renders. */
    references: number;
    usedBy: Array<{ source: string; count: number }>;
  }) {
    super(ERROR_CODES.ENUMERATION_IN_USE, meta);
  }
}

/**
 * Hard delete was asked for on a type whose readers `countReferences` does not
 * enumerate, so nothing can prove the row is unused. 422, not 403: the caller is
 * not forbidden, the operation is meaningless for this row.
 */
export class EnumerationDeleteNotSupportedException extends DomainException {
  constructor(meta: { type: string }) {
    super(ERROR_CODES.ENUMERATION_DELETE_NOT_SUPPORTED, meta);
  }
}

/**
 * A value of a filed-under type was created without naming its list.
 *
 * Refused rather than defaulted: the platform picking a class on the operator's behalf is
 * the platform stating a price tier, and a wrong guess quotes a real number to a real
 * applicant. `meta.parentType` names the list so the screen can offer it.
 */
export class EnumerationParentRequiredException extends DomainException {
  constructor(meta: { type: string; parentType: string }) {
    super(ERROR_CODES.ENUMERATION_PARENT_REQUIRED, meta);
  }
}

/**
 * The named parent is not a live member of the list this type is filed under.
 *
 * `meta.reason` discriminates missing / inactive / deprecated, and `activeKeys` says what
 * would have worked — one code with a reason beats three codes whose fix screen is identical.
 */
export class EnumerationParentUnknownException extends DomainException {
  constructor(meta: {
    type: string;
    parentType: string;
    parentKey: string;
    reason: 'missing' | 'inactive' | 'deprecated';
    activeKeys: string[];
  }) {
    super(ERROR_CODES.ENUMERATION_PARENT_UNKNOWN, meta);
  }
}

/** A parent was named for a type that is filed under nothing. */
export class EnumerationParentNotApplicableException extends DomainException {
  constructor(meta: { type: string }) {
    super(ERROR_CODES.ENUMERATION_PARENT_NOT_APPLICABLE, meta);
  }
}

/**
 * Retiring a list value while members are still filed under it.
 *
 * The engine's parent walk filters the CHILD's active flag and never the parent's, so a
 * retired class with children keeps pricing off a row the operator can no longer see or
 * re-select. A refusal they read beats a quote that silently goes on.
 */
export class EnumerationHasChildrenException extends DomainException {
  constructor(meta: { type: string; key: string; childType: string; children: number }) {
    super(ERROR_CODES.ENUMERATION_HAS_CHILDREN, meta);
  }
}

/**
 * A value could not go because the list IS a question's answers and two must remain.
 *
 * `remaining` is the count AFTER the refused write, so the operator reads how far short
 * they are rather than how many there are now.
 */
export class MirroredListMinValuesException extends DomainException {
  constructor(meta: {
    type: string;
    key: string;
    questionCode: string;
    remaining: number;
    minimum: number;
  }) {
    super(ERROR_CODES.MIRRORED_LIST_MIN_VALUES, meta);
  }
}

/** A KIND of list was created with a key another kind already holds. */
export class EnumerationTypeDuplicateException extends DomainException {
  constructor(meta: { key: string }) {
    super(ERROR_CODES.ENUMERATION_TYPE_DUPLICATE, meta);
  }
}

/** A KIND was patched or deleted by a key no definition row carries. */
export class EnumerationTypeNotFoundException extends DomainException {
  constructor(meta: { key: string }) {
    super(ERROR_CODES.ENUMERATION_TYPE_NOT_FOUND, meta);
  }
}

/**
 * Deleting a KIND was refused because values still carry its type.
 *
 * `values` rather than a list of keys: the operator is on the screen that shows them, and a
 * three-hundred-key `meta` would be unreadable in a toast where the count is the decision.
 */
export class EnumerationTypeInUseException extends DomainException {
  constructor(meta: { key: string; values: number }) {
    super(ERROR_CODES.ENUMERATION_TYPE_IN_USE, meta);
  }
}

/**
 * A KIND the code names by string was renamed or deleted.
 *
 * `attempted` says which of the two, because the operator's next move differs: a rename has
 * an alternative (relabel it, which IS allowed), a delete does not.
 */
export class EnumerationTypeSystemOnlyException extends DomainException {
  constructor(meta: {
    key: string;
    /**
     * `reconfigure` is every settings field a builtin does not own — the parent axis, the
     * active flag, the delete gate, the rail. It was reported as `rename`, which told the
     * operator to relabel instead: advice that is right for a key change and meaningless for
     * a re-parent. `fields` names what was refused.
     */
    attempted: 'rename' | 'delete' | 'reconfigure';
    fields?: readonly string[];
  }) {
    super(ERROR_CODES.ENUMERATION_TYPE_SYSTEM_ONLY, meta);
  }
}

/** A KIND could not be deleted because other kinds name it as their parent axis. */
export class EnumerationTypeIsParentAxisException extends DomainException {
  constructor(meta: { key: string; childTypes: readonly string[]; count: number }) {
    super(ERROR_CODES.ENUMERATION_TYPE_IS_PARENT_AXIS, meta);
  }
}

/** A KIND was filed under a parent kind that does not exist, or under itself. */
export class EnumerationTypeParentInvalidException extends DomainException {
  constructor(meta: { key: string; parentTypeKey: string; reason: 'missing' | 'self' | 'cycle' }) {
    super(ERROR_CODES.ENUMERATION_TYPE_PARENT_INVALID, meta);
  }
}

/**
 * A KIND's declared FALLBACK class is unusable.
 *
 * `no_axis` — the kind files its values under nothing, so there is no list to fall back
 * into. `unknown` / `inactive` — the key names no live member of the axis it does have.
 * `activeKeys` says what would have worked, the same shape `EnumerationParentUnknownException`
 * uses, because it is the same screen and the same fix.
 */
export class EnumerationTypeFallbackInvalidException extends DomainException {
  constructor(meta: {
    key: string;
    fallbackParentKey: string;
    reason: 'no_axis' | 'unknown' | 'inactive';
    parentType?: string;
    activeKeys?: string[];
  }) {
    super(ERROR_CODES.ENUMERATION_TYPE_FALLBACK_INVALID, meta);
  }
}

/**
 * Retiring a list value that is some kind's declared fallback.
 *
 * Distinct from `EnumerationHasChildrenException`: this fires on a class holding NOTHING,
 * which is precisely the case that guard cannot see. An empty retired fallback is where the
 * next untick sends a value, and the parent walk never checks the parent's own active flag.
 */
export class EnumerationFallbackInUseException extends DomainException {
  constructor(meta: { type: string; key: string; childTypes: readonly string[]; count: number }) {
    super(ERROR_CODES.ENUMERATION_FALLBACK_IN_USE, meta);
  }
}

/** One pasted row the batch could not accept. `index` is ZERO-BASED into the request rows. */
export interface EnumerationBulkProblem {
  index: number;
  reason:
    | 'parent_required'
    | 'parent_unknown'
    | 'parent_not_applicable'
    | 'duplicate_in_batch'
    | 'duplicate_existing'
    | 'label_unsluggable';
  key?: string;
  parentKey?: string;
  /** For `duplicate_in_batch`: the earlier row this one collides with. Zero-based. */
  firstIndex?: number;
}

/**
 * A pasted list was refused in full. Every bad row is named, capped at 200.
 *
 * All-or-nothing: half a four-hundred-line paste leaves the operator diffing a textarea
 * against a list they cannot see, which is worse than doing it again.
 */
export class EnumerationBulkInvalidException extends DomainException {
  constructor(meta: {
    type: string;
    rows: number;
    problemsTotal: number;
    truncated: boolean;
    problems: readonly EnumerationBulkProblem[];
    activeParentKeys?: readonly string[];
  }) {
    super(ERROR_CODES.ENUMERATION_BULK_INVALID, meta);
  }
}

/** Values of this KIND carry settings a three-column paste cannot express. */
export class EnumerationBulkCreateNotApplicableException extends DomainException {
  constructor(meta: { type: string }) {
    super(ERROR_CODES.ENUMERATION_BULK_CREATE_NOT_APPLICABLE, meta);
  }
}

/**
 * A question code matched no question at all — not even a soft-deleted one. Reports
 * every offender so the caller can say which rather than just refusing the save.
 *
 * Written for the catalog question template, which is gone (v25.0.0); the two live
 * throwers are `setBoundQuestion` (point a surrogate FACT at its question) and
 * `linkMirrorQuestion` (point a LIST at the question whose options it is). Both pass a
 * single code, so `unknownCodes` is usually one long — kept plural because the shape has
 * shipped and reporting every offender is still the right contract.
 */
export class EnumerationQuestionUnknownException extends DomainException {
  constructor(meta: { type: string; key: string; unknownCodes: string[] }) {
    super(ERROR_CODES.ENUMERATION_QUESTION_UNKNOWN, meta);
  }
}

// --- User proceed (feature 008) --------------------------------------------

export class BankOfferNotFoundException extends DomainException {
  constructor(meta: { bankOfferId: string }) {
    super(ERROR_CODES.BANK_OFFER_NOT_FOUND, meta);
  }
}

export class OfferNotForApplicationException extends DomainException {
  constructor(meta: { applicationId: string; bankOfferId: string }) {
    super(ERROR_CODES.OFFER_NOT_FOR_APPLICATION, meta);
  }
}

// --- Saved offers ----------------------------------------------------------

export class SavedOfferNotFoundException extends DomainException {
  constructor(meta: { bankOfferId: string }) {
    super(ERROR_CODES.SAVED_OFFER_NOT_FOUND, meta);
  }
}

export class AlreadyProceededException extends DomainException {
  constructor(meta: {
    applicationId: string;
    userProceededAt: string;
    userSelectedBankOfferId: string;
  }) {
    super(ERROR_CODES.ALREADY_PROCEEDED, meta);
  }
}

export class ApplicationNotMatchedException extends DomainException {
  constructor(meta: { applicationId: string; status: string }) {
    super(ERROR_CODES.APPLICATION_NOT_MATCHED, meta);
  }
}

// --- Transfer-type safety (feature 008 follow-up) ---------------------------

/**
 * Programs accepting 'none' as a transfer type carry higher default-risk.
 * Block creation/update unless the operator either explicitly priced the
 * 'none' band (pricing.rateByTransferType.none) OR required collateral.
 */
export class NoneTransferUnsafeException extends DomainException {
  constructor() {
    super(ERROR_CODES.NONE_TRANSFER_UNSAFE);
  }
}

// --- Customer mobile auth (v1.7.0) -----------------------------------------

export class CustomerPhoneAlreadyRegisteredException extends DomainException {
  constructor() {
    super(ERROR_CODES.CUSTOMER_PHONE_ALREADY_REGISTERED);
  }
}

export class CustomerEmailAlreadyRegisteredException extends DomainException {
  constructor() {
    super(ERROR_CODES.CUSTOMER_EMAIL_ALREADY_REGISTERED);
  }
}

export class CustomerInvalidCredentialsException extends DomainException {
  constructor() {
    super(ERROR_CODES.CUSTOMER_INVALID_CREDENTIALS);
  }
}

export class CustomerAccountInactiveException extends DomainException {
  constructor() {
    super(ERROR_CODES.CUSTOMER_ACCOUNT_INACTIVE);
  }
}

export class CustomerRefreshInvalidException extends DomainException {
  constructor() {
    super(ERROR_CODES.CUSTOMER_REFRESH_INVALID);
  }
}

export class CustomerNotFoundException extends DomainException {
  constructor(meta?: { id?: string; phone?: string }) {
    super(ERROR_CODES.CUSTOMER_NOT_FOUND, meta);
  }
}

export class CustomerPhoneInvalidException extends DomainException {
  constructor() {
    super(ERROR_CODES.CUSTOMER_PHONE_INVALID);
  }
}

// --- Document upload constraints -------------------------------------------

export class FileTooLargeException extends DomainException {
  constructor(sizeBytes: number) {
    super(ERROR_CODES.FILE_TOO_LARGE, { maxSizeBytes: 10_485_760, sizeBytes });
  }
}

export class FileTypeNotAllowedException extends DomainException {
  constructor(mimeType: string) {
    super(ERROR_CODES.FILE_TYPE_NOT_ALLOWED, {
      mimeType,
      allowedTypes: ['image/jpeg', 'image/png', 'image/heic', 'application/pdf'],
    });
  }
}

// --- Mobile document upload (v1.7.0) ---------------------------------------

export class DocumentOwnershipMismatchException extends DomainException {
  constructor() {
    super(ERROR_CODES.DOCUMENT_OWNERSHIP_MISMATCH);
  }
}

export class DocumentNotPendingException extends DomainException {
  constructor(meta: { documentId: string; status: string }) {
    super(ERROR_CODES.DOCUMENT_NOT_PENDING, meta);
  }
}

export class DocumentNotFoundException extends DomainException {
  constructor(meta: { documentId: string }) {
    super(ERROR_CODES.DOCUMENT_NOT_FOUND, meta);
  }
}

// --- Support (v1.7.0) ------------------------------------------------------

export class SupportRequestNotFoundException extends DomainException {
  constructor(meta: { id: string }) {
    super(ERROR_CODES.SUPPORT_REQUEST_NOT_FOUND, meta);
  }
}

export class SupportRequestAlreadyResolvedException extends DomainException {
  constructor(meta: { id: string }) {
    super(ERROR_CODES.SUPPORT_REQUEST_ALREADY_RESOLVED, meta);
  }
}

export class SupportConfigNotFoundException extends DomainException {
  constructor() {
    super(ERROR_CODES.SUPPORT_CONFIG_NOT_FOUND);
  }
}

// --- Onboarding (v1.7.0) ---------------------------------------------------

export class OnboardingScreenNotFoundException extends DomainException {
  constructor(meta: { id: string }) {
    super(ERROR_CODES.ONBOARDING_SCREEN_NOT_FOUND, meta);
  }
}

export class OnboardingOrderDuplicateException extends DomainException {
  constructor(order: number) {
    super(ERROR_CODES.ONBOARDING_ORDER_DUPLICATE, { order });
  }
}

// --- Telemetry (v1.7.0) ----------------------------------------------------

export class TelemetryEventNotAllowedException extends DomainException {
  constructor(meta: { eventCode: string; allowed: readonly string[] }) {
    super(ERROR_CODES.TELEMETRY_EVENT_NOT_ALLOWED, meta);
  }
}

// --- Feature 010: simple program setup, banded DBR & calculator ------------

/** FR-017 — band table is empty, unordered, duplicated, or not open-ended-terminated. */
export class DbrBandsInvalidException extends DomainException {
  constructor(meta: { reason: string; index: number | null }) {
    super(ERROR_CODES.DBR_BANDS_INVALID, meta);
  }
}

/** FR-019 — a band's cap percentage falls outside 1…100. */
export class DbrBandCapOutOfRangeException extends DomainException {
  constructor(meta: { index: number; capPercent: string }) {
    super(ERROR_CODES.DBR_BAND_CAP_OUT_OF_RANGE, meta);
  }
}

/** FR-014 — an amount / tenor / age range is inverted or empty. `field` names the offender. */
export class ProgramRangeInvalidException extends DomainException {
  constructor(meta: { field: string; min: string | number | null; max: string | number | null }) {
    super(ERROR_CODES.PROGRAM_RANGE_INVALID, meta);
  }
}

/**
 * A bank program must instantiate a predefined `program_name` catalog archetype;
 * the submitted key names none of them.
 */
export class ProgramNameKeyUnknownException extends DomainException {
  constructor(meta: { programNameKey: string; activeKeys: string[] }) {
    super(ERROR_CODES.PROGRAM_NAME_KEY_UNKNOWN, meta);
  }
}

/**
 * The catalog name is live, but is not assigned to the loan category the
 * program is being saved under. `assignedCategories` is the set it IS offered
 * under, so the admin form can name the alternatives instead of just refusing;
 * an empty list means the name is parked (offerable nowhere).
 */
export class ProgramNameKeyNotInCategoryException extends DomainException {
  constructor(meta: {
    programNameKey: string;
    productCategory: string;
    assignedCategories: string[];
  }) {
    super(ERROR_CODES.PROGRAM_NAME_KEY_NOT_IN_CATEGORY, meta);
  }
}

// NOTE (v16.4.0): `ProgramNameKeyBasisMismatchException` was deleted with the stored
// per-name income basis it enforced. The bank states the basis on its own program
// (`programType`); the catalog counts what banks picked and refuses nothing.

// NOTE (v16.0.0): `ProgramTypeInvalidForCategoryException` was deleted with the Fast
// Loans category it enforced. No category constrains the program type any more — a
// no-payslip loan is an income BASIS chosen per program, so the pair can never be a
// contradiction.

// --- Feature 011 — income-surrogate rule builder ----------------------------
//
// Every rejection below names the offending ROW (index or key), never just the
// table: a bank's grade table runs 10–15 rows, and "the table is invalid" makes
// the admin re-read all of them.

/** FR-009 — a table method was selected and its table is absent or empty. */
export class IncomeRuleEmptyException extends DomainException {
  constructor(meta: { strategy: string }) {
    super(ERROR_CODES.INCOME_RULE_EMPTY, meta);
  }
}

/** FR-010 — a row's income is ≤ 0 or not Decimal-parseable. */
export class IncomeRuleIncomeInvalidException extends DomainException {
  constructor(meta: { index?: number; key?: string; incomeEGP: string }) {
    super(ERROR_CODES.INCOME_RULE_INCOME_INVALID, meta);
  }
}

/** FR-006 — two key-table rows carry the same registry key. */
export class IncomeRuleDuplicateKeyException extends DomainException {
  constructor(meta: { key: string }) {
    super(ERROR_CODES.INCOME_RULE_DUPLICATE_KEY, meta);
  }
}

/**
 * FR-006 / AS-1.9 — the key is not an ACTIVE member of the method's registry.
 * Fails closed: the engine looks up by key, so a dead key resolves to nothing
 * for every applicant and nothing on screen would say why.
 */
export class IncomeRuleUnknownKeyException extends DomainException {
  constructor(meta: { key: string; registry: string; activeKeys?: string[] }) {
    super(ERROR_CODES.INCOME_RULE_UNKNOWN_KEY, meta);
  }
}

export type IncomeRuleBandsInvalidReason =
  | 'unordered'
  | 'gap'
  | 'overlap'
  /** An open-ended band with rows after it — those rows can never be reached. */
  | 'open_band_not_last'
  /**
   * Retired: a CLOSED last band is legal (it means "above this the rule yields
   * nothing"). Retained in the union so a stored or in-flight payload carrying it
   * still type-checks, the same treatment `QUESTION_TYPE_NOT_SCOREABLE` got.
   */
  | 'last_band_not_open'
  | 'empty'
  | 'edge_not_decimal';

/** FR-008 — band edges unordered, gapped, overlapping, or an open band not last. */
export class IncomeRuleBandsInvalidException extends DomainException {
  constructor(meta: { index: number | null; reason: IncomeRuleBandsInvalidReason }) {
    super(ERROR_CODES.INCOME_RULE_BANDS_INVALID, meta);
  }
}

/**
 * The program's maximum-loan table keyed by an answer cannot be read.
 *
 * `reason` is the closed list `MaxLoanByFactReason` owns; `index` names the row when one
 * row owns the problem, and `allowed` carries what could have been typed instead so the
 * screen can offer it rather than making the operator guess.
 */
export class MaxLoanByFactInvalidException extends DomainException {
  constructor(meta: {
    reason: string;
    index?: number;
    detail?: string;
    allowed?: readonly string[];
  }) {
    super(ERROR_CODES.MAX_LOAN_BY_FACT_INVALID, meta);
  }
}

/** FR-012 — per-rule DBR override outside (0, 100]. */
export class IncomeRuleDbrOverrideInvalidException extends DomainException {
  constructor(meta: { value: string }) {
    super(ERROR_CODES.INCOME_RULE_DBR_OVERRIDE_INVALID, meta);
  }
}

/**
 * The additional-income policy names something the engine cannot read, or a percentage that
 * would make it count nothing.
 *
 * `reason` is what the form points at: `unknown_fact` · `not_numeric` · `duplicate_source` ·
 * `percent_out_of_range` · `cap_out_of_range` · `no_sources`.
 */
export class AdditionalIncomeInvalidException extends DomainException {
  constructor(meta: { reason: string; factKey?: string; value?: string }) {
    super(ERROR_CODES.ADDITIONAL_INCOME_INVALID, meta);
  }
}

/**
 * The rule reads a registry fact the registry cannot serve — unknown, deactivated, or
 * bound to a question that is gone, inactive, or of a type no table can be keyed by.
 *
 * `availableFacts` rides along so the form can offer the fix. Naming only the broken key
 * would leave the admin to go and read Manage values to find out what else exists.
 */
export class IncomeRuleFactUnavailableException extends DomainException {
  constructor(meta: { factKey: string; availableFacts: string[] }) {
    super(ERROR_CODES.INCOME_RULE_FACT_UNAVAILABLE, meta);
  }
}

/**
 * A step pipeline that cannot be assembled.
 *
 * `reason` is the machine-readable half (one of `PRODUCT_RULE_INVALID_REASONS`) and the
 * ids are the human half: the admin editor highlights the step or gate named here, so a
 * pipeline of ten steps does not have to be re-read to find the one that is wrong.
 */
export class ProductRuleInvalidException extends DomainException {
  constructor(meta: { reason: string; stepId?: string; gateId?: string; detail?: string }) {
    super(ERROR_CODES.PRODUCT_RULE_INVALID, meta);
  }
}

/**
 * The product sells one of its ways and this program has not named which.
 *
 * `wayIds` are the slot ids of the ways on offer — the picker's own list, so the client can
 * highlight the choice instead of describing it.
 */
export class ProgramIncomeWayRequiredException extends DomainException {
  constructor(meta: { wayIds: string[] }) {
    super(ERROR_CODES.PROGRAM_INCOME_WAY_REQUIRED, meta);
  }
}

/**
 * Figures under a way this program does not sell.
 *
 * `count` rides beside `alsoFilled` because the message reads as a count, and interpolating
 * the array would render "alt,primary way(s)".
 */
export class ProgramIncomeWayConflictException extends DomainException {
  constructor(meta: { wayId: string; alsoFilled: string[] }) {
    super(ERROR_CODES.PROGRAM_INCOME_WAY_CONFLICT, {
      ...meta,
      count: meta.alsoFilled.length,
    });
  }
}

/**
 * The friendly form itself is not compilable — about the ANSWERS the operator gave, not
 * about the steps they never saw.
 */
export class ProductTemplateInvalidException extends DomainException {
  constructor(meta: { reason: string; detail?: string }) {
    super(ERROR_CODES.PRODUCT_TEMPLATE_INVALID, meta);
  }
}

/**
 * Recompiling this form would orphan figures a bank has already typed.
 *
 * `count` as well as the list, because the message reads as a count and interpolating an
 * ARRAY into that slot renders `"ABK-1,CIB-2 bank program(s)"`.
 */
export class ProductTemplateOrphansFiguresException extends DomainException {
  constructor(meta: { programCodes: readonly string[]; lostKeys: readonly string[] }) {
    super(ERROR_CODES.PRODUCT_TEMPLATE_ORPHANS_FIGURES, {
      ...meta,
      count: meta.programCodes.length,
    });
  }
}

/** The calculation was authored by hand, so there is no form to open. */
export class ProductTemplateNotEditableException extends DomainException {
  constructor(meta: { key: string }) {
    super(ERROR_CODES.PRODUCT_TEMPLATE_NOT_EDITABLE, meta);
  }
}

/**
 * One name, one income proof — the program disagrees with the name it is filed under.
 * `expected` is the catalog's answer, which is the one that stands.
 */
export class ProgramNameIncomeProofMismatchException extends DomainException {
  constructor(meta: { programNameKey: string; expected: string; got: string }) {
    super(ERROR_CODES.PROGRAM_NAME_INCOME_PROOF_MISMATCH, meta);
  }
}

/** A surrogate program under a name that states no proof. The fix is on the catalog. */
export class ProgramNameIncomeProofMissingException extends DomainException {
  constructor(meta: { programNameKey: string }) {
    super(ERROR_CODES.PROGRAM_NAME_INCOME_PROOF_MISSING, meta);
  }
}

/** Changing a name's proof out from under the banks whose tables are keyed by it. */
export class IncomeProofInUseException extends DomainException {
  constructor(meta: { programNameKey: string; programCodes: string[] }) {
    super(ERROR_CODES.INCOME_PROOF_IN_USE, meta);
  }
}

/** Research R8 — a marker named a path outside the program's numeric allow-list. */
export class ValueSourcePathUnknownException extends DomainException {
  constructor(meta: { path: string }) {
    super(ERROR_CODES.VALUE_SOURCE_PATH_UNKNOWN, meta);
  }
}

/** A marker on a valid path carrying something other than `team_estimated`. */
export class ValueSourceValueInvalidException extends DomainException {
  constructor(meta: { path: string; value: string }) {
    super(ERROR_CODES.VALUE_SOURCE_VALUE_INVALID, meta);
  }
}

/**
 * FR-033 — activation refused while team-estimated numbers stand. `paths` is
 * EVERY offending path: the admin has one conversation with the bank, not one
 * per number.
 */
export class ProgramHasEstimatedValuesException extends DomainException {
  constructor(meta: { paths: string[] }) {
    super(ERROR_CODES.PROGRAM_HAS_ESTIMATED_VALUES, meta);
  }
}
