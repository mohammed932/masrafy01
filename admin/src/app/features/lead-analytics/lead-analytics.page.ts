import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { CloseCircleOutline } from '@ant-design/icons-angular/icons';
import { PageHeaderComponent, StatStripComponent, type StatStripItem } from '@shared/ui';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { FormsModule } from '@angular/forms';
import { AgentActivitySummary, LeadAnalyticsApiService } from './lead-analytics.api.service';
import { AgentActivityTableComponent, type AgentSortKey } from './components/agent-activity-table.component';

const WINDOWS: readonly number[] = [7, 30, 90, 180];

@Component({
  selector: 'app-lead-analytics-page',
  standalone: true,
  imports: [
    CommonModule,
    NzSpinModule,
    NzTagModule,
    NzIconModule,
    NzSelectModule,
    FormsModule,
    AgentActivityTableComponent,
    PageHeaderComponent,
    StatStripComponent,
  ],
  providers: [provideNzIconsPatch([CloseCircleOutline])],
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
        <div class="sort-row">
          <label class="sort-label" for="agentSort" i18n="@@leadAnalytics.sort.label">Sort by</label>
          <nz-select
            id="agentSort"
            class="sort-select"
            [ngModel]="sortKey()"
            (ngModelChange)="sortKey.set($event)"
            [nzBorderless]="false"
          >
            <nz-option nzValue="conversion" nzLabel="Conversion rate" i18n-nzLabel="@@leadAnalytics.sort.conversion"></nz-option>
            <nz-option nzValue="activities" nzLabel="Activities" i18n-nzLabel="@@leadAnalytics.sort.activities"></nz-option>
            <nz-option nzValue="callMinutes" nzLabel="Call minutes" i18n-nzLabel="@@leadAnalytics.sort.callMinutes"></nz-option>
            <nz-option nzValue="stuck" nzLabel="Stuck leads" i18n-nzLabel="@@leadAnalytics.sort.stuck"></nz-option>
            <nz-option nzValue="lastActivity" nzLabel="Last activity" i18n-nzLabel="@@leadAnalytics.sort.lastActivity"></nz-option>
          </nz-select>
        </div>
        <app-agent-activity-table
          [rows]="s.rows"
          [agents]="s.agents"
          [sortKey]="sortKey()"
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
        gap: var(--space-6);
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
        background: var(--bg-surface, var(--color-surface-default));
        border: 1px solid var(--border-default, var(--color-border-default));
        border-radius: var(--radius-lg);
      }
      .window-picker::before {
        content: 'Window';
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-tertiary, var(--color-text-tertiary));
        margin-inline-end: var(--space-2);
      }
      .chip-set {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 6px;
        flex: 1 1 auto;
      }
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
        border: 1px solid var(--border-default, var(--color-border-default)) !important;
        border-radius: var(--radius-pill) !important;
        font-size: 13px !important;
        font-weight: 600 !important;
        color: var(--text-secondary, var(--color-text-secondary)) !important;
        letter-spacing: 0.02em;
        transition:
          background 150ms cubic-bezier(0.4, 0, 0.2, 1),
          border-color 150ms cubic-bezier(0.4, 0, 0.2, 1),
          color 150ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .chip:hover:not(.selected) {
        border-color: var(--primary, var(--color-brand-primary)) !important;
        color: var(--text-primary, var(--color-text-primary)) !important;
      }
      .chip.selected {
        background: var(--primary, var(--color-brand-primary)) !important;
        border-color: var(--primary, var(--color-brand-primary)) !important;
        color: var(--text-on-primary, var(--color-text-on-brand)) !important;
      }
      .sort-row {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
      }
      .sort-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-tertiary, var(--color-text-tertiary));
      }
      .sort-select { min-inline-size: 200px; }
      .footnote {
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
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
  protected readonly windows = [...WINDOWS];
  protected readonly windowAriaLabel = $localize`:@@leadAnalytics.window.aria:Analytics window`;
  protected readonly titleText = $localize`:@@leadAnalytics.title:Lead analytics`;
  protected readonly subtitleText = $localize`:@@leadAnalytics.subtitle:Spot top performers and quiet agents. Counts every call, follow-up, and document review in the chosen window.`;
  protected readonly statAriaLabel = $localize`:@@leadAnalytics.stat.aria:Lead activity totals`;
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
      {
        label: $localize`:@@leadAnalytics.stat.submitted:Submitted to bank`,
        value: team.submittedToBank,
      },
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
  protected readonly window = signal<number>(30);
  protected readonly sortKey = signal<AgentSortKey>('conversion');
  protected readonly summary = signal<AgentActivitySummary | null>(null);
  protected readonly loading = signal(false);
  protected readonly errorCode = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async setWindow(w: number): Promise<void> {
    this.window.set(w);
    await this.reload();
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    this.errorCode.set(null);
    try {
      const s = await this.api.getActivitySummary(this.window());
      this.summary.set(s);
    } catch (err) {
      const code = (err as { error?: { code?: string } }).error?.code;
      this.errorCode.set(code ?? 'INTERNAL_ERROR');
    } finally {
      this.loading.set(false);
    }
  }
}
