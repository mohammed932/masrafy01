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
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ErrorCodeService } from '@core/errors/error-code.service';
import { ScoringAnalyticsApiService, type ScoringAnalyticsData } from './scoring-analytics.api.service';
import { ScoreDistributionHistogramComponent } from './components/score-distribution-histogram.component';
import { TierAccuracyTableComponent } from './components/tier-accuracy-table.component';
import { HttpErrorResponse } from '@angular/common/http';

const WINDOW_PRESETS = [7, 30, 90, 180] as const;

@Component({
  selector: 'app-scoring-analytics-page',
  standalone: true,
  imports: [
    CommonModule,
    MatChipsModule,
    MatProgressBarModule,
    ScoreDistributionHistogramComponent,
    TierAccuracyTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <h1 class="title" i18n="@@analytics.title">Scoring analytics</h1>
        <p class="subtitle" i18n="@@analytics.subtitle">
          Distribution of approval scores over a chosen window plus per-tier accuracy
          against recorded bank decisions.
        </p>
      </header>

      <mat-chip-set class="window-picker" role="listbox" [attr.aria-label]="pickerAria">
        @for (preset of presets; track preset) {
          <mat-chip
            [class.selected]="windowDays() === preset"
            (click)="setWindow(preset)"
            (keyup.enter)="setWindow(preset)"
            role="option"
            [attr.aria-selected]="windowDays() === preset"
            tabindex="0"
          >
            {{ preset }}d
          </mat-chip>
        }
      </mat-chip-set>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      }

      @if (errorMessage(); as msg) {
        <div class="notice" role="alert">
          <h3 i18n="@@analytics.error.title">Out of OLTP range</h3>
          <p>{{ msg }}</p>
        </div>
      } @else if (data(); as d) {
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
      .title {
        margin: 0 0 4px;
        font-size: 22px;
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        letter-spacing: -0.015em;
      }
      .subtitle {
        margin: 0;
        font-size: 14px;
        color: var(--color-text-secondary);
        max-width: 64ch;
      }
      .window-picker {
        margin-block: var(--space-3);
      }
      mat-chip {
        cursor: pointer;
        font-variant-numeric: tabular-nums lining-nums;
      }
      mat-chip.selected {
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
          this.errorMessage.set(this.errorCodes.toLocalizedMessage('ANALYTICS_WINDOW_TOO_LARGE', { maxDays: 180 }));
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
