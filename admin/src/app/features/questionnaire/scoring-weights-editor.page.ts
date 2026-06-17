import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { startWith } from 'rxjs';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSliderModule } from 'ng-zorro-antd/slider';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzMessageService } from 'ng-zorro-antd/message';
import {
  QuestionnaireApiService,
  type LoanCategory,
  type ProgramMeta,
  type WeightableOption,
  type WeightableQuestion,
} from './questionnaire.api.service';

/** Joins a question + option code into a flat control name. */
const SEP = '::';
const key = (questionCode: string, optionCode: string): string =>
  `${questionCode}${SEP}${optionCode}`;

/** Per-answer point bounds (mirrors backend WEIGHTS_POINTS_OUT_OF_RANGE). */
const MIN_POINTS = 1;
const MAX_POINTS = 100;
const clampPoints = (n: number): number => Math.min(MAX_POINTS, Math.max(MIN_POINTS, n));

type NestedWeights = Record<string, Record<string, number>>;
type ApprovalTier = 'excellent' | 'good' | 'moderate' | 'low' | 'very_low';

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Client-side mirror of the backend tier thresholds
 * ([approval-probability.scorer.ts](../../../../../backend/src/matching/scoring/approval-probability.scorer.ts)).
 * Preview only — the backend stays the source of truth; the formula is constitution-frozen.
 */
const tierFor = (probability: number): ApprovalTier => {
  if (probability >= 0.8) return 'excellent';
  if (probability >= 0.6) return 'good';
  if (probability >= 0.4) return 'moderate';
  if (probability >= 0.2) return 'low';
  return 'very_low';
};

/**
 * Scoring weights editor — "Weight Studio" (Constitution V — direct save, no maker-checker).
 * Admins assign 1–100 points (decimals allowed) per ANSWER, per program; each option's
 * points seed a slider + numeric badge bound to the same control. A live what-if gauge
 * mirrors the real approval formula `Σ(picked points) / maxAchievable` for instant feedback.
 * Saving activates the new versioned set immediately. No sum-to-100 constraint.
 */
@Component({
  standalone: true,
  selector: 'mf-scoring-weights-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    NzButtonModule,
    NzSliderModule,
    NzEmptyModule,
    NzSpinModule,
  ],
  template: `
    <section class="page">
      <header class="hero">
        <span class="hero-accent" aria-hidden="true"></span>
        <a routerLink="/banks" class="back" i18n="@@scoring.editor.back">← Banks</a>
        <h1 class="hero-title" i18n="@@scoring.editor.title">Approval scoring weights</h1>
        @if (program(); as p) {
          <p class="prog-line">
            <span class="bank">{{ p.bankName }}</span>
            <span class="sep" aria-hidden="true">—</span>
            <span class="prog">{{ programName(p) }}</span>
            <span class="cat-chip">{{ p.category }}</span>
          </p>
          <p class="caption">
            <span i18n="@@scoring.editor.hint"
              >Weights are specific to this program — other programs at this bank are weighted
              independently.</span
            >
            <span class="mono id">{{ programId }}</span>
          </p>
        }
      </header>

      @if (loading()) {
        <div class="panel center"><nz-spin nzSimple /></div>
      } @else if (questions().length === 0) {
        <div class="panel">
          <nz-empty
            i18n-nzNotFoundContent="@@scoring.editor.no_questions"
            nzNotFoundContent="No questions for this category yet. Add questions and answers in the questionnaire editor first."
          />
        </div>
      } @else {
        <div class="studio">
          <!-- LEFT — point editors ------------------------------------------ -->
          <section
            class="questions"
            aria-label="Answer points"
            i18n-aria-label="@@scoring.editor.editors_aria"
          >
            <p class="intro" i18n="@@scoring.editor.points_intro">
              Give each answer 1–100 points (decimals allowed) — higher points raise the approval
              chance for that answer.
            </p>
            <form [formGroup]="form">
              @for (q of questions(); track q.code) {
                <fieldset class="qcard">
                  <legend class="qhead">
                    <span class="qlabel">{{ questionLabel(q) }}</span>
                    <span class="qcode mono">{{ q.code }}</span>
                  </legend>
                  @for (o of q.options; track o.code) {
                    <div class="answer" [class.is-top]="isTop(q.code, o.code)">
                      <div class="answer-head">
                        <span class="answer-label">{{ optionLabel(o) }}</span>
                        @if (isTop(q.code, o.code)) {
                          <span class="top-pill" i18n="@@scoring.editor.top">★ Top</span>
                        }
                        <span
                          class="pts-readout"
                          [class.is-top]="isTop(q.code, o.code)"
                          aria-hidden="true"
                          >{{ pointValues()[q.code]?.[o.code] | number: '1.0-1'
                          }}<span class="pts-unit">%</span></span
                        >
                      </div>
                      <nz-slider
                        class="pts-slider"
                        [formControlName]="controlName(q.code, o.code)"
                        [nzMin]="MIN"
                        [nzMax]="MAX"
                        [nzStep]="0.1"
                      />
                      @if (ctrlInvalid(q.code, o.code)) {
                        <p class="err" i18n="@@scoring.editor.range_error">
                          Points must be between 1 and 100.
                        </p>
                      }
                    </div>
                  }
                </fieldset>
              }
            </form>
          </section>

          <!-- RIGHT — live approval preview --------------------------------- -->
          <aside class="rail">
            <div class="preview">
              <p class="preview-eyebrow" i18n="@@scoring.editor.preview_title">
                Approval probability
              </p>

              <div class="gauge" [attr.data-tier]="tier()">
                <svg viewBox="0 0 140 140" class="gauge-svg" aria-hidden="true">
                  <circle class="gauge-track" cx="70" cy="70" [attr.r]="gaugeR" />
                  <circle
                    class="gauge-fill"
                    cx="70"
                    cy="70"
                    [attr.r]="gaugeR"
                    [attr.stroke-dasharray]="gaugeC"
                    [attr.stroke-dashoffset]="dashOffset()"
                  />
                </svg>
                <div class="gauge-center">
                  <span class="gauge-pct"
                    >{{ pct() | number: '1.0-1' }}<span class="gauge-unit">%</span></span
                  >
                  <span class="gauge-tier">{{ tierLabel(tier()) }}</span>
                </div>
              </div>

              <p class="preview-sub" i18n="@@scoring.editor.preview_sub">
                If the applicant picks these answers
              </p>

              <div class="maxline">
                <span i18n="@@scoring.editor.max_achievable">Max achievable</span>
                <strong
                  >{{ maxAchievable() | number: '1.0-1' }}
                  <span i18n="@@scoring.editor.pts">pts</span></strong
                >
              </div>

              <button
                type="button"
                class="reset"
                (click)="resetToBest()"
                i18n="@@scoring.editor.reset_best"
              >
                Reset to best answers
              </button>

              <p class="whatif-hint" i18n="@@scoring.editor.whatif_hint">
                Tap an answer to simulate a different applicant.
              </p>
              <div class="whatif">
                @for (q of questions(); track q.code) {
                  <div class="whatif-q">
                    <span class="whatif-label">{{ questionLabel(q) }}</span>
                    <div class="chips">
                      @for (o of q.options; track o.code) {
                        <button
                          type="button"
                          class="chip"
                          [class.active]="isPicked(q.code, o.code)"
                          [attr.aria-pressed]="isPicked(q.code, o.code)"
                          (click)="pickAnswer(q.code, o.code)"
                        >
                          {{ optionLabel(o) }}
                        </button>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          </aside>
        </div>

        <div class="savebar">
          @if (form.dirty && !saving()) {
            <span class="dirty" i18n="@@scoring.editor.unsaved">Unsaved changes</span>
          }
          <button
            nz-button
            nzType="primary"
            nzSize="large"
            [disabled]="saving() || form.invalid"
            [nzLoading]="saving()"
            (click)="save()"
            i18n="@@scoring.editor.save"
          >
            Save weights
          </button>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .page {
        padding: var(--space-6);
        max-inline-size: min(1040px, 100%);
        margin-inline: auto;
        padding-block-end: var(--space-9);
      }

      /* ── Hero ─────────────────────────────────────────────────────────── */
      .hero {
        position: relative;
        overflow: hidden;
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        padding: var(--space-5) var(--space-5) var(--space-4);
        margin-block-end: var(--space-5);
        box-shadow: var(--shadow-sm);
      }
      .hero-accent {
        position: absolute;
        inset-block-start: 0;
        inset-inline: 0;
        block-size: 4px;
        background: var(--gradient-hero);
      }
      .back {
        display: inline-block;
        margin-block-end: var(--space-2);
        color: var(--text-link, var(--primary));
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
      }
      .hero-title {
        font-size: var(--text-2xl);
        font-weight: var(--font-bold);
        letter-spacing: var(--tracking-tight);
        color: var(--text-primary);
      }
      .prog-line {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-2);
        margin-block: var(--space-3) var(--space-1);
        font-size: var(--text-base);
      }
      .prog-line .bank {
        font-weight: var(--font-semibold);
        color: var(--text-primary);
      }
      .prog-line .sep {
        color: var(--text-tertiary);
      }
      .prog-line .prog {
        color: var(--text-secondary);
      }
      .cat-chip {
        text-transform: capitalize;
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        color: var(--primary);
        background: var(--primary-subtle);
        padding-block: 2px;
        padding-inline: var(--space-3);
        border-radius: var(--radius-pill);
      }
      .caption {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
        align-items: center;
        margin-block-start: var(--space-1);
        font-size: var(--text-sm);
        color: var(--text-tertiary);
      }
      .caption .id {
        font-size: var(--text-xs);
        opacity: 0.85;
      }
      .mono {
        font-family: var(--font-mono);
      }

      /* ── Panels (loading / empty) ─────────────────────────────────────── */
      .panel {
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        padding: var(--space-7) var(--space-5);
      }
      .panel.center {
        display: flex;
        justify-content: center;
      }

      /* ── Studio layout ────────────────────────────────────────────────── */
      .studio {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
      }
      .rail {
        order: -1;
      }
      @media (min-width: 900px) {
        .studio {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 340px;
          gap: var(--space-6);
          align-items: start;
        }
        .rail {
          order: 0;
        }
      }

      .intro {
        margin-block: 0 var(--space-4);
        color: var(--text-secondary);
        font-size: var(--text-sm);
        line-height: var(--leading-relaxed);
        max-inline-size: 60ch;
      }

      /* ── Question cards ───────────────────────────────────────────────── */
      .questions form {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .qcard {
        margin: 0;
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        padding: var(--space-4) var(--space-5) var(--space-5);
        box-shadow: var(--shadow-sm);
      }
      .qhead {
        display: flex;
        align-items: baseline;
        flex-wrap: wrap;
        gap: var(--space-2);
        padding: 0;
        margin-block-end: var(--space-2);
      }
      .qlabel {
        font-size: var(--text-lg);
        font-weight: var(--font-semibold);
        color: var(--text-primary);
      }
      .qcode {
        font-size: var(--text-xs);
        color: var(--text-tertiary);
        background: var(--bg-subtle);
        padding-block: 1px;
        padding-inline: var(--space-2);
        border-radius: var(--radius-sm);
      }

      .answer {
        padding: var(--space-3) var(--space-3) var(--space-2);
        border-radius: var(--radius-md);
        border-inline-start: 3px solid transparent;
        transition: background var(--motion-duration-base) var(--motion-easing-standard);
      }
      .answer + .answer {
        margin-block-start: var(--space-2);
      }
      .answer.is-top {
        background: color-mix(in srgb, var(--primary) 6%, transparent);
        border-inline-start-color: var(--primary);
      }
      .answer-head {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        margin-block-end: var(--space-1);
      }
      .answer-label {
        font-weight: var(--font-medium);
        color: var(--text-primary);
      }
      .top-pill {
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        color: var(--primary);
        background: var(--primary-subtle);
        padding-block: 1px;
        padding-inline: var(--space-2);
        border-radius: var(--radius-pill);
        white-space: nowrap;
      }
      .pts-readout {
        margin-inline-start: auto;
        min-inline-size: 56px;
        padding-block: var(--space-1);
        padding-inline: var(--space-3);
        text-align: center;
        font-size: var(--text-lg);
        font-weight: var(--font-bold);
        font-feature-settings:
          'tnum' 1,
          'lnum' 1;
        color: var(--text-primary);
        background: var(--bg-subtle);
        border-radius: var(--radius-md);
        transition:
          color var(--motion-duration-base) var(--motion-easing-standard),
          background var(--motion-duration-base) var(--motion-easing-standard);
      }
      .pts-readout.is-top {
        color: var(--primary);
        background: var(--primary-subtle);
      }
      .pts-unit {
        margin-inline-start: 1px;
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        color: var(--text-tertiary);
      }
      .pts-readout.is-top .pts-unit {
        color: var(--primary);
      }
      .pts-slider {
        margin-block-start: var(--space-1);
      }
      .pts-slider ::ng-deep .ant-slider-rail {
        block-size: 6px;
        border-radius: var(--radius-pill);
        background: var(--bg-muted);
      }
      .pts-slider ::ng-deep .ant-slider-track {
        block-size: 6px;
        border-radius: var(--radius-pill);
        background: var(--primary);
      }
      .pts-slider ::ng-deep .ant-slider:hover .ant-slider-track {
        background: var(--primary-hover);
      }
      .pts-slider ::ng-deep .ant-slider-handle {
        inline-size: 18px;
        block-size: 18px;
        margin-block-start: -6px;
        border: 2px solid var(--primary);
        background: var(--bg-surface);
        box-shadow: var(--shadow-sm);
        transition:
          transform var(--motion-duration-fast) var(--motion-easing-standard),
          box-shadow var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .pts-slider ::ng-deep .ant-slider-handle:hover,
      .pts-slider ::ng-deep .ant-slider-handle:focus {
        transform: scale(1.14);
        box-shadow: var(--focus-halo);
      }
      @media (prefers-reduced-motion: reduce) {
        .pts-readout,
        .pts-slider ::ng-deep .ant-slider-handle {
          transition: none;
        }
      }
      .err {
        margin-block: var(--space-1) 0;
        color: var(--error);
        font-size: var(--text-xs);
      }

      /* ── Preview rail ─────────────────────────────────────────────────── */
      .preview {
        position: sticky;
        inset-block-start: var(--space-5);
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        padding: var(--space-5);
        box-shadow: var(--shadow-md);
      }
      .preview-eyebrow {
        margin: 0;
        text-align: center;
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        letter-spacing: var(--tracking-wider);
        text-transform: uppercase;
        color: var(--text-tertiary);
      }

      .gauge {
        position: relative;
        inline-size: 180px;
        block-size: 180px;
        margin-inline: auto;
        margin-block: var(--space-3) var(--space-2);
      }
      .gauge-svg {
        inline-size: 100%;
        block-size: 100%;
        transform: rotate(-90deg);
      }
      .gauge-track {
        fill: none;
        stroke: var(--bg-muted);
        stroke-width: 12;
      }
      .gauge-fill {
        fill: none;
        stroke-width: 12;
        stroke-linecap: round;
        stroke: var(--primary);
        transition:
          stroke-dashoffset var(--motion-duration-slow) var(--motion-easing-standard),
          stroke var(--motion-duration-base) var(--motion-easing-standard);
      }
      .gauge[data-tier='excellent'] .gauge-fill {
        stroke: var(--success);
      }
      .gauge[data-tier='good'] .gauge-fill {
        stroke: var(--primary);
      }
      .gauge[data-tier='moderate'] .gauge-fill {
        stroke: var(--warning);
      }
      .gauge[data-tier='low'] .gauge-fill,
      .gauge[data-tier='very_low'] .gauge-fill {
        stroke: var(--error);
      }

      .gauge-center {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      .gauge-pct {
        display: flex;
        align-items: baseline;
        font-size: var(--text-4xl);
        font-weight: var(--font-bold);
        line-height: 1;
        color: var(--text-primary);
        font-feature-settings:
          'tnum' 1,
          'lnum' 1;
      }
      .gauge-unit {
        font-size: var(--text-xl);
        margin-inline-start: 2px;
        color: var(--text-secondary);
      }
      .gauge-tier {
        margin-block-start: var(--space-2);
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
      }
      .gauge[data-tier='excellent'] .gauge-tier {
        color: var(--success);
      }
      .gauge[data-tier='good'] .gauge-tier {
        color: var(--primary);
      }
      .gauge[data-tier='moderate'] .gauge-tier {
        color: var(--warning);
      }
      .gauge[data-tier='low'] .gauge-tier,
      .gauge[data-tier='very_low'] .gauge-tier {
        color: var(--error);
      }

      .preview-sub {
        margin: 0;
        text-align: center;
        font-size: var(--text-xs);
        color: var(--text-tertiary);
      }
      .maxline {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
        margin-block: var(--space-4) var(--space-3);
        padding-block: var(--space-3);
        border-block: 1px solid var(--border-subtle);
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }
      .maxline strong {
        color: var(--text-primary);
        font-feature-settings:
          'tnum' 1,
          'lnum' 1;
      }
      .reset {
        inline-size: 100%;
        border: 1px solid var(--border-default);
        background: var(--bg-subtle);
        color: var(--text-secondary);
        border-radius: var(--radius-md);
        padding-block: var(--space-2);
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        cursor: pointer;
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .reset:hover {
        border-color: var(--primary);
        color: var(--primary);
      }
      .reset:focus-visible {
        outline: none;
        box-shadow: var(--focus-halo);
      }

      .whatif-hint {
        margin-block: var(--space-4) var(--space-2);
        font-size: var(--text-xs);
        color: var(--text-tertiary);
      }
      .whatif {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .whatif-q {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .whatif-label {
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        color: var(--text-secondary);
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1);
      }
      .chip {
        border: 1px solid var(--border-default);
        background: var(--bg-surface);
        color: var(--text-secondary);
        border-radius: var(--radius-pill);
        padding-block: 3px;
        padding-inline: var(--space-3);
        font-size: var(--text-xs);
        font-weight: var(--font-medium);
        cursor: pointer;
        transition: all var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .chip:hover {
        border-color: var(--primary);
        color: var(--primary);
      }
      .chip.active {
        border-color: var(--primary);
        background: var(--primary);
        color: var(--text-on-primary);
      }
      .chip:focus-visible {
        outline: none;
        box-shadow: var(--focus-halo);
      }

      /* ── Save bar ─────────────────────────────────────────────────────── */
      .savebar {
        position: sticky;
        inset-block-end: var(--space-3);
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: var(--space-4);
        margin-block-start: var(--space-5);
        padding: var(--space-3) var(--space-4);
        background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
        backdrop-filter: blur(8px);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
      }
      .dirty {
        font-size: var(--text-sm);
        color: var(--warning);
        font-weight: var(--font-medium);
      }

      /* ── Reduced motion ───────────────────────────────────────────────── */
      @media (prefers-reduced-motion: reduce) {
        .gauge-fill,
        .answer,
        .reset,
        .chip {
          transition: none;
        }
      }
    `,
  ],
})
export class ScoringWeightsEditorPage implements OnInit {
  private readonly api = inject(QuestionnaireApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  /** Active admin locale picks the label language (ar build → Arabic). */
  private readonly isAr = inject(LOCALE_ID).startsWith('ar');

  readonly category = this.route.snapshot.paramMap.get('category') as LoanCategory;
  readonly programId = this.route.snapshot.paramMap.get('programId') ?? '';

  readonly MIN = MIN_POINTS;
  readonly MAX = MAX_POINTS;

  readonly questions = signal<WeightableQuestion[]>([]);
  readonly program = signal<ProgramMeta | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);

  readonly form = new FormGroup<Record<string, FormControl<number>>>({});
  /** Bumps whenever any point changes so the preview computeds recompute. */
  private readonly formTick = toSignal(this.form.valueChanges.pipe(startWith(null)), {
    initialValue: null,
  });
  /** The applicant's simulated pick: one optionCode per question. */
  private readonly selected = signal<Record<string, string>>({});

  /** Gauge geometry — radius + circumference for the SVG arc. */
  readonly gaugeR = 54;
  readonly gaugeC = 2 * Math.PI * 54;

  /** Per-question highest-points option — feeds maxAchievable + the "Top" marker. */
  readonly bestByQuestion = computed<Record<string, string>>(() => {
    this.formTick();
    const w = this.weightsNow();
    const out: Record<string, string> = {};
    for (const q of this.questions()) {
      let best = -Infinity;
      let code = '';
      for (const o of q.options) {
        const p = w[q.code]?.[o.code] ?? 0;
        if (p > best) {
          best = p;
          code = o.code;
        }
      }
      if (code) out[q.code] = code;
    }
    return out;
  });

  /** Σ over questions of the best option's points (the achievable ceiling). */
  readonly maxAchievable = computed<number>(() => {
    this.formTick();
    const w = this.weightsNow();
    let total = 0;
    for (const q of this.questions()) {
      let best = 0;
      for (const o of q.options) {
        const p = w[q.code]?.[o.code] ?? 0;
        if (p > best) best = p;
      }
      total += best;
    }
    return total;
  });

  /** Σ of the points for the currently simulated answers. */
  readonly earned = computed<number>(() => {
    this.formTick();
    const w = this.weightsNow();
    const sel = this.selected();
    let total = 0;
    for (const q of this.questions()) {
      const oc = sel[q.code];
      if (oc) total += w[q.code]?.[oc] ?? 0;
    }
    return total;
  });

  readonly probability = computed<number>(() => {
    const max = this.maxAchievable();
    return max > 0 ? clamp01(this.earned() / max) : 0;
  });
  readonly pct = computed<number>(() => this.probability() * 100);
  readonly tier = computed<ApprovalTier>(() => tierFor(this.probability()));
  readonly dashOffset = computed<number>(() => this.gaugeC * (1 - this.probability()));
  /** Live nested point values — recomputed on every slider change to drive the read-only readouts. */
  readonly pointValues = computed<NestedWeights>(() => {
    this.formTick();
    return this.weightsNow();
  });

  async ngOnInit(): Promise<void> {
    try {
      const [questions, weights] = await Promise.all([
        this.api.weightableQuestions(this.category),
        this.api.programWeights(this.programId),
      ]);
      this.questions.set(questions);
      this.program.set(weights.program);
      const seed = weights.active?.weights ?? {};
      for (const q of questions) {
        for (const o of q.options) {
          const raw = Number(seed[q.code]?.[o.code] ?? 0);
          const points = clampPoints(raw > 0 ? raw : MIN_POINTS);
          this.form.addControl(
            key(q.code, o.code),
            new FormControl<number>(points, {
              nonNullable: true,
              validators: [
                Validators.required,
                Validators.min(MIN_POINTS),
                Validators.max(MAX_POINTS),
              ],
            }),
          );
        }
      }
      // Default the what-if to the best answer per question → gauge starts at the ceiling.
      this.selected.set({ ...this.bestByQuestion() });
    } finally {
      this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    if (this.saving() || this.form.invalid) return;
    this.saving.set(true);
    try {
      await this.api.saveWeights(this.programId, this.weightsNow());
      this.form.markAsPristine();
      this.message.success($localize`:@@scoring.editor.saved:Weights saved`);
    } finally {
      this.saving.set(false);
    }
  }

  /** Program display name, Arabic-first with English fallback. */
  programName(p: ProgramMeta): string {
    return (this.isAr && p.friendlyNameAr) || p.friendlyName;
  }

  /** Question label, Arabic-first. */
  questionLabel(q: WeightableQuestion): string {
    return (this.isAr ? q.labelAr : q.labelEn) || q.labelEn;
  }

  /** Answer label, Arabic-first. */
  optionLabel(o: WeightableOption): string {
    return (this.isAr ? o.labelAr : o.labelEn) || o.labelEn;
  }

  /** Composite control name for a given question/option pair. */
  controlName(questionCode: string, optionCode: string): string {
    return key(questionCode, optionCode);
  }

  /** True when this option carries the highest points for its question. */
  isTop(questionCode: string, optionCode: string): boolean {
    return this.bestByQuestion()[questionCode] === optionCode;
  }

  /** True when this option is the simulated pick for its question. */
  isPicked(questionCode: string, optionCode: string): boolean {
    return this.selected()[questionCode] === optionCode;
  }

  pickAnswer(questionCode: string, optionCode: string): void {
    this.selected.update((s) => ({ ...s, [questionCode]: optionCode }));
  }

  resetToBest(): void {
    this.selected.set({ ...this.bestByQuestion() });
  }

  /** Whether a control is invalid and has been interacted with (inline error gate). */
  ctrlInvalid(questionCode: string, optionCode: string): boolean {
    const c = this.form.get(this.controlName(questionCode, optionCode));
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  tierLabel(t: ApprovalTier): string {
    switch (t) {
      case 'excellent':
        return $localize`:@@scoring.editor.tier_excellent:Excellent`;
      case 'good':
        return $localize`:@@scoring.editor.tier_good:Good`;
      case 'moderate':
        return $localize`:@@scoring.editor.tier_moderate:Moderate`;
      case 'low':
        return $localize`:@@scoring.editor.tier_low:Low`;
      default:
        return $localize`:@@scoring.editor.tier_very_low:Very low`;
    }
  }

  /** Reduce the flat composite form value back into the nested points map. */
  private weightsNow(): NestedWeights {
    const raw = this.form.getRawValue() as Record<string, number>;
    const out: NestedWeights = {};
    for (const [composite, points] of Object.entries(raw)) {
      const [questionCode, optionCode] = composite.split(SEP);
      if (!questionCode || !optionCode) continue;
      (out[questionCode] ??= {})[optionCode] = Number(points ?? 0);
    }
    return out;
  }
}
