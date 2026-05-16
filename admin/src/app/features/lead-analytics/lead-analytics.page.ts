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
import { AgentActivitySummary, LeadAnalyticsApiService } from './lead-analytics.api.service';
import { AgentActivityTableComponent } from './components/agent-activity-table.component';

const WINDOWS: readonly number[] = [7, 30, 90, 180];

@Component({
  selector: 'app-lead-analytics-page',
  standalone: true,
  imports: [
    CommonModule,
    NzSpinModule,
    NzTagModule,
    NzIconModule,
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
        <app-agent-activity-table [rows]="s.rows" />
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
        padding: var(--space-5) var(--space-6);
      }
      .chip-set {
        display: inline-flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }
      .chip {
        cursor: pointer;
        transition: background-color 120ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .chip.selected {
        background: var(--color-tonal-accent-bg);
        color: var(--color-tonal-accent);
        font-weight: var(--font-weight-semibold);
      }
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
  protected readonly subtitleText = $localize`:@@leadAnalytics.subtitle:Per-agent aggregates with session-local anonymization.`;
  protected readonly statAriaLabel = $localize`:@@leadAnalytics.stat.aria:Lead activity totals`;
  protected readonly statItems = computed<StatStripItem[]>(() => {
    const s = this.summary();
    if (!s) return [];
    const agents = new Set(s.rows.map((r) => r.agentAlias)).size;
    const total = s.rows.reduce((acc, r) => acc + r.count, 0);
    const calls = s.rows
      .filter((r) => r.activityType === 'CALLED_USER')
      .reduce((acc, r) => acc + r.count, 0);
    const totalDuration = s.rows.reduce(
      (acc, r) => acc + (r.totalDurationMinutes ?? 0),
      0,
    );
    return [
      { label: $localize`:@@leadAnalytics.stat.window:Window`, value: `${s.windowDays}d` },
      { label: $localize`:@@leadAnalytics.stat.agents:Active agents`, value: agents },
      { label: $localize`:@@leadAnalytics.stat.activities:Activities`, value: total },
      { label: $localize`:@@leadAnalytics.stat.callMin:Call minutes`, value: totalDuration, tone: calls > 0 ? 'success' : 'muted' },
    ];
  });
  protected readonly window = signal<number>(30);
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
