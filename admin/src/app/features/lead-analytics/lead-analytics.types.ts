import type { AgentRollupRow } from './lead-analytics.api.service';

export type AgentSortKey =
  | 'agent'
  | 'conversion'
  | 'valueFunded'
  | 'approved'
  | 'speedToFirstContact'
  | 'bankApprovalRate'
  | 'cycleTime'
  | 'stuck'
  | 'activities'
  | 'lastActivity';

export type SortDir = 'asc' | 'desc';

export type AgentBadge = 'top_performer' | 'needs_coaching' | 'stale' | null;

export type AgentFilter = 'all' | 'top_performer' | 'needs_coaching' | 'stale';

export interface AgentActivityChip {
  type: string;
  label: string;
  count: number;
  minutes: number | null;
}

export interface AgentBucket extends AgentRollupRow {
  initials: string;
  badge: AgentBadge;
  activities: ReadonlyArray<AgentActivityChip>;
}
