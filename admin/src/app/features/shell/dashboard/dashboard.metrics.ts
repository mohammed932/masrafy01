import type { AdminApplicationRow } from '@features/applications/api/applications.api.service';
import type { SupportRequestRow } from '@features/support/support.api.service';
import type { LeadStatus } from '@features/applications/shared/lead-status';

/**
 * Pure derivations behind the dashboard. Everything here reads the SAME rows the
 * applications list already fetches — the dashboard adds no new endpoint, it
 * just counts. Side-effect free so the page component stays presentation-only
 * and each number is reviewable on its own.
 *
 * Principle II: nothing keys off a bank or program identity.
 */

export interface PipelineCounts {
  readonly pending: number;
  readonly in_progress: number;
  readonly done: number;
  readonly cancelled: number;
  readonly total: number;
  /** Share of non-cancelled leads that reached `done`, 0..1. */
  readonly closeRate: number | null;
}

export function pipelineCounts(rows: readonly AdminApplicationRow[]): PipelineCounts {
  const by = (s: LeadStatus): number => rows.filter((r) => r.leadStatus === s).length;
  const pending = by('pending');
  const inProgress = by('in_progress');
  const done = by('done');
  const cancelled = by('cancelled');
  const live = pending + inProgress + done;
  return {
    pending,
    in_progress: inProgress,
    done,
    cancelled,
    total: rows.length,
    closeRate: live > 0 ? done / live : null,
  };
}

export interface SupportCounts {
  readonly open: number;
  readonly inProgress: number;
  readonly total: number;
}

/**
 * The snapshot already holds only live rows (open + in progress), but they are
 * counted by status rather than by length so the split survives any future
 * widening of the fetch.
 */
export function supportCounts(rows: readonly SupportRequestRow[]): SupportCounts {
  const open = rows.filter((r) => r.status === 'open').length;
  const inProgress = rows.filter((r) => r.status === 'in_progress').length;
  return { open, inProgress, total: open + inProgress };
}
