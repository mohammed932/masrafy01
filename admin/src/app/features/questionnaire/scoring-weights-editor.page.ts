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
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzSliderModule } from 'ng-zorro-antd/slider';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzMessageService } from 'ng-zorro-antd/message';
import {
  QuestionnaireApiService,
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
 * Per-program scoring editor (Constitution V — direct save, v8.0.0; Feature 010).
 *
 * ONE unified screen. Every question in the GLOBAL pool has a checkbox — ticking
 * it ASSIGNS the question to this program (it joins the program's scoring),
 * unticking removes it. Only assigned questions carry a weight + answer scores;
 * the assigned weights must total 100 (sticky budget strip), and each assigned
 * answer a score 0–100 — `probability = Σ(questionWeight÷100 × pickedScore÷100)`.
 * The set of assigned questions IS the persisted `questionWeights` map, so
 * assignment and weighting are the same save.
 */
@Component({
  standalone: true,
  selector: 'mf-scoring-weights-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    NzButtonModule,
    NzCheckboxModule,
    NzSliderModule,
    NzEmptyModule,
    NzSpinModule,
  ],
  template: `
    <section class="page">
      <header class="hero">
        <span class="hero-accent" aria-hidden="true"></span>
        <a routerLink="/banks" class="back" i18n="@@scoring.editor.back">← Banks</a>
        <h1 class="hero-title" i18n="@@scoring.editor.title">Approval scoring</h1>
        @if (program(); as p) {
          <p class="prog-line">
            <span class="bank">{{ p.bankName }}</span>
            <span class="sep" aria-hidden="true">—</span>
            <span class="prog">{{ programName(p) }}</span>
            <span class="cat-chip">{{ p.category }}</span>
          </p>
        }
        <p class="hero-sub" i18n="@@scoring.editor.subtitle">
          Tick the questions this program should score on, then set each one's weight and how
          favorable every answer is.
        </p>
      </header>

      @if (loading()) {
        <div class="panel center"><nz-spin nzSimple /></div>
      } @else if (questions().length === 0) {
        <div class="panel center-col">
          <nz-empty
            i18n-nzNotFoundContent="@@scoring.editor.no_questions"
            nzNotFoundContent="No questions in the pool yet."
          />
          <a routerLink="/questionnaire" nz-button nzType="primary" i18n="@@scoring.editor.go_build"
            >Build the question pool</a
          >
        </div>
      } @else {
        <!-- Governor: assigned-question weights must total exactly 100 -->
        <div class="budget-strip" [class.is-bad]="!weightSumOk()">
          <span class="budget-label" i18n="@@scoring.editor.weight_budget">Question weights</span>
          <span class="budget-val"
            >{{ weightSum() | number: '1.0-1' }}<span class="budget-unit"> / 100</span></span
          >
          <div class="budget-bar">
            <span class="budget-fill" [style.inline-size.%]="weightBarPct()"></span>
          </div>
          <span class="assigned-count"
            >{{ assignedCount() }}<span i18n="@@scoring.editor.assigned_suffix"> assigned</span></span
          >
          <button
            nz-button
            nzSize="small"
            type="button"
            class="balance-btn"
            [disabled]="assignedCount() === 0"
            (click)="balance()"
            i18n="@@scoring.editor.balance"
          >
            Distribute evenly
          </button>
          @if (!weightSumOk()) {
            <span class="budget-hint" aria-live="polite" i18n="@@scoring.editor.weight_sum_bad"
              >Assigned question weights must total exactly 100%.</span
            >
          }
        </div>

        <form class="workbench" [formGroup]="form">
          <!-- Left rail: every question with an assign checkbox + its live weight -->
          <aside class="qlist" aria-label="Questions" i18n-aria-label="@@scoring.editor.qlist_aria">
            <p class="qlist-head" i18n="@@scoring.editor.qlist_head">Question pool</p>
            @for (q of questions(); track q.code) {
              <div
                class="q-row"
                [class.assigned]="isAssigned(q.code)"
                [class.active]="selected() === q.code"
              >
                <label
                  nz-checkbox
                  class="q-check"
                  [ngModel]="isAssigned(q.code)"
                  [ngModelOptions]="{ standalone: true }"
                  (ngModelChange)="toggleAssign(q.code, $event)"
                  [attr.aria-label]="assignAria(q)"
                ></label>
                <button
                  type="button"
                  class="q-open"
                  [attr.aria-current]="selected() === q.code"
                  (click)="selected.set(q.code)"
                >
                  <span class="q-name">{{ questionLabel(q) }}</span>
                  @if (isAssigned(q.code) && questionIncomplete(q)) {
                    <span
                      class="attn"
                      title="Needs a weight and answer scores above 0"
                      i18n-title="@@scoring.editor.attn"
                    ></span>
                  }
                  @if (isAssigned(q.code)) {
                    <span class="q-weight">{{ weightOf(q.code) | number: '1.0-0' }}%</span>
                  }
                </button>
              </div>
            }
          </aside>

          <!-- Right canvas: the selected question — assign CTA, or weight + answer scores -->
          @if (selectedQuestion(); as q) {
            <section class="canvas">
              <header class="canvas-head">
                <h2 class="qlabel">{{ questionLabel(q) }}</h2>
                <span class="qcode mono">{{ q.code }}</span>
              </header>

              @if (!isAssigned(q.code)) {
                <div class="assign-cta">
                  <span class="assign-cta-mark" aria-hidden="true"></span>
                  <p class="assign-cta-title" i18n="@@scoring.editor.not_scored">
                    Not scored by this program
                  </p>
                  <p class="assign-cta-sub" i18n="@@scoring.editor.not_scored_sub">
                    Assign this question to give it a weight and score its answers.
                  </p>
                  <button
                    nz-button
                    nzType="primary"
                    type="button"
                    (click)="toggleAssign(q.code, true)"
                    i18n="@@scoring.editor.assign_cta"
                  >
                    Assign to this program
                  </button>
                </div>
              } @else {
                <!-- Level 1: question weight (importance) — slider + live % readout -->
                <div class="qweight-block">
                  <div class="qweight-head">
                    <span class="qweight-name" i18n="@@scoring.editor.q_weight"
                      >Question weight (importance)</span
                    >
                    <span class="qweight-readout"
                      >{{ weightOf(q.code) | number: '1.0-0'
                      }}<span class="qweight-unit">%</span></span
                    >
                  </div>
                  <nz-slider
                    class="qweight-slider"
                    [ngModel]="weightOf(q.code)"
                    [ngModelOptions]="{ standalone: true }"
                    (ngModelChange)="setWeight(q.code, $event)"
                    [nzMin]="0"
                    [nzMax]="100"
                    [nzStep]="1"
                    aria-label="question weight"
                    i18n-aria-label="@@scoring.editor.q_weight_aria"
                  />
                </div>

                <!-- Level 2: answer scores — one row each: label (+Top) · slider · readout -->
                <p class="ascore-head" i18n="@@scoring.editor.answer_scores">
                  Answer scores — how favorable each answer is (0–100)
                </p>
                <div class="answers">
                  @for (o of q.options; track o.code) {
                    <div class="answer-row">
                      <span class="answer-label"
                        >{{ optionLabel(o) }}
                        @if (isTop(q.code, o.code)) {
                          <span class="top-pill" i18n="@@scoring.editor.top">★ Top</span>
                        }
                      </span>
                      <nz-slider
                        class="pts-slider"
                        [ngModel]="scoreOf(q.code, o.code)"
                        [ngModelOptions]="{ standalone: true }"
                        (ngModelChange)="setScore(q.code, o.code, $event)"
                        [nzMin]="0"
                        [nzMax]="100"
                        [nzStep]="1"
                      />
                      <span
                        class="pts-readout"
                        [class.is-top]="isTop(q.code, o.code)"
                        aria-hidden="true"
                        >{{ scoreOf(q.code, o.code) | number: '1.0-0'
                        }}<span class="pts-unit">%</span></span
                      >
                    </div>
                  }
                </div>
              }
            </section>
          }
        </form>

        <div class="savebar">
          @if (assignedCount() === 0) {
            <span class="savebar-error" i18n="@@scoring.editor.fix_none_assigned"
              >Assign at least one question to score this program.</span
            >
          } @else if (!weightSumOk()) {
            <span class="savebar-error" i18n="@@scoring.editor.fix_weights"
              >Assigned question weights must total 100% to save.</span
            >
          } @else if (!allWeightsPositive()) {
            <span class="savebar-error" i18n="@@scoring.editor.fix_zero_weight"
              >Every assigned question needs a weight above 0%.</span
            >
          } @else if (!allScoresPositive()) {
            <span class="savebar-error" i18n="@@scoring.editor.fix_zero_score"
              >Every answer of an assigned question needs a score above 0.</span
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
            Save scoring
          </button>
        </div>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        block-size: 100%;
      }
      /* Full-height column: hero + governor + workbench (fills) + save bar.
         The PAGE never scrolls — the rail and canvas scroll inside themselves. */
      .page {
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        min-block-size: 0;
        block-size: 100%;
        max-inline-size: min(1100px, 100%);
        margin-inline: auto;
      }

      /* ── Hero ─────────────────────────────────────────────────────────── */
      .hero {
        position: relative;
        overflow: hidden;
        flex: 0 0 auto;
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        padding: var(--space-4) var(--space-5);
        margin-block-end: var(--space-4);
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
      .hero-sub {
        margin: var(--space-2) 0 0;
        max-inline-size: 68ch;
        font-size: var(--text-sm);
        line-height: var(--leading-normal);
        color: var(--text-secondary);
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
      .panel.center-col {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-4);
      }

      /* ── Weight governor — always-visible, flex-none top of the column ── */
      .budget-strip {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-2) var(--space-4);
        padding: var(--space-3) var(--space-5);
        margin-block-end: var(--space-4);
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-sm);
        transition: border-color var(--motion-duration-base) var(--motion-easing-standard);
      }
      .budget-strip.is-bad {
        border-color: var(--error);
      }
      .budget-label {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--text-secondary);
        white-space: nowrap;
      }
      .budget-val {
        font-size: var(--text-xl);
        font-weight: var(--font-bold);
        color: var(--text-primary);
        white-space: nowrap;
        font-feature-settings:
          'tnum' 1,
          'lnum' 1;
      }
      .budget-strip.is-bad .budget-val {
        color: var(--error);
      }
      .budget-unit {
        font-size: var(--text-sm);
        font-weight: var(--font-normal);
        color: var(--text-tertiary);
      }
      .budget-bar {
        flex: 1 1 120px;
        block-size: 8px;
        border-radius: var(--radius-pill);
        background: var(--bg-muted);
        overflow: hidden;
      }
      .budget-fill {
        display: block;
        block-size: 100%;
        background: var(--primary);
        border-radius: var(--radius-pill);
        transition:
          inline-size var(--motion-duration-base) var(--motion-easing-standard),
          background var(--motion-duration-base) var(--motion-easing-standard);
      }
      .budget-strip.is-bad .budget-fill {
        background: var(--error);
      }
      .assigned-count {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--text-secondary);
        white-space: nowrap;
        font-feature-settings:
          'tnum' 1,
          'lnum' 1;
      }
      .budget-hint {
        flex-basis: 100%;
        margin: 0;
        font-size: var(--text-xs);
        font-weight: var(--font-medium);
        color: var(--error);
      }

      /* ── Workbench: master–detail (question rail + editor canvas) ─────── */
      .workbench {
        flex: 1 1 auto;
        min-block-size: 0;
        display: grid;
        grid-template-columns: minmax(260px, 340px) minmax(0, 1fr);
        gap: var(--space-5);
      }

      /* Left rail — scrolls inside itself so the page never does. */
      .qlist {
        min-block-size: 0;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: var(--space-3);
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-sm);
      }
      .qlist-head {
        margin: 0 0 var(--space-1);
        padding-inline: var(--space-2);
        font-size: var(--text-xs);
        font-weight: var(--font-bold);
        letter-spacing: var(--tracking-wide);
        text-transform: uppercase;
        color: var(--text-tertiary);
      }
      /* Row = assign checkbox + open button. Active border on the row itself. */
      .q-row {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        padding-inline-start: var(--space-2);
        border-inline-start: 3px solid transparent;
        border-radius: var(--radius-md);
        transition: background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .q-row:hover {
        background: var(--bg-subtle);
      }
      .q-row.active {
        border-inline-start-color: var(--primary);
        background: color-mix(in srgb, var(--primary) 8%, transparent);
      }
      .q-check {
        margin-block-start: var(--space-2);
      }
      .q-open {
        flex: 1;
        min-inline-size: 0;
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-2);
        border: 0;
        background: transparent;
        color: var(--text-secondary);
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        text-align: start;
        cursor: pointer;
        transition:
          color var(--motion-duration-fast) var(--motion-easing-standard),
          opacity var(--motion-duration-fast) var(--motion-easing-standard);
      }
      /* Unassigned rows read quieter — they aren't part of this program's score. */
      .q-row:not(.assigned) .q-open {
        opacity: 0.6;
      }
      .q-row:not(.assigned):hover .q-open {
        opacity: 0.85;
      }
      .q-row.assigned .q-open {
        color: var(--text-primary);
      }
      .q-row.active .q-open {
        color: var(--text-primary);
        font-weight: var(--font-semibold);
      }
      .q-open:focus-visible {
        outline: none;
        box-shadow: var(--focus-halo);
        border-radius: var(--radius-sm);
      }
      .q-name {
        flex: 1;
        min-inline-size: 0;
        white-space: normal;
        overflow-wrap: anywhere;
        line-height: var(--leading-normal);
      }
      /* Amber dot = this question still blocks Save (no weight, or a 0 answer). */
      .attn {
        flex: none;
        margin-block-start: 5px;
        inline-size: 7px;
        block-size: 7px;
        border-radius: var(--radius-pill);
        background: var(--warning);
      }
      .q-weight {
        flex: none;
        font-size: var(--text-xs);
        font-weight: var(--font-bold);
        color: var(--primary);
        font-feature-settings:
          'tnum' 1,
          'lnum' 1;
      }

      /* Right canvas — the selected question's editor; scrolls if ever tall. */
      .canvas {
        min-block-size: 0;
        overflow-y: auto;
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-sm);
        padding: var(--space-5);
      }
      .canvas-head {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-block-end: var(--space-4);
      }
      .qlabel {
        margin: 0;
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

      /* Assign call-to-action (shown when the selected question isn't scored) */
      .assign-cta {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: var(--space-2);
        padding: var(--space-7) var(--space-4);
        border: 1px dashed var(--border-default);
        border-radius: var(--radius-md);
        background: var(--bg-subtle);
      }
      .assign-cta-mark {
        inline-size: 40px;
        block-size: 40px;
        border-radius: var(--radius-pill);
        background: var(--bg-muted);
        margin-block-end: var(--space-1);
      }
      .assign-cta-title {
        margin: 0;
        font-size: var(--text-base);
        font-weight: var(--font-semibold);
        color: var(--text-primary);
      }
      .assign-cta-sub {
        margin: 0 0 var(--space-2);
        max-inline-size: 42ch;
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }

      /* Narrow: stack panes, rail becomes a vertical list, page scrolls. */
      @media (max-width: 960px) {
        .page {
          block-size: auto;
        }
        .workbench {
          grid-template-columns: 1fr;
          min-block-size: auto;
        }
        .qlist {
          max-block-size: 320px;
        }
        .canvas {
          overflow: visible;
        }
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
      .qweight-name {
        font-weight: var(--font-semibold);
        color: var(--text-primary);
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

      /* ── Level 2: answer scores — one tidy row per answer ─────────────── */
      .ascore-head {
        margin-block: 0 var(--space-3);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        letter-spacing: var(--tracking-wide);
        text-transform: uppercase;
        color: var(--text-tertiary);
      }
      .answers {
        display: grid;
        grid-template-columns: minmax(12ch, 18ch) 1fr auto;
        column-gap: var(--space-4);
        row-gap: var(--space-1);
      }
      .answer-row {
        display: grid;
        grid-template-columns: subgrid;
        grid-column: 1 / -1;
        align-items: center;
        padding-block: var(--space-1);
      }
      .answer-label {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        min-inline-size: 0;
        font-size: var(--text-sm);
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
        min-inline-size: 4ch;
        text-align: end;
        font-size: var(--text-base);
        font-weight: var(--font-bold);
        font-feature-settings:
          'tnum' 1,
          'lnum' 1;
        color: var(--text-primary);
        transition: color var(--motion-duration-base) var(--motion-easing-standard);
      }
      .pts-unit {
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        margin-inline-start: 1px;
        color: var(--text-tertiary);
      }
      .pts-readout.is-top {
        color: var(--primary);
      }
      .pts-readout.is-top .pts-unit {
        color: color-mix(in srgb, var(--primary) 60%, transparent);
      }
      .pts-slider {
        margin: 0;
      }
      .pts-slider ::ng-deep .ant-slider {
        margin-block: 0;
        margin-inline: var(--space-2);
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

      /* ── Save bar — flex-none footer of the page column ───────────────── */
      .savebar {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: var(--space-4);
        margin-block-start: var(--space-4);
        padding-block-start: var(--space-4);
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
        .budget-strip,
        .budget-fill,
        .q-row,
        .q-open,
        .answer-row,
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

  readonly programId = this.route.snapshot.paramMap.get('programId') ?? '';

  readonly weightKey = weightKey;
  readonly scoreKey = scoreKey;

  readonly questions = signal<WeightableQuestion[]>([]);
  readonly program = signal<ProgramMeta | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  /** Master–detail: the question being edited (by code). */
  readonly selected = signal<string | null>(null);
  /**
   * The set of ASSIGNED question codes — the checkbox state. This IS the
   * program's `questionWeights` domain: assigned → scored, unassigned → excluded.
   * Stored as an immutable Set (replaced on every toggle) so signal reads react.
   */
  readonly assigned = signal<ReadonlySet<string>>(new Set());
  /** The question object for the selected code — drives the right-hand editor pane. */
  readonly selectedQuestion = computed<WeightableQuestion | null>(
    () => this.questions().find((q) => q.code === this.selected()) ?? null,
  );

  readonly form = new FormGroup<Record<string, FormControl<number>>>({});
  /**
   * Explicit revision counter, bumped by every weight/score/assign mutation. All
   * derived signals depend on it, so they recompute deterministically on each
   * drag — NOT via `form.valueChanges`, whose signal bridge proved unreliable.
   */
  private readonly rev = signal(0);
  private touch(): void {
    this.rev.update((n) => n + 1);
  }

  /** Live two-level scoring rebuilt from the form (assigned questions only). */
  readonly scoring = computed<ProgramScoringWeights>(() => {
    this.rev();
    return this.scoringNow();
  });

  readonly weightValues = computed<Record<string, number>>(() => this.scoring().questionWeights);
  readonly scoreValues = computed<Record<string, Record<string, number>>>(
    () => this.scoring().answerScores,
  );
  /** How many questions this program scores on. */
  readonly assignedCount = computed<number>(() => {
    this.rev();
    return this.assigned().size;
  });
  /** Sum of ASSIGNED question weights (1-decimal). Must equal 100 to save. */
  readonly weightSum = computed<number>(() => {
    const total = Object.values(this.weightValues()).reduce((a, b) => a + b, 0);
    return Math.round(total * 10) / 10;
  });
  readonly weightSumOk = computed<boolean>(() => this.weightSum() === 100);
  readonly weightBarPct = computed<number>(() => Math.min(100, Math.max(0, this.weightSum())));

  /** Assigned questions only. */
  private readonly assignedQuestions = computed<WeightableQuestion[]>(() => {
    const a = this.assigned();
    return this.questions().filter((q) => a.has(q.code));
  });
  /** No assigned question may be left at 0% weight. */
  readonly allWeightsPositive = computed<boolean>(() =>
    this.assignedQuestions().every((q) => (this.weightValues()[q.code] ?? 0) > 0),
  );
  /** No answer of an assigned question may be left at 0 score. */
  readonly allScoresPositive = computed<boolean>(() =>
    this.assignedQuestions().every((q) =>
      q.options.every((o) => (this.scoreValues()[q.code]?.[o.code] ?? 0) > 0),
    ),
  );
  /** Save is allowed only when ≥1 assigned, weights total 100, nothing at zero. */
  readonly canSave = computed<boolean>(
    () =>
      this.assignedCount() > 0 &&
      this.weightSumOk() &&
      this.allWeightsPositive() &&
      this.allScoresPositive(),
  );

  /** Per-question highest-scoring option — feeds the "Top" marker. */
  readonly bestByQuestion = computed<Record<string, string>>(() => {
    const scores = this.scoreValues();
    const out: Record<string, string> = {};
    for (const q of this.assignedQuestions()) {
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

  async ngOnInit(): Promise<void> {
    try {
      const [questions, weights] = await Promise.all([
        this.api.weightableQuestions(),
        this.api.programWeights(this.programId),
      ]);
      this.questions.set(questions);
      this.program.set(weights.program);

      const active = weights.active?.weights;
      const seedWeights = active?.questionWeights ?? {};
      const seedScores = active?.answerScores ?? {};
      // Assignment = the keys already in the saved weight set. A program with no
      // saved set starts with nothing assigned — the admin ticks what matters.
      const assignedCodes = Object.keys(seedWeights).filter((c) =>
        questions.some((q) => q.code === c),
      );
      this.assigned.set(new Set(assignedCodes));
      // Open the first assigned question (or the first in the pool) by default.
      this.selected.set(assignedCodes[0] ?? questions[0]?.code ?? null);

      for (const q of questions) {
        const w = clampPct(Number(seedWeights[q.code] ?? 0));
        this.form.addControl(weightKey(q.code), this.numberControl(w));
        for (const o of q.options) {
          const s = clampPct(Number(seedScores[q.code]?.[o.code] ?? 0));
          this.form.addControl(scoreKey(q.code, o.code), this.numberControl(s));
        }
      }
      this.touch();
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
      this.message.success($localize`:@@scoring.editor.saved:Scoring saved`);
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

  assignAria(q: WeightableQuestion): string {
    return $localize`:@@scoring.editor.assign_aria:Assign question` + `: ${this.questionLabel(q)}`;
  }

  isAssigned(code: string): boolean {
    this.rev();
    return this.assigned().has(code);
  }

  /**
   * Tick / untick a question for this program. Ticking adds it to the scoring
   * (starts at its current weight, 0 for a fresh assignment — the admin sets it
   * or hits "Distribute evenly"); unticking removes it from the budget entirely.
   */
  toggleAssign(code: string, checked: boolean): void {
    this.assigned.update((s) => {
      const next = new Set(s);
      if (checked) next.add(code);
      else next.delete(code);
      return next;
    });
    if (checked) this.selected.set(code);
    this.form.markAsDirty();
    this.touch();
  }

  /** Spread 100% evenly across the assigned questions (leaves answer scores untouched). */
  balance(): void {
    const codes = [...this.assigned()];
    if (codes.length === 0) return;
    const split = equalSplit(codes);
    for (const c of codes) {
      this.form.controls[weightKey(c)]?.setValue(split[c] ?? 0);
    }
    this.form.markAsDirty();
    this.touch();
  }

  weightOf(questionCode: string): number {
    this.rev();
    return this.form.controls[weightKey(questionCode)]?.value ?? 0;
  }

  scoreOf(questionCode: string, optionCode: string): number {
    this.rev();
    return this.form.controls[scoreKey(questionCode, optionCode)]?.value ?? 0;
  }

  setWeight(questionCode: string, value: number): void {
    const ctrl = this.form.controls[weightKey(questionCode)];
    if (!ctrl) return;
    ctrl.setValue(value);
    ctrl.markAsDirty();
    this.form.markAsDirty();
    this.touch();
  }

  setScore(questionCode: string, optionCode: string, value: number): void {
    const ctrl = this.form.controls[scoreKey(questionCode, optionCode)];
    if (!ctrl) return;
    ctrl.setValue(value);
    ctrl.markAsDirty();
    this.form.markAsDirty();
    this.touch();
  }

  /** True when this option carries the highest score for its question. */
  isTop(questionCode: string, optionCode: string): boolean {
    return this.bestByQuestion()[questionCode] === optionCode;
  }

  /** An assigned question still needs work: no weight yet, or some answer at 0. */
  questionIncomplete(q: WeightableQuestion): boolean {
    if ((this.weightValues()[q.code] ?? 0) <= 0) return true;
    const scores = this.scoreValues()[q.code] ?? {};
    return q.options.some((o) => (scores[o.code] ?? 0) <= 0);
  }

  /**
   * Build the two-level scoring payload from the ASSIGNED questions only,
   * reading each control by its EXACT key. Unassigned questions are omitted, so
   * the saved `questionWeights` map doubles as the assignment record.
   */
  private scoringNow(): ProgramScoringWeights {
    const questionWeights: Record<string, number> = {};
    const answerScores: Record<string, Record<string, number>> = {};
    const assigned = this.assigned();
    for (const q of this.questions()) {
      if (!assigned.has(q.code)) continue;
      questionWeights[q.code] = Number(this.form.controls[weightKey(q.code)]?.value ?? 0);
      const scores: Record<string, number> = {};
      for (const o of q.options) {
        scores[o.code] = Number(this.form.controls[scoreKey(q.code, o.code)]?.value ?? 0);
      }
      answerScores[q.code] = scores;
    }
    return { questionWeights, answerScores };
  }
}
