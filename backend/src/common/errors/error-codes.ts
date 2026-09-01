/**
 * Stable error codes for the admin + mobile API.
 * Constitution Principle III: no English strings cross the API boundary.
 * Adding a code is a same-PR operation across three files:
 *   1. this file
 *   2. admin/src/i18n/error-codes.ar-EG.json
 *   3. admin/src/i18n/error-codes.en-US.json
 */
export const ERROR_CODES = {
  // --- Auth / Session ---
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_ACCOUNT_INACTIVE: 'AUTH_ACCOUNT_INACTIVE',
  AUTH_TOKEN_MISSING: 'AUTH_TOKEN_MISSING',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_REFRESH_INVALID: 'AUTH_REFRESH_INVALID',
  FORBIDDEN: 'FORBIDDEN',
  MUST_CHANGE_PASSWORD: 'MUST_CHANGE_PASSWORD',
  INVALID_CURRENT_PASSWORD: 'INVALID_CURRENT_PASSWORD',

  // --- Password policy ---
  PASSWORD_TOO_SHORT: 'PASSWORD_TOO_SHORT',
  PASSWORD_TOO_LONG: 'PASSWORD_TOO_LONG',
  PASSWORD_BREACHED: 'PASSWORD_BREACHED',
  PASSWORD_ON_COMMON_LIST: 'PASSWORD_ON_COMMON_LIST',
  PASSWORD_BREACH_CHECK_UNAVAILABLE: 'PASSWORD_BREACH_CHECK_UNAVAILABLE',
  PASSWORD_REUSES_RESET_VALUE: 'PASSWORD_REUSES_RESET_VALUE',

  // --- User management ---
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  CANNOT_SELF_MODIFY: 'CANNOT_SELF_MODIFY',
  SUPER_ADMIN_FLOOR_VIOLATED: 'SUPER_ADMIN_FLOOR_VIOLATED',

  // --- Bank programs (feature 002) ---
  BANK_PROGRAM_NOT_FOUND: 'BANK_PROGRAM_NOT_FOUND',
  PROGRAM_CODE_ALREADY_IN_USE: 'PROGRAM_CODE_ALREADY_IN_USE',
  INVALID_VARIABLE_RATE_CONFIGURATION: 'INVALID_VARIABLE_RATE_CONFIGURATION',
  INVALID_QUALITATIVE_REVIEW_CEILING: 'INVALID_QUALITATIVE_REVIEW_CEILING',
  QUALITATIVE_REVIEW_CEILING_BELOW_BASE: 'QUALITATIVE_REVIEW_CEILING_BELOW_BASE',
  DERIVATION_ARITHMETIC_MISMATCH: 'DERIVATION_ARITHMETIC_MISMATCH',
  CONFLICT_STALE_DATA: 'CONFLICT_STALE_DATA',
  BANK_PROGRAM_HAS_OFFERS: 'BANK_PROGRAM_HAS_OFFERS',
  UNKNOWN_ENUMERATION_KEY: 'UNKNOWN_ENUMERATION_KEY',
  DEPRECATED_ENUMERATION_KEY: 'DEPRECATED_ENUMERATION_KEY',
  ENUMERATION_REGISTRY_UNAVAILABLE: 'ENUMERATION_REGISTRY_UNAVAILABLE',
  SEED_RATE_VERIFICATION_FAILED: 'SEED_RATE_VERIFICATION_FAILED',
  SEED_REQUIRES_SUPER_ADMIN: 'SEED_REQUIRES_SUPER_ADMIN',

  // --- Matching engine (feature 003) ---
  NO_MATCHING_PROGRAMS: 'NO_MATCHING_PROGRAMS',
  INCOME_TOO_LOW: 'INCOME_TOO_LOW',
  AGE_NOT_ELIGIBLE: 'AGE_NOT_ELIGIBLE',
  DBR_EXCEEDED: 'DBR_EXCEEDED',
  TENOR_OUT_OF_RANGE: 'TENOR_OUT_OF_RANGE',
  AMOUNT_OUT_OF_RANGE: 'AMOUNT_OUT_OF_RANGE',
  MISSING_CD_RECORD: 'MISSING_CD_RECORD',
  MISSING_CAR_LOAN_RECORD: 'MISSING_CAR_LOAN_RECORD',
  MISSING_BANK_STATEMENT: 'MISSING_BANK_STATEMENT',
  INCOME_LOOKUP_FAILED: 'INCOME_LOOKUP_FAILED',
  MATCHING_ENGINE_ERROR: 'MATCHING_ENGINE_ERROR',
  IDEMPOTENCY_KEY_MISMATCH: 'IDEMPOTENCY_KEY_MISMATCH',
  UNAUTHENTICATED: 'UNAUTHENTICATED',

  // --- Scoring versions / analytics (feature 004) ---
  SCORING_VERSION_CONCURRENT_PROMOTION: 'SCORING_VERSION_CONCURRENT_PROMOTION',
  SCORING_VERSION_NOT_FOUND: 'SCORING_VERSION_NOT_FOUND',
  SCORING_VERSION_NO_ACTIVE: 'SCORING_VERSION_NO_ACTIVE',

  // --- Platform enumerations (feature 006) ---
  ENUMERATION_KEY_DUPLICATE: 'ENUMERATION_KEY_DUPLICATE',
  ENUMERATION_SYSTEM_ONLY: 'ENUMERATION_SYSTEM_ONLY',
  /** Loan categories were submitted for an enumeration type that has no such axis. */
  ENUMERATION_CATEGORIES_NOT_APPLICABLE: 'ENUMERATION_CATEGORIES_NOT_APPLICABLE',
  /**
   * An income basis was submitted for a (name, loan category) pair that is not
   * assigned — the name is not offered under that loan type, so there is nothing
   * there to describe.
   */
  ENUMERATION_CATEGORY_NOT_ASSIGNED: 'ENUMERATION_CATEGORY_NOT_ASSIGNED',
  /** A question template was submitted for an enumeration type that has no such axis. */
  ENUMERATION_QUESTIONS_NOT_APPLICABLE: 'ENUMERATION_QUESTIONS_NOT_APPLICABLE',
  /** A catalog question template named codes that are in no question, active or not. */
  ENUMERATION_QUESTION_UNKNOWN: 'ENUMERATION_QUESTION_UNKNOWN',
  /**
   * A question BINDING was submitted for an enumeration type that binds no question —
   * anything other than `surrogate_fact`. Its own code rather than the template one
   * above: those are a catalog name SUGGESTING many questions, this is a fact READING
   * one, and telling an operator their governorate has no question template would send
   * them looking for a screen that does not exist.
   */
  ENUMERATION_QUESTION_BINDING_NOT_APPLICABLE: 'ENUMERATION_QUESTION_BINDING_NOT_APPLICABLE',
  /**
   * A fact was pointed at a question no bank table can be keyed by — TEXT or
   * MULTI_SELECT. A free-text answer is not a key anyone can enumerate in advance, and
   * a multi-pick answer has no single value to look up.
   */
  SURROGATE_FACT_QUESTION_TYPE_INVALID: 'SURROGATE_FACT_QUESTION_TYPE_INVALID',
  /**
   * A hard DELETE was refused because something still names this entry's key.
   *
   * No enumeration key carries an FK anywhere — the registry's unique key is the
   * composite `(type, key)` — so the database would let the row go and leave every
   * reader pointing at nothing, exactly the ghost rows A26 forbids. Deprecating is
   * the reversible answer, and the meta says so by naming each surface and its count.
   */
  ENUMERATION_IN_USE: 'ENUMERATION_IN_USE',
  /**
   * Delete was asked for on an enumeration type this endpoint cannot vouch for.
   *
   * `PostgresPlatformEnumerationsRepository.countReferences` enumerates the readers
   * of each deletable type by hand (no FK exists to lean on). A type absent from
   * that switch — the seeded-but-deactivated ones — has no checkable reference
   * list, so a delete there would be a silent dangle. Deactivate or deprecate
   * instead.
   */
  ENUMERATION_DELETE_NOT_SUPPORTED: 'ENUMERATION_DELETE_NOT_SUPPORTED',
  /**
   * A value of a type that is FILED UNDER a list was created without naming which
   * one. A compound with no class is invisible to the derivation that reads it —
   * `factParentTable` answers `no_matching_row` for whoever picks it, which stops
   * the rule — so the value exists, is offered to the customer, and quotes nothing.
   * `meta.parentType` names the list to pick from.
   */
  ENUMERATION_PARENT_REQUIRED: 'ENUMERATION_PARENT_REQUIRED',
  /**
   * The parent named is not a live member of the list this type is filed under —
   * missing, deactivated or deprecated (`meta.reason` says which). One code rather
   * than three, because the fix screen is the same list in every case, and
   * `meta.activeKeys` says what would have worked.
   */
  ENUMERATION_PARENT_UNKNOWN: 'ENUMERATION_PARENT_UNKNOWN',
  /** A parent was named for a type that is filed under nothing. */
  ENUMERATION_PARENT_NOT_APPLICABLE: 'ENUMERATION_PARENT_NOT_APPLICABLE',
  /**
   * Retiring a list value was refused because members are still filed under it.
   *
   * 409, like `ENUMERATION_IN_USE`: the request is well-formed and the row exists —
   * the current state of the world refuses it, and it stops refusing once the last
   * child is re-filed. Load-bearing: the engine's parent walk filters the CHILD's
   * active flag and never the parent's, so a retired class with children goes on
   * pricing while the operator believes it is gone.
   */
  ENUMERATION_HAS_CHILDREN: 'ENUMERATION_HAS_CHILDREN',
  /**
   * Retiring or deleting a list value was refused because the list IS a question's answers
   * and the question would be left with fewer than two of them.
   *
   * A mirrored list (`enumeration_type_def.mirrorQuestionId`) is a question's option set:
   * `syncMirroredOptions` deactivates the option when the value goes. `assertQuestionTypeRules`
   * refuses a choice question with fewer than `MIN_CHOICE_OPTIONS` at CREATE, but the sync runs
   * after the registry write has committed and re-checks nothing — so emptying the list one
   * value at a time published a live SINGLE_SELECT with no answers, which an applicant cannot
   * answer and a bank cannot key a table by.
   *
   * 409 for the reason `ENUMERATION_HAS_CHILDREN` is: the request is well-formed, the state
   * refuses it, and it stops refusing as soon as another value is added. Separate from that
   * code because the blocker is a QUESTION, not a filing relation — the operator's next move
   * is to add a value or unpick the mirror, not to re-file a child.
   */
  MIRRORED_LIST_MIN_VALUES: 'MIRRORED_LIST_MIN_VALUES',
  /**
   * A KIND could not be deleted because other kinds are filed under it as their parent axis.
   *
   * Separate from `ENUMERATION_TYPE_IN_USE`, whose meta field is `values` and whose message
   * says "this list still holds N value(s)": the blocker here is not a value, and an operator
   * sent to look for one opens an empty list and learns nothing. Dropping the axis anyway
   * would make every value of the CHILD kind uncreatable — `resolveParentKey` refuses a
   * create with no parent — which is the same damage as a missing parent, refused there.
   *
   * 409: shape is fine, state refuses, and re-pointing the children lifts it.
   */
  ENUMERATION_TYPE_IS_PARENT_AXIS: 'ENUMERATION_TYPE_IS_PARENT_AXIS',
  /**
   * A KIND of list was created with a key another kind already uses.
   *
   * Separate from `ENUMERATION_KEY_DUPLICATE`, which is about a VALUE inside one kind: the
   * two live in different tables with different uniques (`enumeration_type_def.key` alone
   * versus `platform_enumeration (type, key)`), and the operator's next move differs —
   * pick another name for the list, versus pick another name for the value.
   */
  ENUMERATION_TYPE_DUPLICATE: 'ENUMERATION_TYPE_DUPLICATE',
  /** A KIND was patched or deleted by a key no definition row carries. */
  ENUMERATION_TYPE_NOT_FOUND: 'ENUMERATION_TYPE_NOT_FOUND',
  /**
   * Deleting a KIND was refused because values still carry its type.
   *
   * 409, like the two refusals above: shape is fine, state refuses, and it stops refusing
   * once the last value is gone. `meta.values` is the count, so the operator knows whether
   * they are clearing three rows or three hundred.
   *
   * Load-bearing because `platform_enumeration.type` carries NO foreign key — nothing in the
   * database would stop the delete, and the rows left behind would belong to a kind with no
   * label, no parent axis and no delete gate, which is exactly the orphan state the registry
   * exists to remove.
   */
  ENUMERATION_TYPE_IN_USE: 'ENUMERATION_TYPE_IN_USE',
  /**
   * A KIND the code names by string was renamed or deleted.
   *
   * `systemOnly` on a kind means a code path reads that exact type string —
   * `countReferences`'s switch, the customer allow-list, the categorised and question-bound
   * axes, the document pipeline. Renaming one strands every value carrying the old string
   * AND leaves the code asking for a key nothing answers to, so both halves break and
   * neither says so. Relabelling is a different thing and stays allowed: the label is what
   * an operator reads, the key is what the code reads.
   */
  ENUMERATION_TYPE_SYSTEM_ONLY: 'ENUMERATION_TYPE_SYSTEM_ONLY',
  /**
   * A KIND was filed under a parent kind that does not exist, or under itself.
   *
   * Both refused here because both produce the same unusable state: `resolveParentKey`
   * would demand a parent from a list nothing can populate, making every value of the new
   * kind uncreatable. `meta.reason` separates `missing` from `self`.
   */
  ENUMERATION_TYPE_PARENT_INVALID: 'ENUMERATION_TYPE_PARENT_INVALID',
  /**
   * A KIND's declared FALLBACK class is unusable: the kind has no parent axis at all, or the
   * key names no live member of the axis it does have. `meta.reason` separates the three.
   *
   * A separate code from `ENUMERATION_TYPE_PARENT_INVALID` rather than a reason on it: that
   * code's locale strings interpolate `{parentTypeKey}` and describe filing the KIND under
   * another kind, which is a different sentence from "where do this kind's unfiled VALUES
   * go". Overloading it would put the wrong noun in front of the operator.
   */
  ENUMERATION_TYPE_FALLBACK_INVALID: 'ENUMERATION_TYPE_FALLBACK_INVALID',
  /**
   * Retiring a list value was refused because it is where some kind's UNFILED values are
   * sent — its declared `fallbackParentKey`.
   *
   * Separate from `ENUMERATION_HAS_CHILDREN`, which refuses a parent that still holds
   * children: this one can fire on a class holding NOTHING, and that is exactly the case
   * worth refusing. Retire an empty fallback and the next untick on the class board files a
   * value under a retired class — `factParentTable`'s parent walk filters the CHILD's active
   * flag and never the parent's, so it goes on pricing while the operator believes the class
   * is gone. `meta.childTypes` names the lists to re-point first.
   *
   * 409 for the reason its two siblings are: shape is fine, state refuses, and it stops
   * refusing once the fallback is moved.
   */
  ENUMERATION_FALLBACK_IN_USE: 'ENUMERATION_FALLBACK_IN_USE',
  /**
   * A pasted list of values was refused. NOTHING was written.
   *
   * All-or-nothing, and every bad row is reported at once rather than only the first:
   * `meta.problems[].index` is ZERO-BASED into the request's `rows`, and the screen adds one
   * to name a line. Partial success looks kinder and is worse — it leaves the operator to
   * reconstruct, row by row, which half of a four-hundred-line paste landed. The two existing
   * bulk endpoints refuse it for the same reason.
   *
   * A DUPLICATE is not a problem and is not reported here: re-pasting the same sheet is the
   * expected second use, and it comes back in the success body as `skipped`.
   *
   * `meta.problems` is capped at 200 with `meta.truncated`; a paste with more distinct
   * problems than that is one the operator redoes, and a 200 KB error body helps nobody.
   */
  ENUMERATION_BULK_INVALID: 'ENUMERATION_BULK_INVALID',
  /**
   * Values of this KIND cannot be created from a pasted list.
   *
   * A paste has three columns. `program_name` carries loan categories and an income basis,
   * `surrogate_product` a calculation, `surrogate_fact` a bound question — none of which a
   * row can express, and each of which has a screen that asks for it. Creating one through
   * this door produces a row the screen that owns it cannot render.
   */
  ENUMERATION_BULK_CREATE_NOT_APPLICABLE: 'ENUMERATION_BULK_CREATE_NOT_APPLICABLE',
  /**
   * A catalog program name was set to the no-payslip basis without naming the surrogate
   * product it takes its calculation from.
   *
   * The name says what the product is CALLED and who sells it; the product says how the
   * income is worked out. A no-payslip name with neither a link nor a rule of its own is
   * a name every bank under it quotes `rule_unconfigured` for — live, and silent until a
   * customer hits it. `meta.activeProducts` names what would have worked.
   *
   * NOT raised for a name that already states its own rule: those predate the archetypes
   * and keep working. Grandfather what exists, enforce on the next write.
   */
  SURROGATE_PRODUCT_REQUIRED: 'SURROGATE_PRODUCT_REQUIRED',
  /**
   * Retiring a surrogate product was refused because catalog names still link to it.
   *
   * 409 for the same reason `ENUMERATION_HAS_CHILDREN` is: shape is fine, state refuses,
   * and it stops refusing once the last name is moved off. A separate code rather than
   * reusing that one — its `meta` and its Arabic both describe a parent/child filing
   * relation, and this is a product/consumer one. `meta.names` says which to move.
   *
   * Load-bearing in the same way: `programNameIncomeRules()` resolves a link without
   * checking the product's active flag, deliberately, so that retiring one does not blank
   * the income of every name already on it mid-flight. That is only safe because THIS
   * refusal stops the retire happening while anyone is still linked.
   */
  SURROGATE_PRODUCT_IN_USE: 'SURROGATE_PRODUCT_IN_USE',
  /**
   * A rule was written onto a catalog program name that takes its calculation from a
   * surrogate product.
   *
   * Refused rather than merged: storing a rule here would fork the calculation, and the
   * fork is invisible — both rows look configured and only one is read.
   *
   * A code of its own rather than letting it fail downstream. Without it the write dies
   * as `PRODUCT_RULE_INVALID / no_steps` — because `withStoredStructure` finds nothing to
   * overlay on a linked name — which is the right refusal wearing a reason that sends the
   * operator to look for a missing step list that was never missing.
   * `meta.surrogateProductKey` is where the edit actually belongs.
   */
  PROGRAM_NAME_RULE_LINKED: 'PROGRAM_NAME_RULE_LINKED',
  /**
   * No surrogate product has this key.
   *
   * A code of its own rather than `PROGRAM_NAME_KEY_UNKNOWN`, which was reused here first:
   * that message names a program NAME and sends the operator to "add it under Program
   * catalog" — the wrong object, and not where products live. The operator is on the
   * product's own URL when this fires.
   */
  SURROGATE_PRODUCT_NOT_FOUND: 'SURROGATE_PRODUCT_NOT_FOUND',
  /**
   * A catalog name that states its OWN income rule was linked to a surrogate product.
   *
   * Refused rather than absorbed, and the first attempt did absorb — clearing the name's
   * rule in the same statement so the fork could not exist. That traded a silent wrong
   * answer for an UNFIXABLE state: the rule was gone, so unlinking then hit
   * `SURROGATE_PRODUCT_REQUIRED` and the name could not be moved back at all.
   *
   * Refusing keeps both doors open. The operator clears the rule first
   * (`PUT program-names/:key/income-rule` with `incomeRule: null`, which is allowed
   * precisely because the name is not linked yet, and is itself refused while bank
   * programs still read it), then links. Nothing is destroyed on the platform's initiative
   * and every step says what it did.
   */
  PROGRAM_NAME_HAS_OWN_RULE: 'PROGRAM_NAME_HAS_OWN_RULE',

  // --- User proceed (feature 008) ---
  BANK_OFFER_NOT_FOUND: 'BANK_OFFER_NOT_FOUND',
  OFFER_NOT_FOR_APPLICATION: 'OFFER_NOT_FOR_APPLICATION',
  ALREADY_PROCEEDED: 'ALREADY_PROCEEDED',
  APPLICATION_NOT_MATCHED: 'APPLICATION_NOT_MATCHED',
  NONE_TRANSFER_UNSAFE: 'NONE_TRANSFER_UNSAFE',

  // --- Saved offers (Saved Offers screen) ---
  SAVED_OFFER_NOT_FOUND: 'SAVED_OFFER_NOT_FOUND',

  // --- Banks (feature 007) ---
  BANK_NOT_FOUND: 'BANK_NOT_FOUND',
  BANK_NAME_DUPLICATE: 'BANK_NAME_DUPLICATE',
  BANK_HAS_PROGRAMS: 'BANK_HAS_PROGRAMS',
  BANK_CONFLICT_STALE_DATA: 'BANK_CONFLICT_STALE_DATA',

  // --- Customer mobile auth (v1.7.0) ---
  CUSTOMER_PHONE_ALREADY_REGISTERED: 'CUSTOMER_PHONE_ALREADY_REGISTERED',
  CUSTOMER_EMAIL_ALREADY_REGISTERED: 'CUSTOMER_EMAIL_ALREADY_REGISTERED',
  CUSTOMER_INVALID_CREDENTIALS: 'CUSTOMER_INVALID_CREDENTIALS',
  CUSTOMER_ACCOUNT_INACTIVE: 'CUSTOMER_ACCOUNT_INACTIVE',
  CUSTOMER_REFRESH_INVALID: 'CUSTOMER_REFRESH_INVALID',
  CUSTOMER_NOT_FOUND: 'CUSTOMER_NOT_FOUND',
  CUSTOMER_PHONE_INVALID: 'CUSTOMER_PHONE_INVALID',

  // --- Feature 008 — Two-Path Registration (Constitution v1.8.0 / Principle XIII) ---
  // OTP lifecycle
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_CONSUMED: 'OTP_CONSUMED',
  OTP_ATTEMPTS_EXCEEDED: 'OTP_ATTEMPTS_EXCEEDED',
  OTP_RATE_LIMITED: 'OTP_RATE_LIMITED',
  OTP_PURPOSE_LOGIN_FORBIDDEN: 'OTP_PURPOSE_LOGIN_FORBIDDEN',
  // Verified-mobile token (PHONE-signup pre-customer bearer)
  VERIFIED_MOBILE_TOKEN_INVALID: 'VERIFIED_MOBILE_TOKEN_INVALID',
  VERIFIED_MOBILE_TOKEN_EXPIRED: 'VERIFIED_MOBILE_TOKEN_EXPIRED',
  VERIFIED_MOBILE_TOKEN_CONSUMED: 'VERIFIED_MOBILE_TOKEN_CONSUMED',
  // Social provider verification
  SOCIAL_TOKEN_INVALID: 'SOCIAL_TOKEN_INVALID',
  SOCIAL_TOKEN_EXPIRED: 'SOCIAL_TOKEN_EXPIRED',
  SOCIAL_PROVIDER_UNAVAILABLE: 'SOCIAL_PROVIDER_UNAVAILABLE',
  SOCIAL_SESSION_INVALID: 'SOCIAL_SESSION_INVALID',
  SOCIAL_SESSION_EXPIRED: 'SOCIAL_SESSION_EXPIRED',
  SOCIAL_SESSION_CONSUMED: 'SOCIAL_SESSION_CONSUMED',
  // Login lockout (10 failures / 15 min → 30 min)
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  PASSWORD_NOT_SET: 'PASSWORD_NOT_SET',
  PASSWORD_SAME_AS_OLD: 'PASSWORD_SAME_AS_OLD',
  // Profile-completion flow (Principle XXXVII)
  PROFILE_INCOMPLETE: 'PROFILE_INCOMPLETE',
  PROFILE_FIELD_IMMUTABLE: 'PROFILE_FIELD_IMMUTABLE',
  PROFILE_ID_DOCS_MISSING: 'PROFILE_ID_DOCS_MISSING',
  // Select-offer commitment gate: optional at signup; the profile photo and
  // National ID (front+back) are required when the customer proceeds with a
  // bank offer — not at the matching call (POST /v1/apply).
  NATIONAL_ID_REQUIRED: 'NATIONAL_ID_REQUIRED',
  PROFILE_PHOTO_REQUIRED: 'PROFILE_PHOTO_REQUIRED',
  PASSWORD_REQUIRED_FOR_PHONE_PROFILE: 'PASSWORD_REQUIRED_FOR_PHONE_PROFILE',
  PASSWORD_FORBIDDEN_FOR_SOCIAL_PROFILE: 'PASSWORD_FORBIDDEN_FOR_SOCIAL_PROFILE',
  PHONE_MUTATION_ON_PHONE_CUSTOMER_FORBIDDEN: 'PHONE_MUTATION_ON_PHONE_CUSTOMER_FORBIDDEN',
  PASSWORD_CHANGE_FORBIDDEN_FOR_SOCIAL: 'PASSWORD_CHANGE_FORBIDDEN_FOR_SOCIAL',
  // Loan submission validation
  AGE_INVALID: 'AGE_INVALID',
  DOCUMENTS_MISSING: 'DOCUMENTS_MISSING',
  DOCUMENTS_NOT_OWNED: 'DOCUMENTS_NOT_OWNED',
  BANK_PROGRAM_INVALID: 'BANK_PROGRAM_INVALID',

  // --- Document upload constraints ---
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  FILE_TYPE_NOT_ALLOWED: 'FILE_TYPE_NOT_ALLOWED',

  // --- Customer document upload (v1.7.0) ---
  DOCUMENT_OWNERSHIP_MISMATCH: 'DOCUMENT_OWNERSHIP_MISMATCH',
  DOCUMENT_NOT_PENDING: 'DOCUMENT_NOT_PENDING',
  DOCUMENT_NOT_FOUND: 'DOCUMENT_NOT_FOUND',

  // --- Support (v1.7.0) ---
  SUPPORT_REQUEST_NOT_FOUND: 'SUPPORT_REQUEST_NOT_FOUND',
  SUPPORT_REQUEST_ALREADY_RESOLVED: 'SUPPORT_REQUEST_ALREADY_RESOLVED',
  SUPPORT_CONFIG_NOT_FOUND: 'SUPPORT_CONFIG_NOT_FOUND',

  // --- Onboarding (v1.7.0) ---
  ONBOARDING_SCREEN_NOT_FOUND: 'ONBOARDING_SCREEN_NOT_FOUND',
  ONBOARDING_ORDER_DUPLICATE: 'ONBOARDING_ORDER_DUPLICATE',

  // --- Telemetry (v1.7.0) ---
  TELEMETRY_EVENT_NOT_ALLOWED: 'TELEMETRY_EVENT_NOT_ALLOWED',

  // --- Dynamic questionnaire & matching (Feature 00X, Constitution V v4.1.0) ---
  QUESTIONNAIRE_NOT_PUBLISHED: 'QUESTIONNAIRE_NOT_PUBLISHED',
  QUESTION_GROUP_NOT_FOUND: 'QUESTION_GROUP_NOT_FOUND',
  QUESTION_NOT_FOUND: 'QUESTION_NOT_FOUND',
  QUESTION_OPTION_NOT_FOUND: 'QUESTION_OPTION_NOT_FOUND',
  UNKNOWN_QUESTION_CODE: 'UNKNOWN_QUESTION_CODE',
  UNKNOWN_OPTION_CODE: 'UNKNOWN_OPTION_CODE',
  ENABLED_WHEN_INVALID: 'ENABLED_WHEN_INVALID',
  QUESTION_IN_USE: 'QUESTION_IN_USE',
  QUESTION_OPTION_IN_USE: 'QUESTION_OPTION_IN_USE',
  QUESTION_GROUP_NOT_EMPTY: 'QUESTION_GROUP_NOT_EMPTY',
  REQUIRED_ANSWER_MISSING: 'REQUIRED_ANSWER_MISSING',
  PROGRAM_NO_LONGER_MATCHES: 'PROGRAM_NO_LONGER_MATCHES',
  // Scoring weights (MVP — per-answer points, direct save)
  WEIGHT_SET_NOT_FOUND: 'WEIGHT_SET_NOT_FOUND',
  WEIGHTS_UNKNOWN_OPTION: 'WEIGHTS_UNKNOWN_OPTION',
  WEIGHTS_QUESTION_WEIGHT_SUM_INVALID: 'WEIGHTS_QUESTION_WEIGHT_SUM_INVALID',
  WEIGHTS_ANSWER_SCORE_OUT_OF_RANGE: 'WEIGHTS_ANSWER_SCORE_OUT_OF_RANGE',
  /**
   * A weighted question carries no rule for its own type (v14.0.0): no option
   * scores, no numeric bands, no text presence score. It would consume its share
   * of the denominator and never be able to earn anything — a silent cap.
   */
  WEIGHTS_MISSING_RULE: 'WEIGHTS_MISSING_RULE',
  /** NUMERIC bands missing, out of order, overlapping, gapped, or malformed. */
  WEIGHTS_NUMERIC_BANDS_INVALID: 'WEIGHTS_NUMERIC_BANDS_INVALID',
  /** A rule block on a question of the wrong type, or an unknown aggregation. */
  WEIGHTS_RULE_TYPE_MISMATCH: 'WEIGHTS_RULE_TYPE_MISMATCH',
  /**
   * A weighted question is not in the program's catalog set — the questions a
   * `program_name` scores on under this loan category (`/program-catalog/:key`).
   * Every bank program sharing a catalog name scores on the SAME questions and
   * differs only in weights, so the question set is not the bank program's to
   * choose. Also raised when the program has no `programNameKey` at all (nothing
   * to scope by) or the catalog set for its category is empty: the meta carries
   * `programNameKey` + `allowedQuestionCodes` so the admin screen can say which.
   */
  WEIGHTS_QUESTION_NOT_IN_CATALOG: 'WEIGHTS_QUESTION_NOT_IN_CATALOG',

  // --- Feature 010 — simple program setup, banded DBR & calculator ---
  // Banded DBR + program ranges (admin)
  DBR_BANDS_INVALID: 'DBR_BANDS_INVALID',
  DBR_BAND_CAP_OUT_OF_RANGE: 'DBR_BAND_CAP_OUT_OF_RANGE',
  PROGRAM_RANGE_INVALID: 'PROGRAM_RANGE_INVALID',
  /** Bank program named something outside the predefined `program_name` catalog. */
  PROGRAM_NAME_KEY_UNKNOWN: 'PROGRAM_NAME_KEY_UNKNOWN',
  /**
   * The catalog name exists and is live, but is not assigned to the loan
   * category the program is being saved under (Program catalog → Loan
   * categories). `meta.assignedCategories` is the set it IS offered under —
   * empty means the name is parked.
   */
  PROGRAM_NAME_KEY_NOT_IN_CATEGORY: 'PROGRAM_NAME_KEY_NOT_IN_CATEGORY',
  // NOTE (v16.4.0): `PROGRAM_NAME_KEY_BASIS_MISMATCH` was deleted with the stored
  // per-name income basis. A catalog tick could refuse a save whose basis the bank had
  // legitimately chosen on its own program; the program is now the only authority, so
  // there is nothing left to disagree with. Deleted in one change with both locale
  // dictionaries (Principle III).
  // NOTE (v16.0.0): `PROGRAM_TYPE_INVALID_FOR_CATEGORY` lived here for one day. It
  // existed only to force a Fast Loans program to be `income_surrogate`; with that
  // category gone, no category constrains the program type and the code became
  // unthrowable. Deleted rather than retired, in one change with both locale
  // dictionaries (Principle III) — nothing had shipped against it.
  // Typed questions + typed answers
  ANSWER_TYPE_MISMATCH: 'ANSWER_TYPE_MISMATCH',
  ANSWER_OUT_OF_RANGE: 'ANSWER_OUT_OF_RANGE',
  ANSWER_TOO_LONG: 'ANSWER_TOO_LONG',
  ANSWER_REQUIRED: 'ANSWER_REQUIRED',
  QUESTION_TYPE_RULES_INVALID: 'QUESTION_TYPE_RULES_INVALID',
  QUESTION_TYPE_NOT_SCOREABLE: 'QUESTION_TYPE_NOT_SCOREABLE',
  // Money-field bindings (code constants — never a Question column, A33)
  MONEY_FIELD_BINDING_MISSING: 'MONEY_FIELD_BINDING_MISSING',
  MONEY_FIGURE_MISSING: 'MONEY_FIGURE_MISSING',
  // Itemised obligations: the stated total disagreed with the sum of the per-debt
  // answers. The sum is authoritative, so this is a tampered or stale client —
  // never a user mistake, because the total is not typed by hand.
  OBLIGATIONS_TOTAL_MISMATCH: 'OBLIGATIONS_TOTAL_MISMATCH',
  // Calculator
  CALCULATOR_INPUT_INVALID: 'CALCULATOR_INPUT_INVALID',
  CALCULATOR_PROGRAM_INACTIVE: 'CALCULATOR_PROGRAM_INACTIVE',
  PROGRAM_MISCONFIGURED: 'PROGRAM_MISCONFIGURED',
  // Reason codes: never thrown — returned inside a 200 payload when a program is
  // listed without figures (FR-024). `PROGRAM_MISCONFIGURED` doubles as a reason.
  NO_RECOGNISED_INCOME: 'NO_RECOGNISED_INCOME',
  OBLIGATIONS_EXCEED_ALLOWANCE: 'OBLIGATIONS_EXCEED_ALLOWANCE',
  BELOW_PROGRAM_MIN_AMOUNT: 'BELOW_PROGRAM_MIN_AMOUNT',
  AGE_AT_MATURITY: 'AGE_AT_MATURITY',
  // Disclaimer shown alongside every indicative figure (not an error)
  INDICATIVE_ESTIMATE_NOT_AN_OFFER: 'INDICATIVE_ESTIMATE_NOT_AN_OFFER',

  // --- Feature 011 — income-surrogate rule builder (admin) ---
  // Rule save rejections (FR-006 … FR-012). Every one names the offending row so
  // the admin form can point at it rather than reporting "the table is invalid".
  /** A table method was selected and its table is absent or empty (FR-009). */
  INCOME_RULE_EMPTY: 'INCOME_RULE_EMPTY',
  /** A row's `incomeEGP` is ≤ 0 or not Decimal-parseable (FR-010). */
  INCOME_RULE_INCOME_INVALID: 'INCOME_RULE_INCOME_INVALID',
  /** Two rows of a key table carry the same registry key (FR-006). */
  INCOME_RULE_DUPLICATE_KEY: 'INCOME_RULE_DUPLICATE_KEY',
  /**
   * A key table row names a key that is not an ACTIVE member of the method's
   * platform enumeration. Fails CLOSED (AS-1.9): the engine's lookup is by key,
   * so a dead key would resolve to nothing for every applicant, silently.
   */
  INCOME_RULE_UNKNOWN_KEY: 'INCOME_RULE_UNKNOWN_KEY',
  /**
   * Band edges unordered, gapped, overlapping, or an OPEN band with rows after it
   * (FR-008). `meta.reason` names which, `meta.index` the offending band. A closed
   * LAST band is legal — it means the rule yields nothing above that edge.
   */
  INCOME_RULE_BANDS_INVALID: 'INCOME_RULE_BANDS_INVALID',
  /** Per-rule DBR override outside (0, 100] (FR-012). */
  INCOME_RULE_DBR_OVERRIDE_INVALID: 'INCOME_RULE_DBR_OVERRIDE_INVALID',
  /**
   * The program's maximum-loan table (`loanLimits.maxLoanByFact`) cannot be read — an
   * unknown fact, rows keyed the wrong way for that fact's type, an option code the
   * question does not offer, a repeated cell, or bands that gap or overlap.
   *
   * A refusal and not a warning: every one of those makes the table match nothing, so it
   * would read as configured on the screen and cap nobody at runtime.
   */
  MAX_LOAN_BY_FACT_INVALID: 'MAX_LOAN_BY_FACT_INVALID',
  /**
   * The rule reads a `fact:<key>` that the registry cannot serve — no such fact, it
   * was deactivated, or its question was deleted / deactivated / changed to a type no
   * table can be keyed by.
   *
   * Fails CLOSED, exactly like `INCOME_RULE_UNKNOWN_KEY` and for the same reason: the
   * engine resolves an unserveable fact to `fact_not_answered` for every applicant,
   * forever, and the program keeps quoting off the declared salary as though the bank's
   * table were not there. `meta.factKey` names it; `meta.availableFacts` lists what the
   * registry does serve, so the form can offer the fix rather than state the problem.
   */
  INCOME_RULE_FACT_UNAVAILABLE: 'INCOME_RULE_FACT_UNAVAILABLE',
  /**
   * A product rule's step pipeline is not assemblable — `meta.reason` says which of
   * `PRODUCT_RULE_INVALID_REASONS` applied, and `meta.stepId` / `meta.gateId` name the
   * row to fix. ONE code with a reason rather than one code per reason: every one of them
   * points the operator at the same editor.
   */
  PRODUCT_RULE_INVALID: 'PRODUCT_RULE_INVALID',

  // --- The friendly form ---
  // A surrogate product's calculation, authored by answering three plain questions instead
  // of wiring steps by hand. The form is stored beside the rule it compiles to; these three
  // are the only ways a save of it is refused.

  /**
   * The FORM is not one the compiler can turn into a rule — `meta.reason` says which of
   * `TEMPLATE_INVALID_REASONS` applied, `meta.detail` names the offending value.
   *
   * Separate from `PRODUCT_RULE_INVALID`, and the split is not cosmetic: this one is about
   * the answers the operator gave, which is what is on their screen, while that one is about
   * the compiled steps, which on this path nobody typed. Reporting a step id to somebody who
   * never saw a step list would name a thing they cannot find.
   */
  PRODUCT_TEMPLATE_INVALID: 'PRODUCT_TEMPLATE_INVALID',
  /**
   * Saving this form would throw away figures a bank has already typed.
   *
   * A bank's numbers live in `stepParams` keyed by STEP ID, and so do the estimated-value
   * markers. Recompiling a changed form can stop emitting a step — removing one of the two
   * ways of reaching the figure, or a column — and every number filed under it is then
   * orphaned: the program still reads as configured and quotes nothing, or quotes off a
   * different derivation entirely.
   *
   * So the save is REFUSED rather than reconciled. `meta.programCodes` names the programs
   * that would lose figures and `meta.lostKeys` the boxes, so the operator can clear them
   * deliberately instead of discovering it from a customer.
   */
  PRODUCT_TEMPLATE_ORPHANS_FIGURES: 'PRODUCT_TEMPLATE_ORPHANS_FIGURES',
  /**
   * This product's calculation was authored through the raw step editor, so there is no form
   * to edit.
   *
   * Using Advanced is one-way BY DESIGN — a hand-edited step list has shapes the form cannot
   * describe, and a form that half-describes a live calculation is worse than no form. The
   * remedy is to start again from a shape, which creates a NEW product rather than silently
   * replacing this one.
   */
  PRODUCT_TEMPLATE_NOT_EDITABLE: 'PRODUCT_TEMPLATE_NOT_EDITABLE',

  // --- One name, one income proof ---
  // A catalog program name states exactly ONE thing a bank works the income out from.
  // Every surrogate program filed under that name reads the same one; a bank wanting a
  // different one is selling a different product and needs a different name. Only the
  // FIGURES are the bank's. All three fire on save only — never at read, so a program
  // that predates the rule keeps quoting while it is corrected.
  /**
   * The program reads something other than what its program name states.
   * `meta.expected` / `meta.got` / `meta.programNameKey`.
   *
   * Grandfathered on an UNCHANGED pair: an update that leaves both the name and the
   * strategy alone is not re-rejected, or a legacy program would be frozen out of
   * every unrelated edit — including the ones that would fix it.
   */
  PROGRAM_NAME_INCOME_PROOF_MISMATCH: 'PROGRAM_NAME_INCOME_PROOF_MISMATCH',
  /**
   * A surrogate program under a name that states no proof at all. The fix is on the
   * catalog, not on the program, so `meta.programNameKey` names where to go.
   *
   * Refused rather than defaulted: guessing the proof from whatever the first bank
   * happened to send is how one name ends up meaning two things.
   */
  PROGRAM_NAME_INCOME_PROOF_MISSING: 'PROGRAM_NAME_INCOME_PROOF_MISSING',
  /**
   * A catalog write that would change the name's proof while banks are still reading
   * it. `meta.programCodes` lists them.
   *
   * The tables those banks typed are keyed by the OLD proof — rank names against a
   * grade table — so letting the change through would leave live programs quoting
   * rows no applicant can match, and the operator would have no way to see it happen.
   */
  INCOME_PROOF_IN_USE: 'INCOME_PROOF_IN_USE',
  /**
   * A `valueSources` marker names a dot-path that is not on the program's
   * numeric allow-list AND never was on the stored one. A path that WAS markable
   * and no longer is (a row deleted, a method switched) is stale, not unknown: it
   * is pruned with the number it described, because rejecting it would trap the
   * admin behind a control that no longer exists (research R8).
   */
  VALUE_SOURCE_PATH_UNKNOWN: 'VALUE_SOURCE_PATH_UNKNOWN',
  /**
   * A `valueSources` entry carries something other than `team_estimated`. Its own
   * code, not `VALUE_SOURCE_PATH_UNKNOWN`: the path is fine, so "reload the
   * program and try again" would send the admin to fix the one thing that is right.
   */
  VALUE_SOURCE_VALUE_INVALID: 'VALUE_SOURCE_VALUE_INVALID',
  /**
   * Activation refused: the program still carries team-estimated numbers
   * (FR-033). `meta.paths` lists EVERY one, not the first — the admin has to ask
   * the bank about all of them, and a one-at-a-time reveal wastes a round trip.
   */
  PROGRAM_HAS_ESTIMATED_VALUES: 'PROGRAM_HAS_ESTIMATED_VALUES',
  /**
   * Publish/tree WARNING payload (never thrown): a surrogate fact's bound
   * question is missing, inactive, the wrong type, drifted from its registry, or
   * not assigned to `personal`. Sibling of `MONEY_FIELD_BINDING_MISSING` —
   * publishing is never blocked, or a half-renamed binding would lock the pool.
   */
  SURROGATE_FACT_BINDING_MISSING: 'SURROGATE_FACT_BINDING_MISSING',
  /**
   * WARNING payload (never thrown): a `factParentTable` step's key table has no row for one
   * or more live classes of the list its fact is filed under. `meta.missing` names them,
   * `meta.have` / `meta.expected` count them.
   *
   * Warning and never a refusal, the same posture the income-rule validator takes on parent
   * keys and for the same stated reason: refusing on a class list that moved would refuse a
   * save that a lookup fix elsewhere makes valid, and the fix is on another screen. What it
   * buys is that the operator hears it at all — an applicant filed under a missing class
   * gets `no_matching_row`, which STOPS the rule, and until now nothing said so before a
   * real customer hit it.
   *
   * Emitted on SAVE and again on READ, from one shared derivation, so leaving the screen
   * does not lose it.
   */
  INCOME_RULE_CLASS_ROW_MISSING: 'INCOME_RULE_CLASS_ROW_MISSING',
  // Reason codes: returned inside a 200 payload, the program still listed and
  // still ranked (FR-022, FR-024). They exist as a PAIR because the two lead to
  // different admin actions — assign the question vs. add the table row.
  /** The rule's fact is absent from the profile — not asked, or skipped (FR-020). */
  SURROGATE_FACT_MISSING: 'SURROGATE_FACT_MISSING',
  /** The fact was answered, but no key matched / the value fell in no band. */
  SURROGATE_NO_MATCHING_ROW: 'SURROGATE_NO_MATCHING_ROW',
  /**
   * A COLLATERAL product's own condition refused this applicant — the share paid is short,
   * the ownership contract is outside the bank's window, the strongest unit was not
   * confirmed. The program stays LISTED and stays RANKED; only the figures are withheld.
   *
   * Never an eligibility filter (A33), and it could not be one anyway: every production
   * path runs with `skipEligibility`, which is exactly why a product's own conditions are
   * expressed as rule GATES on this path instead.
   */
  PRODUCT_RULE_GATE_FAILED: 'PRODUCT_RULE_GATE_FAILED',
  // WHICH condition refused, from the closed `GATE_REASON_CODES` set. A gate's own id is
  // authored by an operator on the program catalog and could never have a translation, so
  // the engine reports one of these and every one has a sentence in both locales
  // (Principle III / A2). `GATE_NOT_MET` is the honest fallback for a condition the
  // platform has no word for yet.
  GATE_DOWN_PAYMENT_BELOW_MIN: 'GATE_DOWN_PAYMENT_BELOW_MIN',
  GATE_UNIT_PRICE_BELOW_MIN: 'GATE_UNIT_PRICE_BELOW_MIN',
  GATE_CONTRACT_TOO_NEW: 'GATE_CONTRACT_TOO_NEW',
  GATE_CONTRACT_TOO_OLD: 'GATE_CONTRACT_TOO_OLD',
  GATE_OWNERSHIP_NOT_CONFIRMED: 'GATE_OWNERSHIP_NOT_CONFIRMED',
  GATE_MULTI_UNIT_NOT_CONFIRMED: 'GATE_MULTI_UNIT_NOT_CONFIRMED',
  GATE_SELF_EMPLOYED_DOCS_MISSING: 'GATE_SELF_EMPLOYED_DOCS_MISSING',
  GATE_BUSINESS_TOO_NEW: 'GATE_BUSINESS_TOO_NEW',
  GATE_NOT_MET: 'GATE_NOT_MET',

  // --- Generic ---
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * HTTP status mapping. Reviewers can verify the OpenAPI contract matches.
 */
export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  AUTH_INVALID_CREDENTIALS: 401,
  AUTH_ACCOUNT_INACTIVE: 403,
  AUTH_TOKEN_MISSING: 401,
  AUTH_TOKEN_EXPIRED: 401,
  AUTH_TOKEN_INVALID: 401,
  AUTH_REFRESH_INVALID: 401,
  FORBIDDEN: 403,
  MUST_CHANGE_PASSWORD: 403,
  INVALID_CURRENT_PASSWORD: 401,

  PASSWORD_TOO_SHORT: 422,
  PASSWORD_TOO_LONG: 422,
  PASSWORD_BREACHED: 422,
  PASSWORD_ON_COMMON_LIST: 422,
  PASSWORD_BREACH_CHECK_UNAVAILABLE: 503,
  PASSWORD_REUSES_RESET_VALUE: 422,

  DUPLICATE_ENTRY: 409,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 422,
  CANNOT_SELF_MODIFY: 403,
  SUPER_ADMIN_FLOOR_VIOLATED: 403,

  BANK_PROGRAM_NOT_FOUND: 404,
  PROGRAM_CODE_ALREADY_IN_USE: 409,
  INVALID_VARIABLE_RATE_CONFIGURATION: 422,
  INVALID_QUALITATIVE_REVIEW_CEILING: 422,
  QUALITATIVE_REVIEW_CEILING_BELOW_BASE: 422,
  DERIVATION_ARITHMETIC_MISMATCH: 422,
  CONFLICT_STALE_DATA: 409,
  BANK_PROGRAM_HAS_OFFERS: 409,
  UNKNOWN_ENUMERATION_KEY: 422,
  DEPRECATED_ENUMERATION_KEY: 422,
  ENUMERATION_REGISTRY_UNAVAILABLE: 503,
  SEED_RATE_VERIFICATION_FAILED: 422,
  SEED_REQUIRES_SUPER_ADMIN: 403,

  NO_MATCHING_PROGRAMS: 200,
  INCOME_TOO_LOW: 200,
  AGE_NOT_ELIGIBLE: 200,
  DBR_EXCEEDED: 200,
  TENOR_OUT_OF_RANGE: 200,
  AMOUNT_OUT_OF_RANGE: 200,
  MISSING_CD_RECORD: 200,
  MISSING_CAR_LOAN_RECORD: 200,
  MISSING_BANK_STATEMENT: 200,
  INCOME_LOOKUP_FAILED: 200,
  MATCHING_ENGINE_ERROR: 500,
  IDEMPOTENCY_KEY_MISMATCH: 409,
  UNAUTHENTICATED: 401,

  SCORING_VERSION_CONCURRENT_PROMOTION: 409,
  SCORING_VERSION_NOT_FOUND: 404,
  SCORING_VERSION_NO_ACTIVE: 503,

  ENUMERATION_KEY_DUPLICATE: 409,
  ENUMERATION_SYSTEM_ONLY: 403,
  ENUMERATION_CATEGORIES_NOT_APPLICABLE: 422,
  ENUMERATION_CATEGORY_NOT_ASSIGNED: 422,
  ENUMERATION_QUESTIONS_NOT_APPLICABLE: 422,
  ENUMERATION_QUESTION_UNKNOWN: 422,
  ENUMERATION_QUESTION_BINDING_NOT_APPLICABLE: 422,
  SURROGATE_FACT_QUESTION_TYPE_INVALID: 422,
  // 409, like `BANK_HAS_PROGRAMS`: the request is well-formed and the row exists —
  // it is the current state of the world that refuses it, and it stops refusing
  // once the last program is repointed.
  ENUMERATION_IN_USE: 409,
  ENUMERATION_DELETE_NOT_SUPPORTED: 422,
  ENUMERATION_PARENT_REQUIRED: 422,
  ENUMERATION_PARENT_UNKNOWN: 422,
  ENUMERATION_PARENT_NOT_APPLICABLE: 422,
  // 409 for the same reason `ENUMERATION_IN_USE` is: state, not shape.
  ENUMERATION_HAS_CHILDREN: 409,
  // 409 for the same reason: state, not shape. Adding a value lifts it.
  MIRRORED_LIST_MIN_VALUES: 409,
  ENUMERATION_TYPE_IS_PARENT_AXIS: 409,
  ENUMERATION_TYPE_DUPLICATE: 409,
  ENUMERATION_TYPE_NOT_FOUND: 404,
  ENUMERATION_TYPE_IN_USE: 409,
  ENUMERATION_TYPE_SYSTEM_ONLY: 422,
  ENUMERATION_TYPE_PARENT_INVALID: 422,
  ENUMERATION_TYPE_FALLBACK_INVALID: 422,
  ENUMERATION_FALLBACK_IN_USE: 409,
  ENUMERATION_BULK_INVALID: 422,
  ENUMERATION_BULK_CREATE_NOT_APPLICABLE: 422,
  SURROGATE_PRODUCT_REQUIRED: 422,
  // 409, like the two above: state, not shape.
  SURROGATE_PRODUCT_IN_USE: 409,
  PROGRAM_NAME_RULE_LINKED: 422,
  SURROGATE_PRODUCT_NOT_FOUND: 404,
  PROGRAM_NAME_HAS_OWN_RULE: 422,

  BANK_NOT_FOUND: 404,
  BANK_NAME_DUPLICATE: 409,
  BANK_HAS_PROGRAMS: 409,
  BANK_CONFLICT_STALE_DATA: 409,

  BANK_OFFER_NOT_FOUND: 404,
  OFFER_NOT_FOR_APPLICATION: 409,
  ALREADY_PROCEEDED: 409,
  APPLICATION_NOT_MATCHED: 409,
  NONE_TRANSFER_UNSAFE: 422,

  SAVED_OFFER_NOT_FOUND: 404,

  CUSTOMER_PHONE_ALREADY_REGISTERED: 409,
  CUSTOMER_EMAIL_ALREADY_REGISTERED: 409,
  CUSTOMER_INVALID_CREDENTIALS: 401,
  CUSTOMER_ACCOUNT_INACTIVE: 403,
  CUSTOMER_REFRESH_INVALID: 401,
  CUSTOMER_NOT_FOUND: 404,
  CUSTOMER_PHONE_INVALID: 422,

  OTP_INVALID: 400,
  OTP_EXPIRED: 400,
  OTP_CONSUMED: 400,
  OTP_ATTEMPTS_EXCEEDED: 400,
  OTP_RATE_LIMITED: 429,
  OTP_PURPOSE_LOGIN_FORBIDDEN: 400,
  VERIFIED_MOBILE_TOKEN_INVALID: 401,
  VERIFIED_MOBILE_TOKEN_EXPIRED: 401,
  VERIFIED_MOBILE_TOKEN_CONSUMED: 401,
  SOCIAL_TOKEN_INVALID: 401,
  SOCIAL_TOKEN_EXPIRED: 401,
  SOCIAL_PROVIDER_UNAVAILABLE: 503,
  SOCIAL_SESSION_INVALID: 400,
  SOCIAL_SESSION_EXPIRED: 400,
  SOCIAL_SESSION_CONSUMED: 400,
  ACCOUNT_LOCKED: 423,
  PASSWORD_NOT_SET: 409,
  PASSWORD_SAME_AS_OLD: 422,
  PROFILE_INCOMPLETE: 409,
  PROFILE_FIELD_IMMUTABLE: 409,
  PROFILE_ID_DOCS_MISSING: 400,
  NATIONAL_ID_REQUIRED: 409,
  PROFILE_PHOTO_REQUIRED: 409,
  PASSWORD_REQUIRED_FOR_PHONE_PROFILE: 400,
  PASSWORD_FORBIDDEN_FOR_SOCIAL_PROFILE: 400,
  PHONE_MUTATION_ON_PHONE_CUSTOMER_FORBIDDEN: 403,
  PASSWORD_CHANGE_FORBIDDEN_FOR_SOCIAL: 403,
  AGE_INVALID: 422,
  DOCUMENTS_MISSING: 400,
  DOCUMENTS_NOT_OWNED: 403,
  BANK_PROGRAM_INVALID: 409,

  FILE_TOO_LARGE: 413,
  FILE_TYPE_NOT_ALLOWED: 415,
  DOCUMENT_OWNERSHIP_MISMATCH: 403,
  DOCUMENT_NOT_PENDING: 409,
  DOCUMENT_NOT_FOUND: 404,

  SUPPORT_REQUEST_NOT_FOUND: 404,
  SUPPORT_REQUEST_ALREADY_RESOLVED: 409,
  SUPPORT_CONFIG_NOT_FOUND: 404,

  ONBOARDING_SCREEN_NOT_FOUND: 404,
  ONBOARDING_ORDER_DUPLICATE: 409,

  TELEMETRY_EVENT_NOT_ALLOWED: 422,

  QUESTIONNAIRE_NOT_PUBLISHED: 404,
  QUESTION_GROUP_NOT_FOUND: 404,
  QUESTION_NOT_FOUND: 404,
  QUESTION_OPTION_NOT_FOUND: 404,
  UNKNOWN_QUESTION_CODE: 400,
  UNKNOWN_OPTION_CODE: 400,
  ENABLED_WHEN_INVALID: 422,
  QUESTION_IN_USE: 409,
  QUESTION_OPTION_IN_USE: 409,
  QUESTION_GROUP_NOT_EMPTY: 409,
  REQUIRED_ANSWER_MISSING: 422,
  PROGRAM_NO_LONGER_MATCHES: 409,
  WEIGHT_SET_NOT_FOUND: 404,
  WEIGHTS_UNKNOWN_OPTION: 422,
  WEIGHTS_QUESTION_WEIGHT_SUM_INVALID: 422,
  WEIGHTS_ANSWER_SCORE_OUT_OF_RANGE: 422,
  WEIGHTS_MISSING_RULE: 422,
  WEIGHTS_NUMERIC_BANDS_INVALID: 422,
  WEIGHTS_RULE_TYPE_MISMATCH: 422,
  WEIGHTS_QUESTION_NOT_IN_CATALOG: 422,

  DBR_BANDS_INVALID: 422,
  DBR_BAND_CAP_OUT_OF_RANGE: 422,
  PROGRAM_RANGE_INVALID: 422,
  PROGRAM_NAME_KEY_UNKNOWN: 422,
  PROGRAM_NAME_KEY_NOT_IN_CATEGORY: 422,
  ANSWER_TYPE_MISMATCH: 400,
  ANSWER_OUT_OF_RANGE: 400,
  ANSWER_TOO_LONG: 400,
  ANSWER_REQUIRED: 400,
  QUESTION_TYPE_RULES_INVALID: 422,
  QUESTION_TYPE_NOT_SCOREABLE: 422,
  MONEY_FIELD_BINDING_MISSING: 422,
  MONEY_FIGURE_MISSING: 422,
  OBLIGATIONS_TOTAL_MISMATCH: 422,
  CALCULATOR_INPUT_INVALID: 400,
  CALCULATOR_PROGRAM_INACTIVE: 409,
  PROGRAM_MISCONFIGURED: 422,
  // Reason codes + disclaimer: only ever returned inside a 200 payload.
  NO_RECOGNISED_INCOME: 200,
  OBLIGATIONS_EXCEED_ALLOWANCE: 200,
  BELOW_PROGRAM_MIN_AMOUNT: 200,
  AGE_AT_MATURITY: 200,
  INDICATIVE_ESTIMATE_NOT_AN_OFFER: 200,

  INCOME_RULE_EMPTY: 422,
  MAX_LOAN_BY_FACT_INVALID: 422,
  INCOME_RULE_INCOME_INVALID: 422,
  INCOME_RULE_DUPLICATE_KEY: 422,
  INCOME_RULE_UNKNOWN_KEY: 422,
  INCOME_RULE_BANDS_INVALID: 422,
  INCOME_RULE_DBR_OVERRIDE_INVALID: 422,
  INCOME_RULE_FACT_UNAVAILABLE: 422,
  PRODUCT_RULE_INVALID: 422,
  PRODUCT_TEMPLATE_INVALID: 422,
  PRODUCT_TEMPLATE_ORPHANS_FIGURES: 409,
  PRODUCT_TEMPLATE_NOT_EDITABLE: 409,
  PROGRAM_NAME_INCOME_PROOF_MISMATCH: 422,
  PROGRAM_NAME_INCOME_PROOF_MISSING: 422,
  INCOME_PROOF_IN_USE: 422,
  VALUE_SOURCE_PATH_UNKNOWN: 422,
  VALUE_SOURCE_VALUE_INVALID: 422,
  PROGRAM_HAS_ESTIMATED_VALUES: 409,
  SURROGATE_FACT_BINDING_MISSING: 422,
  INCOME_RULE_CLASS_ROW_MISSING: 422,
  // Reason codes: only ever returned inside a 200 payload.
  SURROGATE_FACT_MISSING: 200,
  SURROGATE_NO_MATCHING_ROW: 200,
  PRODUCT_RULE_GATE_FAILED: 200,
  GATE_DOWN_PAYMENT_BELOW_MIN: 200,
  GATE_UNIT_PRICE_BELOW_MIN: 200,
  GATE_CONTRACT_TOO_NEW: 200,
  GATE_CONTRACT_TOO_OLD: 200,
  GATE_OWNERSHIP_NOT_CONFIRMED: 200,
  GATE_MULTI_UNIT_NOT_CONFIRMED: 200,
  GATE_SELF_EMPLOYED_DOCS_MISSING: 200,
  GATE_BUSINESS_TOO_NEW: 200,
  GATE_NOT_MET: 200,

  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

export const ALL_ERROR_CODES: readonly ErrorCode[] = Object.values(ERROR_CODES);
