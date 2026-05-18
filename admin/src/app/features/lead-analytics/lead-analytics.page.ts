import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzDrawerService } from 'ng-zorro-antd/drawer';
import {
  CloseCircleOutline,
  SearchOutline,
} from '@ant-design/icons-angular/icons';
import { PageHeaderComponent, StatStripComponent, type StatStripItem } from '@shared/ui';
import {
  AgentActivitySummary,
  AgentRollupRow,
  LeadAnalyticsApiService,
} from './lead-analytics.api.service';
import {
  AgentBadge,
  AgentBucket,
  AgentFilter,
  AgentSortKey,
  SortDir,
} from './lead-analytics.types';
import { AgentLeaderboardTableComponent } from './components/agent-leaderboard-table.component';
import { AgentDetailDrawerComponent } from './components/agent-detail-drawer.component';

const WINDOWS: readonly number[] = [7, 30, 90, 180];
const MIN_SAMPLE_FOR_BADGE = 3;
const SEARCH_DEBOUNCE_MS = 300;

@Component({
  selector: 'app-lead-analytics-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzSpinModule,
    NzTagModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    AgentLeaderboardTableComponent,
    PageHeaderComponent,
    StatStripComponent,
  ],
  providers: [provideNzIconsPatch([CloseCircleOutline, SearchOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <app-page-header [title]="titleText" [subtitle]="subtitleText" />

      @if (summary()) {
        <app-stat-strip [items]="statItems()" [ariaLabel]="statAriaLabel" />
      }

      <div class="period-bar" [attr.aria-label]="windowAriaLabel">
        <div class="period-meta">
          <span class="period-label" i18n="@@leadAnalytics.period.label">Reporting period</span>
          <span class="period-range">{{ periodRangeText() }}</span>
        </div>
        <div class="seg-group" role="radiogroup" [attr.aria-label]="windowAriaLabel">
          @for (w of windows; track w) {
            <button
              type="button"
              class="seg"
              role="radio"
              [class.active]="window() === w"
              [attr.aria-checked]="window() === w"
              (click)="setWindow(w)"
            >
              <span class="seg-num tabular">{{ w }}</span>
              <span class="seg-unit" i18n="@@leadAnalytics.period.days">days</span>
            </button>
          }
        </div>
      </div>

      @if (loading()) {
        <nz-spin nzSimple [nzSize]="'small'"></nz-spin>
      } @else if (errorCode()) {
        <div class="error" role="alert">
          <span nz-icon nzType="close-circle" nzTheme="outline"></span>
          <span>{{ errorCode() }}</span>
        </div>
      } @else if (summary()) {
        @let s = summary()!;
        <div class="toolbar">
          <div class="search-wrap">
            <nz-input-group [nzPrefix]="searchIcon" class="search">
              <input
                nz-input
                type="search"
                [ngModel]="searchInput()"
                (ngModelChange)="onSearchInput($event)"
                [placeholder]="searchPlaceholder"
                [attr.aria-label]="searchAria"
              />
            </nz-input-group>
            <ng-template #searchIcon>
              <span nz-icon nzType="search" nzTheme="outline"></span>
            </ng-template>
          </div>

          <div class="filter-chips" [attr.aria-label]="filterAria">
            @for (f of filterOptions; track f.value) {
              <button
                type="button"
                class="chip filter"
                [class.selected]="filter() === f.value"
                [class.tone-top]="f.value === 'top_performer'"
                [class.tone-coach]="f.value === 'needs_coaching'"
                [class.tone-stale]="f.value === 'stale'"
                (click)="setFilter(f.value)"
                role="radio"
                [attr.aria-checked]="filter() === f.value"
                [attr.aria-label]="f.label + ' — ' + f.hint"
                [attr.title]="f.hint"
              >
                <span class="chip-label">{{ f.label }}</span>
                <span class="chip-help">{{ f.helper }}</span>
                @if (f.count !== null) {
                  <span class="count">{{ f.count }}</span>
                }
              </button>
            }
          </div>

          <div class="sort-wrap">
            <label class="sort-label" for="agentSort" i18n="@@leadAnalytics.sort.label">Rank by</label>
            <nz-select
              id="agentSort"
              class="sort-select"
              [ngModel]="sortKey()"
              (ngModelChange)="sortKey.set($event)"
            >
              <nz-option nzValue="conversion" nzLabel="Conversion rate" i18n-nzLabel="@@leadAnalytics.sort.conversion"></nz-option>
              <nz-option nzValue="valueFunded" nzLabel="Value funded (EGP)" i18n-nzLabel="@@leadAnalytics.sort.valueFunded"></nz-option>
              <nz-option nzValue="approved" nzLabel="Loans approved" i18n-nzLabel="@@leadAnalytics.sort.approved"></nz-option>
              <nz-option nzValue="bankApprovalRate" nzLabel="Bank approval rate" i18n-nzLabel="@@leadAnalytics.sort.bankApproval"></nz-option>
              <nz-option nzValue="speedToFirstContact" nzLabel="Speed to first contact" i18n-nzLabel="@@leadAnalytics.sort.speed"></nz-option>
              <nz-option nzValue="cycleTime" nzLabel="Cycle time" i18n-nzLabel="@@leadAnalytics.sort.cycle"></nz-option>
              <nz-option nzValue="stuck" nzLabel="Stuck leads" i18n-nzLabel="@@leadAnalytics.sort.stuck"></nz-option>
              <nz-option nzValue="lastActivity" nzLabel="Last active" i18n-nzLabel="@@leadAnalytics.sort.lastActivity"></nz-option>
            </nz-select>
          </div>
        </div>

        <app-agent-leaderboard-table
          [agents]="visibleAgents()"
          [sortKey]="sortKey()"
          [sortDir]="sortDir()"
          [slowFirstContactMs]="s.thresholds.slowFirstContactMs"
          (sortChange)="onSortChange($event)"
          (rowClick)="openDrawer($event)"
        />

        <p class="footnote">
          <span i18n="@@leadAnalytics.window.label">Window:</span> {{ s.windowDays }}d ·
          <span i18n="@@leadAnalytics.generated.label">generated</span>
          {{ s.generatedAt | date: 'short' }}
        </p>
      }
    </section>
  `,
  styles: [
    `
      .page {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
        max-width: var(--content-max-width);
        margin-inline: auto;
        padding: var(--space-6);
      }
      app-stat-strip { display: block; margin-block-end: var(--space-2); }

      .period-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-4);
        flex-wrap: wrap;
      }
      .period-meta {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .period-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--text-tertiary);
      }
      .period-range {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary);
        font-variant-numeric: tabular-nums lining-nums;
        letter-spacing: -0.005em;
      }
      .seg-group {
        display: inline-flex;
        padding: 4px;
        background: var(--bg-subtle);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-pill);
        gap: 2px;
      }
      .seg {
        appearance: none;
        cursor: pointer;
        background: transparent;
        border: 0;
        padding: 6px 14px;
        border-radius: var(--radius-pill);
        display: inline-flex;
        align-items: baseline;
        gap: 4px;
        color: var(--text-secondary);
        font: inherit;
        transition:
          background 160ms cubic-bezier(0.4, 0, 0.2, 1),
          color 160ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .seg-num {
        font-size: 14px;
        font-weight: 700;
        letter-spacing: -0.01em;
      }
      .seg-unit {
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        opacity: 0.7;
      }
      .seg:hover:not(.active) {
        color: var(--text-primary);
      }
      .seg.active {
        background: var(--primary);
        color: var(--text-on-primary);
        box-shadow: 0 1px 3px color-mix(in oklab, var(--primary) 25%, transparent);
      }
      .seg.active .seg-unit { opacity: 0.85; }
      .seg:focus-visible {
        outline: none;
        box-shadow: var(--focus-halo);
      }
      @media (prefers-reduced-motion: reduce) {
        .seg { transition: none !important; }
      }

      .toolbar {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        flex-wrap: wrap;
      }
      .search-wrap { flex: 1 1 240px; max-inline-size: 360px; }
      .search { inline-size: 100%; }
      :host ::ng-deep .search input { font-size: 14px; }

      .filter-chips { display: inline-flex; gap: 8px; flex-wrap: wrap; align-items: stretch; }
      .filter {
        appearance: none;
        cursor: pointer;
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        padding: 6px 12px;
        font: inherit;
        display: inline-flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 1px;
        line-height: 1.2;
        color: var(--text-secondary);
        text-align: start;
        transition: background 150ms cubic-bezier(0.4, 0, 0.2, 1),
          border-color 150ms cubic-bezier(0.4, 0, 0.2, 1),
          color 150ms cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
      }
      .filter .chip-label {
        font-size: 13px;
        font-weight: 700;
        color: var(--text-primary);
      }
      .filter .chip-help {
        font-size: 10px;
        font-weight: 500;
        color: var(--text-tertiary);
        letter-spacing: 0.01em;
      }
      .filter:empty .chip-help { display: none; }
      .filter:not(.selected):hover {
        border-color: var(--primary);
        color: var(--text-primary);
      }
      .filter.selected {
        background: var(--primary);
        border-color: var(--primary);
      }
      .filter.selected .chip-label,
      .filter.selected .chip-help { color: var(--text-on-primary); }
      .filter.selected.tone-top { background: var(--success); border-color: var(--success); }
      .filter.selected.tone-coach { background: var(--warning); border-color: var(--warning); }
      .filter.selected.tone-stale { background: var(--error); border-color: var(--error); }
      .filter:focus-visible { outline: none; box-shadow: var(--focus-halo); }
      .filter .count {
        position: absolute;
        inset-block-start: -6px;
        inset-inline-end: -6px;
        min-inline-size: 18px;
        padding: 1px 5px;
        border-radius: var(--radius-pill);
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        color: var(--text-secondary);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0;
        line-height: 1.4;
        text-align: center;
      }
      .filter.tone-top:not(.selected) .count { color: var(--success); border-color: color-mix(in oklab, var(--success) 30%, var(--border-default)); }
      .filter.tone-coach:not(.selected) .count { color: var(--warning); border-color: color-mix(in oklab, var(--warning) 30%, var(--border-default)); }
      .filter.tone-stale:not(.selected) .count { color: var(--error); border-color: color-mix(in oklab, var(--error) 30%, var(--border-default)); }
      .filter.selected .count {
        background: var(--bg-surface);
        color: var(--text-primary);
        border-color: var(--bg-surface);
      }

      .sort-wrap { display: inline-flex; align-items: center; gap: var(--space-2); margin-inline-start: auto; }
      .sort-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-tertiary);
      }
      .sort-select { min-inline-size: 200px; }

      .footnote {
        font-size: var(--text-xs);
        color: var(--text-tertiary);
      }
      .error {
        background: var(--color-error-bg);
        color: var(--color-error);
        border-radius: var(--radius-md);
        padding: var(--space-3) var(--space-4);
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
      }
    `,
  ],
})
export class LeadAnalyticsPage implements OnInit {
  private readonly api = inject(LeadAnalyticsApiService);
  private readonly drawer = inject(NzDrawerService);

  protected readonly windows = [...WINDOWS];
  protected readonly windowAriaLabel = $localize`:@@leadAnalytics.window.aria:Analytics window`;
  protected readonly titleText = $localize`:@@leadAnalytics.title:Lead analytics`;
  protected readonly subtitleText = $localize`:@@leadAnalytics.subtitle:Rank agents by outcomes — value funded, conversion, cycle time. Activity is shown for context only.`;
  protected readonly statAriaLabel = $localize`:@@leadAnalytics.stat.aria:Team headline KPIs`;
  protected readonly searchPlaceholder = $localize`:@@leadAnalytics.search.placeholder:Search agents…`;
  protected readonly searchAria = $localize`:@@leadAnalytics.search.aria:Filter agents by name`;
  protected readonly filterAria = $localize`:@@leadAnalytics.filter.aria:Performance filter`;

  protected readonly window = signal<number>(30);
  protected readonly periodRangeText = computed<string>(() => {
    const w = this.window();
    const to = new Date();
    const from = new Date(to.getTime() - w * 24 * 60 * 60 * 1000);
    const fmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
    const fmtYear = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    return `${fmt.format(from)} → ${fmtYear.format(to)}`;
  });
  protected readonly sortKey = signal<AgentSortKey>('conversion');
  protected readonly sortDir = signal<SortDir>('desc');
  protected readonly searchInput = signal<string>('');
  protected readonly searchQuery = signal<string>('');
  protected readonly filter = signal<AgentFilter>('all');
  protected readonly summary = signal<AgentActivitySummary | null>(null);
  protected readonly loading = signal(false);
  protected readonly errorCode = signal<string | null>(null);

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly enrichedAgents = computed<readonly AgentBucket[]>(() => {
    const s = this.summary();
    if (!s) return [];
    const activityByAlias = new Map<string, { type: string; label: string; count: number; minutes: number | null }[]>();
    for (const r of s.rows) {
      const list = activityByAlias.get(r.agentAlias) ?? [];
      list.push({
        type: r.activityType,
        label: this.formatType(r.activityType),
        count: r.count,
        minutes: r.totalDurationMinutes ?? null,
      });
      activityByAlias.set(r.agentAlias, list);
    }
    for (const list of activityByAlias.values()) list.sort((a, b) => b.count - a.count);

    const eligible = s.agents.filter((a) => !a.isSystem);
    const conversions = eligible
      .filter((a) => a.results.conversionRate !== null && a.results.leadsAssigned >= MIN_SAMPLE_FOR_BADGE)
      .map((a) => a.results.conversionRate as number)
      .sort((a, b) => a - b);
    const activities = eligible.map((a) => a.activity.totalActivities).sort((a, b) => a - b);
    const convTop = this.quantile(conversions, 2 / 3);
    const convBottom = this.quantile(conversions, 1 / 3);
    const activityTop = this.quantile(activities, 2 / 3);

    return s.agents.map((a) => this.enrichOne(a, activityByAlias, convTop, convBottom, activityTop));
  });

  protected readonly filterCounts = computed(() => {
    const enriched = this.enrichedAgents();
    return {
      top: enriched.filter((a) => a.badge === 'top_performer').length,
      coach: enriched.filter((a) => a.badge === 'needs_coaching').length,
      stale: enriched.filter((a) => a.badge === 'stale').length,
    };
  });

  protected get filterOptions(): ReadonlyArray<{ value: AgentFilter; label: string; helper: string; hint: string; count: number | null }> {
    const c = this.filterCounts();
    return [
      {
        value: 'all',
        label: $localize`:@@leadAnalytics.filter.all:Everyone`,
        helper: '',
        hint: $localize`:@@leadAnalytics.filter.all.hint:Show every agent`,
        count: null,
      },
      {
        value: 'top_performer',
        label: $localize`:@@leadAnalytics.filter.top:Best closers`,
        helper: $localize`:@@leadAnalytics.filter.top.helper:high conversion`,
        hint: $localize`:@@leadAnalytics.filter.top.hint:Agents with the highest conversion rate this period`,
        count: c.top,
      },
      {
        value: 'needs_coaching',
        label: $localize`:@@leadAnalytics.filter.coach:Help needed`,
        helper: $localize`:@@leadAnalytics.filter.coach.helper:works hard, closes little`,
        hint: $localize`:@@leadAnalytics.filter.coach.hint:Lots of activity but low conversion — coach them`,
        count: c.coach,
      },
      {
        value: 'stale',
        label: $localize`:@@leadAnalytics.filter.stale:Inactive`,
        helper: $localize`:@@leadAnalytics.filter.stale.helper:silent 3+ days`,
        hint: $localize`:@@leadAnalytics.filter.stale.hint:Agents who logged no activity in the last 3 days`,
        count: c.stale,
      },
    ];
  }

  protected readonly visibleAgents = computed<readonly AgentBucket[]>(() => {
    const enriched = this.enrichedAgents();
    const q = this.searchQuery().trim().toLowerCase();
    const f = this.filter();
    const filtered = enriched.filter((a) => {
      if (f !== 'all' && a.badge !== f) return false;
      if (q.length > 0 && !a.agentAlias.toLowerCase().includes(q)) return false;
      return true;
    });
    return this.sortAgents(filtered, this.sortKey(), this.sortDir());
  });

  protected readonly statItems = computed<StatStripItem[]>(() => {
    const s = this.summary();
    if (!s) return [];
    const activeAgents = s.agents.filter(
      (a) => !a.isSystem && a.activity.totalActivities > 0,
    ).length;
    const team = s.team;
    const conv = team.conversionRate;
    const convTone: StatStripItem['tone'] =
      conv === null ? 'muted' : conv >= 0.4 ? 'success' : conv >= 0.2 ? 'warning' : 'error';
    return [
      { label: $localize`:@@leadAnalytics.stat.agents:Active agents`, value: activeAgents },
      {
        label: $localize`:@@leadAnalytics.stat.valueFunded:Value funded`,
        value: this.formatEgpShort(team.valueFundedEGP),
        tone: team.valueFundedEGP !== null && Number(team.valueFundedEGP) > 0 ? 'success' : 'muted',
      },
      {
        label: $localize`:@@leadAnalytics.stat.loansApproved:Loans approved`,
        value: team.loansApproved,
        tone: team.loansApproved > 0 ? 'success' : 'muted',
      },
      {
        label: $localize`:@@leadAnalytics.stat.conversion:Conversion`,
        value: conv === null ? '—' : `${Math.round(conv * 100)}%`,
        tone: convTone,
      },
      {
        label: $localize`:@@leadAnalytics.stat.bankApproval:Bank approval`,
        value: team.bankApprovalRate === null ? '—' : `${Math.round(team.bankApprovalRate * 100)}%`,
      },
      {
        label: $localize`:@@leadAnalytics.stat.activities:Activities`,
        value: team.totalActivities,
        tone: 'muted',
      },
    ];
  });

  async ngOnInit(): Promise<void> {
    await this.reload(this.window());
  }

  async setWindow(w: number): Promise<void> {
    this.window.set(w);
    await this.reload(w);
  }

  setFilter(f: AgentFilter): void {
    this.filter.set(f);
  }

  onSearchInput(v: string): void {
    this.searchInput.set(v);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.searchQuery.set(v);
    }, SEARCH_DEBOUNCE_MS);
  }

  onSortChange(e: { key: AgentSortKey; dir: SortDir }): void {
    this.sortKey.set(e.key);
    this.sortDir.set(e.dir);
  }

  openDrawer(agent: AgentBucket): void {
    this.drawer.create<AgentDetailDrawerComponent, { agent: AgentBucket; slowFirstContactMs: number }, void>({
      nzTitle: agent.agentAlias,
      nzContent: AgentDetailDrawerComponent,
      nzData: {
        agent,
        slowFirstContactMs: this.summary()?.thresholds.slowFirstContactMs ?? 60 * 60 * 1000,
      },
      nzWidth: 560,
      nzPlacement: 'right',
      nzMaskClosable: true,
      nzKeyboard: true,
    });
  }

  private async reload(windowDays: number): Promise<void> {
    this.loading.set(true);
    this.errorCode.set(null);
    try {
      const s = await this.api.getActivitySummary(windowDays);
      this.summary.set(s);
    } catch (err) {
      const code = (err as { error?: { code?: string } }).error?.code;
      this.errorCode.set(code ?? 'INTERNAL_ERROR');
    } finally {
      this.loading.set(false);
    }
  }

  private enrichOne(
    a: AgentRollupRow,
    activityByAlias: Map<string, { type: string; label: string; count: number; minutes: number | null }[]>,
    convTop: number | null,
    convBottom: number | null,
    activityTop: number | null,
  ): AgentBucket {
    let badge: AgentBadge = null;
    if (a.isStale) {
      badge = 'stale';
    } else if (
      a.results.leadsAssigned >= MIN_SAMPLE_FOR_BADGE &&
      a.results.conversionRate !== null &&
      convTop !== null &&
      a.results.conversionRate >= convTop
    ) {
      badge = 'top_performer';
    } else if (
      a.results.leadsAssigned >= MIN_SAMPLE_FOR_BADGE &&
      activityTop !== null &&
      a.activity.totalActivities >= activityTop &&
      a.results.conversionRate !== null &&
      convBottom !== null &&
      a.results.conversionRate <= convBottom
    ) {
      badge = 'needs_coaching';
    }
    return {
      ...a,
      initials: this.initialsOf(a.agentAlias),
      badge,
      activities: activityByAlias.get(a.agentAlias) ?? [],
    };
  }

  private sortAgents(list: readonly AgentBucket[], key: AgentSortKey, dir: SortDir): readonly AgentBucket[] {
    const factor = dir === 'asc' ? 1 : -1;
    const out = [...list];
    out.sort((a, b) => {
      if (a.badge === 'stale' && b.badge !== 'stale') return -1;
      if (b.badge === 'stale' && a.badge !== 'stale') return 1;
      const diff = this.compareBySort(a, b, key);
      return diff * factor;
    });
    return out;
  }

  private compareBySort(a: AgentBucket, b: AgentBucket, key: AgentSortKey): number {
    switch (key) {
      case 'agent':
        return b.agentAlias.localeCompare(a.agentAlias);
      case 'conversion': {
        const av = a.results.conversionRate ?? -1;
        const bv = b.results.conversionRate ?? -1;
        if (bv !== av) return bv - av;
        return b.results.leadsAssigned - a.results.leadsAssigned;
      }
      case 'valueFunded': {
        const av = a.results.valueFundedEGP === null ? -1 : Number(a.results.valueFundedEGP);
        const bv = b.results.valueFundedEGP === null ? -1 : Number(b.results.valueFundedEGP);
        return bv - av;
      }
      case 'approved':
        return b.results.loansApproved - a.results.loansApproved;
      case 'bankApprovalRate': {
        const av = a.pipeline.bankApprovalRate ?? -1;
        const bv = b.pipeline.bankApprovalRate ?? -1;
        return bv - av;
      }
      case 'speedToFirstContact': {
        // ascending desirable — but we sort by chosen dir downstream
        const av = a.pipeline.avgSpeedToFirstContactMs ?? Number.MAX_SAFE_INTEGER;
        const bv = b.pipeline.avgSpeedToFirstContactMs ?? Number.MAX_SAFE_INTEGER;
        return av - bv; // smaller = better; pass factor=-1 for desc to flip
      }
      case 'cycleTime': {
        const av = a.pipeline.avgCycleTimeMs ?? Number.MAX_SAFE_INTEGER;
        const bv = b.pipeline.avgCycleTimeMs ?? Number.MAX_SAFE_INTEGER;
        return av - bv;
      }
      case 'stuck':
        return b.pipeline.stuckLeadsCount - a.pipeline.stuckLeadsCount;
      case 'activities':
        return b.activity.totalActivities - a.activity.totalActivities;
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

  private formatEgpShort(v: string | null): string {
    if (v === null) return '—';
    const n = Number(v);
    if (!Number.isFinite(n) || n === 0) return '—';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M EGP`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K EGP`;
    return `${Math.round(n)} EGP`;
  }
}
