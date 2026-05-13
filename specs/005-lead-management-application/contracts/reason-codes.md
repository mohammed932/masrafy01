# Activity Type × Reason Code Matrix

**Canonical source of truth** for the FR-003 activity-type → allowed-reason-code mapping. Validated at the application layer (FR-004) via `backend/src/activities/activity-reasons.ts` const which mirrors this doc 1:1. `OTHER` is always present and requires a free-text `note` (FR-036).

## Matrix

| Activity Type | Reason Codes |
|---|---|
| `CALLED_USER` | `INITIAL_CONTACT`, `FOLLOWUP`, `DOCUMENT_REMINDER`, `STATUS_UPDATE`, `VERIFICATION_CALL`, `COMPLAINT_RESOLUTION`, `RESCHEDULE`, `OTHER` |
| `SENT_WHATSAPP` | `DOCUMENT_REQUEST`, `STATUS_UPDATE`, `REMINDER`, `WELCOME_MESSAGE`, `BANK_SUBMISSION_NOTICE`, `APPROVAL_NOTICE`, `REJECTION_NOTICE`, `OTHER` |
| `SENT_EMAIL` | `DOCUMENT_REQUEST`, `STATUS_UPDATE`, `APPROVAL_LETTER`, `REJECTION_LETTER`, `BANK_SUBMISSION`, `COMPLIANCE_NOTICE`, `OTHER` |
| `RECEIVED_DOCUMENTS` | `VIA_WHATSAPP`, `VIA_EMAIL`, `IN_PERSON`, `VIA_MOBILE_APP_UPLOAD`, `VIA_COURIER`, `OTHER` |
| `REVIEWED_DOCUMENTS` | `ALL_COMPLETE`, `MISSING_ITEMS`, `QUALITY_ISSUES`, `MISMATCH_WITH_PROFILE`, `VERIFIED_READY`, `NEEDS_CLARIFICATION`, `OTHER` |
| `REQUESTED_MORE_DOCS` | `MISSING_ITEM`, `DOCUMENT_BLURRY`, `DOCUMENT_EXPIRED`, `WRONG_DOCUMENT_TYPE`, `NAME_MISMATCH`, `QUALITY_ISSUE`, `ADDITIONAL_VERIFICATION`, `OTHER` |
| `UPDATED_APPLICANT_INFO` | `CORRECTED_PHONE`, `CORRECTED_INCOME`, `UPDATED_EMPLOYMENT`, `CORRECTED_ADDRESS`, `OTHER_CORRECTION`, `OTHER` |
| `MARKED_AS_REVIEWED` | `READY_FOR_SUBMISSION`, `NEEDS_MANAGER_APPROVAL`, `HOLD_FOR_FOLLOWUP`, `INTERNAL_REVIEW_ONLY`, `OTHER` |
| `INTERNAL_NOTE` | `GENERAL_OBSERVATION`, `CUSTOMER_FEEDBACK`, `SALES_TIP`, `WARNING_FLAG`, `REMINDER_FOR_SELF`, `REMINDER_FOR_MANAGER`, `FOLLOWUP_COMPLETED`, `FOLLOWUP_SNOOZED`, `FOLLOWUP_CANCELLED`, `OTHER` |
| `STATUS_CHANGE` | `SYSTEM_GENERATED` (system-only — agents never pick this) |
| `SUBMITTED_TO_BANK` | dynamic; equals the set of `BankProgram.programCode` values that are currently `active=true`. Validated at write time against the live registry. |
| `BANK_RESPONDED` | `APPROVED`, `REJECTED`, `NEEDS_MORE_INFO`, `CONDITIONAL_APPROVAL`, `COUNTER_OFFER`, `OTHER` |
| `LEAD_REASSIGNED` | `INITIAL_ASSIGNMENT`, `WORKLOAD_REBALANCE`, `SKILL_MATCH`, `AGENT_DEACTIVATED`, `MANAGER_OVERRIDE`, `OTHER` |
| `STALE_LEAD_FLAGGED` | `NO_ACTIVITY_48H` (system-only) |

## Validation rules

- An `activityType` not in the matrix is rejected with `INVALID_ACTIVITY_TYPE` (422).
- A `reason` not in the row for its activity type is rejected with `INVALID_ACTIVITY_REASON` (FR-035).
- `reason='OTHER'` requires a non-empty `note`; else `REASON_DETAILS_REQUIRED` (FR-036).
- `STATUS_CHANGE` and `STALE_LEAD_FLAGGED` types are system-only — rejected at the controller if `actorRole != 'system'`.
- `SUBMITTED_TO_BANK` reason lookup goes through `BankProgramRepository.findAllActive()` cache (1-minute TTL); a deprecated bank code returns `INVALID_ACTIVITY_REASON`.

## Adding a new entry

Same-PR rule:

1. Add a row to this doc.
2. Add the literal to `ACTIVITY_REASONS` in `backend/src/activities/activity-reasons.ts`.
3. Add an i18n unit `@@activity.reason.<TYPE>.<REASON>` to `admin/src/i18n/messages.ar-EG.xlf` (AR + EN target).
4. Add the localized chip to any UI surface that needs it (Add Activity dropdown, filter chips).

A linter check (out of scope for this feature) can statically verify the three lists agree.
