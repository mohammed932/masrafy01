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
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import {
  CheckCircleFill,
  ExclamationCircleFill,
  CloseCircleFill,
  ArrowUpOutline,
  ArrowDownOutline,
  MinusOutline,
  InfoCircleOutline,
} from '@ant-design/icons-angular/icons';
import { HttpErrorResponse } from '@angular/common/http';
import { ErrorCodeService } from '@core/errors/error-code.service';
import { PageHeaderComponent } from '@shared/ui';
import {
  ScoringAnalyticsApiService,
  type ScoringAnalyticsData,
  type TierEvaluation,
  type HealthStatus,
} from './scoring-analytics.api.service';
import type { ApprovalTier } from '../applications/list/components/approval-pill.component';

const WINDOW_PRESETS = [7, 30, 90, 180] as const;
const TIER_ORDER: readonly ApprovalTier[] = [
  'excellent',
  'good',
  'moderate',
  'low',
  'very_low',
];

@Component({
  selector: 'app-scoring-analytics-page',
  standalone: true,
  imports: [
    CommonModule,
    NzSpinModule,
    NzIconModule,
    PageHeaderComponent,
  ],
  providers: [
    provideNzIconsPatch([
      CheckCircleFill,
      ExclamationCircleFill,
      CloseCircleFill,
      ArrowUpOutline,
      ArrowDownOutline,
      MinusOutline,
      InfoCircleOutline,
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <app-page-header [title]="titleText" [subtitle]="subtitleText" />

      <div class="toolbar" [attr.aria-label]="pickerAria">
        <div class="period-meta">
          <span class="period-label" i18n="@@analytics.period.label">Reporting period</span>
          <span class="period-range tabular">{{ periodRangeText() }}</span>
        </div>
        <div class="seg-group" role="radiogroup" [attr.aria-label]="pickerAria">
          @for (preset of presets; track preset) {
            <button
              type="button"
              class="seg"
              role="radio"
              [class.active]="windowDays() === preset"
              [attr.aria-checked]="windowDays() === preset"
              (click)="setWindow(preset)"
            >
              <span class="seg-num tabular">{{ preset }}</span>
              <span class="seg-unit">d</span>
            </button>
          }
        </div>
      </div>

      @if (loading()) {
        <div class="loading"><nz-spin nzSimple [nzSize]="'small'"></nz-spin></div>
      }

      @if (errorMessage(); as msg) {
        <div class="notice" role="alert">{{ msg }}</div>
      } @else if (data()) {
        @let d = data()!;

        <!-- Hero: verdict + KPI strip in one card -->
        <article class="hero" [attr.data-status]="d.health.status">
          <header class="hero-head">
            <span class="verdict-badge">
              <span nz-icon [nzType]="verdictIcon(d.health.status)" nzTheme="fill" aria-hidden="true"></span>
            </span>
            <div class="verdict-body">
              <span class="verdict-status">{{ statusLabel(d.health.status) }}</span>
              <h2 class="verdict-headline">{{ d.health.headline }}</h2>
            </div>
            @if (d.engineVersion) {
              <span class="engine-tag" [title]="engineTooltip">
                <span class="engine-key" i18n="@@analytics.health.engine">Engine</span>
                <span class="engine-version tabular">{{ d.engineVersion }}</span>
              </span>
            }
          </header>

          <dl class="kpi-row">
            <div class="kpi">
              <dt i18n="@@analytics.kpi.decisions">Bank decisions</dt>
              <dd class="tabular">
                <span class="kpi-num">{{ d.health.decisionsInWindow }}</span>
                <span class="kpi-unit" i18n="@@analytics.kpi.window">in window</span>
              </dd>
            </div>
            <div class="kpi-sep" aria-hidden="true"></div>
            <div class="kpi">
              <dt i18n="@@analytics.kpi.worstGap">Worst tier gap</dt>
              <dd class="tabular" [attr.data-tone]="gapTone(d.health.worstGap, d.thresholds.healthyGap, d.thresholds.driftingGap)">
                <span class="kpi-num">{{ formatPoints(d.health.worstGap) }}</span>
                @if (d.health.worstTier) {
                  <span class="kpi-unit">{{ tierLabel(d.health.worstTier) }}</span>
                }
              </dd>
            </div>
            <div class="kpi-sep" aria-hidden="true"></div>
            <div class="kpi">
              <dt i18n="@@analytics.kpi.bandSpread">Score-band spread</dt>
              <dd class="tabular">
                <span class="kpi-num">{{ formatPoints(d.health.bandSpread) }}</span>
                <span class="kpi-unit" i18n="@@analytics.kpi.bandSpreadHint">best − worst tier</span>
              </dd>
            </div>
            <div class="kpi-sep" aria-hidden="true"></div>
            <div class="kpi">
              <dt i18n="@@analytics.kpi.coverage">Coverage</dt>
              <dd class="tabular">
                <span class="kpi-num">{{ trustworthyTierCount() }}/{{ d.tiers.length }}</span>
                <span class="kpi-unit" i18n="@@analytics.kpi.coverageHint">tiers with trusted samples</span>
              </dd>
            </div>
          </dl>
        </article>

        <!-- Reality rail: predicted vs actual per tier -->
        <article class="rail">
          <header class="rail-head">
            <h3 class="rail-title" i18n="@@analytics.rail.title">Reality check per tier</h3>
            <p class="rail-sub">
              <span i18n="@@analytics.rail.predLegend">Predicted</span>
              <span class="legend-swatch legend-predicted" aria-hidden="true"></span>
              <span class="legend-sep" aria-hidden="true">·</span>
              <span class="legend-swatch legend-actual" aria-hidden="true"></span>
              <span i18n="@@analytics.rail.actualLegend">Actual approval rate</span>
            </p>
          </header>

          <ul class="tier-list" role="list">
            @for (t of orderedTiers(); track t.tier) {
              <li class="tier-row" [attr.data-status]="t.status">
                <div class="tier-left">
                  <span class="tier-name">{{ tierLabel(t.tier) }}</span>
                  <span class="tier-meta">
                    <span class="tabular">{{ t.decisionCount }}</span>
                    <span i18n="@@analytics.tier.decisions">decisions</span>
                    <span class="tier-dot" aria-hidden="true">·</span>
                    <span class="tabular">{{ t.offerCount }}</span>
                    <span i18n="@@analytics.tier.offers">offers</span>
                  </span>
                  @if (!t.sampleSizeTrustworthy && t.decisionCount > 0) {
                    <span class="trust-pill" [title]="lowSampleTooltip(d.thresholds.sampleSizeTrustworthy)">
                      <span nz-icon nzType="info-circle" nzTheme="outline" aria-hidden="true"></span>
                      <span i18n="@@analytics.tier.lowSample">Low sample</span>
                    </span>
                  }
                </div>

                <div class="tier-bars" [attr.aria-label]="barAria(t)">
                  <!-- Predicted: ghost line marker -->
                  <div class="bar-track">
                    @if (t.predictedApprovalRate !== null) {
                      <span
                        class="predicted-line"
                        [style.inset-inline-start.%]="pct(t.predictedApprovalRate)"
                        [title]="predictedTooltip(t.predictedApprovalRate)"
                      ></span>
                    }
                    @if (t.actualApprovalRate !== null) {
                      <span
                        class="actual-fill"
                        [style.inline-size.%]="pct(t.actualApprovalRate)"
                        [title]="actualTooltip(t.actualApprovalRate)"
                      ></span>
                    } @else {
                      <span class="actual-empty" i18n="@@analytics.tier.noData">—</span>
                    }
                  </div>
                  <div class="bar-axis">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>

                <div class="tier-numbers">
                  <div class="num-block">
                    <span class="num-label" i18n="@@analytics.tier.predicted">Predicted</span>
                    <span class="num-value tabular">{{ formatPct(t.predictedApprovalRate) }}</span>
                  </div>
                  <div class="num-block">
                    <span class="num-label" i18n="@@analytics.tier.actual">Actual</span>
                    <span class="num-value tabular">{{ formatPct(t.actualApprovalRate) }}</span>
                  </div>
                  <div class="num-block">
                    <span class="num-label" i18n="@@analytics.tier.gap">Gap</span>
                    <span class="num-value tabular gap" [attr.data-tone]="gapTone(t.gap, d.thresholds.healthyGap, d.thresholds.driftingGap)">
                      @if (t.gap !== null) {
                        <span nz-icon [nzType]="gapIcon(t.gap)" nzTheme="outline" aria-hidden="true"></span>
                        {{ formatPoints(absOrNull(t.gap)) }}
                      } @else {
                        —
                      }
                    </span>
                  </div>
                </div>
              </li>
            }
          </ul>
        </article>
      }
    </section>
  `,
  styles: [
    `
      .page {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
        max-width: 1080px;
        margin-inline: auto;
        padding: var(--space-6);
      }

      /* ---------- toolbar ---------- */
      .toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-4);
        flex-wrap: wrap;
      }
      .period-meta { display: flex; flex-direction: column; gap: 2px; }
      .period-label {
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--text-tertiary);
      }
      .period-range {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-secondary);
        font-variant-numeric: tabular-nums lining-nums;
      }
      .seg-group {
        display: inline-flex;
        padding: 3px;
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
        padding: 5px 12px;
        border-radius: var(--radius-pill);
        display: inline-flex;
        align-items: baseline;
        gap: 3px;
        color: var(--text-secondary);
        font: inherit;
        transition: background 140ms cubic-bezier(0.4, 0, 0.2, 1),
          color 140ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .seg-num { font-size: 13px; font-weight: 700; letter-spacing: -0.01em; }
      .seg-unit { font-size: 10px; font-weight: 600; opacity: 0.75; }
      .seg:hover:not(.active) { color: var(--text-primary); }
      .seg.active {
        background: var(--primary);
        color: var(--text-on-primary);
      }
      .seg.active .seg-unit { opacity: 0.9; }

      .loading {
        display: flex;
        justify-content: center;
        padding: var(--space-4);
      }

      .notice {
        padding: var(--space-4) var(--space-5);
        background: var(--bg-subtle);
        border: 1px dashed var(--border-default);
        border-radius: var(--radius-md);
        font-size: 13px;
        color: var(--text-secondary);
      }

      /* ---------- hero verdict + KPIs ---------- */
      .hero {
        position: relative;
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        padding: var(--space-5) var(--space-6);
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
        overflow: hidden;
        animation: fade-up var(--motion-duration-slow) var(--motion-easing-standard) both;
      }
      .hero::before {
        content: '';
        position: absolute;
        inset-block: 0;
        inset-inline-start: 0;
        inline-size: 3px;
        background: var(--text-tertiary);
      }
      .hero[data-status='healthy']::before  { background: var(--success); }
      .hero[data-status='drifting']::before { background: var(--warning); }
      .hero[data-status='broken']::before   { background: var(--error); }

      .hero-head {
        display: grid;
        grid-template-columns: 48px minmax(0, 1fr) auto;
        align-items: center;
        gap: var(--space-3);
      }
      .verdict-badge {
        inline-size: 44px;
        block-size: 44px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        flex-shrink: 0;
      }
      .hero[data-status='healthy'] .verdict-badge {
        background: color-mix(in oklab, var(--success) 14%, transparent);
        color: var(--success);
      }
      .hero[data-status='drifting'] .verdict-badge {
        background: color-mix(in oklab, var(--warning) 14%, transparent);
        color: var(--warning);
      }
      .hero[data-status='broken'] .verdict-badge {
        background: color-mix(in oklab, var(--error) 14%, transparent);
        color: var(--error);
      }

      .verdict-body { display: flex; flex-direction: column; gap: 4px; min-inline-size: 0; }
      .verdict-status {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--text-tertiary);
      }
      .hero[data-status='healthy'] .verdict-status  { color: var(--success); }
      .hero[data-status='drifting'] .verdict-status { color: var(--warning); }
      .hero[data-status='broken'] .verdict-status   { color: var(--error); }

      .verdict-headline {
        margin: 0;
        font-family: var(--font-display, var(--font-sans));
        font-size: 22px;
        font-weight: 700;
        color: var(--text-primary);
        line-height: 1.25;
        letter-spacing: -0.015em;
      }

      .engine-tag {
        display: inline-flex;
        align-items: baseline;
        gap: 6px;
        padding: 4px 10px;
        background: var(--bg-subtle);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-pill);
        white-space: nowrap;
      }
      .engine-key {
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--text-tertiary);
      }
      .engine-version {
        font-family: var(--font-mono, var(--font-sans));
        font-size: 11px;
        font-weight: 700;
        color: var(--text-primary);
      }

      .kpi-row {
        margin: 0;
        display: grid;
        grid-template-columns: 1fr 1px 1fr 1px 1fr 1px 1fr;
        gap: var(--space-4);
        padding-block-start: var(--space-4);
        border-block-start: 1px solid var(--border-default);
      }
      .kpi { display: flex; flex-direction: column; gap: 4px; min-inline-size: 0; }
      .kpi dt {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--text-tertiary);
        margin: 0;
      }
      .kpi dd {
        margin: 0;
        display: flex;
        align-items: baseline;
        gap: 6px;
      }
      .kpi-num {
        font-family: var(--font-display, var(--font-sans));
        font-size: 26px;
        font-weight: 700;
        color: var(--text-primary);
        letter-spacing: -0.02em;
        line-height: 1;
      }
      .kpi-unit {
        font-size: 11px;
        color: var(--text-tertiary);
        letter-spacing: 0.02em;
      }
      .kpi dd[data-tone='healthy']  .kpi-num { color: var(--success); }
      .kpi dd[data-tone='drifting'] .kpi-num { color: var(--warning); }
      .kpi dd[data-tone='broken']   .kpi-num { color: var(--error); }
      .kpi-sep { background: var(--border-default); }

      /* ---------- tier reality rail ---------- */
      .rail {
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        padding: var(--space-5) var(--space-6);
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        animation: fade-up var(--motion-duration-slow) var(--motion-easing-standard) both;
        animation-delay: 60ms;
      }
      .rail-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--space-3);
        flex-wrap: wrap;
      }
      .rail-title {
        margin: 0;
        font-family: var(--font-display, var(--font-sans));
        font-size: 16px;
        font-weight: 700;
        color: var(--text-primary);
        letter-spacing: -0.01em;
      }
      .rail-sub {
        margin: 0;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: var(--text-tertiary);
        letter-spacing: 0.02em;
      }
      .legend-swatch {
        inline-size: 14px;
        block-size: 8px;
        border-radius: 2px;
        display: inline-block;
      }
      .legend-predicted {
        background: transparent;
        border-block-end: 2px dashed var(--primary);
        inline-size: 14px;
        block-size: 2px;
      }
      .legend-actual {
        background: var(--accent);
      }
      .legend-sep { color: var(--border-strong, var(--border-default)); }

      .tier-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
      }
      .tier-row {
        display: grid;
        grid-template-columns: 200px minmax(0, 1fr) 280px;
        align-items: center;
        gap: var(--space-4);
        padding-block: var(--space-3);
        border-block-end: 1px solid var(--border-default);
      }
      .tier-row:last-child { border-block-end: 0; }

      .tier-left {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-inline-size: 0;
      }
      .tier-name {
        font-size: 14px;
        font-weight: 700;
        color: var(--text-primary);
        letter-spacing: -0.005em;
      }
      .tier-meta {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        color: var(--text-tertiary);
        font-variant-numeric: tabular-nums lining-nums;
        flex-wrap: wrap;
      }
      .tier-meta .tabular { font-weight: 600; color: var(--text-secondary); }
      .tier-dot { color: var(--border-strong, var(--border-default)); }
      .trust-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: var(--radius-pill);
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        background: color-mix(in oklab, var(--warning) 12%, transparent);
        color: var(--warning);
        align-self: flex-start;
        margin-block-start: 2px;
      }

      /* paired bar */
      .tier-bars { display: flex; flex-direction: column; gap: 4px; min-inline-size: 0; }
      .bar-track {
        position: relative;
        block-size: 14px;
        border-radius: var(--radius-pill);
        background: color-mix(in oklab, var(--border-default) 50%, transparent);
        overflow: hidden;
      }
      .actual-fill {
        position: absolute;
        inset-block: 0;
        inset-inline-start: 0;
        background: linear-gradient(
          to inline-end,
          color-mix(in oklab, var(--accent) 90%, transparent),
          var(--accent)
        );
        border-end-end-radius: var(--radius-pill);
        border-start-end-radius: var(--radius-pill);
        animation: stretch-x var(--motion-duration-slow) var(--motion-easing-standard) both;
      }
      .tier-row[data-status='aligned'] .actual-fill { background: linear-gradient(to inline-end, color-mix(in oklab, var(--success) 90%, transparent), var(--success)); }
      .tier-row[data-status='soft']    .actual-fill { background: linear-gradient(to inline-end, color-mix(in oklab, var(--warning) 90%, transparent), var(--warning)); }
      .tier-row[data-status='harsh']   .actual-fill { background: linear-gradient(to inline-end, color-mix(in oklab, var(--error) 90%, transparent), var(--error)); }

      .predicted-line {
        position: absolute;
        inset-block: -3px;
        inline-size: 2px;
        background: var(--primary);
        border-radius: 2px;
        transform: translateX(-1px);
        z-index: 2;
      }
      .predicted-line::after {
        content: '';
        position: absolute;
        inset-block-start: -4px;
        inset-inline-start: -3px;
        inline-size: 8px;
        block-size: 8px;
        background: var(--primary);
        border-radius: 50%;
      }
      .actual-empty {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        color: var(--text-tertiary);
      }

      .bar-axis {
        display: flex;
        justify-content: space-between;
        font-size: 9px;
        font-weight: 600;
        color: var(--text-tertiary);
        letter-spacing: 0.04em;
      }

      .tier-numbers {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: var(--space-3);
      }
      .num-block { display: flex; flex-direction: column; gap: 2px; align-items: flex-end; }
      .num-label {
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--text-tertiary);
      }
      .num-value {
        font-size: 15px;
        font-weight: 700;
        color: var(--text-primary);
        font-variant-numeric: tabular-nums lining-nums;
        letter-spacing: -0.005em;
        display: inline-flex;
        align-items: center;
        gap: 3px;
      }
      .num-value.gap[data-tone='healthy']  { color: var(--success); }
      .num-value.gap[data-tone='drifting'] { color: var(--warning); }
      .num-value.gap[data-tone='broken']   { color: var(--error); }

      .tabular {
        font-variant-numeric: tabular-nums lining-nums;
        font-feature-settings: var(--font-feature-tabular);
      }

      @keyframes fade-up {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes stretch-x {
        from { transform: scaleX(0); transform-origin: inline-start; }
        to   { transform: scaleX(1); transform-origin: inline-start; }
      }
      @media (prefers-reduced-motion: reduce) {
        .hero, .rail, .actual-fill, .seg { animation: none !important; transition: none !important; }
      }

      @media (max-width: 960px) {
        .kpi-row {
          grid-template-columns: 1fr 1fr;
          gap: var(--space-3);
        }
        .kpi-sep { display: none; }
        .tier-row {
          grid-template-columns: 1fr;
          gap: var(--space-2);
        }
        .tier-numbers { grid-template-columns: repeat(3, minmax(0, 1fr)); }
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
  protected readonly pickerAria = $localize`:@@analytics.window.aria:Select reporting period`;
  protected readonly titleText = $localize`:@@analytics.title:Scoring analytics`;
  protected readonly subtitleText = $localize`:@@analytics.subtitle:How closely the engine's predicted approval rates match what banks actually do.`;
  protected readonly engineTooltip = $localize`:@@analytics.health.engineTooltip:Active scoring engine version`;

  protected readonly windowDays = signal<number>(30);
  protected readonly data = signal<ScoringAnalyticsData | null>(null);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly periodRangeText = computed<string>(() => {
    const w = this.windowDays();
    const to = new Date();
    const from = new Date(to.getTime() - w * 24 * 60 * 60 * 1000);
    const fmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
    const fmtYear = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    return `${fmt.format(from)} → ${fmtYear.format(to)}`;
  });

  protected readonly orderedTiers = computed<TierEvaluation[]>(() => {
    const d = this.data();
    if (!d) return [];
    const map = new Map(d.tiers.map((t) => [t.tier, t]));
    return TIER_ORDER.map(
      (t) =>
        map.get(t) ?? {
          tier: t,
          offerCount: 0,
          decisionCount: 0,
          predictedApprovalRate: null,
          actualApprovalRate: null,
          gap: null,
          sampleSizeTrustworthy: false,
          status: 'unknown',
        },
    );
  });

  protected readonly trustworthyTierCount = computed<number>(() => {
    const d = this.data();
    if (!d) return 0;
    return d.tiers.filter((t) => t.sampleSizeTrustworthy).length;
  });

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

  protected verdictIcon(s: HealthStatus): string {
    if (s === 'healthy') return 'check-circle';
    if (s === 'broken') return 'close-circle';
    return 'exclamation-circle';
  }

  protected statusLabel(s: HealthStatus): string {
    if (s === 'healthy') return $localize`:@@analytics.health.status.healthy:Healthy`;
    if (s === 'broken') return $localize`:@@analytics.health.status.broken:Needs tuning`;
    return $localize`:@@analytics.health.status.drifting:Drifting`;
  }

  protected tierLabel(t: ApprovalTier): string {
    switch (t) {
      case 'excellent':
        return $localize`:@@approval.tier.excellent:Excellent`;
      case 'good':
        return $localize`:@@approval.tier.good:Good`;
      case 'moderate':
        return $localize`:@@approval.tier.moderate:Moderate`;
      case 'low':
        return $localize`:@@approval.tier.low:Low`;
      case 'very_low':
        return $localize`:@@approval.tier.very_low:Very low`;
    }
  }

  protected formatPct(v: number | null): string {
    if (v === null) return '—';
    return `${Math.round(v * 100)}%`;
  }

  protected formatPoints(v: number | null): string {
    if (v === null) return '—';
    return `${Math.round(v * 100)} pts`;
  }

  protected absOrNull(v: number | null): number | null {
    return v === null ? null : Math.abs(v);
  }

  protected pct(v: number): number {
    return Math.max(0, Math.min(100, v * 100));
  }

  protected gapTone(
    v: number | null,
    healthyGap: number,
    driftingGap: number,
  ): 'healthy' | 'drifting' | 'broken' | 'unknown' {
    if (v === null) return 'unknown';
    const abs = Math.abs(v);
    if (abs > driftingGap) return 'broken';
    if (abs > healthyGap) return 'drifting';
    return 'healthy';
  }

  protected gapIcon(v: number): string {
    if (v > 0.005) return 'arrow-up';
    if (v < -0.005) return 'arrow-down';
    return 'minus';
  }

  protected barAria(t: TierEvaluation): string {
    return $localize`:@@analytics.bar.aria:${this.tierLabel(t.tier)} — predicted ${this.formatPct(t.predictedApprovalRate)}, actual ${this.formatPct(t.actualApprovalRate)}`;
  }

  protected predictedTooltip(v: number): string {
    return $localize`:@@analytics.bar.predicted:Predicted approval rate: ${Math.round(v * 100)}%`;
  }

  protected actualTooltip(v: number): string {
    return $localize`:@@analytics.bar.actual:Actual approval rate: ${Math.round(v * 100)}%`;
  }

  protected lowSampleTooltip(threshold: number): string {
    return $localize`:@@analytics.tier.lowSample.tooltip:Below the ${threshold}-decision trust threshold — interpret with caution`;
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
