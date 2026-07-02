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
 * Scoring weights editor (Constitution V — direct save, v8.0.0).
 * TWO levels, per program: each QUESTION has an importance **weight** (all summing to 100,
 * tracked by the sticky budget strip) and each ANSWER a **score 0–100** —
 * `probability = Σ(questionWeight÷100 × pickedScore÷100)`. Questions render as an
 * accordion (first open). Save is blocked until the weights total exactly 100.
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
        <!-- Governor: question weights must total exactly 100 -->
        <div class="budget-strip" [class.is-bad]="!weightSumOk()">
          <span class="budget-label" i18n="@@scoring.editor.weight_budget">Question weights</span>
          <span class="budget-val"
            >{{ weightSum() | number: '1.0-1' }}<span class="budget-unit"> / 100</span></span
          >
          <div class="budget-bar">
            <span class="budget-fill" [style.inline-size.%]="weightBarPct()"></span>
          </div>
          @if (!weightSumOk()) {
            <span class="budget-hint" aria-live="polite" i18n="@@scoring.editor.weight_sum_bad"
              >All question weights must total exactly 100%.</span
            >
          }
        </div>

        <form class="workbench" [formGroup]="form">
          <!-- Left rail: every question + its live weight; one click to edit -->
          <aside class="qlist" aria-label="Questions" i18n-aria-label="@@scoring.editor.qlist_aria">
            <p class="qlist-head" i18n="@@scoring.editor.qlist_head">Questions</p>
            @for (q of questions(); track q.code) {
              <button
                type="button"
                class="q-row"
                [class.active]="selected() === q.code"
                [attr.aria-current]="selected() === q.code"
                (click)="selected.set(q.code)"
              >
                <span class="q-name">{{ questionLabel(q) }}</span>
                @if (questionIncomplete(q)) {
                  <span
                    class="attn"
                    title="Needs a weight and answer scores above 0"
                    i18n-title="@@scoring.editor.attn"
                  ></span>
                }
                <span class="q-weight">{{ weightOf(q.code) | number: '1.0-0' }}%</span>
              </button>
            }
          </aside>

          <!-- Right canvas: the selected question's weight + answer scores -->
          @if (selectedQuestion(); as q) {
            <section class="canvas">
              <header class="canvas-head">
                <h2 class="qlabel">{{ questionLabel(q) }}</h2>
                <span class="qcode mono">{{ q.code }}</span>
              </header>

              <!-- Level 1: question weight (importance) — slider + live % readout -->
              <div class="qweight-block">
                <div class="qweight-head">
                  <span class="qweight-name" i18n="@@scoring.editor.q_weight"
                    >Question weight (importance)</span
                  >
                  <span class="qweight-readout">{{ weightOf(q.code) | number: '1.0-0'
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
            </section>
          }
        </form>

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
      :host {
        display: block;
        block-size: 100%;
      }
      /* Full-height column: hero + governor + workbench (fills) + save bar.
         The PAGE never scrolls — the rail and canvas scroll inside themselves.
         No own padding: the shell's <main class="content"> already gutters us, and
         a second pad on top of block-size:100% would overflow and re-add a scroll. */
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
        grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
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
      .q-row {
        inline-size: 100%;
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
        border: 0;
        border-inline-start: 3px solid transparent;
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--text-secondary);
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        text-align: start;
        cursor: pointer;
        transition:
          background var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .q-row:hover {
        background: var(--bg-subtle);
        color: var(--text-primary);
      }
      .q-row:focus-visible {
        outline: none;
        box-shadow: var(--focus-halo);
      }
      .q-row.active {
        border-inline-start-color: var(--primary);
        background: color-mix(in srgb, var(--primary) 8%, transparent);
        color: var(--text-primary);
        font-weight: var(--font-semibold);
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

      /* Narrow: stack panes, rail becomes a horizontal chip scroller, page scrolls. */
      @media (max-width: 960px) {
        .page {
          block-size: auto;
        }
        .workbench {
          grid-template-columns: 1fr;
          min-block-size: auto;
        }
        .qlist {
          flex-direction: row;
          flex-wrap: nowrap;
          overflow-x: auto;
          overflow-y: hidden;
        }
        .qlist-head {
          display: none;
        }
        .q-row {
          inline-size: auto;
          flex: 0 0 auto;
          border-inline-start: 0;
          border-block-end: 3px solid transparent;
        }
        .q-row.active {
          border-block-end-color: var(--primary);
        }
        .q-name {
          white-space: nowrap;
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

      /* ── Level 2: answer scores — one tidy row per answer ─────────────── */
      .ascore-head {
        margin-block: 0 var(--space-3);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        letter-spacing: var(--tracking-wide);
        text-transform: uppercase;
        color: var(--text-tertiary);
      }
      /* Grid lives on the container so every row's label/slider/readout share
         the same columns (subgrid) — sliders + readouts align down the panel. */
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
      /* Drop ant's tall default block margin so answer rows stay dense;
         keep a little inline margin so the handle never clips at 0 / 100%. */
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

  readonly category = this.route.snapshot.paramMap.get('category') as LoanCategory;
  readonly programId = this.route.snapshot.paramMap.get('programId') ?? '';

  readonly weightKey = weightKey;
  readonly scoreKey = scoreKey;

  readonly questions = signal<WeightableQuestion[]>([]);
  readonly program = signal<ProgramMeta | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  /** Master–detail: the question being edited (by code); the first opens on load. */
  readonly selected = signal<string | null>(null);
  /** The question object for the selected code — drives the right-hand editor pane. */
  readonly selectedQuestion = computed<WeightableQuestion | null>(
    () => this.questions().find((q) => q.code === this.selected()) ?? null,
  );

  readonly form = new FormGroup<Record<string, FormControl<number>>>({});
  /**
   * Explicit revision counter, bumped by every `setWeight`/`setScore` (the sole
   * mutation points now the sliders use `ngModel`+`ngModelChange`). All derived
   * signals depend on it, so they recompute deterministically on each drag —
   * NOT via `form.valueChanges`, whose signal bridge proved unreliable here.
   */
  private readonly rev = signal(0);
  private touch(): void {
    this.rev.update((n) => n + 1);
  }

  /** Live two-level scoring rebuilt from the form on every change. */
  readonly scoring = computed<ProgramScoringWeights>(() => {
    this.rev();
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

  /** Per-question highest-scoring option — feeds the "Top" marker. */
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

  async ngOnInit(): Promise<void> {
    try {
      const [questions, weights] = await Promise.all([
        this.api.weightableQuestions(this.category),
        this.api.programWeights(this.programId),
      ]);
      this.questions.set(questions);
      this.selected.set(questions[0]?.code ?? null);
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
      // Controls now seeded — recompute the derived signals off the initial values.
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

  /**
   * Live question weight (for the header chip). Reads the SAME control the
   * slider binds to (not the derived split map), so readout ≡ slider always;
   * `formTick()` keeps it reactive to drags.
   */
  weightOf(questionCode: string): number {
    this.rev();
    return this.form.controls[weightKey(questionCode)]?.value ?? 0;
  }

  /**
   * Live answer score (for the read-only readout). Reads the SAME control the
   * slider binds to, so the label can never diverge from the handle.
   */
  scoreOf(questionCode: string, optionCode: string): number {
    this.rev();
    return this.form.controls[scoreKey(questionCode, optionCode)]?.value ?? 0;
  }

  /**
   * Write a dragged question weight back into its control. The slider uses a
   * standalone `ngModel` + this `(ngModelChange)` handler (NOT `formControlName`)
   * so the write is a parent-template event — it reliably schedules change
   * detection so every readout/validation refreshes on each drag.
   */
  setWeight(questionCode: string, value: number): void {
    const ctrl = this.form.controls[weightKey(questionCode)];
    if (!ctrl) return;
    ctrl.setValue(value);
    ctrl.markAsDirty();
    this.form.markAsDirty();
    this.touch();
  }

  /** Write a dragged answer score back into its control (see {@link setWeight}). */
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

  /** A question still needs work: no weight yet, or some answer left at 0 — flags the rail row. */
  questionIncomplete(q: WeightableQuestion): boolean {
    if ((this.weightValues()[q.code] ?? 0) <= 0) return true;
    const scores = this.scoreValues()[q.code] ?? {};
    return q.options.some((o) => (scores[o.code] ?? 0) <= 0);
  }

  /**
   * Build the two-level scoring payload by reading each control by its EXACT
   * key off the known questions/options — never by splitting composite control
   * names. Immune to any code content (incl. non-slug enum-backed option codes)
   * and keeps save/validation reading the identical source as the sliders.
   */
  private scoringNow(): ProgramScoringWeights {
    const questionWeights: Record<string, number> = {};
    const answerScores: Record<string, Record<string, number>> = {};
    for (const q of this.questions()) {
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
