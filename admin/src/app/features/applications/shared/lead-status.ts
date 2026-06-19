import type { StatusTone } from '@shared/ui';

/**
 * Sales pipeline status of an application (lead). Mirrors the backend
 * `LeadStatus` enum. Separate from the engine matching `status`.
 */
export type LeadStatus = 'pending' | 'in_progress' | 'done' | 'cancelled';

/** Ordered for selectable controls (pending → in_progress → done, then cancelled). */
export const LEAD_STATUS_VALUES: readonly LeadStatus[] = [
  'pending',
  'in_progress',
  'done',
  'cancelled',
];

export interface LeadStatusMeta {
  readonly label: string;
  readonly tone: StatusTone;
}

/** Localized label + pill tone for a lead status. */
export function leadStatusMeta(status: LeadStatus): LeadStatusMeta {
  switch (status) {
    case 'pending':
      return { label: $localize`:@@lead.status.pending:Pending`, tone: 'neutral' };
    case 'in_progress':
      return { label: $localize`:@@lead.status.in_progress:In Progress`, tone: 'info' };
    case 'done':
      return { label: $localize`:@@lead.status.done:Done`, tone: 'success' };
    case 'cancelled':
      return { label: $localize`:@@lead.status.cancelled:Cancelled`, tone: 'error' };
  }
}
