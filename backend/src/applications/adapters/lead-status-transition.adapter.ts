// Pure adapter — feature 005, research R-003.
// Engine-purity rule: no I/O, no Prisma, no Nest imports.
//
// Maps (current leadStatus, freshly-written activity) → next leadStatus or null
// when no transition fires. Caller (activities.service) runs the UPDATE inside
// the same transaction as the activity INSERT.

import type { LeadStatus } from '@prisma/client';

export interface ActivityTransitionInput {
  activityType: string;
  reason: string;
  actorRole: 'super_admin' | 'sales_manager' | 'sales_agent' | 'system' | string;
}

export function deriveLeadStatusTransition(
  currentLeadStatus: LeadStatus,
  activity: ActivityTransitionInput,
): LeadStatus | null {
  if (activity.activityType === 'BANK_RESPONDED') {
    if (currentLeadStatus === 'submitted_to_bank') return 'bank_decided';
    return null;
  }

  if (activity.activityType === 'SUBMITTED_TO_BANK') {
    if (currentLeadStatus === 'submitted_to_bank' || currentLeadStatus === 'bank_decided') {
      return null;
    }
    return 'submitted_to_bank';
  }

  if (
    activity.activityType === 'MARKED_AS_REVIEWED' &&
    activity.reason === 'READY_FOR_SUBMISSION'
  ) {
    if (
      currentLeadStatus === 'needs_first_contact' ||
      currentLeadStatus === 'document_collection'
    ) {
      return 'ready_for_submission';
    }
    return null;
  }

  if (currentLeadStatus === 'needs_first_contact') {
    if (activity.actorRole === 'system') return null;
    return 'document_collection';
  }

  return null;
}
