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

      <nav class="window-picker" [attr.aria-label]="windowAriaLabel">
        <div class="chip-set">
          @for (w of windows; track w) {
            <nz-tag
              class="chip"
              [class.selected]="window() === w"
              nzMode="checkable"
              [nzChecked]="window() === w"
              (nzCheckedChange)="setWindow(w)"
              tabindex="0"
              role="option"
              [attr.aria-selected]="window() === w"
              >{{ w }}d</nz-tag
            >
          }
        </div>
      </nav>

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
              <nz-tag
                class="chip filter"
                [class.selected]="filter() === f.value"
                nzMode="checkable"
                [nzChecked]="filter() === f.value"
                (nzCheckedChange)="setFilter(f.value)"
                role="option"
                tabindex="0"
                [attr.aria-selected]="filter() === f.value"
              >
                {{ f.label }}
                @if (f.count !== null) {
                  <span class="count">{{ f.count }}</span>
                }
              </nz-tag>
            }
          </div>

          <div class="sort-wrap">
            <label class="sort-label" for="agentSort" i18n="@@leadAnalytics.sort.label">Sort by</label>
            <nz-select
              id="agentSort"
              class="sort-select"
              [ngModel]="sortKey()"
              (ngModelChange)="sortKey.set($event)"
            >
              <nz-option nzValue="conversion" nzLabel="Performance (conversion)" i18n-nzLabel="@@leadAnalytics.sort.conversion"></nz-option>
              <nz-option nzValue="activities" nzLabel="Effort (activities)" i18n-nzLabel="@@leadAnalytics.sort.activities"></nz-option>
              <nz-option nzValue="stuck" nzLabel="Stuck leads" i18n-nzLabel="@@leadAnalytics.sort.stuck"></nz-option>
              <nz-option nzValue="lastActivity" nzLabel="Last active" i18n-nzLabel="@@leadAnalytics.sort.lastActivity"></nz-option>
            </nz-select>
          </div>
        </div>

        <app-agent-leaderboard-table
          [agents]="visibleAgents()"
          [sortKey]="sortKey()"
          [sortDir]="sortDir()"
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

      .window-picker {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-3);
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
      }
      .window-picker::before {
        content: 'Window';
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-tertiary);
        margin-inline-end: var(--space-2);
      }
      .chip-set { display: inline-flex; flex-wrap: wrap; gap: 6px; flex: 1 1 auto; }
      :host ::ng-deep .chip-set nz-tag {
        padding: 0 !important;
        margin: 0 !important;
        background: transparent !important;
        border: none !important;
      }
      .chip {
        appearance: none;
        cursor: pointer;
        padding: 6px 14px !important;
        background: transparent !important;
        border: 1px solid var(--border-default) !important;
        border-radius: var(--radius-pill) !important;
        font-size: 13px !important;
        font-weight: 600 !important;
        color: var(--text-secondary) !important;
        letter-spacing: 0.02em;
        transition: background 150ms, border-color 150ms, color 150ms;
      }
      .chip:hover:not(.selected) {
        border-color: var(--primary) !important;
        color: var(--text-primary) !important;
      }
      .chip.selected {
        background: var(--primary) !important;
        border-color: var(--primary) !important;
        color: var(--text-on-primary) !important;
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

      .filter-chips { display: inline-flex; gap: 6px; flex-wrap: wrap; }
      .filter .count {
        margin-inline-start: 6px;
        font-size: 11px;
        font-weight: 700;
        opacity: 0.85;
      }

      .sort-wrap { display: inline-flex; align-items: center; gap: var(--space-2); margin-inline-start: auto; }
      .sort-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-tertiary);
      }
      .sort-select { min-inline-size: 180px; }

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
  protected readonly subtitleText = $localize`:@@leadAnalytics.subtitle:Spot top performers and quiet agents. Counts every call, follow-up, and document review in the chosen window.`;
  protected readonly statAriaLabel = $localize`:@@leadAnalytics.stat.aria:Lead activity totals`;
  protected readonly searchPlaceholder = $localize`:@@leadAnalytics.search.placeholder:Search agents…`;
  protected readonly searchAria = $localize`:@@leadAnalytics.search.aria:Filter agents by name`;
  protected readonly filterAria = $localize`:@@leadAnalytics.filter.aria:Performance filter`;

  protected readonly window = signal<number>(30);
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
      .filter((a) => a.conversionRate !== null && a.leadsAssigned >= MIN_SAMPLE_FOR_BADGE)
      .map((a) => a.conversionRate as number)
      .sort((a, b) => a - b);
    const activities = eligible.map((a) => a.totalActivities).sort((a, b) => a - b);
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

  protected get filterOptions(): ReadonlyArray<{ value: AgentFilter; label: string; count: number | null }> {
    const c = this.filterCounts();
    return [
      { value: 'all', label: $localize`:@@leadAnalytics.filter.all:All`, count: null },
      { value: 'top_performer', label: $localize`:@@leadAnalytics.filter.top:Top`, count: c.top },
      { value: 'needs_coaching', label: $localize`:@@leadAnalytics.filter.coach:Coaching`, count: c.coach },
      { value: 'stale', label: $localize`:@@leadAnalytics.filter.stale:Stale`, count: c.stale },
    ];
  }

  protected readonly visibleAgents = computed<readonly AgentBucket[]>(() => {
    const enriched = this.enrichedAgents();
    const q = this.searchQuery().trim().toLowerCase();
    const f = this.filter();
    const filtered = enriched.filter((a) => {
      if (f === 'all') {
        // nothing
      } else if (a.badge !== f) {
        return false;
      }
      if (q.length > 0 && !a.agentAlias.toLowerCase().includes(q)) return false;
      return true;
    });
    return this.sortAgents(filtered, this.sortKey(), this.sortDir());
  });

  protected readonly statItems = computed<StatStripItem[]>(() => {
    const s = this.summary();
    if (!s) return [];
    const activeAgents = s.agents.filter((a) => !a.isSystem && a.totalActivities > 0).length;
    const team = s.team;
    const conv = team.conversionRate;
    const convTone: StatStripItem['tone'] =
      conv === null ? 'muted' : conv >= 0.4 ? 'success' : conv >= 0.2 ? 'warning' : 'error';
    return [
      { label: $localize`:@@leadAnalytics.stat.window:Window`, value: `${s.windowDays}d` },
      { label: $localize`:@@leadAnalytics.stat.agents:Active agents`, value: activeAgents },
      { label: $localize`:@@leadAnalytics.stat.activities:Activities`, value: team.totalActivities },
      {
        label: $localize`:@@leadAnalytics.stat.callMin:Call minutes`,
        value: team.totalCallMinutes,
        tone: team.totalCallMinutes > 0 ? 'success' : 'muted',
      },
      { label: $localize`:@@leadAnalytics.stat.submitted:Submitted to bank`, value: team.submittedToBank },
      {
        label: $localize`:@@leadAnalytics.stat.approved:Approved`,
        value: team.approvedByBank,
        tone: team.approvedByBank > 0 ? 'success' : 'muted',
      },
      {
        label: $localize`:@@leadAnalytics.stat.conversion:Conversion rate`,
        value: conv === null ? '—' : `${Math.round(conv * 100)}%`,
        tone: convTone,
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
    this.drawer.create<AgentDetailDrawerComponent, { agent: AgentBucket }, void>({
      nzTitle: agent.agentAlias,
      nzContent: AgentDetailDrawerComponent,
      nzData: { agent },
      nzWidth: 520,
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
    if (!a.isSystem) {
      if (a.isStale) {
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
      if (a.isSystem !== b.isSystem) return a.isSystem ? 1 : -1;
      if (a.badge === 'stale' && b.badge !== 'stale') return -1;
      if (b.badge === 'stale' && a.badge !== 'stale') return 1;
      const diff = this.compareBySort(a, b, key);
      return diff * factor;
    });
    return out;
  }

  private compareBySort(a: AgentBucket, b: AgentBucket, key: AgentSortKey): number {
    switch (key) {
      case 'rank':
        return 0;
      case 'agent':
        return b.agentAlias.localeCompare(a.agentAlias);
      case 'status': {
        const order: Record<string, number> = { top_performer: 3, needs_coaching: 2, stale: 1, '': 0 };
        return (order[b.badge ?? ''] ?? 0) - (order[a.badge ?? ''] ?? 0);
      }
      case 'conversion': {
        const av = a.conversionRate ?? -1;
        const bv = b.conversionRate ?? -1;
        if (bv !== av) return bv - av;
        return b.leadsAssigned - a.leadsAssigned;
      }
      case 'assigned':
        return b.leadsAssigned - a.leadsAssigned;
      case 'submitted':
        return b.submittedToBank - a.submittedToBank;
      case 'approved':
        return b.approvedByBank - a.approvedByBank;
      case 'activities':
        return b.totalActivities - a.totalActivities;
      case 'callAvg': {
        const av = a.avgCallMinutes ?? -1;
        const bv = b.avgCallMinutes ?? -1;
        return bv - av;
      }
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
