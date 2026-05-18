import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NzDrawerRef, NZ_DRAWER_DATA } from 'ng-zorro-antd/drawer';
import { AuthService } from '@core/auth/auth.service';
import type { AgentBucket } from '../lead-analytics.types';

interface DrawerData {
  agent: AgentBucket;
}

@Component({
  selector: 'app-agent-detail-drawer',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let a = data.agent;
    <article class="drawer-body">
      <header class="head">
        <span class="avatar" aria-hidden="true">{{ a.initials }}</span>
        <div class="title">
          <h2 class="name">{{ a.agentAlias }}</h2>
          <div class="meta">
            @if (a.isSystem) {
              <span class="badge platform" i18n="@@leadAnalytics.platform">Platform</span>
            } @else if (a.badge === 'top_performer') {
              <span class="badge top" i18n="@@leadAnalytics.badge.top">Top performer</span>
            } @else if (a.badge === 'needs_coaching') {
              <span class="badge coach" i18n="@@leadAnalytics.badge.coach">Needs coaching</span>
            } @else if (a.badge === 'stale') {
              <span class="badge stale-pill" i18n="@@leadAnalytics.badge.stale">Stale</span>
            }
            @if (a.lastActivityAt) {
              <span class="last-seen">
                <span i18n="@@leadAnalytics.lastSeen">Last active</span>
                {{ a.lastActivityAt | date: 'medium' }}
              </span>
            }
          </div>
        </div>
      </header>

      @if (!a.isSystem) {
        <section class="results" [attr.aria-label]="resultsAria">
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

        <section class="effort" [attr.aria-label]="effortAria">
          <div class="line">
            <span class="line-label" i18n="@@leadAnalytics.metric.submissionRate">Submission rate</span>
            <span class="line-value tabular">{{ formatPct(a.submissionRate) }}</span>
          </div>
          <div class="line">
            <span class="line-label" i18n="@@leadAnalytics.metric.activities.total">Activities</span>
            <span class="line-value tabular">{{ a.totalActivities }}</span>
          </div>
          <div class="line">
            <span class="line-label" i18n="@@leadAnalytics.metric.callMin">Call minutes</span>
            <span class="line-value">
              @if (a.callCount > 0) {
                <span class="tabular">{{ a.callMinutes }}m</span> /
                <span class="tabular">{{ a.callCount }}</span> calls =
                <span class="tabular">{{ formatAvg(a.avgCallMinutes) }}m</span>
                <span class="dim" i18n="@@leadAnalytics.effort.avg">avg</span>
              } @else {
                <span class="dim">—</span>
              }
            </span>
          </div>
          @if (a.shortCallCount > 0) {
            <div class="line">
              <span class="line-label" i18n="@@leadAnalytics.effort.shortCalls">Short calls (&lt;3m)</span>
              <span class="line-value tabular">{{ a.shortCallCount }}</span>
            </div>
          }
          <div class="line" [class.amber]="a.stuckLeadsCount > 0">
            <span class="line-label" i18n="@@leadAnalytics.effort.stuck.long">Stuck leads (&gt;7d)</span>
            <span class="line-value tabular">{{ a.stuckLeadsCount }}</span>
          </div>
        </section>
      }

      @if (a.activities.length > 0) {
        <section class="chips" [attr.aria-label]="chipsAria">
          <h3 class="section-title" i18n="@@leadAnalytics.section.activityBreakdown">Activity breakdown</h3>
          <ul class="strip" role="list">
            @for (act of a.activities; track act.type) {
              <li class="chip">
                <span class="chip-label">{{ act.label }}</span>
                <span class="chip-count tabular">{{ act.count }}</span>
                @if (act.minutes !== null) {
                  <span class="chip-minutes tabular">{{ act.minutes }}m</span>
                }
              </li>
            }
          </ul>
        </section>
      }

      @if (canDrillIn() && a.actorStaffId && !a.isSystem) {
        <footer class="footer">
          <a
            class="cta"
            [routerLink]="['/applications']"
            [queryParams]="{ assignedAgentStaffId: a.actorStaffId }"
            (click)="close()"
            i18n="@@leadAnalytics.viewLeads"
          >View this agent's leads →</a>
        </footer>
      }
    </article>
  `,
  styles: [
    `
      :host { display: block; }
      .drawer-body { display: flex; flex-direction: column; gap: var(--space-5); padding: var(--space-2); }

      .head { display: grid; grid-template-columns: 56px 1fr; gap: var(--space-3); align-items: center; }
      .avatar {
        display: inline-flex; align-items: center; justify-content: center;
        inline-size: 48px; block-size: 48px; border-radius: 50%;
        background: var(--accent-subtle, var(--color-tonal-accent-bg));
        color: var(--primary);
        font-weight: 700; font-size: 14px;
      }
      .title { min-inline-size: 0; }
      .name { margin: 0; font-size: var(--text-xl); font-weight: 700; color: var(--text-primary); }
      .meta { display: inline-flex; align-items: center; gap: var(--space-2); margin-block-start: 4px; flex-wrap: wrap; }
      .last-seen { font-size: 12px; color: var(--text-tertiary); }
      .last-seen > span:first-child {
        font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
        margin-inline-end: 4px;
      }

      .badge {
        font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
        padding: 2px 8px; border-radius: var(--radius-pill);
      }
      .badge.platform { background: var(--bg-muted); color: var(--text-tertiary); }
      .badge.top { background: color-mix(in oklab, var(--success) 16%, transparent); color: var(--success); }
      .badge.coach { background: color-mix(in oklab, var(--warning) 16%, transparent); color: var(--warning); }
      .badge.stale-pill { background: color-mix(in oklab, var(--error) 16%, transparent); color: var(--error); }

      .results {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: var(--space-3);
        padding: var(--space-4);
        background: var(--bg-subtle, var(--color-surface-row-hover));
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
      }
      .metric { display: flex; flex-direction: column; gap: 2px; }
      .metric-value {
        font-size: var(--text-xl); font-weight: 700;
        color: var(--text-primary); letter-spacing: -0.02em; line-height: 1;
      }
      .metric-label {
        font-size: 10px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
        color: var(--text-tertiary);
      }
      .metric.headline .metric-value { color: var(--primary); }
      .metric.headline[data-tone='success'] .metric-value { color: var(--success); }
      .metric.headline[data-tone='warning'] .metric-value { color: var(--warning); }
      .metric.headline[data-tone='error'] .metric-value { color: var(--error); }
      .metric.headline[data-tone='muted'] .metric-value { color: var(--text-tertiary); }

      .effort { display: flex; flex-direction: column; gap: var(--space-2); }
      .line {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: baseline;
        padding-block: 6px;
        border-block-end: 1px solid var(--border-subtle, var(--color-border-default));
      }
      .line:last-child { border-block-end: none; }
      .line-label { font-size: 13px; color: var(--text-secondary); }
      .line-value { font-size: 14px; font-weight: 700; color: var(--text-primary); }
      .line.amber .line-label, .line.amber .line-value { color: var(--warning); }
      .dim { color: var(--text-tertiary); margin-inline-start: 4px; }

      .section-title {
        margin: 0 0 var(--space-2) 0;
        font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
        color: var(--text-tertiary);
      }
      .strip {
        list-style: none; margin: 0; padding: 0;
        display: flex; flex-wrap: wrap; gap: var(--space-2);
      }
      .chip {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 4px 10px;
        background: var(--bg-subtle, var(--color-surface-row-hover));
        border: 1px solid var(--border-default);
        border-radius: var(--radius-pill);
      }
      .chip-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
      .chip-count {
        font-size: 12px; font-weight: 700;
        color: var(--primary);
        padding: 0 6px; border-radius: var(--radius-pill);
        background: var(--accent-subtle, var(--color-tonal-accent-bg));
      }
      .chip-minutes { font-size: 11px; font-weight: 600; color: var(--text-tertiary); }
      .tabular { font-variant-numeric: tabular-nums lining-nums; }

      .footer { display: flex; justify-content: flex-end; padding-block-start: var(--space-2); }
      .cta {
        display: inline-flex; align-items: center; gap: 4px;
        font-size: 13px; font-weight: 600;
        color: var(--primary); text-decoration: none;
        padding: 8px 14px; border-radius: var(--radius-md);
        background: var(--accent-subtle, var(--color-tonal-accent-bg));
        transition: background 150ms cubic-bezier(0.4, 0, 0.2, 1);
        cursor: pointer;
      }
      .cta:hover { background: color-mix(in oklab, var(--primary) 18%, transparent); }
    `,
  ],
})
export class AgentDetailDrawerComponent {
  private readonly auth = inject(AuthService);
  private readonly ref = inject(NzDrawerRef<AgentDetailDrawerComponent, void>);
  protected readonly data: DrawerData = inject(NZ_DRAWER_DATA);

  protected readonly resultsAria = $localize`:@@leadAnalytics.results.aria:Results — assigned, submitted, approved, conversion rate`;
  protected readonly effortAria = $localize`:@@leadAnalytics.effort.aria:Effort — activities, call minutes, stuck leads`;
  protected readonly chipsAria = $localize`:@@leadAnalytics.chips.aria:Activity-type breakdown`;

  protected canDrillIn(): boolean {
    const r = this.auth.role();
    return r === 'super_admin' || r === 'sales_manager';
  }

  protected close(): void {
    this.ref.close();
  }

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
}
