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
    provideNzIconsPatch([ArrowUpOutline, ArrowDownOutline, RightOutline, AlertOutline]),
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
              [class.platform]="a.isSystem"
              [class.clickable]="canDrillIn() && a.actorStaffId && !a.isSystem"
              (click)="onRowClick(a)"
              (keydown.enter)="onRowClick(a)"
              [attr.tabindex]="canDrillIn() && a.actorStaffId && !a.isSystem ? 0 : -1"
            >
              <div class="cell agent-cell" [style.flex]="'1.6'">
                <div class="avatar-wrap">
                  <span class="avatar" aria-hidden="true">{{ a.initials }}</span>
                  <span class="rank tabular" aria-hidden="true">#{{ i + 1 }}</span>
                </div>
                <div class="agent-id">
                  <div class="agent-line">
                    <span class="name">{{ a.agentAlias }}</span>
                    @if (a.isSystem) {
                      <span class="badge platform" i18n="@@leadAnalytics.platform">Platform</span>
                    } @else if (a.badge === 'top_performer') {
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
                  @if (!a.isSystem) {
                    <div class="agent-meta">
                      <span class="meta-num tabular">{{ a.leadsAssigned }}</span>
                      <span class="meta-label" i18n="@@leadAnalytics.metric.assigned.label">leads</span>
                      @if (a.stuckLeadsCount > 0) {
                        <span class="meta-sep">·</span>
                        <span class="meta-warn tabular">{{ a.stuckLeadsCount }}</span>
                        <span class="meta-warn-label" i18n="@@leadAnalytics.metric.stuck.label">stuck</span>
                      }
                    </div>
                  }
                </div>
              </div>

              <div class="cell perf-cell" [style.flex]="'1.6'">
                @if (a.isSystem) {
                  <span class="muted">—</span>
                } @else {
                  <div class="perf">
                    <div class="conv-block">
                      <span class="conv-pct tabular" [attr.data-tone]="convTone(a.conversionRate)">
                        {{ formatPct(a.conversionRate) }}
                      </span>
                      <span class="conv-sub" i18n="@@leadAnalytics.metric.conversion.label">conversion</span>
                    </div>
                    <div class="funnel" [attr.aria-label]="funnelAria(a)">
                      <span class="step assigned">
                        <span class="step-num tabular">{{ a.leadsAssigned }}</span>
                        <span class="step-label" i18n="@@leaderboard.funnel.a">Assigned</span>
                      </span>
                      <span class="connector"></span>
                      <span class="step submitted">
                        <span class="step-num tabular">{{ a.submittedToBank }}</span>
                        <span class="step-label" i18n="@@leaderboard.funnel.s">Submitted</span>
                      </span>
                      <span class="connector"></span>
                      <span class="step approved">
                        <span class="step-num tabular">{{ a.approvedByBank }}</span>
                        <span class="step-label" i18n="@@leaderboard.funnel.p">Approved</span>
                      </span>
                    </div>
                  </div>
                }
              </div>

              <div class="cell effort-cell" [style.flex]="'1'">
                @if (a.totalActivities > 0) {
                  <span class="eff-main tabular">{{ a.totalActivities }}</span>
                  <span class="eff-label" i18n="@@leadAnalytics.metric.activities.label">activities</span>
                  @if (a.avgCallMinutes !== null) {
                    <span class="eff-sub">
                      <span class="tabular">{{ formatAvg(a.avgCallMinutes) }}m</span>
                      <span i18n="@@leadAnalytics.effort.avg.call">/ call</span>
                    </span>
                  }
                } @else {
                  <span class="muted">—</span>
                }
              </div>

              <div class="cell last-cell" [style.flex]="'0.9'">
                @if (a.lastActivityAt) {
                  <span class="pulse" [attr.data-fresh]="freshness(a.lastActivityAt)" aria-hidden="true"></span>
                  <span class="last-rel" [attr.title]="a.lastActivityAt">{{ relativeTime(a.lastActivityAt) }}</span>
                } @else {
                  <span class="muted">—</span>
                }
              </div>

              <span class="chevron" aria-hidden="true">
                @if (canDrillIn() && a.actorStaffId && !a.isSystem) {
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
        background: none;
        border: 0;
        padding: 0;
        font: inherit;
        text-align: start;
        color: var(--text-tertiary);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        white-space: nowrap;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        transition: color 150ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .th.sortable { cursor: pointer; }
      .th.sortable:hover, .th.active { color: var(--text-primary); }
      .th[disabled] { cursor: default; }
      .sort-ind { font-size: 10px; color: var(--primary); }
      .th-spacer { flex: 0 0 36px; }

      .rows {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .row {
        position: relative;
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-4) var(--space-5);
        min-block-size: 80px;
        border-block-end: 1px solid var(--border-subtle, var(--border-default));
        transition: background 160ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .row:last-child { border-block-end: none; }
      .row.clickable { cursor: pointer; }
      .row:hover { background: var(--bg-subtle); }
      .row.tone-top::before,
      .row.tone-coach::before,
      .row.tone-stale::before {
        content: '';
        position: absolute;
        inset-block: 0;
        inset-inline-start: 0;
        inline-size: 3px;
      }
      .row.tone-top::before { background: var(--success); }
      .row.tone-coach::before { background: var(--warning); }
      .row.tone-stale::before { background: var(--error); }
      .row.tone-stale {
        background: color-mix(in oklab, var(--error) 4%, transparent);
      }
      .row.tone-stale:hover {
        background: color-mix(in oklab, var(--error) 9%, transparent);
      }
      .row.platform { background: var(--bg-subtle); opacity: 0.9; }
      .row:focus-visible { outline: none; box-shadow: var(--focus-halo); z-index: 1; }
      .row:hover .chevron { opacity: 1; transform: translateX(2px); }

      .cell { display: inline-flex; align-items: center; min-inline-size: 0; }

      .agent-cell { gap: var(--space-3); }
      .avatar-wrap { position: relative; flex-shrink: 0; }
      .avatar {
        display: inline-flex; align-items: center; justify-content: center;
        inline-size: 40px; block-size: 40px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--accent-subtle), var(--bg-muted));
        color: var(--primary);
        font-weight: 700; font-size: 13px; letter-spacing: 0.02em;
      }
      .row.platform .avatar {
        background: var(--bg-muted);
        color: var(--text-secondary);
      }
      .row.tone-top .avatar {
        background: linear-gradient(135deg, color-mix(in oklab, var(--success) 22%, transparent), var(--accent-subtle));
      }
      .row.tone-stale .avatar {
        background: linear-gradient(135deg, color-mix(in oklab, var(--error) 18%, transparent), var(--bg-muted));
      }
      .rank {
        position: absolute;
        inset-block-start: -6px;
        inset-inline-end: -8px;
        font-size: 9px;
        font-weight: 700;
        padding: 1px 6px;
        border-radius: var(--radius-pill);
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        color: var(--text-tertiary);
        letter-spacing: 0.04em;
        line-height: 1.2;
      }
      .row.tone-top .rank { color: var(--success); border-color: color-mix(in oklab, var(--success) 30%, var(--border-default)); }

      .agent-id { display: flex; flex-direction: column; gap: 2px; min-inline-size: 0; }
      .agent-line {
        display: inline-flex; align-items: center; gap: var(--space-2);
        flex-wrap: wrap;
      }
      .name {
        font-size: 15px;
        font-weight: 700;
        color: var(--text-primary);
        letter-spacing: -0.01em;
        line-height: 1.2;
      }
      .row.clickable .name { color: var(--primary); }
      .row.clickable:hover .name { text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; }

      .badge {
        font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
        padding: 3px 9px; border-radius: var(--radius-pill);
        white-space: nowrap;
        display: inline-flex; align-items: center; gap: 4px;
      }
      .badge.platform { background: var(--bg-muted); color: var(--text-tertiary); }
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
      .meta-label { color: var(--text-tertiary); }
      .meta-sep { color: var(--text-tertiary); opacity: 0.5; padding-inline: 2px; }
      .meta-warn { font-weight: 700; color: var(--warning); }
      .meta-warn-label { color: var(--warning); opacity: 0.85; }

      .perf { display: flex; align-items: center; gap: var(--space-4); inline-size: 100%; }
      .conv-block { display: flex; flex-direction: column; gap: 0; min-inline-size: 64px; }
      .conv-pct {
        font-size: 26px;
        font-weight: 700;
        line-height: 1;
        letter-spacing: -0.03em;
        color: var(--text-primary);
      }
      .conv-pct[data-tone='success'] { color: var(--success); }
      .conv-pct[data-tone='warning'] { color: var(--warning); }
      .conv-pct[data-tone='error'] { color: var(--error); }
      .conv-pct[data-tone='muted'] { color: var(--text-tertiary); }
      .conv-sub {
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--text-tertiary);
        margin-block-start: 2px;
      }

      .funnel {
        display: inline-flex;
        align-items: center;
        gap: 0;
        flex: 1;
        min-inline-size: 0;
      }
      .step {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        gap: 1px;
        padding: 4px 8px;
        border-radius: var(--radius-md);
        background: var(--bg-subtle);
        border: 1px solid var(--border-default);
        min-inline-size: 44px;
      }
      .step.submitted {
        background: color-mix(in oklab, var(--accent) 14%, var(--bg-subtle));
        border-color: color-mix(in oklab, var(--accent) 30%, var(--border-default));
      }
      .step.approved {
        background: color-mix(in oklab, var(--primary) 14%, var(--bg-subtle));
        border-color: color-mix(in oklab, var(--primary) 36%, var(--border-default));
      }
      .step-num {
        font-size: 14px;
        font-weight: 700;
        line-height: 1;
        color: var(--text-primary);
      }
      .step.submitted .step-num { color: var(--accent); }
      .step.approved .step-num { color: var(--primary); }
      .step-label {
        font-size: 8px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-tertiary);
      }
      .connector {
        flex: 1;
        block-size: 1px;
        max-inline-size: 18px;
        background: linear-gradient(
          90deg,
          var(--border-default),
          color-mix(in oklab, var(--primary) 30%, var(--border-default))
        );
      }

      .effort-cell { flex-direction: column; align-items: flex-start; gap: 0; }
      .eff-main {
        font-size: 22px;
        font-weight: 700;
        line-height: 1;
        color: var(--text-primary);
        letter-spacing: -0.02em;
      }
      .eff-label {
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--text-tertiary);
        margin-block-start: 3px;
      }
      .eff-sub {
        font-size: 11px;
        color: var(--text-secondary);
        margin-block-start: 3px;
        display: inline-flex; gap: 3px;
      }

      .last-cell { gap: 8px; align-items: center; }
      .pulse {
        display: inline-block;
        inline-size: 8px; block-size: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .pulse[data-fresh='today'] {
        background: var(--success);
        box-shadow: 0 0 0 3px color-mix(in oklab, var(--success) 20%, transparent);
      }
      .pulse[data-fresh='recent'] { background: var(--warning); }
      .pulse[data-fresh='stale'] { background: var(--text-tertiary); opacity: 0.5; }
      .last-rel {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-secondary);
      }

      .chevron {
        position: absolute;
        inset-inline-end: var(--space-5);
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

      @media (max-width: 900px) {
        .funnel { display: none; }
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

  readonly sortChange = output<{ key: AgentSortKey; dir: SortDir }>();
  readonly rowClick = output<AgentBucket>();

  protected readonly cols: readonly ColDef[] = [
    { key: 'agent', label: $localize`:@@leaderboard.col.agent:Agent`, align: 'start', sortable: true, width: '1.6' },
    { key: 'conversion', label: $localize`:@@leaderboard.col.performance:Performance`, align: 'start', sortable: true, width: '1.6' },
    { key: 'activities', label: $localize`:@@leaderboard.col.effort:Effort`, align: 'start', sortable: true, width: '1' },
    { key: 'lastActivity', label: $localize`:@@leaderboard.col.lastActive:Last active`, align: 'start', sortable: true, width: '0.9' },
  ];

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
    if (!this.canDrillIn() || !a.actorStaffId || a.isSystem) return;
    this.rowClick.emit(a);
  }

  protected ariaSortFor(key: AgentSortKey): string {
    if (this.sortKey() !== key) return 'none';
    return this.sortDir() === 'asc' ? 'ascending' : 'descending';
  }

  protected funnelAria(a: AgentBucket): string {
    return $localize`:@@leaderboard.funnel.aria:Assigned ${a.leadsAssigned}, submitted ${a.submittedToBank}, approved ${a.approvedByBank}`;
  }

  protected formatPct(v: number | null): string {
    return v === null ? '—' : `${Math.round(v * 100)}%`;
  }

  protected formatAvg(v: number): string {
    return v.toFixed(1).replace(/\.0$/, '');
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
