// Canonical activityType × reasonCode matrix (FR-003 / FR-004).
// Mirrors specs/005-lead-management-application/contracts/reason-codes.md 1:1.
// SUBMITTED_TO_BANK reasons are dynamic (= active BankProgram.programCode set)
// and validated via BankProgramRepository.findAllActive() at write time.

import type { ActivityType, ReasonCode } from './activities.types';

export const ACTIVITY_REASONS = {
  CALLED_USER: [
    'INITIAL_CONTACT',
    'FOLLOWUP',
    'DOCUMENT_REMINDER',
    'STATUS_UPDATE',
    'VERIFICATION_CALL',
    'COMPLAINT_RESOLUTION',
    'RESCHEDULE',
    'OTHER',
  ],
  SENT_WHATSAPP: [
    'DOCUMENT_REQUEST',
    'STATUS_UPDATE',
    'REMINDER',
    'WELCOME_MESSAGE',
    'BANK_SUBMISSION_NOTICE',
    'APPROVAL_NOTICE',
    'REJECTION_NOTICE',
    'OTHER',
  ],
  SENT_EMAIL: [
    'DOCUMENT_REQUEST',
    'STATUS_UPDATE',
    'APPROVAL_LETTER',
    'REJECTION_LETTER',
    'BANK_SUBMISSION',
    'COMPLIANCE_NOTICE',
    'OTHER',
  ],
  RECEIVED_DOCUMENTS: [
    'VIA_WHATSAPP',
    'VIA_EMAIL',
    'IN_PERSON',
    'VIA_MOBILE_APP_UPLOAD',
    'VIA_COURIER',
    'OTHER',
  ],
  REVIEWED_DOCUMENTS: [
    'ALL_COMPLETE',
    'MISSING_ITEMS',
    'QUALITY_ISSUES',
    'MISMATCH_WITH_PROFILE',
    'VERIFIED_READY',
    'NEEDS_CLARIFICATION',
    'OTHER',
  ],
  REQUESTED_MORE_DOCS: [
    'MISSING_ITEM',
    'DOCUMENT_BLURRY',
    'DOCUMENT_EXPIRED',
    'WRONG_DOCUMENT_TYPE',
    'NAME_MISMATCH',
    'QUALITY_ISSUE',
    'ADDITIONAL_VERIFICATION',
    'OTHER',
  ],
  UPDATED_APPLICANT_INFO: [
    'CORRECTED_PHONE',
    'CORRECTED_INCOME',
    'UPDATED_EMPLOYMENT',
    'CORRECTED_ADDRESS',
    'OTHER_CORRECTION',
    'OTHER',
  ],
  MARKED_AS_REVIEWED: [
    'READY_FOR_SUBMISSION',
    'NEEDS_MANAGER_APPROVAL',
    'HOLD_FOR_FOLLOWUP',
    'INTERNAL_REVIEW_ONLY',
    'OTHER',
  ],
  INTERNAL_NOTE: [
    'GENERAL_OBSERVATION',
    'CUSTOMER_FEEDBACK',
    'SALES_TIP',
    'WARNING_FLAG',
    'REMINDER_FOR_SELF',
    'REMINDER_FOR_MANAGER',
    'FOLLOWUP_COMPLETED',
    'FOLLOWUP_SNOOZED',
    'FOLLOWUP_CANCELLED',
    'OTHER',
  ],
  STATUS_CHANGE: ['SYSTEM_GENERATED'],
  SUBMITTED_TO_BANK: [] as readonly string[], // dynamic — validated against active BankProgram.programCode set
  BANK_RESPONDED: [
    'APPROVED',
    'REJECTED',
    'NEEDS_MORE_INFO',
    'CONDITIONAL_APPROVAL',
    'COUNTER_OFFER',
    'OTHER',
  ],
  LEAD_REASSIGNED: [
    'INITIAL_ASSIGNMENT',
    'WORKLOAD_REBALANCE',
    'SKILL_MATCH',
    'AGENT_DEACTIVATED',
    'MANAGER_OVERRIDE',
    'OTHER',
  ],
  STALE_LEAD_FLAGGED: ['NO_ACTIVITY_48H'],
} as const satisfies Readonly<Record<ActivityType, readonly string[]>>;

export type ActivityReasonsMap = typeof ACTIVITY_REASONS;

export interface ValidateActivityReasonResult {
  valid: boolean;
  allowedReasons: readonly string[];
}

/**
 * Statically validates `reason` against the canonical matrix for `activityType`.
 * SUBMITTED_TO_BANK is dynamic and MUST go through a second pass against the
 * live BankProgramRepository. The result here only short-circuits the static set.
 */
export function validateActivityReason(
  activityType: ActivityType,
  reason: ReasonCode,
  dynamicReasons?: readonly string[],
): ValidateActivityReasonResult {
  if (activityType === 'SUBMITTED_TO_BANK') {
    const allowed = dynamicReasons ?? [];
    return { valid: allowed.includes(reason), allowedReasons: allowed };
  }
  const staticAllowed = ACTIVITY_REASONS[activityType];
  return { valid: (staticAllowed as readonly string[]).includes(reason), allowedReasons: staticAllowed };
}
