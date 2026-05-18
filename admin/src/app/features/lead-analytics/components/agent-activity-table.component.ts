import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import type { AgentActivitySummaryRow, AgentRollupRow } from '../lead-analytics.api.service';

export type AgentSortKey = 'conversion' | 'activities' | 'callMinutes' | 'stuck' | 'lastActivity';

type Badge = 'top_performer' | 'needs_coaching' | 'stale' | null;

interface AgentBucket extends AgentRollupRow {
  initials: string;
  badge: Badge;
  activities: ReadonlyArray<{ type: string; label: string; count: number; minutes: number | null }>;
}

const MIN_SAMPLE_FOR_BADGE = 3;

@Component({
  selector: 'app-agent-activity-table',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (buckets().length === 0) {
      <div class="empty-card">
        <p class="empty-title" i18n="@@leadAnalytics.empty">No activity recorded in this window.</p>
        <p class="empty-sub" i18n="@@leadAnalytics.emptySub">
          Once agents start logging calls, follow-ups, and document reviews, their per-agent rollups land here.
        </p>
      </div>
    } @else {
      <ul class="agent-list" role="list">
        @for (a of buckets(); track a.agentAlias) {
          <li class="agent-card" [class.platform]="a.isSystem" [class.stale]="a.badge === 'stale'" [class.coaching]="a.badge === 'needs_coaching'">
            <header class="agent-head">
              <span class="agent-avatar" aria-hidden="true">{{ a.initials }}</span>
              <div class="agent-id">
                @if (canDrillIn() && a.actorStaffId && !a.isSystem) {
                  <a
                    class="agent-name link"
                    [routerLink]="['/applications']"
                    [queryParams]="{ assignedAgentStaffId: a.actorStaffId }"
                  >{{ a.agentAlias }}</a>
                } @else {
                  <span class="agent-name">{{ a.agentAlias }}</span>
                }
                @if (a.isSystem) {
                  <span class="agent-badge platform" i18n="@@leadAnalytics.platform">Platform</span>
                } @else if (a.badge === 'top_performer') {
                  <span class="agent-badge top" i18n="@@leadAnalytics.badge.top">Top performer</span>
                } @else if (a.badge === 'needs_coaching') {
                  <span class="agent-badge coach" i18n="@@leadAnalytics.badge.coach">Needs coaching</span>
                } @else if (a.badge === 'stale') {
                  <span class="agent-badge stale-pill" i18n="@@leadAnalytics.badge.stale">Stale</span>
                }
              </div>
              @if (a.lastActivityAt) {
                <span class="last-seen tabular">
                  <span class="last-seen-label" i18n="@@leadAnalytics.lastSeen">Last active</span>
                  {{ a.lastActivityAt | date: 'shortDate' }}
                </span>
              }
            </header>

            @if (!a.isSystem) {
              <section class="results-row" [attr.aria-label]="resultsAria">
                <div class="metric">
                  <span class="metric-value tabular">{{ a.leadsAssigned }}</span>
                  <span class="metric-label" i18n="@@leadAnalytics.metric.assigned">Assigned</span>
                </div>
                <div class="metric">
                  <span class="metric-value tabular">{{ a.submittedToBank }}</span>
                  <span class="metric-label" i18n="@@leadAnalytics.metric.submitted">Submitted</span>
                </div>
                <div class="metric">
                  <span class="metric-value tabular">{{ a.approvedByBank }}</span>
                  <span class="metric-label" i18n="@@leadAnalytics.metric.approved">Approved</span>
                </div>
                <div class="metric headline" [attr.data-tone]="convTone(a.conversionRate)">
                  <span class="metric-value tabular">{{ formatPct(a.conversionRate) }}</span>
                  <span class="metric-label" i18n="@@leadAnalytics.metric.conversion">Conversion rate</span>
                </div>
              </section>
            }

            <section class="effort-row" [attr.aria-label]="effortAria">
              <span class="effort-item">
                <span class="effort-value tabular">{{ a.totalActivities }}</span>
                <span class="effort-label" i18n="@@leadAnalytics.effort.activities">activities</span>
              </span>
              @if (a.callCount > 0) {
                <span class="effort-item">
                  <span class="effort-value tabular">{{ a.callMinutes }}m</span>
                  <span class="effort-label">
                    / {{ a.callCount }} =
                    <span class="tabular">{{ formatAvg(a.avgCallMinutes) }}m</span>
                    <span i18n="@@leadAnalytics.effort.avg">avg</span>
                  </span>
                </span>
              }
              @if (a.shortCallCount > 0) {
                <span class="effort-item muted">
                  <span class="effort-value tabular">{{ a.shortCallCount }}</span>
                  <span class="effort-label" i18n="@@leadAnalytics.effort.shortCalls">short calls</span>
                </span>
              }
              @if (a.stuckLeadsCount > 0) {
                <span class="effort-item amber">
                  <span class="effort-value tabular">{{ a.stuckLeadsCount }}</span>
                  <span class="effort-label" i18n="@@leadAnalytics.effort.stuck">leads stalled &gt;7d</span>
                </span>
              }
            </section>

            @if (a.activities.length > 0) {
              <ul class="activity-strip" role="list">
                @for (act of a.activities; track act.type) {
                  <li class="activity">
                    <span class="activity-label">{{ act.label }}</span>
                    <span class="activity-count tabular">{{ act.count }}</span>
                    @if (act.minutes !== null) {
                      <span class="activity-minutes tabular">{{ act.minutes }}m</span>
                    }
                  </li>
                }
              </ul>
            }
          </li>
        }
      </ul>
    }
  `,
  styles: [
    `
      :host { display: block; }
      .agent-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-3); }
      .agent-card {
        background: var(--bg-surface, var(--color-surface-default));
        border: 1px solid var(--border-default, var(--color-border-default));
        border-radius: var(--radius-lg);
        overflow: hidden;
      }
      .agent-card.platform { background: var(--bg-subtle, var(--color-surface-row-hover)); }
      .agent-card.stale { border-color: var(--error, #c1666b); box-shadow: 0 0 0 1px var(--error, #c1666b) inset; }
      .agent-card.coaching { border-color: var(--warning, #c8893d); }

      .agent-head {
        display: grid;
        grid-template-columns: 44px minmax(0, 1fr) auto;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-4) var(--space-5);
        border-block-end: 1px solid var(--border-subtle, var(--color-border-default));
      }
      .agent-avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 40px;
        block-size: 40px;
        border-radius: 50%;
        background: var(--accent-subtle, var(--color-tonal-accent-bg));
        color: var(--primary, var(--color-brand-primary));
        font-weight: 700;
        font-size: 13px;
        letter-spacing: 0.02em;
      }
      .agent-card.platform .agent-avatar {
        background: var(--bg-muted, var(--color-surface-muted));
        color: var(--text-secondary, var(--color-text-secondary));
      }
      .agent-id { display: flex; align-items: center; gap: var(--space-2); min-inline-size: 0; flex-wrap: wrap; }
      .agent-name {
        font-size: var(--text-md);
        font-weight: 700;
        color: var(--text-primary, var(--color-text-primary));
        letter-spacing: -0.005em;
      }
      .agent-name.link {
        color: var(--primary, var(--color-brand-primary));
        text-decoration: none;
        cursor: pointer;
        transition: color 150ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .agent-name.link:hover { text-decoration: underline; }
      .agent-badge {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        padding: 2px 8px;
        border-radius: var(--radius-pill);
      }
      .agent-badge.platform { background: var(--bg-muted); color: var(--text-tertiary); }
      .agent-badge.top { background: color-mix(in oklab, var(--success) 16%, transparent); color: var(--success); }
      .agent-badge.coach { background: color-mix(in oklab, var(--warning) 16%, transparent); color: var(--warning); }
      .agent-badge.stale-pill { background: color-mix(in oklab, var(--error) 16%, transparent); color: var(--error); }

      .last-seen {
        display: inline-flex;
        flex-direction: column;
        align-items: flex-end;
        font-size: 12px;
        font-weight: 600;
        color: var(--text-secondary);
      }
      .last-seen-label {
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-tertiary);
      }

      .results-row {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: var(--space-3);
        padding: var(--space-4) var(--space-5);
        border-block-end: 1px solid var(--border-subtle, var(--color-border-default));
      }
      .metric { display: flex; flex-direction: column; gap: 2px; }
      .metric-value {
        font-size: var(--text-xl);
        font-weight: 700;
        color: var(--text-primary);
        letter-spacing: -0.02em;
        line-height: 1;
      }
      .metric-label {
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--text-tertiary);
      }
      .metric.headline .metric-value { color: var(--primary); }
      .metric.headline[data-tone='success'] .metric-value { color: var(--success); }
      .metric.headline[data-tone='warning'] .metric-value { color: var(--warning); }
      .metric.headline[data-tone='error'] .metric-value { color: var(--error); }
      .metric.headline[data-tone='muted'] .metric-value { color: var(--text-tertiary); }

      .effort-row {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2) var(--space-4);
        padding: var(--space-3) var(--space-5);
        border-block-end: 1px solid var(--border-subtle, var(--color-border-default));
      }
      .effort-item {
        display: inline-flex;
        align-items: baseline;
        gap: 4px;
        font-size: 13px;
        color: var(--text-secondary);
      }
      .effort-value { font-weight: 700; color: var(--text-primary); }
      .effort-label { font-size: 12px; color: var(--text-tertiary); }
      .effort-item.muted .effort-value { color: var(--text-tertiary); }
      .effort-item.amber .effort-value, .effort-item.amber .effort-label { color: var(--warning); font-weight: 700; }

      .activity-strip {
        list-style: none;
        margin: 0;
        padding: var(--space-3) var(--space-4);
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }
      .activity {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        background: var(--bg-subtle, var(--color-surface-row-hover));
        border: 1px solid var(--border-default, var(--color-border-default));
        border-radius: var(--radius-pill);
      }
      .activity-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
      .activity-count {
        font-size: 12px;
        font-weight: 700;
        color: var(--primary);
        padding: 0 6px;
        border-radius: var(--radius-pill);
        background: var(--accent-subtle, var(--color-tonal-accent-bg));
      }
      .activity-minutes { font-size: 11px; font-weight: 600; color: var(--text-tertiary); }
      .tabular { font-variant-numeric: tabular-nums lining-nums; }

      .empty-card {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        padding: var(--space-9) var(--space-5);
        text-align: center;
        background: var(--bg-surface, var(--color-surface-default));
        border: 1px dashed var(--border-default, var(--color-border-default));
        border-radius: var(--radius-lg);
      }
      .empty-title { margin: 0; font-size: var(--text-md); font-weight: 700; color: var(--text-primary); }
      .empty-sub { margin: 0; font-size: var(--text-sm); color: var(--text-tertiary); max-inline-size: 56ch; align-self: center; }
    `,
  ],
})
export class AgentActivityTableComponent {
  private readonly auth = inject(AuthService);

  readonly rows = input.required<readonly AgentActivitySummaryRow[]>();
  readonly agents = input.required<readonly AgentRollupRow[]>();
  readonly sortKey = input<AgentSortKey>('conversion');

  protected readonly resultsAria = $localize`:@@leadAnalytics.results.aria:Results — assigned, submitted, approved, conversion rate`;
  protected readonly effortAria = $localize`:@@leadAnalytics.effort.aria:Effort — activities, call minutes, stuck leads`;

  protected readonly canDrillIn = computed(() => {
    const r = this.auth.role();
    return r === 'super_admin' || r === 'sales_manager';
  });

  protected readonly buckets = computed<readonly AgentBucket[]>(() => {
    const activityByAgent = new Map<string, { type: string; label: string; count: number; minutes: number | null }[]>();
    for (const r of this.rows()) {
      const list = activityByAgent.get(r.agentAlias) ?? [];
      list.push({
        type: r.activityType,
        label: this.formatType(r.activityType),
        count: r.count,
        minutes: r.totalDurationMinutes ?? null,
      });
      activityByAgent.set(r.agentAlias, list);
    }
    for (const list of activityByAgent.values()) list.sort((a, b) => b.count - a.count);

    const agents = [...this.agents()];
    const conversions = agents
      .filter((a) => !a.isSystem && a.conversionRate !== null && a.leadsAssigned >= MIN_SAMPLE_FOR_BADGE)
      .map((a) => a.conversionRate as number)
      .sort((a, b) => a - b);
    const activities = agents
      .filter((a) => !a.isSystem)
      .map((a) => a.totalActivities)
      .sort((a, b) => a - b);

    const convTop = this.quantile(conversions, 2 / 3);
    const convBottom = this.quantile(conversions, 1 / 3);
    const activityTop = this.quantile(activities, 2 / 3);

    const enriched: AgentBucket[] = agents.map((a) => {
      let badge: Badge = null;
      if (a.isSystem) {
        badge = null;
      } else if (a.isStale) {
        badge = 'stale';
      } else if (
        a.leadsAssigned >= MIN_SAMPLE_FOR_BADGE &&
        a.conversionRate !== null &&
        convTop !== null &&
        a.conversionRate >= convTop
      ) {
        badge = 'top_performer';
      } else if (
        a.leadsAssigned >= MIN_SAMPLE_FOR_BADGE &&
        activityTop !== null &&
        a.totalActivities >= activityTop &&
        a.conversionRate !== null &&
        convBottom !== null &&
        a.conversionRate <= convBottom
      ) {
        badge = 'needs_coaching';
      }
      return {
        ...a,
        initials: this.initialsOf(a.agentAlias),
        badge,
        activities: activityByAgent.get(a.agentAlias) ?? [],
      };
    });

    const sortKey = this.sortKey();
    enriched.sort((a, b) => {
      if (a.isSystem !== b.isSystem) return a.isSystem ? 1 : -1;
      if (a.badge === 'stale' && b.badge !== 'stale') return -1;
      if (b.badge === 'stale' && a.badge !== 'stale') return 1;
      return this.compareBySort(a, b, sortKey);
    });
    return enriched;
  });

  protected formatPct(v: number | null): string {
    return v === null ? '—' : `${Math.round(v * 100)}%`;
  }

  protected formatAvg(v: number | null): string {
    return v === null ? '0' : v.toFixed(1).replace(/\.0$/, '');
  }

  protected convTone(v: number | null): 'success' | 'warning' | 'error' | 'muted' | 'default' {
    if (v === null) return 'muted';
    if (v >= 0.4) return 'success';
    if (v >= 0.2) return 'warning';
    return 'error';
  }

  private compareBySort(a: AgentBucket, b: AgentBucket, key: AgentSortKey): number {
    switch (key) {
      case 'conversion': {
        const av = a.conversionRate ?? -1;
        const bv = b.conversionRate ?? -1;
        if (bv !== av) return bv - av;
        return b.leadsAssigned - a.leadsAssigned;
      }
      case 'activities':
        return b.totalActivities - a.totalActivities;
      case 'callMinutes':
        return b.callMinutes - a.callMinutes;
      case 'stuck':
        return b.stuckLeadsCount - a.stuckLeadsCount;
      case 'lastActivity': {
        const av = a.lastActivityAt ? Date.parse(a.lastActivityAt) : 0;
        const bv = b.lastActivityAt ? Date.parse(b.lastActivityAt) : 0;
        return bv - av;
      }
      default:
        return 0;
    }
  }

  private quantile(sortedAsc: readonly number[], q: number): number | null {
    if (sortedAsc.length === 0) return null;
    const idx = Math.min(sortedAsc.length - 1, Math.floor(q * sortedAsc.length));
    return sortedAsc[idx] ?? null;
  }

  private formatType(t: string): string {
    return t
      .toLowerCase()
      .split('_')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');
  }

  private initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }
}
