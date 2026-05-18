import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NzDrawerRef, NZ_DRAWER_DATA } from 'ng-zorro-antd/drawer';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { AlertOutline, ClockCircleOutline, ThunderboltOutline } from '@ant-design/icons-angular/icons';
import { AuthService } from '@core/auth/auth.service';
import type { AgentBucket } from '../lead-analytics.types';

interface DrawerData {
  agent: AgentBucket;
  slowFirstContactMs: number;
}

@Component({
  selector: 'app-agent-detail-drawer',
  standalone: true,
  imports: [CommonModule, RouterLink, NzIconModule],
  providers: [provideNzIconsPatch([AlertOutline, ClockCircleOutline, ThunderboltOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let a = data.agent;
    <article class="drawer-body">
      <header class="head">
        <span class="avatar" aria-hidden="true">{{ a.initials }}</span>
        <div class="title">
          <h2 class="name">{{ a.agentAlias }}</h2>
          <div class="meta">
            @if (a.badge === 'top_performer') {
              <span class="badge top" i18n="@@leadAnalytics.badge.top">Top performer</span>
            } @else if (a.badge === 'needs_coaching') {
              <span class="badge coach" i18n="@@leadAnalytics.badge.coach">Needs coaching</span>
            } @else if (a.badge === 'stale') {
              <span class="badge stale-pill">
                <span nz-icon nzType="alert" nzTheme="outline"></span>
                <span i18n="@@leadAnalytics.badge.stale">Stale</span>
              </span>
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

      <!-- RESULTS TIER -->
      <section class="tier results" [attr.aria-label]="resultsAria">
        <header class="tier-head">
          <span class="tier-label primary" i18n="@@leadAnalytics.tier.results">Results</span>
          <span class="tier-sub" i18n="@@leadAnalytics.tier.results.sub">The headline — what actually closed</span>
        </header>
        <div class="grid">
          @if (canDrillIn() && a.actorStaffId) {
            <a class="kpi link" [routerLink]="['/applications']" [queryParams]="{ assignedAgentStaffId: a.actorStaffId }" (click)="close()">
              <span class="kpi-value tabular">{{ a.results.leadsAssigned }}</span>
              <span class="kpi-label" i18n="@@leadAnalytics.kpi.assigned">Assigned</span>
            </a>
          } @else {
            <div class="kpi">
              <span class="kpi-value tabular">{{ a.results.leadsAssigned }}</span>
              <span class="kpi-label" i18n="@@leadAnalytics.kpi.assigned">Assigned</span>
            </div>
          }

          <div class="kpi hero" [attr.data-tone]="convTone(a.results.conversionRate)">
            <span class="kpi-value tabular">{{ formatPct(a.results.conversionRate) }}</span>
            <span class="kpi-label" i18n="@@leadAnalytics.kpi.conversion">Conversion rate</span>
          </div>

          <div class="kpi">
            <span class="kpi-value tabular">{{ formatEgp(a.results.valueFundedEGP) }}</span>
            <span class="kpi-label" i18n="@@leadAnalytics.kpi.valueFunded">Value funded</span>
          </div>

          <div class="kpi">
            <span class="kpi-value tabular">{{ a.results.loansApproved }}</span>
            <span class="kpi-label" i18n="@@leadAnalytics.kpi.approved">Loans approved</span>
          </div>
        </div>
      </section>

      <!-- PIPELINE TIER -->
      <section class="tier pipeline" [attr.aria-label]="pipelineAria">
        <header class="tier-head">
          <span class="tier-label" i18n="@@leadAnalytics.tier.pipeline">Pipeline</span>
          <span class="tier-sub" i18n="@@leadAnalytics.tier.pipeline.sub">Funnel diagnostics — where time + leads go</span>
        </header>
        <div class="line-list">
          <div class="line" [class.amber]="a.pipeline.slowFirstContact">
            <span class="line-label">
              @if (a.pipeline.slowFirstContact) {
                <span nz-icon nzType="clock-circle" nzTheme="outline" class="warn-icon"></span>
              } @else if (a.pipeline.avgSpeedToFirstContactMs !== null) {
                <span nz-icon nzType="thunderbolt" nzTheme="outline" class="ok-icon"></span>
              }
              <span i18n="@@leadAnalytics.kpi.speed.long">Avg speed to first contact</span>
            </span>
            <span class="line-value tabular">{{ formatDuration(a.pipeline.avgSpeedToFirstContactMs) }}</span>
          </div>
          <div class="line">
            <span class="line-label" i18n="@@leadAnalytics.kpi.bankApproval.long">Bank approval rate</span>
            <span class="line-value tabular">{{ formatPct(a.pipeline.bankApprovalRate) }}</span>
          </div>
          <div class="line">
            <span class="line-label" i18n="@@leadAnalytics.kpi.cycle.long">Avg cycle time (assigned → submitted)</span>
            <span class="line-value tabular">{{ formatCycle(a.pipeline.avgCycleTimeMs) }}</span>
          </div>
          <div class="line">
            <span class="line-label" i18n="@@leadAnalytics.kpi.submitted.long">Leads submitted to bank</span>
            <span class="line-value tabular">{{ a.pipeline.leadsSubmittedToBank }}</span>
          </div>
          <div class="line" [class.amber]="a.pipeline.stuckLeadsCount > 0">
            <span class="line-label" i18n="@@leadAnalytics.kpi.stuck.long">Stuck leads (&gt;7d no progress)</span>
            <span class="line-value tabular">{{ a.pipeline.stuckLeadsCount }}</span>
          </div>
        </div>
      </section>

      <!-- ACTIVITY TIER -->
      <section class="tier activity" [attr.aria-label]="activityAria">
        <header class="tier-head">
          <span class="tier-label muted" i18n="@@leadAnalytics.tier.activity">Effort — context only</span>
          <span class="tier-sub" i18n="@@leadAnalytics.tier.activity.sub">Volume of work. Not a performance metric.</span>
        </header>
        <div class="line-list dim">
          <div class="line">
            <span class="line-label" i18n="@@leadAnalytics.act.activitiesLong">Activities</span>
            <span class="line-value tabular">{{ a.activity.totalActivities }}</span>
          </div>
          @if (a.activity.callCount > 0) {
            <div class="line">
              <span class="line-label" i18n="@@leadAnalytics.act.callsLong">Calls</span>
              <span class="line-value">
                <span class="tabular">{{ a.activity.callMinutes }}m</span> /
                <span class="tabular">{{ a.activity.callCount }}</span> =
                <span class="tabular">{{ formatAvg(a.activity.avgCallMinutes) }}m</span>
                <span class="dim" i18n="@@leadAnalytics.effort.avg">avg</span>
              </span>
            </div>
          }
          @if (a.activity.shortCallCount > 0) {
            <div class="line">
              <span class="line-label" i18n="@@leadAnalytics.act.shortCalls">Short calls (&lt;3m)</span>
              <span class="line-value tabular">{{ a.activity.shortCallCount }}</span>
            </div>
          }
          @if (a.activity.whatsappCount > 0) {
            <div class="line">
              <span class="line-label" i18n="@@leadAnalytics.act.whatsapp">WhatsApp messages</span>
              <span class="line-value tabular">{{ a.activity.whatsappCount }}</span>
            </div>
          }
          @if (a.activity.documentReviewedCount > 0 || a.activity.documentReceivedCount > 0) {
            <div class="line">
              <span class="line-label" i18n="@@leadAnalytics.act.documents">Documents (received / reviewed)</span>
              <span class="line-value tabular">
                {{ a.activity.documentReceivedCount }} / {{ a.activity.documentReviewedCount }}
              </span>
            </div>
          }
        </div>
        @if (a.activities.length > 0) {
          <ul class="chips" role="list">
            @for (act of a.activities; track act.type) {
              <li class="chip">
                <span class="chip-label">{{ act.label }}</span>
                <span class="chip-count tabular">{{ act.count }}</span>
              </li>
            }
          </ul>
        }
      </section>

      @if (canDrillIn() && a.actorStaffId) {
        <footer class="footer">
          <a class="cta" [routerLink]="['/applications']" [queryParams]="{ assignedAgentStaffId: a.actorStaffId }" (click)="close()" i18n="@@leadAnalytics.viewLeads">
            View this agent's leads →
          </a>
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
        background: var(--accent-subtle); color: var(--primary);
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
        display: inline-flex; align-items: center; gap: 4px;
      }
      .badge.top { background: color-mix(in oklab, var(--success) 14%, transparent); color: var(--success); }
      .badge.coach { background: color-mix(in oklab, var(--warning) 14%, transparent); color: var(--warning); }
      .badge.stale-pill { background: color-mix(in oklab, var(--error) 14%, transparent); color: var(--error); }

      .tier { display: flex; flex-direction: column; gap: var(--space-3); }
      .tier-head { display: flex; flex-direction: column; gap: 2px; }
      .tier-label {
        font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
        color: var(--text-tertiary);
      }
      .tier-label.primary { color: var(--primary); }
      .tier-label.muted { color: var(--text-tertiary); opacity: 0.8; }
      .tier-sub { font-size: 12px; color: var(--text-tertiary); }

      .grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: var(--space-3);
        padding: var(--space-3);
        background: var(--bg-subtle);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
      }
      .kpi {
        display: flex; flex-direction: column; gap: 2px;
        padding: 8px;
        border-radius: var(--radius-md);
        text-decoration: none;
        color: inherit;
        transition: background 150ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .kpi.link { cursor: pointer; }
      .kpi.link:hover { background: var(--bg-surface); }
      .kpi-value {
        font-size: 20px; font-weight: 700; line-height: 1;
        color: var(--text-primary); letter-spacing: -0.02em;
      }
      .kpi.hero .kpi-value { font-size: 28px; color: var(--primary); letter-spacing: -0.03em; }
      .kpi.hero[data-tone='success'] .kpi-value { color: var(--success); }
      .kpi.hero[data-tone='warning'] .kpi-value { color: var(--warning); }
      .kpi.hero[data-tone='error'] .kpi-value { color: var(--error); }
      .kpi.hero[data-tone='muted'] .kpi-value { color: var(--text-tertiary); }
      .kpi-label {
        font-size: 10px; font-weight: 600;
        letter-spacing: 0.06em; text-transform: uppercase;
        color: var(--text-tertiary);
        margin-block-start: 2px;
      }

      .line-list { display: flex; flex-direction: column; gap: 0; }
      .line-list.dim { opacity: 0.85; }
      .line {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: baseline;
        padding-block: 8px;
        border-block-end: 1px solid var(--border-subtle, var(--border-default));
      }
      .line:last-child { border-block-end: none; }
      .line-label {
        font-size: 13px; color: var(--text-secondary);
        display: inline-flex; align-items: center; gap: 4px;
      }
      .line-value { font-size: 14px; font-weight: 700; color: var(--text-primary); }
      .line.amber .line-label, .line.amber .line-value { color: var(--warning); }
      .warn-icon { color: var(--warning); }
      .ok-icon { color: var(--success); }
      .dim { color: var(--text-tertiary); margin-inline-start: 4px; }

      .chips {
        list-style: none; margin: var(--space-2) 0 0 0; padding: 0;
        display: flex; flex-wrap: wrap; gap: 6px;
      }
      .chip {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 4px 10px;
        background: var(--bg-subtle);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-pill);
      }
      .chip-label { font-size: 11px; font-weight: 600; color: var(--text-secondary); }
      .chip-count {
        font-size: 11px; font-weight: 700;
        color: var(--primary);
        padding: 0 6px; border-radius: var(--radius-pill);
        background: var(--accent-subtle);
      }
      .tabular { font-variant-numeric: tabular-nums lining-nums; }

      .footer { display: flex; justify-content: flex-end; padding-block-start: var(--space-2); }
      .cta {
        display: inline-flex; align-items: center; gap: 4px;
        font-size: 13px; font-weight: 600;
        color: var(--primary); text-decoration: none;
        padding: 8px 14px; border-radius: var(--radius-md);
        background: var(--accent-subtle);
        transition: background 150ms cubic-bezier(0.4, 0, 0.2, 1);
        cursor: pointer;
      }
      .cta:hover { background: color-mix(in oklab, var(--primary) 18%, transparent); }

      @media (prefers-reduced-motion: reduce) {
        .kpi.link, .cta { transition: none !important; }
      }
    `,
  ],
})
export class AgentDetailDrawerComponent {
  private readonly auth = inject(AuthService);
  private readonly ref = inject(NzDrawerRef<AgentDetailDrawerComponent, void>);
  protected readonly data: DrawerData = inject(NZ_DRAWER_DATA);

  protected readonly resultsAria = $localize`:@@leaderboard.aria.results:Results — conversion, value funded, loans approved`;
  protected readonly pipelineAria = $localize`:@@leaderboard.aria.pipeline:Pipeline — speed to contact, bank approval rate, cycle time`;
  protected readonly activityAria = $localize`:@@leaderboard.aria.activity:Effort — context only`;

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

  protected formatEgp(v: string | null): string {
    if (v === null) return '—';
    const n = Number(v);
    if (!Number.isFinite(n) || n === 0) return '—';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(/\.0+$/, '')}M EGP`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K EGP`;
    return `${Math.round(n)} EGP`;
  }

  protected formatDuration(ms: number | null): string {
    if (ms === null) return '—';
    const sec = Math.max(0, Math.floor(ms / 1000));
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    const remMin = min % 60;
    if (hr < 24) return remMin > 0 ? `${hr}h ${remMin}m` : `${hr}h`;
    const day = Math.floor(hr / 24);
    return `${day}d`;
  }

  protected formatCycle(ms: number | null): string {
    if (ms === null) return '—';
    const days = ms / (1000 * 60 * 60 * 24);
    if (days < 1) {
      const hr = Math.round(ms / (1000 * 60 * 60));
      return `${hr}h`;
    }
    return `${days.toFixed(1).replace(/\.0$/, '')}d`;
  }

  protected convTone(v: number | null): 'success' | 'warning' | 'error' | 'muted' | 'default' {
    if (v === null) return 'muted';
    if (v >= 0.4) return 'success';
    if (v >= 0.2) return 'warning';
    return 'error';
  }
}
