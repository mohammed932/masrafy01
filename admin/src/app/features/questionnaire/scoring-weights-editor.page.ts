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
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSliderModule } from 'ng-zorro-antd/slider';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzMessageService } from 'ng-zorro-antd/message';
import {
  ArrowLeftOutline,
  ArrowRightOutline,
  CheckOutline,
  ExclamationCircleOutline,
  SaveOutline,
  SearchOutline,
  ThunderboltOutline,
} from '@ant-design/icons-angular/icons';
import { PercentFieldComponent } from '@shared/ui';
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

/** Score written into every still-blank answer by the "fill blanks" shortcut. */
const BLANK_FILL_SCORE = 50;

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

/** Wizard steps, in order. `review` owns no inputs — it reads the model back. */
type StepId = 'pick' | 'weights' | 'answers' | 'review';

interface WizardStep {
  readonly id: StepId;
  readonly label: string;
  readonly caption: string;
}

/**
 * Per-program scoring editor (Constitution V — direct save, v8.0.0; Feature 010).
 *
 * FOUR guided steps instead of one dense workbench — each step asks exactly one
 * question of the admin:
 *   1. pick    — which of the GLOBAL pool questions does this program score on?
 *                (the picked set IS the persisted `questionWeights` key set)
 *   2. weights — how is 100% of importance shared across those questions?
 *   3. answers — how favorable is every answer (0–100)?
 *   4. review  — read the model back, then save.
 *
 * A step is only reachable once the ones before it are satisfied, so the save
 * gate (`canSave`) can never be a surprise at the end: the blocker is always
 * stated on the step that owns it.
 * `probability = Σ(questionWeight÷100 × pickedScore÷100)`.
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
    NzIconModule,
    NzInputModule,
    NzSliderModule,
    NzEmptyModule,
    NzSpinModule,
    PercentFieldComponent,
  ],
  providers: [
    provideNzIconsPatch([
      ArrowLeftOutline,
      ArrowRightOutline,
      CheckOutline,
      ExclamationCircleOutline,
      SaveOutline,
      SearchOutline,
      ThunderboltOutline,
    ]),
  ],
  template: `
    <section class="page">
      <header class="page-header">
        <a routerLink="/banks" class="back-link">
          <span nz-icon nzType="arrow-left" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@scoring.editor.back">Banks</span>
        </a>
        <h1 class="page-title" i18n="@@scoring.editor.title">Approval scoring</h1>
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
        <!-- ═══ STEP RAIL ═════════════════════════════════════════════════
             Navigation, not decoration: a step opens once the ones before it
             are satisfied, and every step carries its state as a word, not
             colour alone. -->
        <ol class="steps" [attr.aria-label]="stepsAria">
          @for (s of steps; track s.id; let i = $index, last = $last) {
            <li class="steps-item" [class.is-last]="last">
              <button
                type="button"
                class="step"
                [class.active]="stepIndex() === i"
                [class.done]="stepDone(i) && stepIndex() !== i"
                [attr.aria-current]="stepIndex() === i ? 'step' : null"
                [disabled]="!canJumpTo(i)"
                (click)="goTo(i)"
              >
                <span class="step-num" aria-hidden="true">
                  @if (stepDone(i) && stepIndex() !== i) {
                    <span nz-icon nzType="check" nzTheme="outline"></span>
                  } @else {
                    {{ i + 1 }}
                  }
                </span>
                <span class="step-label">{{ s.label }}</span>
                @if (stepDone(i) && stepIndex() !== i) {
                  <span class="step-state">{{ stepDoneLabel }}</span>
                }
              </button>
              @if (!last) {
                <span class="step-sep" aria-hidden="true"></span>
              }
            </li>
          }
        </ol>
        <p class="step-caption">{{ steps[stepIndex()]?.caption }}</p>

        <form class="stage" [formGroup]="form">
          <!-- ─── Step 1 · pick the scored questions ───────────────────── -->
          @if (stepIndex() === 0) {
            <div class="panel">
              <div class="pick-bar">
                <nz-input-group [nzPrefix]="searchIcon" class="pick-search">
                  <input
                    nz-input
                    type="search"
                    [ngModel]="query()"
                    [ngModelOptions]="{ standalone: true }"
                    (ngModelChange)="query.set($event)"
                    placeholder="Search questions"
                    i18n-placeholder="@@scoring.editor.search_ph"
                    aria-label="Search questions"
                    i18n-aria-label="@@scoring.editor.search_aria"
                  />
                </nz-input-group>
                <ng-template #searchIcon>
                  <span nz-icon nzType="search" nzTheme="outline" aria-hidden="true"></span>
                </ng-template>
                <span class="pick-count" aria-live="polite"
                  >{{ assignedCount() }}<span i18n="@@scoring.editor.of"> of </span
                  >{{ questions().length }}<span i18n="@@scoring.editor.picked_suffix">
                    picked</span
                  ></span
                >
                <button
                  nz-button
                  nzSize="small"
                  type="button"
                  [disabled]="visibleQuestions().length === 0"
                  (click)="pickAllVisible(true)"
                  i18n="@@scoring.editor.select_all"
                >
                  Select all
                </button>
                <button
                  nz-button
                  nzSize="small"
                  type="button"
                  [disabled]="assignedCount() === 0"
                  (click)="pickAllVisible(false)"
                  i18n="@@scoring.editor.clear_all"
                >
                  Clear
                </button>
              </div>

              @if (visibleQuestions().length === 0) {
                <p class="empty-line" i18n="@@scoring.editor.no_match">
                  No question matches that search.
                </p>
              } @else {
                <ul class="pick-list">
                  @for (q of visibleQuestions(); track q.code) {
                    <li>
                      <label
                        class="pick-row"
                        [class.on]="isAssigned(q.code)"
                        nz-checkbox
                        [ngModel]="isAssigned(q.code)"
                        [ngModelOptions]="{ standalone: true }"
                        (ngModelChange)="toggleAssign(q.code, $event)"
                      >
                        <span class="pick-text">
                          <span class="pick-name">{{ questionLabel(q) }}</span>
                          <span class="pick-meta"
                            >{{ q.options.length
                            }}<span i18n="@@scoring.editor.answers_suffix"> answers</span></span
                          >
                        </span>
                      </label>
                    </li>
                  }
                </ul>
              }
            </div>
          }

          <!-- ─── Step 2 · share 100% of importance ────────────────────── -->
          @if (stepIndex() === 1) {
            <div class="budget-strip" [class.is-bad]="!weightSumOk()">
              <span class="budget-label" i18n="@@scoring.editor.weight_budget">Importance</span>
              <span class="budget-val"
                >{{ weightSum() | number: '1.0-1' }}<span class="budget-unit"> / 100</span></span
              >
              <div class="budget-bar">
                <span class="budget-fill" [style.inline-size.%]="weightBarPct()"></span>
              </div>
              @if (!weightSumOk()) {
                <span class="budget-delta" aria-live="polite">{{ remainingLabel() }}</span>
              }
              <button
                nz-button
                nzSize="small"
                type="button"
                class="balance-btn"
                [disabled]="assignedCount() === 0"
                (click)="balance()"
              >
                <span nz-icon nzType="thunderbolt" nzTheme="outline" aria-hidden="true"></span>
                <span i18n="@@scoring.editor.balance">Distribute evenly</span>
              </button>
            </div>

            <div class="panel">
              @if (autoBalanced()) {
                <p class="stage-note" i18n="@@scoring.editor.autobalanced">
                  Weights started out even. Drag any question up and the others keep their values —
                  the total must land on 100.
                </p>
              }
              <ul class="weight-list">
                @for (q of assignedQuestions(); track q.code) {
                  <li class="weight-row">
                    <span class="weight-name">{{ questionLabel(q) }}</span>
                    <nz-slider
                      class="qweight-slider"
                      [ngModel]="weightOf(q.code)"
                      [ngModelOptions]="{ standalone: true }"
                      (ngModelChange)="setWeight(q.code, $event)"
                      [nzMin]="0"
                      [nzMax]="100"
                      [nzStep]="1"
                      [attr.aria-label]="questionLabel(q)"
                    />
                    <app-percent-field
                      [value]="weightOf(q.code)"
                      (valueChange)="setWeight(q.code, $event)"
                      [ariaLabel]="typedAria(questionLabel(q))"
                    />
                  </li>
                }
              </ul>
            </div>
          }

          <!-- ─── Step 3 · score every answer ──────────────────────────── -->
          @if (stepIndex() === 2) {
            <div class="budget-strip">
              <span class="budget-label" i18n="@@scoring.editor.scored_label">Questions scored</span>
              <span class="budget-val"
                >{{ scoredCount() }}<span class="budget-unit"> / {{ assignedCount() }}</span></span
              >
              <div class="budget-bar">
                <span class="budget-fill" [style.inline-size.%]="scoredBarPct()"></span>
              </div>
              @if (blankCount() > 0) {
                <button nz-button nzSize="small" type="button" (click)="fillBlankScores()">
                  <span nz-icon nzType="thunderbolt" nzTheme="outline" aria-hidden="true"></span>
                  <span i18n="@@scoring.editor.fill_blanks">Set blanks to 50</span>
                </button>
              }
            </div>

            <div class="panel">
              <ul class="score-list">
                @for (q of assignedQuestions(); track q.code) {
                  <li class="score-block" [class.pending]="questionIncomplete(q)">
                    <header class="score-head">
                      <h2 class="qlabel">{{ questionLabel(q) }}</h2>
                      <span class="q-weight">{{ weightOf(q.code) | number: '1.0-0' }}%</span>
                    </header>
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
                            [attr.aria-label]="draggedAria(optionLabel(o))"
                          />
                          <app-percent-field
                            [value]="scoreOf(q.code, o.code)"
                            (valueChange)="setScore(q.code, o.code, $event)"
                            [accent]="isTop(q.code, o.code)"
                            [ariaLabel]="typedAria(optionLabel(o))"
                          />
                        </div>
                      }
                    </div>
                  </li>
                }
              </ul>
            </div>
          }

          <!-- ─── Step 4 · review, then save ───────────────────────────── -->
          @if (stepIndex() === 3) {
            <div class="panel">
              <div class="review-head">
                <h2 class="review-title" i18n="@@scoring.editor.review_title">Scoring model</h2>
                <p class="review-sub" i18n="@@scoring.editor.review_sub">
                  An applicant picking every top answer scores 100%. Everything below is what gets
                  saved.
                </p>
              </div>
              <ul class="review-list">
                @for (r of reviewRows(); track r.code) {
                  <li class="review-row">
                    <span class="review-q">
                      <span class="review-q-name">{{ r.label }}</span>
                      <span class="review-q-top"
                        ><span i18n="@@scoring.editor.top_answer">Top answer:</span>
                        {{ r.topLabel }} ({{ r.topScore | number: '1.0-0' }}%)</span
                      >
                    </span>
                    <span class="review-bar" aria-hidden="true">
                      <span class="review-fill" [style.inline-size.%]="r.weight"></span>
                    </span>
                    <span class="review-w">{{ r.weight | number: '1.0-0' }}%</span>
                  </li>
                }
              </ul>
              <div class="review-actions">
                <button nz-button type="button" nzSize="small" (click)="goTo(0)" i18n="@@scoring.editor.edit_pick">
                  Change questions
                </button>
                <button nz-button type="button" nzSize="small" (click)="goTo(1)" i18n="@@scoring.editor.edit_weights">
                  Change weights
                </button>
                <button nz-button type="button" nzSize="small" (click)="goTo(2)" i18n="@@scoring.editor.edit_scores">
                  Change answer scores
                </button>
              </div>
            </div>
          }
        </form>

        <!-- ═══ FOOTER ════════════════════════════════════════════════════
             Sticky: the next action is one glance away at any step height,
             and the blocker for THIS step is spelled out beside it. -->
        <footer class="form-footer">
          @if (blocker(); as msg) {
            <span class="blocker" role="status">
              <span nz-icon nzType="exclamation-circle" nzTheme="outline" aria-hidden="true"></span>
              <span>{{ msg }}</span>
            </span>
          } @else if (form.dirty && !saving()) {
            <span class="dirty" i18n="@@scoring.editor.unsaved">Unsaved changes</span>
          }
          <span class="footer-spacer"></span>
          @if (stepIndex() > 0) {
            <button nz-button type="button" (click)="prev()" [disabled]="saving()">
              <span nz-icon nzType="arrow-left" nzTheme="outline" aria-hidden="true"></span>
              <span i18n="@@scoring.editor.prev">Previous</span>
            </button>
          }
          @if (!isLastStep()) {
            <button
              nz-button
              nzType="primary"
              type="button"
              [disabled]="!!blocker()"
              (click)="next()"
            >
              <span i18n="@@scoring.editor.next">Continue</span>
              <span nz-icon nzType="arrow-right" nzTheme="outline" aria-hidden="true"></span>
            </button>
          } @else {
            <button
              nz-button
              nzType="primary"
              type="button"
              [disabled]="saving() || form.invalid || !canSave()"
              [nzLoading]="saving()"
              (click)="save()"
            >
              @if (!saving()) {
                <span nz-icon nzType="save" nzTheme="outline" aria-hidden="true"></span>
              }
              <span i18n="@@scoring.editor.save">Save scoring</span>
            </button>
          }
        </footer>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .page {
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        max-inline-size: min(1080px, 100%);
        margin-inline: auto;
        padding-block-end: var(--space-4);
      }

      /* ── Header ───────────────────────────────────────────────────────── */
      .page-header {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .back-link {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        inline-size: max-content;
        color: var(--text-secondary);
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        text-decoration: none;
      }
      .back-link:hover {
        color: var(--primary);
      }
      .page-title {
        margin: 0;
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
        margin: var(--space-1) 0 0;
        font-size: var(--text-sm);
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

      /* ── Step rail ────────────────────────────────────────────────────── */
      .steps {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0;
        padding: var(--space-3) var(--space-4);
        list-style: none;
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-sm);
        overflow-x: auto;
      }
      .steps-item {
        display: flex;
        align-items: center;
        flex: 1 1 auto;
        min-inline-size: 0;
      }
      .steps-item.is-last {
        flex: 0 0 auto;
      }
      .step {
        appearance: none;
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        flex: 0 0 auto;
        min-block-size: 44px;
        padding-block: var(--space-1);
        padding-inline: var(--space-2-5);
        background: transparent;
        border: 0;
        border-radius: var(--radius-pill);
        cursor: pointer;
        transition:
          background var(--motion-duration-fast) var(--motion-easing-standard),
          opacity var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .step:hover:not(:disabled) {
        background: var(--bg-subtle);
      }
      .step:disabled {
        cursor: not-allowed;
        opacity: 0.45;
      }
      .step:focus-visible {
        outline: none;
        box-shadow: var(--focus-halo);
      }
      .step-num {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: none;
        inline-size: 24px;
        block-size: 24px;
        border-radius: var(--radius-pill);
        background: var(--bg-muted);
        color: var(--text-tertiary);
        font-size: var(--text-xs);
        font-weight: var(--font-bold);
        line-height: 1;
      }
      .step.active .step-num {
        background: var(--primary);
        color: var(--text-on-primary);
      }
      .step.done .step-num {
        background: var(--success);
        color: var(--text-on-primary);
      }
      .step-label {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--text-secondary);
        white-space: nowrap;
      }
      .step.active .step-label {
        color: var(--text-primary);
      }
      .step-state {
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        color: var(--success);
      }
      .step-sep {
        flex: 1 1 auto;
        min-inline-size: var(--space-4);
        block-size: 1px;
        background: var(--border-default);
      }
      .step-caption {
        margin: 0;
        padding-inline: var(--space-1);
        max-inline-size: 72ch;
        font-size: var(--text-sm);
        line-height: var(--leading-normal);
        color: var(--text-secondary);
      }

      /* ── Stage + panels ───────────────────────────────────────────────── */
      .stage {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .panel {
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-sm);
        padding: var(--space-5);
      }
      .panel.center {
        display: flex;
        justify-content: center;
        padding-block: var(--space-7);
      }
      .panel.center-col {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-4);
        padding-block: var(--space-7);
      }
      .stage-note {
        margin: 0 0 var(--space-4);
        padding: var(--space-3) var(--space-4);
        background: var(--bg-subtle);
        border-inline-start: 3px solid var(--primary);
        border-radius: var(--radius-md);
        font-size: var(--text-sm);
        line-height: var(--leading-normal);
        color: var(--text-secondary);
      }
      .empty-line {
        margin: 0;
        padding-block: var(--space-5);
        text-align: center;
        font-size: var(--text-sm);
        color: var(--text-tertiary);
      }

      /* ── Step 1 · pick ────────────────────────────────────────────────── */
      .pick-bar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-2) var(--space-3);
        margin-block-end: var(--space-4);
      }
      .pick-search {
        flex: 1 1 240px;
        max-inline-size: 380px;
      }
      .pick-count {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--text-secondary);
        white-space: nowrap;
        font-feature-settings:
          'tnum' 1,
          'lnum' 1;
      }
      .pick-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: var(--space-2);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      /* One tap target per question — the whole row toggles, not just the box. */
      .pick-row {
        display: flex;
        align-items: flex-start;
        inline-size: 100%;
        min-block-size: 44px;
        padding: var(--space-3);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .pick-row:hover {
        background: var(--bg-subtle);
      }
      .pick-row.on {
        border-color: var(--primary);
        background: color-mix(in srgb, var(--primary) 6%, transparent);
      }
      .pick-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-inline-size: 0;
      }
      .pick-name {
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        line-height: var(--leading-normal);
        color: var(--text-primary);
        overflow-wrap: anywhere;
        white-space: normal;
      }
      .pick-meta {
        font-size: var(--text-xs);
        color: var(--text-tertiary);
        overflow-wrap: anywhere;
        white-space: normal;
      }
      /* ── Progress strip (steps 2 + 3) ─────────────────────────────────── */
      .budget-strip {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-2) var(--space-4);
        padding: var(--space-3) var(--space-5);
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
      .budget-delta {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--error);
        white-space: nowrap;
      }

      /* ── Step 2 · weights ─────────────────────────────────────────────── */
      .weight-list {
        display: grid;
        grid-template-columns: minmax(14ch, 24ch) minmax(0, 1fr) auto;
        align-items: center;
        column-gap: var(--space-4);
        row-gap: 0;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .weight-row {
        display: grid;
        grid-template-columns: subgrid;
        grid-column: 1 / -1;
        align-items: center;
        min-block-size: 44px;
        padding-block: var(--space-2);
        border-block-end: 1px solid var(--border-default);
      }
      .weight-row:last-child {
        border-block-end: 0;
      }
      .weight-name {
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        line-height: var(--leading-normal);
        color: var(--text-primary);
        overflow-wrap: anywhere;
      }

      /* ── Step 3 · answer scores ───────────────────────────────────────── */
      .score-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .score-block {
        padding-block-end: var(--space-5);
        border-block-end: 1px solid var(--border-default);
      }
      .score-block:last-child {
        padding-block-end: 0;
        border-block-end: 0;
      }
      .score-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--space-4);
        margin-block-end: var(--space-3);
      }
      .qlabel {
        margin: 0;
        font-size: var(--text-base);
        font-weight: var(--font-semibold);
        color: var(--text-primary);
      }
      .q-weight {
        flex: none;
        font-size: var(--text-sm);
        font-weight: var(--font-bold);
        color: var(--primary);
        font-feature-settings:
          'tnum' 1,
          'lnum' 1;
      }
      /* Amber marker = this question still blocks Continue (an answer at 0). */
      .score-block.pending .qlabel::before {
        content: '';
        display: inline-block;
        inline-size: 7px;
        block-size: 7px;
        margin-inline-end: var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--warning);
        vertical-align: middle;
      }
      .answers {
        display: grid;
        grid-template-columns: minmax(12ch, 18ch) minmax(0, 1fr) auto;
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
      /* Keeps the typed value on the same optical line as the slider it mirrors. */
      .answer-row app-percent-field,
      .weight-row app-percent-field {
        justify-self: end;
      }

      /* Slider skins (shared by both levels) */
      .pts-slider,
      .qweight-slider {
        margin: 0;
      }
      .pts-slider ::ng-deep .ant-slider,
      .qweight-slider ::ng-deep .ant-slider {
        margin-block: 0;
        margin-inline: var(--space-2);
      }
      .pts-slider ::ng-deep .ant-slider-rail,
      .qweight-slider ::ng-deep .ant-slider-rail {
        block-size: 6px;
        border-radius: var(--radius-pill);
        background: var(--bg-muted);
      }
      .pts-slider ::ng-deep .ant-slider-track,
      .qweight-slider ::ng-deep .ant-slider-track {
        block-size: 6px;
        border-radius: var(--radius-pill);
        background: var(--primary);
      }
      .pts-slider ::ng-deep .ant-slider:hover .ant-slider-track,
      .qweight-slider ::ng-deep .ant-slider:hover .ant-slider-track {
        background: var(--primary-hover);
      }
      .pts-slider ::ng-deep .ant-slider-handle,
      .qweight-slider ::ng-deep .ant-slider-handle {
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
      .pts-slider ::ng-deep .ant-slider-handle:focus,
      .qweight-slider ::ng-deep .ant-slider-handle:hover,
      .qweight-slider ::ng-deep .ant-slider-handle:focus {
        transform: scale(1.14);
        box-shadow: var(--focus-halo);
      }

      /* ── Step 4 · review ──────────────────────────────────────────────── */
      .review-head {
        margin-block-end: var(--space-4);
      }
      .review-title {
        margin: 0;
        font-size: var(--text-lg);
        font-weight: var(--font-semibold);
        color: var(--text-primary);
      }
      .review-sub {
        margin: var(--space-1) 0 0;
        max-inline-size: 68ch;
        font-size: var(--text-sm);
        line-height: var(--leading-normal);
        color: var(--text-secondary);
      }
      .review-list {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(80px, 200px) auto;
        align-items: center;
        column-gap: var(--space-4);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .review-row {
        display: grid;
        grid-template-columns: subgrid;
        grid-column: 1 / -1;
        align-items: center;
        padding-block: var(--space-3);
        border-block-end: 1px solid var(--border-default);
      }
      .review-row:last-child {
        border-block-end: 0;
      }
      .review-q {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-inline-size: 0;
      }
      .review-q-name {
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        color: var(--text-primary);
        overflow-wrap: anywhere;
      }
      .review-q-top {
        font-size: var(--text-xs);
        color: var(--text-tertiary);
        overflow-wrap: anywhere;
      }
      .review-bar {
        block-size: 6px;
        border-radius: var(--radius-pill);
        background: var(--bg-muted);
        overflow: hidden;
      }
      .review-fill {
        display: block;
        block-size: 100%;
        background: var(--primary);
        border-radius: var(--radius-pill);
      }
      .review-w {
        font-size: var(--text-base);
        font-weight: var(--font-bold);
        color: var(--text-primary);
        font-feature-settings:
          'tnum' 1,
          'lnum' 1;
      }
      .review-actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
        margin-block-start: var(--space-5);
        padding-block-start: var(--space-4);
        border-block-start: 1px solid var(--border-default);
      }

      /* ── Footer ───────────────────────────────────────────────────────── */
      .form-footer {
        position: sticky;
        inset-block-end: 0;
        z-index: 2;
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-md);
      }
      .footer-spacer {
        flex: 1 1 auto;
      }
      .dirty {
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        color: var(--warning);
      }
      .blocker {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        line-height: var(--leading-normal);
        color: var(--error);
      }

      /* ── Narrow ───────────────────────────────────────────────────────── */
      @media (max-width: 720px) {
        .weight-list {
          grid-template-columns: minmax(0, 1fr) auto;
        }
        .weight-row {
          grid-template-columns: 1fr;
          row-gap: var(--space-2);
        }
        .answers {
          grid-template-columns: minmax(0, 1fr);
        }
        .answer-row {
          grid-template-columns: 1fr auto;
          column-gap: var(--space-3);
        }
        .answer-row .answer-label {
          grid-column: 1 / -1;
        }
        .review-list {
          grid-template-columns: minmax(0, 1fr) auto;
        }
        .review-row .review-bar {
          display: none;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .step,
        .pick-row,
        .budget-strip,
        .budget-fill,
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

  readonly questions = signal<WeightableQuestion[]>([]);
  readonly program = signal<ProgramMeta | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  /** Step-1 search box. */
  readonly query = signal('');
  /** Which wizard step is on stage. */
  readonly stepIndex = signal(0);
  /** True once entering step 2 auto-spread an all-zero budget — explains itself. */
  readonly autoBalanced = signal(false);
  /**
   * The set of PICKED question codes — the checkbox state. This IS the
   * program's `questionWeights` domain: picked → scored, unpicked → excluded.
   * Stored as an immutable Set (replaced on every toggle) so signal reads react.
   */
  readonly assigned = signal<ReadonlySet<string>>(new Set());

  readonly steps: readonly WizardStep[] = [
    {
      id: 'pick',
      label: $localize`:@@scoring.editor.step_pick:Pick questions`,
      caption: $localize`:@@scoring.editor.cap_pick:Pick the questions this program scores on. Everything else in the pool is still asked of the applicant — it just doesn't move this program's approval odds.`,
    },
    {
      id: 'weights',
      label: $localize`:@@scoring.editor.step_weights:Set importance`,
      caption: $localize`:@@scoring.editor.cap_weights:Share 100% of importance across the picked questions. A question at 30% can move the approval odds by up to 30 points.`,
    },
    {
      id: 'answers',
      label: $localize`:@@scoring.editor.step_answers:Score answers`,
      caption: $localize`:@@scoring.editor.cap_answers:Score every answer from 0 to 100 — how favorable it is for approval. The highest answer of each question is marked Top.`,
    },
    {
      id: 'review',
      label: $localize`:@@scoring.editor.step_review:Review & save`,
      caption: $localize`:@@scoring.editor.cap_review:Read the model back, then save. Saving archives the previous version in one atomic write.`,
    },
  ];
  readonly stepsAria = $localize`:@@scoring.editor.steps_aria:Scoring setup steps`;
  readonly stepDoneLabel = $localize`:@@scoring.editor.step_done:Done`;

  readonly form = new FormGroup<Record<string, FormControl<number>>>({});
  /**
   * Explicit revision counter, bumped by every weight/score/pick mutation. All
   * derived signals depend on it, so they recompute deterministically on each
   * drag — NOT via `form.valueChanges`, whose signal bridge proved unreliable.
   */
  private readonly rev = signal(0);
  private touch(): void {
    this.rev.update((n) => n + 1);
  }

  /** Live two-level scoring rebuilt from the form (picked questions only). */
  readonly scoring = computed<ProgramScoringWeights>(() => {
    this.rev();
    return this.scoringNow();
  });

  readonly weightValues = computed<Record<string, number>>(() => this.scoring().questionWeights);
  readonly scoreValues = computed<Record<string, Record<string, number>>>(
    () => this.scoring().answerScores,
  );

  /** Step-1 list, filtered by the search box (label or code). */
  readonly visibleQuestions = computed<WeightableQuestion[]>(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.questions();
    if (!q) return all;
    return all.filter(
      (x) =>
        this.questionLabel(x).toLowerCase().includes(q) || x.code.toLowerCase().includes(q),
    );
  });

  /** How many questions this program scores on. */
  readonly assignedCount = computed<number>(() => {
    this.rev();
    return this.assigned().size;
  });
  /** Sum of PICKED question weights (1-decimal). Must equal 100 to save. */
  readonly weightSum = computed<number>(() => {
    const total = Object.values(this.weightValues()).reduce((a, b) => a + b, 0);
    return Math.round(total * 10) / 10;
  });
  readonly weightSumOk = computed<boolean>(() => this.weightSum() === 100);
  readonly weightBarPct = computed<number>(() => Math.min(100, Math.max(0, this.weightSum())));

  /** Picked questions, in pool order. */
  readonly assignedQuestions = computed<WeightableQuestion[]>(() => {
    const a = this.assigned();
    return this.questions().filter((q) => a.has(q.code));
  });
  /** No picked question may be left at 0% weight. */
  readonly allWeightsPositive = computed<boolean>(() =>
    this.assignedQuestions().every((q) => (this.weightValues()[q.code] ?? 0) > 0),
  );
  /** No answer of a picked question may be left at 0 score. */
  readonly allScoresPositive = computed<boolean>(() =>
    this.assignedQuestions().every((q) =>
      q.options.every((o) => (this.scoreValues()[q.code]?.[o.code] ?? 0) > 0),
    ),
  );
  /** Picked questions whose answers are all scored — step-3 progress. */
  readonly scoredCount = computed<number>(
    () => this.assignedQuestions().filter((q) => !this.questionIncomplete(q)).length,
  );
  readonly scoredBarPct = computed<number>(() => {
    const total = this.assignedCount();
    return total === 0 ? 0 : (this.scoredCount() / total) * 100;
  });
  /** Answers still sitting at 0 across the picked questions. */
  readonly blankCount = computed<number>(() => {
    const scores = this.scoreValues();
    let n = 0;
    for (const q of this.assignedQuestions()) {
      for (const o of q.options) if ((scores[q.code]?.[o.code] ?? 0) <= 0) n += 1;
    }
    return n;
  });
  /** Save is allowed only when ≥1 picked, weights total 100, nothing at zero. */
  readonly canSave = computed<boolean>(
    () =>
      this.assignedCount() > 0 &&
      this.weightSumOk() &&
      this.allWeightsPositive() &&
      this.allScoresPositive(),
  );

  /** Per-question highest-scoring option — feeds the "Top" marker + review. */
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

  /** Flattened model for the review step. */
  readonly reviewRows = computed<
    { code: string; label: string; weight: number; topLabel: string; topScore: number }[]
  >(() => {
    const scores = this.scoreValues();
    const best = this.bestByQuestion();
    return this.assignedQuestions().map((q) => {
      const topCode = best[q.code] ?? '';
      const top = q.options.find((o) => o.code === topCode);
      return {
        code: q.code,
        label: this.questionLabel(q),
        weight: this.weightValues()[q.code] ?? 0,
        topLabel: top ? this.optionLabel(top) : '—',
        topScore: scores[q.code]?.[topCode] ?? 0,
      };
    });
  });

  readonly isLastStep = computed<boolean>(() => this.stepIndex() === this.steps.length - 1);

  /**
   * The one thing stopping the CURRENT step from being left (or saved). Null
   * means Continue / Save is live — the button is never dead without a reason
   * printed next to it.
   */
  readonly blocker = computed<string | null>(() => {
    switch (this.stepIndex()) {
      case 0:
        return this.assignedCount() === 0
          ? $localize`:@@scoring.editor.fix_none_assigned:Pick at least one question to score this program.`
          : null;
      case 1:
        if (!this.weightSumOk())
          return $localize`:@@scoring.editor.fix_weights:Question weights must total exactly 100%.`;
        return this.allWeightsPositive()
          ? null
          : $localize`:@@scoring.editor.fix_zero_weight:Every picked question needs a weight above 0%.`;
      case 2:
        return this.allScoresPositive()
          ? null
          : $localize`:@@scoring.editor.fix_zero_score:Every answer needs a score above 0.`;
      default:
        return this.canSave()
          ? null
          : $localize`:@@scoring.editor.fix_generic:Some steps are still incomplete.`;
    }
  });

  /** Remaining / over-budget readout for the weight strip. */
  readonly remainingLabel = computed<string>(() => {
    const left = Math.round((100 - this.weightSum()) * 10) / 10;
    return left > 0
      ? $localize`:@@scoring.editor.left_to_assign:${left}:LEFT: left to assign`
      : $localize`:@@scoring.editor.over_budget:${-left}:OVER: over budget`;
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
      // Pick set = the keys already in the saved weight set. A program with no
      // saved set starts with nothing picked — the admin ticks what matters.
      const assignedCodes = Object.keys(seedWeights).filter((c) =>
        questions.some((q) => q.code === c),
      );
      this.assigned.set(new Set(assignedCodes));

      for (const q of questions) {
        const w = clampPct(Number(seedWeights[q.code] ?? 0));
        this.form.addControl(weightKey(q.code), this.numberControl(w));
        for (const o of q.options) {
          const s = clampPct(Number(seedScores[q.code]?.[o.code] ?? 0));
          this.form.addControl(scoreKey(q.code, o.code), this.numberControl(s));
        }
      }
      this.touch();
      // An already-configured program opens on Review — the admin came to read
      // or tweak, not to redo the picking they did last time.
      if (this.canSave()) this.stepIndex.set(this.steps.length - 1);
    } finally {
      this.loading.set(false);
    }
  }

  // ── Wizard navigation ─────────────────────────────────────────────────
  /** A step is done when its own gate is satisfied. */
  stepDone(i: number): boolean {
    switch (i) {
      case 0:
        return this.assignedCount() > 0;
      case 1:
        return this.assignedCount() > 0 && this.weightSumOk() && this.allWeightsPositive();
      case 2:
        return this.assignedCount() > 0 && this.allScoresPositive();
      default:
        return this.canSave();
    }
  }

  /** Reachable once every earlier step is done — no dead ends, no surprises. */
  canJumpTo(i: number): boolean {
    for (let s = 0; s < i; s += 1) if (!this.stepDone(s)) return false;
    return true;
  }

  goTo(i: number): void {
    if (i < 0 || i >= this.steps.length || !this.canJumpTo(i)) return;
    this.enter(i);
  }

  next(): void {
    if (this.blocker()) return;
    this.enter(Math.min(this.stepIndex() + 1, this.steps.length - 1));
  }

  prev(): void {
    this.enter(Math.max(this.stepIndex() - 1, 0));
  }

  /**
   * Land on a step. Entering the weights step with an untouched (all-zero)
   * budget pre-spreads it evenly — a hand-typed even split is busywork, and the
   * note above the list says it happened.
   */
  private enter(i: number): void {
    if (i === 1 && this.assignedCount() > 0 && this.weightSum() === 0) {
      this.balance();
      this.autoBalanced.set(true);
    }
    this.stepIndex.set(i);
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

  // Slider and typed field edit the SAME number, so each says which one it is —
  // otherwise a screen reader announces the label twice with no way to tell them apart.

  /** Accessible name for the drag control of `label`. */
  draggedAria(label: string): string {
    return $localize`:@@scoring.editor.aria.slider:${label}:name: — slider`;
  }

  /** Accessible name for the typed percent field of `label`. */
  typedAria(label: string): string {
    return $localize`:@@scoring.editor.aria.field:${label}:name: — percent, type or use arrow keys`;
  }

  isAssigned(code: string): boolean {
    this.rev();
    return this.assigned().has(code);
  }

  /**
   * Tick / untick a question for this program. Ticking adds it to the scoring
   * (weight starts at 0 for a fresh pick — step 2 spreads the budget);
   * unticking removes it from the budget entirely.
   */
  toggleAssign(code: string, checked: boolean): void {
    this.assigned.update((s) => {
      const next = new Set(s);
      if (checked) next.add(code);
      else next.delete(code);
      return next;
    });
    this.form.markAsDirty();
    this.touch();
  }

  /** Tick (or untick) everything currently listed under the search filter. */
  pickAllVisible(checked: boolean): void {
    const codes = this.visibleQuestions().map((q) => q.code);
    this.assigned.update((s) => {
      const next = new Set(s);
      for (const c of codes) {
        if (checked) next.add(c);
        else next.delete(c);
      }
      return next;
    });
    this.form.markAsDirty();
    this.touch();
  }

  /** Spread 100% evenly across the picked questions (leaves answer scores untouched). */
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

  /** Give every still-blank answer a neutral score, so only the deltas need work. */
  fillBlankScores(): void {
    for (const q of this.assignedQuestions()) {
      for (const o of q.options) {
        const ctrl = this.form.controls[scoreKey(q.code, o.code)];
        if (ctrl && ctrl.value <= 0) ctrl.setValue(BLANK_FILL_SCORE);
      }
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

  /** `null` arrives when the number input is cleared — treat it as 0. */
  setWeight(questionCode: string, value: number | null): void {
    const ctrl = this.form.controls[weightKey(questionCode)];
    if (!ctrl) return;
    ctrl.setValue(clampPct(Number(value ?? 0)));
    ctrl.markAsDirty();
    this.form.markAsDirty();
    this.autoBalanced.set(false);
    this.touch();
  }

  setScore(questionCode: string, optionCode: string, value: number | null): void {
    const ctrl = this.form.controls[scoreKey(questionCode, optionCode)];
    if (!ctrl) return;
    ctrl.setValue(clampPct(Number(value ?? 0)));
    ctrl.markAsDirty();
    this.form.markAsDirty();
    this.touch();
  }

  /** True when this option carries the highest score for its question. */
  isTop(questionCode: string, optionCode: string): boolean {
    return this.bestByQuestion()[questionCode] === optionCode;
  }

  /** A picked question still needs work: no weight yet, or some answer at 0. */
  questionIncomplete(q: WeightableQuestion): boolean {
    const scores = this.scoreValues()[q.code] ?? {};
    return q.options.some((o) => (scores[o.code] ?? 0) <= 0);
  }

  /**
   * Build the two-level scoring payload from the PICKED questions only,
   * reading each control by its EXACT key. Unpicked questions are omitted, so
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
