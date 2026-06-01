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

export class BankCodeDuplicateException extends DomainException {
  constructor(code: string) {
    super(ERROR_CODES.BANK_CODE_DUPLICATE, { code });
  }
}

export class BankCodeInvalidFormatException extends DomainException {
  constructor(code: string) {
    super(ERROR_CODES.BANK_CODE_INVALID_FORMAT, { code });
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

// --- Scoring versions / analytics (feature 004) ----------------------------

export class ScoringVersionConcurrentPromotionException extends DomainException {
  constructor() {
    super(ERROR_CODES.SCORING_VERSION_CONCURRENT_PROMOTION);
  }
}

export class ScoringVersionNotFoundException extends DomainException {
  constructor(version: string) {
    super(ERROR_CODES.SCORING_VERSION_NOT_FOUND, { version });
  }
}

export class ScoringVersionNoActiveException extends DomainException {
  constructor() {
    super(ERROR_CODES.SCORING_VERSION_NO_ACTIVE);
  }
}

export class AnalyticsWindowTooLargeException extends DomainException {
  constructor(maxDays: number) {
    super(ERROR_CODES.ANALYTICS_WINDOW_TOO_LARGE, { maxDays });
  }
}

// --- Lead management (feature 005) -----------------------------------------

export class ActivityForbiddenNotAssignedException extends DomainException {
  constructor(applicationId: string) {
    super(ERROR_CODES.ACTIVITY_FORBIDDEN_NOT_ASSIGNED, { applicationId });
  }
}

export class InvalidActivityReasonException extends DomainException {
  constructor(meta: { activityType: string; reason: string; allowedReasons: readonly string[] }) {
    super(ERROR_CODES.INVALID_ACTIVITY_REASON, meta);
  }
}

export class ReasonDetailsRequiredException extends DomainException {
  constructor() {
    super(ERROR_CODES.REASON_DETAILS_REQUIRED);
  }
}

export class DurationRequiredForCallException extends DomainException {
  constructor() {
    super(ERROR_CODES.DURATION_REQUIRED_FOR_CALL);
  }
}

export class FollowupInPastException extends DomainException {
  constructor(followUpAt: string) {
    super(ERROR_CODES.FOLLOWUP_IN_PAST, { followUpAt });
  }
}

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
