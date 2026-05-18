import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import {
  ArrowUpOutline,
  ArrowDownOutline,
  RightOutline,
  AlertOutline,
  ThunderboltOutline,
  ClockCircleOutline,
} from '@ant-design/icons-angular/icons';
import { AuthService } from '@core/auth/auth.service';
import type {
  AgentBucket,
  AgentSortKey,
  SortDir,
} from '../lead-analytics.types';

interface ColDef {
  key: AgentSortKey;
  label: string;
  align: 'start' | 'end' | 'center';
  sortable: boolean;
  width: string;
}

@Component({
  selector: 'app-agent-leaderboard-table',
  standalone: true,
  imports: [CommonModule, NzIconModule],
  providers: [
    provideNzIconsPatch([
      ArrowUpOutline,
      ArrowDownOutline,
      RightOutline,
      AlertOutline,
      ThunderboltOutline,
      ClockCircleOutline,
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (agents().length === 0) {
      <div class="empty-card">
        <p class="empty-title" i18n="@@leadAnalytics.empty">No agents match the current filters.</p>
        <p class="empty-sub" i18n="@@leadAnalytics.emptySub">
          Adjust the window, search, or filter chips to widen the view.
        </p>
      </div>
    } @else {
      <div class="board" role="table">
        <div class="head" role="row">
          @for (c of cols; track c.key) {
            <button
              type="button"
              class="th"
              [class.sortable]="c.sortable"
              [class.active]="sortKey() === c.key"
              [style.flex]="c.width"
              [style.text-align]="c.align"
              [attr.aria-sort]="ariaSortFor(c.key)"
              [attr.disabled]="!c.sortable ? '' : null"
              (click)="c.sortable && onHeaderClick(c.key)"
            >
              <span class="th-label">{{ c.label }}</span>
              @if (c.sortable && sortKey() === c.key) {
                <span class="sort-ind" aria-hidden="true">
                  @if (sortDir() === 'asc') {
                    <span nz-icon nzType="arrow-up" nzTheme="outline"></span>
                  } @else {
                    <span nz-icon nzType="arrow-down" nzTheme="outline"></span>
                  }
                </span>
              }
            </button>
          }
          <span class="th-spacer" aria-hidden="true"></span>
        </div>

        <ul class="rows" role="rowgroup">
          @for (a of agents(); track a.agentAlias; let i = $index) {
            <li
              class="row"
              role="row"
              [class.tone-stale]="a.badge === 'stale'"
              [class.tone-coach]="a.badge === 'needs_coaching'"
              [class.tone-top]="a.badge === 'top_performer'"
              [class.clickable]="canDrillIn() && a.actorStaffId"
              (click)="onRowClick(a)"
              (keydown.enter)="onRowClick(a)"
              [attr.tabindex]="canDrillIn() && a.actorStaffId ? 0 : -1"
            >
              <!-- AGENT CELL -->
              <div class="cell agent-cell" [style.flex]="'1.4'">
                <div class="avatar-wrap">
                  <span class="avatar" aria-hidden="true">{{ a.initials }}</span>
                  <span class="rank tabular" aria-hidden="true">#{{ i + 1 }}</span>
                </div>
                <div class="agent-id">
                  <div class="agent-line">
                    <span class="name">{{ a.agentAlias }}</span>
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
                  </div>
                  <div class="agent-meta">
                    <span class="meta-num tabular">{{ a.results.leadsAssigned }}</span>
                    <span class="meta-label" i18n="@@leadAnalytics.metric.assigned.label">assigned</span>
                    @if (a.pipeline.stuckLeadsCount > 0) {
                      <span class="meta-sep">·</span>
                      <span class="meta-warn tabular">{{ a.pipeline.stuckLeadsCount }}</span>
                      <span class="meta-warn-label" i18n="@@leadAnalytics.metric.stuck.label">stuck</span>
                    }
                  </div>
                </div>
              </div>

              <!-- RESULTS TIER -->
              <div class="cell results-cell" [style.flex]="'2'" role="group" [attr.aria-label]="resultsAria">
                <span class="tier-tag results-tag" i18n="@@leadAnalytics.tier.results">Results</span>
                <div class="kpi-row">
                  <div class="kpi kpi-hero">
                    <span class="kpi-value tabular" [attr.data-tone]="convTone(a.results.conversionRate)">
                      {{ formatPct(a.results.conversionRate) }}
                    </span>
                    <span class="kpi-label" i18n="@@leadAnalytics.kpi.conversion">conversion</span>
                  </div>
                  <div class="kpi">
                    <span class="kpi-value tabular">{{ formatEgp(a.results.valueFundedEGP) }}</span>
                    <span class="kpi-label" i18n="@@leadAnalytics.kpi.valueFunded">value funded</span>
                  </div>
                  <div class="kpi">
                    <span class="kpi-value tabular">{{ a.results.loansApproved }}</span>
                    <span class="kpi-label" i18n="@@leadAnalytics.kpi.approved">approved</span>
                  </div>
                </div>
              </div>

              <!-- PIPELINE TIER -->
              <div class="cell pipeline-cell" [style.flex]="'2'" role="group" [attr.aria-label]="pipelineAria">
                <span class="tier-tag pipeline-tag" i18n="@@leadAnalytics.tier.pipeline">Pipeline</span>
                <div class="kpi-row">
                  <div class="kpi" [class.amber]="a.pipeline.slowFirstContact">
                    <span class="kpi-value-with-icon">
                      @if (a.pipeline.slowFirstContact) {
                        <span nz-icon nzType="clock-circle" nzTheme="outline" class="warn-icon"></span>
                      } @else if (a.pipeline.avgSpeedToFirstContactMs !== null) {
                        <span nz-icon nzType="thunderbolt" nzTheme="outline" class="ok-icon"></span>
                      }
                      <span class="kpi-value tabular">{{ formatDurationShort(a.pipeline.avgSpeedToFirstContactMs) }}</span>
                    </span>
                    <span class="kpi-label" i18n="@@leadAnalytics.kpi.speed">speed to contact</span>
                  </div>
                  <div class="kpi">
                    <span class="kpi-value tabular">{{ formatPct(a.pipeline.bankApprovalRate) }}</span>
                    <span class="kpi-label" i18n="@@leadAnalytics.kpi.bankApproval">bank approval</span>
                  </div>
                  <div class="kpi">
                    <span class="kpi-value tabular">{{ formatCycle(a.pipeline.avgCycleTimeMs) }}</span>
                    <span class="kpi-label" i18n="@@leadAnalytics.kpi.cycle">cycle time</span>
                  </div>
                </div>
              </div>

              <!-- ACTIVITY TIER (greyed, context only) -->
              <div class="cell activity-cell" [style.flex]="'1.2'" role="group" [attr.aria-label]="activityAria">
                <span class="tier-tag activity-tag" i18n="@@leadAnalytics.tier.activity">Effort — context</span>
                <div class="activity-row">
                  <div class="act">
                    <span class="act-value tabular">{{ a.activity.totalActivities }}</span>
                    <span class="act-label" i18n="@@leadAnalytics.act.total">acts</span>
                  </div>
                  @if (a.activity.callCount > 0) {
                    <div class="act">
                      <span class="act-value tabular">{{ formatAvg(a.activity.avgCallMinutes) }}m</span>
                      <span class="act-label" i18n="@@leadAnalytics.act.callAvg">call avg</span>
                    </div>
                  }
                  @if (a.activity.whatsappCount > 0) {
                    <div class="act">
                      <span class="act-value tabular">{{ a.activity.whatsappCount }}</span>
                      <span class="act-label" i18n="@@leadAnalytics.act.wa">whatsapp</span>
                    </div>
                  }
                </div>
              </div>

              <!-- LAST -->
              <div class="cell last-cell" [style.flex]="'0.7'">
                @if (a.lastActivityAt) {
                  <span class="pulse" [attr.data-fresh]="freshness(a.lastActivityAt)" aria-hidden="true"></span>
                  <span class="last-rel" [attr.title]="a.lastActivityAt">{{ relativeTime(a.lastActivityAt) }}</span>
                } @else {
                  <span class="muted">—</span>
                }
              </div>

              <span class="chevron" aria-hidden="true">
                @if (canDrillIn() && a.actorStaffId) {
                  <span nz-icon nzType="right" nzTheme="outline"></span>
                }
              </span>
            </li>
          }
        </ul>
      </div>
    }
  `,
  styles: [
    `
      :host { display: block; }

      .board {
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        overflow: hidden;
      }

      .head {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-5);
        background: var(--bg-subtle);
        border-block-end: 1px solid var(--border-default);
      }
      .th {
        appearance: none;
        background: none; border: 0; padding: 0;
        font: inherit; text-align: start;
        color: var(--text-tertiary);
        font-size: 10px; font-weight: 700;
        letter-spacing: 0.1em; text-transform: uppercase;
        white-space: nowrap;
        display: inline-flex; align-items: center; gap: 4px;
        transition: color 150ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .th.sortable { cursor: pointer; }
      .th.sortable:hover, .th.active { color: var(--text-primary); }
      .th[disabled] { cursor: default; }
      .sort-ind { font-size: 10px; color: var(--primary); }
      .th-spacer { flex: 0 0 36px; }

      .rows { list-style: none; margin: 0; padding: 0; }
      .row {
        position: relative;
        display: flex;
        align-items: stretch;
        gap: var(--space-3);
        padding: var(--space-4) var(--space-5);
        min-block-size: 96px;
        border-block-end: 1px solid var(--border-subtle, var(--border-default));
        transition: background 160ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .row:last-child { border-block-end: none; }
      .row.clickable { cursor: pointer; }
      .row:hover { background: var(--bg-subtle); }
      .row.tone-top::before,
      .row.tone-coach::before,
      .row.tone-stale::before {
        content: ''; position: absolute; inset-block: 0;
        inset-inline-start: 0; inline-size: 3px;
      }
      .row.tone-top::before { background: var(--success); }
      .row.tone-coach::before { background: var(--warning); }
      .row.tone-stale::before { background: var(--error); }
      .row.tone-stale { background: color-mix(in oklab, var(--error) 4%, transparent); }
      .row.tone-stale:hover { background: color-mix(in oklab, var(--error) 9%, transparent); }
      .row:focus-visible { outline: none; box-shadow: var(--focus-halo); z-index: 1; }
      .row:hover .chevron { opacity: 1; transform: translateX(2px); }

      .cell { display: flex; flex-direction: column; gap: 6px; min-inline-size: 0; justify-content: center; }

      /* AGENT CELL */
      .agent-cell { flex-direction: row; align-items: center; gap: var(--space-3); }
      .avatar-wrap { position: relative; flex-shrink: 0; }
      .avatar {
        display: inline-flex; align-items: center; justify-content: center;
        inline-size: 40px; block-size: 40px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--accent-subtle), var(--bg-muted));
        color: var(--primary);
        font-weight: 700; font-size: 13px; letter-spacing: 0.02em;
      }
      .row.tone-top .avatar {
        background: linear-gradient(135deg, color-mix(in oklab, var(--success) 22%, transparent), var(--accent-subtle));
      }
      .row.tone-stale .avatar {
        background: linear-gradient(135deg, color-mix(in oklab, var(--error) 18%, transparent), var(--bg-muted));
      }
      .rank {
        position: absolute;
        inset-block-start: -6px; inset-inline-end: -8px;
        font-size: 9px; font-weight: 700;
        padding: 1px 6px; border-radius: var(--radius-pill);
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        color: var(--text-tertiary);
        line-height: 1.2;
      }
      .row.tone-top .rank { color: var(--success); border-color: color-mix(in oklab, var(--success) 30%, var(--border-default)); }

      .agent-id { display: flex; flex-direction: column; gap: 2px; min-inline-size: 0; }
      .agent-line { display: inline-flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
      .name {
        font-size: 15px; font-weight: 700; color: var(--text-primary);
        letter-spacing: -0.01em; line-height: 1.2;
      }
      .row.clickable .name { color: var(--primary); }
      .row.clickable:hover .name {
        text-decoration: underline;
        text-underline-offset: 3px;
        text-decoration-thickness: 1px;
      }

      .badge {
        font-size: 10px; font-weight: 700;
        letter-spacing: 0.06em; text-transform: uppercase;
        padding: 3px 9px; border-radius: var(--radius-pill);
        white-space: nowrap;
        display: inline-flex; align-items: center; gap: 4px;
      }
      .badge.top {
        background: color-mix(in oklab, var(--success) 14%, transparent);
        color: var(--success);
        box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--success) 30%, transparent);
      }
      .badge.coach {
        background: color-mix(in oklab, var(--warning) 14%, transparent);
        color: var(--warning);
        box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--warning) 30%, transparent);
      }
      .badge.stale-pill {
        background: color-mix(in oklab, var(--error) 14%, transparent);
        color: var(--error);
        box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--error) 30%, transparent);
      }

      .agent-meta {
        display: inline-flex; align-items: baseline; gap: 4px;
        font-size: 12px; color: var(--text-tertiary);
      }
      .meta-num { font-weight: 700; color: var(--text-secondary); }
      .meta-sep { color: var(--text-tertiary); opacity: 0.5; padding-inline: 2px; }
      .meta-warn { font-weight: 700; color: var(--warning); }
      .meta-warn-label { color: var(--warning); opacity: 0.85; }

      /* TIER TAGS */
      .tier-tag {
        font-size: 9px; font-weight: 700;
        letter-spacing: 0.12em; text-transform: uppercase;
        color: var(--text-tertiary);
        padding-block-end: 4px;
        align-self: flex-start;
      }
      .results-tag { color: var(--primary); }
      .pipeline-tag { color: var(--text-secondary); }
      .activity-tag { color: var(--text-tertiary); }

      /* KPI ROWS */
      .kpi-row { display: flex; gap: var(--space-4); align-items: flex-end; }
      .kpi { display: flex; flex-direction: column; gap: 1px; min-inline-size: 0; }
      .kpi-value {
        font-size: 18px; font-weight: 700; line-height: 1.1;
        color: var(--text-primary); letter-spacing: -0.02em;
      }
      .kpi-hero .kpi-value { font-size: 24px; letter-spacing: -0.03em; }
      .kpi-value[data-tone='success'] { color: var(--success); }
      .kpi-value[data-tone='warning'] { color: var(--warning); }
      .kpi-value[data-tone='error'] { color: var(--error); }
      .kpi-value[data-tone='muted'] { color: var(--text-tertiary); }
      .kpi-label {
        font-size: 9px; font-weight: 700;
        letter-spacing: 0.1em; text-transform: uppercase;
        color: var(--text-tertiary);
        margin-block-start: 2px;
        white-space: nowrap;
      }
      .kpi-value-with-icon { display: inline-flex; align-items: center; gap: 4px; }
      .warn-icon { color: var(--warning); font-size: 12px; }
      .ok-icon { color: var(--success); font-size: 12px; }
      .kpi.amber .kpi-value { color: var(--warning); }
      .kpi.amber .kpi-label { color: var(--warning); }

      /* ACTIVITY TIER */
      .activity-row { display: flex; gap: var(--space-3); flex-wrap: wrap; opacity: 0.78; }
      .act { display: flex; flex-direction: column; gap: 1px; min-inline-size: 0; }
      .act-value { font-size: 13px; font-weight: 600; color: var(--text-secondary); line-height: 1.1; }
      .act-label {
        font-size: 9px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
        color: var(--text-tertiary);
      }

      /* LAST */
      .last-cell { flex-direction: row; align-items: center; gap: 8px; justify-content: flex-start; }
      .pulse {
        display: inline-block;
        inline-size: 8px; block-size: 8px;
        border-radius: 50%; flex-shrink: 0;
      }
      .pulse[data-fresh='today'] {
        background: var(--success);
        box-shadow: 0 0 0 3px color-mix(in oklab, var(--success) 20%, transparent);
      }
      .pulse[data-fresh='recent'] { background: var(--warning); }
      .pulse[data-fresh='stale'] { background: var(--text-tertiary); opacity: 0.5; }
      .last-rel { font-size: 13px; font-weight: 600; color: var(--text-secondary); }

      .chevron {
        position: absolute;
        inset-inline-end: var(--space-5);
        inset-block-start: 50%;
        transform: translateY(-50%);
        font-size: 14px;
        color: var(--text-tertiary);
        opacity: 0;
        transition:
          opacity 160ms cubic-bezier(0.4, 0, 0.2, 1),
          transform 160ms cubic-bezier(0.4, 0, 0.2, 1);
      }

      .muted { color: var(--text-tertiary); }
      .tabular { font-variant-numeric: tabular-nums lining-nums; }

      .empty-card {
        display: flex; flex-direction: column; gap: var(--space-1);
        padding: var(--space-9) var(--space-5);
        text-align: center;
        background: var(--bg-surface);
        border: 1px dashed var(--border-default);
        border-radius: var(--radius-lg);
      }
      .empty-title { margin: 0; font-size: var(--text-md); font-weight: 700; color: var(--text-primary); }
      .empty-sub { margin: 0; font-size: var(--text-sm); color: var(--text-tertiary); max-inline-size: 56ch; align-self: center; }

      @media (max-width: 1100px) {
        .activity-cell { display: none; }
      }
      @media (max-width: 900px) {
        .pipeline-cell { display: none; }
        .results-cell .kpi-row { flex-wrap: wrap; }
      }
      @media (prefers-reduced-motion: reduce) {
        .row, .chevron { transition: none !important; }
        .pulse { box-shadow: none !important; }
      }
    `,
  ],
})
export class AgentLeaderboardTableComponent {
  private readonly auth = inject(AuthService);

  readonly agents = input.required<readonly AgentBucket[]>();
  readonly sortKey = input<AgentSortKey>('conversion');
  readonly sortDir = input<SortDir>('desc');
  readonly slowFirstContactMs = input<number>(60 * 60 * 1000);

  readonly sortChange = output<{ key: AgentSortKey; dir: SortDir }>();
  readonly rowClick = output<AgentBucket>();

  protected readonly cols: readonly ColDef[] = [
    { key: 'agent', label: $localize`:@@leaderboard.col.agent:Agent`, align: 'start', sortable: true, width: '1.4' },
    { key: 'conversion', label: $localize`:@@leaderboard.col.results:Results`, align: 'start', sortable: true, width: '2' },
    { key: 'speedToFirstContact', label: $localize`:@@leaderboard.col.pipeline:Pipeline`, align: 'start', sortable: true, width: '2' },
    { key: 'activities', label: $localize`:@@leaderboard.col.activity:Effort`, align: 'start', sortable: true, width: '1.2' },
    { key: 'lastActivity', label: $localize`:@@leaderboard.col.lastActive:Last active`, align: 'start', sortable: true, width: '0.7' },
  ];

  protected readonly resultsAria = $localize`:@@leaderboard.aria.results:Results — conversion, value funded, loans approved`;
  protected readonly pipelineAria = $localize`:@@leaderboard.aria.pipeline:Pipeline — speed to contact, bank approval rate, cycle time`;
  protected readonly activityAria = $localize`:@@leaderboard.aria.activity:Effort — context only`;

  protected readonly canDrillIn = computed(() => {
    const r = this.auth.role();
    return r === 'super_admin' || r === 'sales_manager';
  });

  protected onHeaderClick(key: AgentSortKey): void {
    const currentKey = this.sortKey();
    const currentDir = this.sortDir();
    const nextDir: SortDir =
      currentKey === key ? (currentDir === 'desc' ? 'asc' : 'desc') : 'desc';
    this.sortChange.emit({ key, dir: nextDir });
  }

  protected onRowClick(a: AgentBucket): void {
    if (!this.canDrillIn() || !a.actorStaffId) return;
    this.rowClick.emit(a);
  }

  protected ariaSortFor(key: AgentSortKey): string {
    if (this.sortKey() !== key) return 'none';
    return this.sortDir() === 'asc' ? 'ascending' : 'descending';
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
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return `${Math.round(n)}`;
  }

  protected formatDurationShort(ms: number | null): string {
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

  protected freshness(iso: string): 'today' | 'recent' | 'stale' {
    const now = Date.now();
    const then = Date.parse(iso);
    if (Number.isNaN(then)) return 'stale';
    const diff = now - then;
    const day = 24 * 60 * 60 * 1000;
    if (diff < day) return 'today';
    if (diff < 3 * day) return 'recent';
    return 'stale';
  }

  protected relativeTime(iso: string): string {
    const now = Date.now();
    const then = Date.parse(iso);
    if (Number.isNaN(then)) return '—';
    const diffMs = now - then;
    const min = 60_000, hour = 60 * min, day = 24 * hour;
    if (diffMs < min) return $localize`:@@time.justNow:just now`;
    if (diffMs < hour) return $localize`:@@time.mAgo:${Math.floor(diffMs / min)}m ago`;
    if (diffMs < day) return $localize`:@@time.hAgo:${Math.floor(diffMs / hour)}h ago`;
    if (diffMs < 7 * day) return $localize`:@@time.dAgo:${Math.floor(diffMs / day)}d ago`;
    return new Date(then).toLocaleDateString();
  }
}
