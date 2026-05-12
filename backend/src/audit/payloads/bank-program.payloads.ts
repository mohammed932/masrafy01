/**
 * Audit event payload schemas for bank-program events.
 * Research R6 + Principle VI (no PII).
 *
 * Payload shapes here are documentation + structural types; runtime validation
 * is informal (the audit-event-writer trusts the service to pass valid payloads).
 * A class-validator pass at write time is a Phase 9+ hardening item.
 */

export interface BankProgramCreatedPayload {
  programCode: string;
  friendlyName: string;
  bankName: string;
  productCategory: string;
  active: boolean;
  seededFrom?: string;
}

export interface BankProgramUpdatedPayload {
  programCode: string;
  diff: Array<{ fieldPath: string; before: unknown; after: unknown }>;
}

export interface BankProgramToggledPayload {
  programCode: string;
  before: 'active' | 'inactive';
  after: 'active' | 'inactive';
}

export interface BankProgramClonedPayload {
  sourceProgramCode: string;
  newProgramCode: string;
}

export interface BankProgramDeletedPayload {
  programCode: string;
  friendlyName: string;
  bankName: string;
  deletedAt: string;
}

export interface BankProgramRateUpdatedPayload {
  programCode: string;
  beforeEffectiveRate: string | null;
  afterEffectiveRate: string | null;
  isVariableRate: boolean;
  operatorNote?: string;
}

export interface BankProgramQualitativeReviewDecidedPayload {
  programCode: string;
  offerId: string;
  decision: 'approved' | 'denied';
  uplift?: { beforeMaxEGP: string; afterMaxEGP: string };
  rationale: string;
}

/**
 * Forbid-PII invariant: none of the above payloads may carry applicant identifiers,
 * email addresses, phone numbers, account numbers, or any other end-user data.
 * Reviewers should reject PRs that add such fields here.
 */
