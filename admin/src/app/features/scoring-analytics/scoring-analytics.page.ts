import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { ErrorCodeService } from '@core/errors/error-code.service';
import { PageHeaderComponent, StatStripComponent, type StatStripItem } from '@shared/ui';
import {
  ScoringAnalyticsApiService,
  type ScoringAnalyticsData,
} from './scoring-analytics.api.service';
import { ScoreDistributionHistogramComponent } from './components/score-distribution-histogram.component';
import { TierAccuracyTableComponent } from './components/tier-accuracy-table.component';
import { HttpErrorResponse } from '@angular/common/http';

const WINDOW_PRESETS = [7, 30, 90, 180] as const;

@Component({
  selector: 'app-scoring-analytics-page',
  standalone: true,
  imports: [
    CommonModule,
    NzTagModule,
    NzSpinModule,
    ScoreDistributionHistogramComponent,
    TierAccuracyTableComponent,
    PageHeaderComponent,
    StatStripComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <app-page-header [title]="titleText" [subtitle]="subtitleText" />

      @if (data()) {
        <app-stat-strip [items]="statItems()" [ariaLabel]="statAriaLabel" />
      }

      <div class="window-picker chip-set" role="listbox" [attr.aria-label]="pickerAria">
        @for (preset of presets; track preset) {
          <nz-tag
            class="chip"
            [class.selected]="windowDays() === preset"
            nzMode="checkable"
            [nzChecked]="windowDays() === preset"
            (nzCheckedChange)="setWindow(preset)"
            role="option"
            [attr.aria-selected]="windowDays() === preset"
            tabindex="0"
          >
            {{ preset }}d
          </nz-tag>
        }
      </div>

      @if (loading()) {
        <nz-spin nzSimple [nzSize]="'small'"></nz-spin>
      }

      @if (errorMessage(); as msg) {
        <div class="notice" role="alert">
          <h3 i18n="@@analytics.error.title">Out of OLTP range</h3>
          <p>{{ msg }}</p>
        </div>
      } @else if (data()) {
        @let d = data()!;
        <section class="block">
          <h2 i18n="@@analytics.dist.title">Distribution</h2>
          <app-score-distribution-histogram [buckets]="d.distribution" />
        </section>
        <section class="block">
          <h2 i18n="@@analytics.tier.title">Per-tier accuracy</h2>
          <app-tier-accuracy-table [data]="d.tierAccuracy" />
        </section>
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
      .window-picker {
        margin-block: var(--space-3);
      }
      .chip-set {
        display: inline-flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }
      .chip {
        cursor: pointer;
        font-variant-numeric: tabular-nums lining-nums;
      }
      .chip.selected {
        background: var(--color-tonal-accent-bg);
        color: var(--color-tonal-accent);
        font-weight: var(--font-weight-semibold);
      }
      .block {
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg, 12px);
        padding: var(--space-4) var(--space-5);
      }
      .block h2 {
        margin: 0 0 var(--space-3);
        font-size: 13px;
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-text-secondary);
      }
      .notice {
        background: var(--color-surface-muted);
        border: 1px dashed var(--color-border-default);
        border-radius: var(--radius-lg, 12px);
        padding: var(--space-5) var(--space-6);
      }
      .notice h3 {
        margin: 0 0 var(--space-2);
        font-size: 15px;
        color: var(--color-text-primary);
      }
      .notice p {
        margin: 0;
        font-size: 13px;
        color: var(--color-text-secondary);
      }
    `,
  ],
})
export class ScoringAnalyticsPage implements OnInit {
  private readonly api = inject(ScoringAnalyticsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly errorCodes = inject(ErrorCodeService);

  protected readonly presets = WINDOW_PRESETS;
  protected readonly pickerAria = $localize`:@@analytics.window.aria:Select look-back window in days`;
  protected readonly titleText = $localize`:@@analytics.title:Scoring analytics`;
  protected readonly subtitleText = $localize`:@@analytics.subtitle:Distribution of approval scores over a chosen window plus per-tier accuracy against recorded bank decisions.`;
  protected readonly statAriaLabel = $localize`:@@analytics.stat.aria:Scoring totals`;
  protected readonly statItems = computed<StatStripItem[]>(() => {
    const d = this.data();
    if (!d) return [];
    const offers = d.tierAccuracy.reduce((s, t) => s + t.offerCount, 0);
    const decisions = d.tierAccuracy.reduce((s, t) => s + t.decisionCount, 0);
    const weighted = d.tierAccuracy.reduce(
      (s, t) => s + (t.approvalRate ?? 0) * t.decisionCount,
      0,
    );
    const aggregateRate = decisions > 0 ? Math.round((weighted / decisions) * 100) : null;
    return [
      { label: $localize`:@@analytics.stat.window:Window`, value: `${d.windowDays}d` },
      { label: $localize`:@@analytics.stat.offers:Offers`, value: offers },
      { label: $localize`:@@analytics.stat.decisions:Decisions`, value: decisions },
      {
        label: $localize`:@@analytics.stat.rate:Approval rate`,
        value: aggregateRate !== null ? `${aggregateRate}%` : '—',
        tone: aggregateRate !== null && aggregateRate >= 50 ? 'success' : 'muted',
      },
    ];
  });
  protected readonly windowDays = signal<number>(30);
  protected readonly data = signal<ScoringAnalyticsData | null>(null);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly hasData = computed(() => this.data() !== null);

  async ngOnInit(): Promise<void> {
    const param = this.route.snapshot.queryParamMap.get('windowDays');
    const n = param ? Number.parseInt(param, 10) : 30;
    if (Number.isInteger(n) && n > 0) this.windowDays.set(n);
    await this.reload();
  }

  protected async setWindow(days: number): Promise<void> {
    this.windowDays.set(days);
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { windowDays: days },
      queryParamsHandling: 'merge',
    });
    await this.reload();
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const d = await this.api.get(this.windowDays());
      this.data.set(d);
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 400) {
        const code = (err.error as { code?: string } | undefined)?.code;
        if (code === 'ANALYTICS_WINDOW_TOO_LARGE') {
          this.errorMessage.set(
            this.errorCodes.toLocalizedMessage('ANALYTICS_WINDOW_TOO_LARGE', { maxDays: 180 }),
          );
          this.data.set(null);
          return;
        }
      }
      throw err;
    } finally {
      this.loading.set(false);
    }
  }
}
