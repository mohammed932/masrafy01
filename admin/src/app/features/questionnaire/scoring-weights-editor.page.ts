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
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { NzSliderModule } from 'ng-zorro-antd/slider';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzMessageService } from 'ng-zorro-antd/message';
import {
  QuestionnaireApiService,
  type LoanCategory,
  type ProgramMeta,
  type ProgramScoringWeights,
  type WeightableOption,
  type WeightableQuestion,
} from './questionnaire.api.service';

/** Control-name prefixes: question weight vs answer score. Composite keys joined by SEP. */
const SEP = '::';
const QW = 'qw';
const SC = 'sc';
const weightKey = (q: string): string => `${QW}${SEP}${q}`;
const scoreKey = (q: string, o: string): string => `${SC}${SEP}${q}${SEP}${o}`;

/** Weights + scores are both 0..100. */
const clampPct = (n: number): number => Math.min(100, Math.max(0, n));

type ApprovalTier = 'excellent' | 'good' | 'moderate' | 'low' | 'very_low';

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Equal question weights summing to exactly 100 (remainder spread over the first questions). */
function equalSplit(codes: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  const n = codes.length;
  if (n === 0) return out;
  const base = Math.floor(100 / n);
  let rem = 100 - base * n;
  for (const c of codes) {
    out[c] = base + (rem > 0 ? 1 : 0);
    if (rem > 0) rem -= 1;
  }
  return out;
}

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
 * Scoring weights editor — "Weight Studio" (Constitution V — direct save, v8.0.0).
 * TWO levels, per program: each QUESTION has an importance **weight** (all summing to 100,
 * tracked by the top budget bar) and each ANSWER a **score 0–100**. A live what-if gauge
 * mirrors `probability = Σ(questionWeight÷100 × pickedScore÷100)`. Questions render as an
 * accordion (first open). Save is blocked until the weights total exactly 100.
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
    NzCollapseModule,
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
          <!-- LEFT — weight + score editors --------------------------------- -->
          <section
            class="questions"
            aria-label="Scoring weights"
            i18n-aria-label="@@scoring.editor.editors_aria"
          >
            <p class="intro" i18n="@@scoring.editor.points_intro">
              Give each question a weight (how much it matters) — all question weights must total
              100%. Then score each answer 0–100 (how favorable it is).
            </p>

            <!-- Top budget: question weights must total 100 -->
            <div class="wbudget" [class.bad]="!weightSumOk()">
              <div class="wbudget-top">
                <span class="wbudget-label" i18n="@@scoring.editor.weight_budget"
                  >Question weights</span
                >
                <span class="wbudget-val"
                  >{{ weightSum() | number: '1.0-1' }}<span class="wbudget-unit"> / 100</span></span
                >
              </div>
              <div class="wbudget-bar">
                <span class="wbudget-fill" [style.inline-size.%]="weightBarPct()"></span>
              </div>
              @if (!weightSumOk()) {
                <p class="wbudget-hint" i18n="@@scoring.editor.weight_sum_bad">
                  All question weights must total exactly 100%.
                </p>
              }
            </div>

            <form [formGroup]="form">
              <nz-collapse class="qaccordion" nzAccordion>
                @for (q of questions(); track q.code) {
                  <nz-collapse-panel
                    [nzActive]="openPanel() === q.code"
                    (nzActiveChange)="openPanel.set($event ? q.code : null)"
                    [nzHeader]="qHeader"
                    [nzExtra]="qExtra"
                  >
                    <ng-template #qHeader>
                      <span class="qlabel">{{ questionLabel(q) }}</span>
                      <span class="qcode mono">{{ q.code }}</span>
                    </ng-template>
                    <ng-template #qExtra>
                      <span class="qweight-chip"
                        >{{ weightOf(q.code) | number: '1.0-1' }}%
                        <span class="qweight-chip-label" i18n="@@scoring.editor.weight"
                          >weight</span
                        >
                      </span>
                    </ng-template>

                    <!-- Level 1: question weight (importance) — slider + live % readout -->
                    <div class="qweight-block">
                      <div class="qweight-head">
                        <div class="qweight-text">
                          <span class="qweight-name" i18n="@@scoring.editor.q_weight"
                            >Question weight (importance)</span
                          >
                          <span class="qweight-sub" i18n="@@scoring.editor.q_weight_hint"
                            >share of the 100% across all questions</span
                          >
                        </div>
                        <span class="qweight-readout">{{ weightOf(q.code) | number: '1.0-0'
                          }}<span class="qweight-unit">%</span></span
                        >
                      </div>
                      <nz-slider
                        class="qweight-slider"
                        [formControlName]="weightKey(q.code)"
                        [nzMin]="0"
                        [nzMax]="100"
                        [nzStep]="1"
                        aria-label="question weight"
                        i18n-aria-label="@@scoring.editor.q_weight_aria"
                      />
                    </div>

                    <!-- Level 2: answer scores (quality) -->
                    <p class="ascore-head" i18n="@@scoring.editor.answer_scores">
                      Answer scores — how favorable each answer is (0–100)
                    </p>
                    <div class="answers">
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
                              >{{ scoreOf(q.code, o.code) | number: '1.0-0'
                              }}<span class="pts-unit">%</span></span
                            >
                          </div>
                          <nz-slider
                            class="pts-slider"
                            [formControlName]="scoreKey(q.code, o.code)"
                            [nzMin]="0"
                            [nzMax]="100"
                            [nzStep]="1"
                          />
                        </div>
                      }
                    </div>
                  </nz-collapse-panel>
                }
              </nz-collapse>
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
          @if (!weightSumOk()) {
            <span class="savebar-error" i18n="@@scoring.editor.fix_weights"
              >Question weights must total 100% to save.</span
            >
          } @else if (!allWeightsPositive()) {
            <span class="savebar-error" i18n="@@scoring.editor.fix_zero_weight"
              >Every question needs a weight above 0%.</span
            >
          } @else if (!allScoresPositive()) {
            <span class="savebar-error" i18n="@@scoring.editor.fix_zero_score"
              >Every answer needs a score above 0.</span
            >
          } @else if (form.dirty && !saving()) {
            <span class="dirty" i18n="@@scoring.editor.unsaved">Unsaved changes</span>
          }
          <button
            nz-button
            nzType="primary"
            nzSize="large"
            [disabled]="saving() || form.invalid || !canSave()"
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
        max-inline-size: min(1180px, 100%);
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
        max-inline-size: 64ch;
      }

      /* ── Weight budget (question weights must total 100) ──────────────── */
      .wbudget {
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        padding: var(--space-4) var(--space-5);
        margin-block-end: var(--space-4);
        box-shadow: var(--shadow-sm);
      }
      .wbudget.bad {
        border-color: var(--error);
      }
      .wbudget-top {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--space-2);
      }
      .wbudget-label {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--text-secondary);
      }
      .wbudget-val {
        font-size: var(--text-xl);
        font-weight: var(--font-bold);
        color: var(--text-primary);
        font-feature-settings:
          'tnum' 1,
          'lnum' 1;
      }
      .wbudget.bad .wbudget-val {
        color: var(--error);
      }
      .wbudget-unit {
        font-size: var(--text-sm);
        font-weight: var(--font-normal);
        color: var(--text-tertiary);
      }
      .wbudget-bar {
        block-size: 8px;
        border-radius: var(--radius-pill);
        background: var(--bg-muted);
        overflow: hidden;
        margin-block-start: var(--space-2);
      }
      .wbudget-fill {
        display: block;
        block-size: 100%;
        background: var(--primary);
        border-radius: var(--radius-pill);
        transition:
          inline-size var(--motion-duration-base) var(--motion-easing-standard),
          background var(--motion-duration-base) var(--motion-easing-standard);
      }
      .wbudget.bad .wbudget-fill {
        background: var(--error);
      }
      .wbudget-hint {
        margin-block: var(--space-2) 0;
        font-size: var(--text-xs);
        font-weight: var(--font-medium);
        color: var(--error);
      }

      /* ── Accordion (one question per panel) ───────────────────────────── */
      .qaccordion {
        display: block;
        border: none;
        background: transparent;
      }
      .qaccordion ::ng-deep .ant-collapse {
        border: none;
        background: transparent;
      }
      .qaccordion ::ng-deep .ant-collapse-item {
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg) !important;
        background: var(--bg-surface);
        box-shadow: var(--shadow-sm);
        overflow: hidden;
        margin-block-end: var(--space-4);
      }
      .qaccordion ::ng-deep .ant-collapse-item:last-child {
        margin-block-end: 0;
      }
      .qaccordion ::ng-deep .ant-collapse-header {
        align-items: center !important;
        gap: var(--space-2);
        padding: var(--space-4) var(--space-5) !important;
        color: var(--text-primary) !important;
      }
      .qaccordion ::ng-deep .ant-collapse-item-active {
        border-color: var(--primary);
      }
      .qaccordion ::ng-deep .ant-collapse-item-active .ant-collapse-header {
        background: color-mix(in srgb, var(--primary) 5%, transparent);
      }
      .qaccordion ::ng-deep .ant-collapse-extra {
        margin-inline-start: auto;
      }
      .qaccordion ::ng-deep .ant-collapse-content-box {
        padding: var(--space-4) var(--space-5) var(--space-5) !important;
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
        margin-inline-start: var(--space-2);
      }
      .qweight-chip {
        font-size: var(--text-sm);
        font-weight: var(--font-bold);
        color: var(--primary);
        background: var(--primary-subtle);
        padding-block: 2px;
        padding-inline: var(--space-3);
        border-radius: var(--radius-pill);
        white-space: nowrap;
        font-feature-settings:
          'tnum' 1,
          'lnum' 1;
      }
      .qweight-chip-label {
        font-weight: var(--font-normal);
        font-size: var(--text-xs);
      }

      /* ── Level 1: question weight — slider + live % readout ───────────── */
      .qweight-block {
        padding: var(--space-4) var(--space-4) var(--space-3);
        background: var(--bg-subtle);
        border-radius: var(--radius-md);
        border-inline-start: 3px solid var(--primary);
        margin-block-end: var(--space-4);
      }
      .qweight-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--space-4);
      }
      .qweight-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .qweight-name {
        font-weight: var(--font-semibold);
        color: var(--text-primary);
      }
      .qweight-sub {
        font-size: var(--text-xs);
        color: var(--text-tertiary);
      }
      .qweight-readout {
        display: flex;
        align-items: baseline;
        font-size: var(--text-2xl);
        font-weight: var(--font-bold);
        line-height: 1;
        color: var(--primary);
        font-feature-settings:
          'tnum' 1,
          'lnum' 1;
      }
      .qweight-unit {
        font-size: var(--text-base);
        font-weight: var(--font-semibold);
        margin-inline-start: 1px;
        color: color-mix(in srgb, var(--primary) 65%, transparent);
      }
      /* Weight slider reads heavier than the answer sliders — it's the level-1 control. */
      .qweight-slider {
        margin-block-start: var(--space-3);
      }
      .qweight-slider ::ng-deep .ant-slider-rail {
        block-size: 8px;
        border-radius: var(--radius-pill);
        background: var(--bg-muted);
      }
      .qweight-slider ::ng-deep .ant-slider-track {
        block-size: 8px;
        border-radius: var(--radius-pill);
        background: linear-gradient(
          90deg,
          color-mix(in srgb, var(--primary) 70%, transparent),
          var(--primary)
        );
      }
      .qweight-slider ::ng-deep .ant-slider:hover .ant-slider-track {
        background: var(--primary-hover);
      }
      .qweight-slider ::ng-deep .ant-slider-handle {
        inline-size: 22px;
        block-size: 22px;
        margin-block-start: -7px;
        border: 3px solid var(--primary);
        background: var(--bg-surface);
        box-shadow: var(--shadow-md);
        transition:
          transform var(--motion-duration-fast) var(--motion-easing-standard),
          box-shadow var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .qweight-slider ::ng-deep .ant-slider-handle:hover,
      .qweight-slider ::ng-deep .ant-slider-handle:focus {
        transform: scale(1.12);
        box-shadow: var(--focus-halo);
      }

      /* ── Level 2: answer scores ───────────────────────────────────────── */
      .ascore-head {
        margin-block: 0 var(--space-2);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        letter-spacing: var(--tracking-wide);
        text-transform: uppercase;
        color: var(--text-tertiary);
      }
      .answers {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: var(--space-3) var(--space-5);
      }
      .answer {
        padding: var(--space-3) var(--space-3) var(--space-2);
        border-radius: var(--radius-md);
        border-inline-start: 3px solid transparent;
        transition: background var(--motion-duration-base) var(--motion-easing-standard);
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
        min-inline-size: 44px;
        padding-block: var(--space-1);
        padding-inline: var(--space-2);
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
      .pts-unit {
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        margin-inline-start: 1px;
        color: var(--text-tertiary);
      }
      .pts-readout.is-top {
        color: var(--primary);
        background: var(--primary-subtle);
      }
      .pts-readout.is-top .pts-unit {
        color: color-mix(in srgb, var(--primary) 60%, transparent);
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
        margin: 0 0 var(--space-4);
        text-align: center;
        font-size: var(--text-xs);
        color: var(--text-tertiary);
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
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: var(--space-4);
        margin-block-start: var(--space-6);
        padding-block-start: var(--space-5);
        border-block-start: 1px solid var(--border-default);
      }
      .dirty {
        font-size: var(--text-sm);
        color: var(--warning);
        font-weight: var(--font-medium);
      }
      .savebar-error {
        font-size: var(--text-sm);
        color: var(--error);
        font-weight: var(--font-medium);
      }

      /* ── Reduced motion ───────────────────────────────────────────────── */
      @media (prefers-reduced-motion: reduce) {
        .gauge-fill,
        .wbudget-fill,
        .answer,
        .reset,
        .chip,
        .pts-readout,
        .pts-slider ::ng-deep .ant-slider-handle,
        .qweight-slider ::ng-deep .ant-slider-handle {
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

  readonly weightKey = weightKey;
  readonly scoreKey = scoreKey;

  readonly questions = signal<WeightableQuestion[]>([]);
  readonly program = signal<ProgramMeta | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  /** Accordion: the single open question (by code); the first question opens on load. */
  readonly openPanel = signal<string | null>(null);

  readonly form = new FormGroup<Record<string, FormControl<number>>>({});
  /** Bumps whenever any weight/score changes so the preview computeds recompute. */
  private readonly formTick = toSignal(this.form.valueChanges.pipe(startWith(null)), {
    initialValue: null,
  });
  /** The applicant's simulated pick: one optionCode per question. */
  private readonly selected = signal<Record<string, string>>({});

  /** Gauge geometry — radius + circumference for the SVG arc. */
  readonly gaugeR = 54;
  readonly gaugeC = 2 * Math.PI * 54;

  /** Live two-level scoring rebuilt from the form on every change. */
  readonly scoring = computed<ProgramScoringWeights>(() => {
    this.formTick();
    return this.scoringNow();
  });

  /** Question weights, rounded to 1 decimal — drives the header chips + budget. */
  readonly weightValues = computed<Record<string, number>>(() => this.scoring().questionWeights);
  readonly scoreValues = computed<Record<string, Record<string, number>>>(
    () => this.scoring().answerScores,
  );
  /** Sum of all question weights (1-decimal). Must equal 100 to save. */
  readonly weightSum = computed<number>(() => {
    const total = Object.values(this.weightValues()).reduce((a, b) => a + b, 0);
    return Math.round(total * 10) / 10;
  });
  readonly weightSumOk = computed<boolean>(() => this.weightSum() === 100);
  readonly weightBarPct = computed<number>(() => Math.min(100, Math.max(0, this.weightSum())));

  /** No question may be left at 0% weight. */
  readonly allWeightsPositive = computed<boolean>(() =>
    this.questions().every((q) => (this.weightValues()[q.code] ?? 0) > 0),
  );
  /** No answer may be left at 0 score. */
  readonly allScoresPositive = computed<boolean>(() =>
    this.questions().every((q) =>
      q.options.every((o) => (this.scoreValues()[q.code]?.[o.code] ?? 0) > 0),
    ),
  );
  /** Save is allowed only when weights total 100 and nothing is left at zero. */
  readonly canSave = computed<boolean>(
    () => this.weightSumOk() && this.allWeightsPositive() && this.allScoresPositive(),
  );

  /** Per-question highest-scoring option — feeds the "Top" marker + best what-if. */
  readonly bestByQuestion = computed<Record<string, string>>(() => {
    const scores = this.scoreValues();
    const out: Record<string, string> = {};
    for (const q of this.questions()) {
      let best = -Infinity;
      let code = '';
      for (const o of q.options) {
        const s = scores[q.code]?.[o.code] ?? 0;
        if (s > best) {
          best = s;
          code = o.code;
        }
      }
      if (code) out[q.code] = code;
    }
    return out;
  });

  /** probability = Σ ( questionWeight/100 × pickedScore/100 ) over the simulated answers. */
  readonly probability = computed<number>(() => {
    const weights = this.weightValues();
    const scores = this.scoreValues();
    const sel = this.selected();
    let total = 0;
    for (const q of this.questions()) {
      const oc = sel[q.code];
      if (!oc) continue;
      const weight = weights[q.code] ?? 0;
      const score = scores[q.code]?.[oc] ?? 0;
      total += (weight / 100) * (score / 100);
    }
    return clamp01(total);
  });
  readonly pct = computed<number>(() => this.probability() * 100);
  readonly tier = computed<ApprovalTier>(() => tierFor(this.probability()));
  readonly dashOffset = computed<number>(() => this.gaugeC * (1 - this.probability()));

  async ngOnInit(): Promise<void> {
    try {
      const [questions, weights] = await Promise.all([
        this.api.weightableQuestions(this.category),
        this.api.programWeights(this.programId),
      ]);
      this.questions.set(questions);
      this.openPanel.set(questions[0]?.code ?? null);
      this.program.set(weights.program);

      const active = weights.active?.weights;
      const seedWeights = active?.questionWeights ?? {};
      const seedScores = active?.answerScores ?? {};
      // equalSplit ONLY seeds a brand-new program with no saved set. When a set
      // exists its weights are authoritative (already sum 100); questions it
      // doesn't cover default to 0 — never equalSplit-of-all, which would stack
      // on top of the saved 100 and blow the budget past 100.
      const hasActiveWeights = Object.keys(seedWeights).length > 0;
      const fallbackWeights = hasActiveWeights ? {} : equalSplit(questions.map((q) => q.code));

      for (const q of questions) {
        const w = clampPct(Number(seedWeights[q.code] ?? fallbackWeights[q.code] ?? 0));
        this.form.addControl(weightKey(q.code), this.numberControl(w));
        for (const o of q.options) {
          const s = clampPct(Number(seedScores[q.code]?.[o.code] ?? 0));
          this.form.addControl(scoreKey(q.code, o.code), this.numberControl(s));
        }
      }
      // Default the what-if to the best (highest-scoring) answer per question.
      this.selected.set({ ...this.bestByQuestion() });
    } finally {
      this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    if (this.saving() || this.form.invalid || !this.canSave()) return;
    this.saving.set(true);
    try {
      await this.api.saveWeights(this.programId, this.scoringNow());
      this.form.markAsPristine();
      this.message.success($localize`:@@scoring.editor.saved:Weights saved`);
    } finally {
      this.saving.set(false);
    }
  }

  /** A 0..100 form control with required + range validators. */
  private numberControl(value: number): FormControl<number> {
    return new FormControl<number>(value, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(100)],
    });
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

  /** Live question weight (for the header chip). */
  weightOf(questionCode: string): number {
    return this.weightValues()[questionCode] ?? 0;
  }

  /** Live answer score (for the read-only readout). */
  scoreOf(questionCode: string, optionCode: string): number {
    return this.scoreValues()[questionCode]?.[optionCode] ?? 0;
  }

  /** True when this option carries the highest score for its question. */
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

  /** Reduce the flat composite form value into the two-level scoring payload. */
  private scoringNow(): ProgramScoringWeights {
    const raw = this.form.getRawValue() as Record<string, number>;
    const questionWeights: Record<string, number> = {};
    const answerScores: Record<string, Record<string, number>> = {};
    for (const [composite, value] of Object.entries(raw)) {
      const parts = composite.split(SEP);
      if (parts[0] === QW && parts[1]) {
        questionWeights[parts[1]] = Number(value ?? 0);
      } else if (parts[0] === SC && parts[1] && parts[2]) {
        (answerScores[parts[1]] ??= {})[parts[2]] = Number(value ?? 0);
      }
    }
    return { questionWeights, answerScores };
  }
}
