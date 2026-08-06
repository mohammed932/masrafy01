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
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSliderModule } from 'ng-zorro-antd/slider';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzMessageService } from 'ng-zorro-antd/message';
import {
  ArrowLeftOutline,
  ArrowRightOutline,
  CheckOutline,
  ExclamationCircleOutline,
  RightOutline,
  SaveOutline,
  SearchOutline,
  ThunderboltOutline,
} from '@ant-design/icons-angular/icons';
import {
  PercentFieldComponent,
  ScoreBandsEditorComponent,
  scoreBandsErrorFor,
  seedScoreBands,
} from '@shared/ui';
import { categoryLabel, isLoanCategory } from '@core/loan-category';
import {
  MULTI_SELECT_AGGREGATIONS,
  QuestionnaireApiService,
  type MultiSelectAggregation,
  type NumericScoreBand,
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

/**
 * A TEXT question has no options, so its presence score rides the SAME control
 * machinery under a reserved pseudo-option code. It is never sent as an option
 * score: `scoringNow` iterates the question's real options, which for TEXT is
 * empty, and emits `textRules` instead.
 */
const TEXT_PRESENCE = '__answered__';
const textScoreKey = (q: string): string => scoreKey(q, TEXT_PRESENCE);

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
    NzSelectModule,
    NzSpinModule,
    PercentFieldComponent,
    ScoreBandsEditorComponent,
  ],
  providers: [
    provideNzIconsPatch([
      ArrowLeftOutline,
      ArrowRightOutline,
      CheckOutline,
      ExclamationCircleOutline,
      RightOutline,
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
                  >{{ questions().length
                  }}<span i18n="@@scoring.editor.picked_suffix"> picked</span></span
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

              @if (unaskedPicked().length > 0) {
                <div class="unasked-note" role="status">
                  <span nz-icon nzType="warning" nzTheme="outline" aria-hidden="true"></span>
                  <p class="un-body">
                    <span class="un-lead" i18n="@@scoring.editor.unasked_lead"
                      >These picked questions are never shown to
                      {{ programCategoryLabel() }} applicants.</span
                    >
                    <span class="un-hint" i18n="@@scoring.editor.unasked_hint"
                      >They can never score, so any weight you give them is wasted. Untick them, or
                      add {{ programCategoryLabel() }} to them under Questionnaire → Loan
                      categories.</span
                    >
                  </p>
                  <ul class="un-list">
                    @for (q of unaskedPicked(); track q.code) {
                      <li>{{ questionLabel(q) }}</li>
                    }
                  </ul>
                </div>
              }

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
                          <span class="pick-name">
                            {{ questionLabel(q) }}
                            @if (!isAskedHere(q)) {
                              <span class="unasked-tag" i18n="@@scoring.editor.unasked_tag"
                                >not asked</span
                              >
                            }
                          </span>
                          <!-- What the admin will be asked to score, so the type is
                               known before picking, not after. -->
                          <span class="pick-meta">{{ scoredByLabel(q) }}</span>
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
              <span class="budget-label" i18n="@@scoring.editor.scored_label"
                >Questions scored</span
              >
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
              <!-- One question open at a time: a 7-answer slider stack per question
                   buries the rest of the list, and the collapsed line already says
                   whether a question needs opening. -->
              <ul class="score-list">
                @for (q of assignedQuestions(); track q.code) {
                  <li
                    class="score-block"
                    [class.pending]="questionIncomplete(q)"
                    [class.is-open]="isScoreOpen(q.code)"
                  >
                    <h2 class="score-head">
                      <button
                        type="button"
                        class="score-trigger"
                        [id]="scoreHeadId(q.code)"
                        [attr.aria-expanded]="isScoreOpen(q.code)"
                        [attr.aria-controls]="scorePanelId(q.code)"
                        (click)="toggleScoreOpen(q.code)"
                      >
                        <span
                          class="score-chev"
                          nz-icon
                          nzType="right"
                          nzTheme="outline"
                          aria-hidden="true"
                        ></span>
                        <span class="qlabel">{{ questionLabel(q) }}</span>
                        <span class="q-type">{{ typeLabel(q) }}</span>
                        <span class="q-weight">{{ weightOf(q.code) | number: '1.0-0' }}%</span>
                        <!-- The collapsed readout: what is set, or what is missing. -->
                        <span class="score-sum">{{ scoreSummary(q) }}</span>
                      </button>
                    </h2>

                    <!-- One question, one way of scoring it. The control follows the
                         question's TYPE: options for a choice, ranges for a number,
                         a single presence score for free text. -->
                    @if (isScoreOpen(q.code)) {
                      <div
                        class="score-panel"
                        role="region"
                        [id]="scorePanelId(q.code)"
                        [attr.aria-labelledby]="scoreHeadId(q.code)"
                      >
                        @switch (q.type) {
                          @case ('NUMERIC') {
                            <p class="type-hint" i18n="@@scoring.editor.hint_numeric">
                              Score this number by range. Each band starts where the one before it
                              ends, so every answer lands in exactly one.
                            </p>
                            <app-score-bands-editor
                              [bands]="bandsOf(q.code)"
                              (bandsChange)="setBands(q.code, $event)"
                              [unit]="numericUnit(q)"
                              [minValue]="q.numericMinValue"
                              [maxValue]="q.numericMaxValue"
                            />
                          }
                          @case ('TEXT') {
                            <p class="type-hint" i18n="@@scoring.editor.hint_text">
                              Free text is scored on being answered, not on what it says — a keyword
                              rule would be guesswork nobody can audit. Leaving it blank earns
                              nothing.
                            </p>
                            <div class="answer-row">
                              <span class="answer-label" i18n="@@scoring.editor.text_answered"
                                >Answered</span
                              >
                              <nz-slider
                                class="pts-slider"
                                [ngModel]="textScoreOf(q.code)"
                                [ngModelOptions]="{ standalone: true }"
                                (ngModelChange)="setTextScore(q.code, $event)"
                                [nzMin]="0"
                                [nzMax]="100"
                                [nzStep]="1"
                                [attr.aria-label]="draggedAria(questionLabel(q))"
                              />
                              <app-percent-field
                                [value]="textScoreOf(q.code)"
                                (valueChange)="setTextScore(q.code, $event)"
                                [ariaLabel]="typedAria(questionLabel(q))"
                              />
                            </div>
                          }
                          @default {
                            @if (q.type === 'MULTI_SELECT') {
                              <div class="agg-row">
                                <!-- Visible text + aria-label rather than a label/for
                                     pair: nz-select renders no native control to point
                                     at, so a for attribute would name nothing. -->
                                <span class="agg-label" i18n="@@scoring.editor.agg_label"
                                  >Several picks count as</span
                                >
                                <nz-select
                                  class="agg-select"
                                  [ngModel]="aggregationOf(q.code)"
                                  [ngModelOptions]="{ standalone: true }"
                                  (ngModelChange)="setAggregation(q.code, $event)"
                                  [attr.aria-label]="aggregationAria(questionLabel(q))"
                                >
                                  @for (mode of aggregations; track mode) {
                                    <nz-option
                                      [nzValue]="mode"
                                      [nzLabel]="aggregationLabel(mode)"
                                    />
                                  }
                                </nz-select>
                                <p class="agg-hint">{{ aggregationHint(q.code) }}</p>
                              </div>
                            }
                            <div class="answers">
                              @for (o of q.options; track o.code) {
                                <div class="answer-row">
                                  <span class="answer-label"
                                    >{{ optionLabel(o) }}
                                    @if (isTop(q.code, o.code)) {
                                      <span class="top-pill" i18n="@@scoring.editor.top"
                                        >★ Top</span
                                      >
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
                          }
                        }
                      </div>
                    }
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
                      @if (r.ruleNote) {
                        <span class="review-q-rule">{{ r.ruleNote }}</span>
                      }
                    </span>
                    <span class="review-bar" aria-hidden="true">
                      <span class="review-fill" [style.inline-size.%]="r.weight"></span>
                    </span>
                    <span class="review-w">{{ r.weight | number: '1.0-0' }}%</span>
                  </li>
                }
              </ul>
              <div class="review-actions">
                <button
                  nz-button
                  type="button"
                  nzSize="small"
                  (click)="goTo(0)"
                  i18n="@@scoring.editor.edit_pick"
                >
                  Change questions
                </button>
                <button
                  nz-button
                  type="button"
                  nzSize="small"
                  (click)="goTo(1)"
                  i18n="@@scoring.editor.edit_weights"
                >
                  Change weights
                </button>
                <button
                  nz-button
                  type="button"
                  nzSize="small"
                  (click)="goTo(2)"
                  i18n="@@scoring.editor.edit_scores"
                >
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
        /* The sticky footer can never travel past this box's bottom edge, so
           the page ends flush with the scrollport — the negative margin
           absorbs the shell content area's own trailing padding. Any trailing
           space here would let the action bar lift off the bottom edge as the
           scroll reaches its end. */
        padding-block-end: 0;
        margin-block-end: calc(-1 * var(--space-6));
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

      /* ── "Not asked here" warning ─────────────────────────────────────────
         Two surfaces for one problem: an inline tag marking each offending row
         in the list, and this summary the admin cannot scroll past. Tinted from
         --warning via color-mix so both themes derive their own surface rather
         than sharing one hardcoded light fill — the mistake that stranded
         question-categories in light mode (see its :host comment). */
      .unasked-note {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: var(--space-1) var(--space-3);
        margin-block-end: var(--space-4);
        padding: var(--space-3) var(--space-4);
        background: color-mix(in srgb, var(--warning) 10%, var(--bg-surface));
        border: 1px solid color-mix(in srgb, var(--warning) 32%, transparent);
        border-radius: var(--radius-md);
      }
      .unasked-note > [nz-icon] {
        margin-block-start: 2px;
        font-size: var(--text-base);
        color: var(--warning);
      }
      .un-body {
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: var(--text-sm);
        line-height: var(--leading-normal);
      }
      .un-lead {
        font-weight: var(--font-medium);
        color: var(--text-primary);
      }
      .un-hint {
        color: var(--text-secondary);
      }
      .un-list {
        grid-column: 2;
        margin: 0;
        padding-inline-start: var(--space-4);
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: var(--text-sm);
        line-height: var(--leading-normal);
        color: var(--text-secondary);
      }
      /* Sits inside a <label>, so it must not swallow the click that toggles
         the checkbox — no pointer cursor, no hit-target of its own. */
      .unasked-tag {
        margin-inline-start: var(--space-2);
        padding: 1px var(--space-2);
        border-radius: var(--radius-pill, 999px);
        background: color-mix(in srgb, var(--warning) 14%, transparent);
        color: var(--warning);
        font-size: var(--text-xs);
        font-weight: var(--font-medium);
        white-space: nowrap;
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

      /* ── Step 3 · answer scores (accordion) ───────────────────────────── */
      /* Rows separated by rules, not by cards: the panel is already a card, and a
         card per question would nest one inside another for no added meaning. */
      .score-list {
        display: flex;
        flex-direction: column;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .score-block {
        border-block-end: 1px solid var(--border-default);
      }
      .score-block:last-child {
        border-block-end: 0;
      }
      .score-head {
        margin: 0;
        font: inherit;
      }
      /* Two rows: identity + weight on top, the state readout under it. The whole
         header is the hit target, so scanning and opening are the same gesture. */
      .score-trigger {
        appearance: none;
        inline-size: 100%;
        display: grid;
        grid-template-columns: var(--space-5) minmax(0, 1fr) auto auto;
        grid-template-areas:
          'chev name type weight'
          'chev sum sum sum';
        align-items: center;
        column-gap: var(--space-3);
        row-gap: var(--space-0-5);
        min-block-size: 44px;
        padding-block: var(--space-3);
        padding-inline: 0;
        background: transparent;
        border: 0;
        text-align: start;
        cursor: pointer;
        transition: background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .score-trigger:hover {
        background: var(--bg-subtle);
      }
      .score-trigger:focus-visible {
        outline: none;
        box-shadow: var(--focus-halo);
        border-radius: var(--radius-sm);
      }
      .score-chev {
        grid-area: chev;
        justify-self: center;
        color: var(--text-tertiary);
        font-size: var(--text-xs);
        transition: transform var(--motion-duration-fast) var(--motion-easing-standard);
      }
      /* Logical rotation: in RTL the collapsed chevron points the other way. */
      :host-context([dir='rtl']) .score-chev {
        transform: rotate(180deg);
      }
      .score-block.is-open .score-chev,
      :host-context([dir='rtl']) .score-block.is-open .score-chev {
        transform: rotate(90deg);
        color: var(--primary);
      }
      .qlabel {
        grid-area: name;
        margin: 0;
        font-size: var(--text-base);
        font-weight: var(--font-semibold);
        line-height: var(--leading-normal);
        color: var(--text-primary);
        overflow-wrap: anywhere;
      }
      .q-weight {
        grid-area: weight;
        font-size: var(--text-sm);
        font-weight: var(--font-bold);
        color: var(--primary);
        white-space: nowrap;
        font-feature-settings:
          'tnum' 1,
          'lnum' 1;
      }
      /* The type sits between name and weight: it explains why THIS question's
         control looks different from the one above it, before the admin wonders. */
      .q-type {
        grid-area: type;
        font-size: var(--text-xs);
        font-weight: var(--font-medium);
        color: var(--text-tertiary);
        padding-block: 1px;
        padding-inline: var(--space-2);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-pill);
        white-space: nowrap;
      }
      /* Collapsed state in words — an amber dot alone would be unreadable to
         anyone who cannot see it, and useless to anyone who can't recall what
         amber meant. */
      .score-sum {
        grid-area: sum;
        font-size: var(--text-xs);
        line-height: var(--leading-normal);
        color: var(--text-tertiary);
        overflow-wrap: anywhere;
      }
      .score-block.pending .score-sum {
        color: var(--warning-600);
        font-weight: var(--font-medium);
      }
      .score-panel {
        padding-block: var(--space-2) var(--space-5);
        padding-inline-start: var(--space-5);
        animation: score-open var(--motion-duration-base) var(--motion-easing-standard) both;
      }
      @keyframes score-open {
        from {
          opacity: 0;
          transform: translateY(-4px);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }
      /* One line of plain language per unfamiliar control, then out of the way. */
      .type-hint {
        margin: 0 0 var(--space-3);
        max-inline-size: 68ch;
        font-size: var(--text-xs);
        line-height: var(--leading-relaxed);
        color: var(--text-tertiary);
      }
      .agg-row {
        display: grid;
        grid-template-columns: minmax(12ch, 18ch) minmax(0, 22rem);
        align-items: center;
        column-gap: var(--space-4);
        row-gap: var(--space-1);
        margin-block-end: var(--space-3);
      }
      .agg-label {
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        color: var(--text-primary);
      }
      .agg-select {
        inline-size: 100%;
      }
      /* Sits under the select, aligned with it — the consequence of the choice
         you just made, not a caption for the label. */
      .agg-hint {
        grid-column: 2;
        margin: 0;
        font-size: var(--text-xs);
        line-height: var(--leading-relaxed);
        color: var(--text-tertiary);
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
      /* The type-specific rule (aggregation mode, band count): part of what gets
         saved, so the review is not silently narrower than the payload. */
      .review-q-rule {
        font-size: var(--text-xs);
        color: var(--text-tertiary);
        font-style: italic;
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
        border-block-end: 0;
        /* Seats on the bottom edge — square where it meets it. */
        border-radius: var(--radius-lg) var(--radius-lg) 0 0;
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
        /* The header stacks instead of squeezing: name + weight, then the type,
           then the readout — the weight stays paired with the name it belongs to. */
        .score-trigger {
          grid-template-columns: var(--space-5) minmax(0, 1fr) auto;
          grid-template-areas:
            'chev name weight'
            'chev type type'
            'chev sum sum';
        }
        .q-type {
          justify-self: start;
        }
        .score-panel {
          padding-inline-start: var(--space-3);
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
        .score-trigger,
        .score-chev,
        .pts-slider ::ng-deep .ant-slider-handle,
        .qweight-slider ::ng-deep .ant-slider-handle {
          transition: none;
        }
        .score-panel {
          animation: none;
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
   * Step-3 accordion: the ONE question whose scoring panel is open (`null` = all
   * collapsed). Exclusive rather than multi-open — a question can stack a dozen
   * sliders, and two of them open at once pushes the rest of the list out of view,
   * which is the problem the accordion exists to solve.
   */
  readonly openScore = signal<string | null>(null);
  /**
   * The set of PICKED question codes — the checkbox state. This IS the
   * program's `questionWeights` domain: picked → scored, unpicked → excluded.
   * Stored as an immutable Set (replaced on every toggle) so signal reads react.
   */
  readonly assigned = signal<ReadonlySet<string>>(new Set());
  /**
   * Per-type scoring rules that have no natural home in the flat number form:
   * NUMERIC band tables and MULTI_SELECT aggregations. Kept as signals for the
   * same reason `assigned` is — they are model state the form has no control for,
   * and every derived signal reads them directly.
   */
  readonly bands = signal<Record<string, NumericScoreBand[]>>({});
  readonly aggregation = signal<Record<string, MultiSelectAggregation>>({});
  readonly aggregations = MULTI_SELECT_AGGREGATIONS;

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
      (x) => this.questionLabel(x).toLowerCase().includes(q) || x.code.toLowerCase().includes(q),
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

  /**
   * Does this program's loan category actually ask the question?
   *
   * The two assignments are made on different screens — `/questionnaire`
   * decides which categories ask a question, this editor decides which
   * questions a program scores on — and nothing else compares them. Picking a
   * question outside the program's category configures a weight for something
   * this program's applicants are never shown.
   *
   * An empty `categories` list means the question is parked (asked by nobody),
   * which is equally invisible here and is flagged the same way.
   */
  isAskedHere(q: WeightableQuestion): boolean {
    const category = this.program()?.category;
    if (!category) return true; // program not loaded yet — do not cry wolf
    return q.categories.includes(category);
  }

  /** Picked questions this program's applicants will never be shown. */
  readonly unaskedPicked = computed<WeightableQuestion[]>(() =>
    this.assignedQuestions().filter((q) => !this.isAskedHere(q)),
  );

  /**
   * The program's category as the admin reads it elsewhere ("Auto Loan", not
   * "car") via the shared label source, so the warning names the same thing the
   * Loan categories tab does. Falls back to the raw value if a program ever
   * carries a category outside the constitution-locked four.
   */
  readonly programCategoryLabel = computed<string>(() => {
    const raw = this.program()?.category ?? '';
    return isLoanCategory(raw) ? categoryLabel(raw) : raw;
  });
  /** No picked question may be left at 0% weight. */
  readonly allWeightsPositive = computed<boolean>(() =>
    this.assignedQuestions().every((q) => (this.weightValues()[q.code] ?? 0) > 0),
  );
  /**
   * Every picked question must be scoreable BY ITS OWN TYPE — a choice question
   * with every answer scored, a number with a valid band table, a text question
   * with a presence score. A weighted question that cannot earn anything spends
   * its share of the score's denominator and never gives it back, which is what
   * the backend now rejects with `WEIGHTS_MISSING_RULE`.
   */
  readonly allScoresPositive = computed<boolean>(() =>
    this.assignedQuestions().every((q) => !this.questionIncomplete(q)),
  );
  /** Picked questions whose answers are all scored — step-3 progress. */
  readonly scoredCount = computed<number>(
    () => this.assignedQuestions().filter((q) => !this.questionIncomplete(q)).length,
  );
  readonly scoredBarPct = computed<number>(() => {
    const total = this.assignedCount();
    return total === 0 ? 0 : (this.scoredCount() / total) * 100;
  });
  /**
   * Scoring slots still sitting at 0 across the picked questions — an unscored
   * option, a text question with no presence score. Numeric bands are excluded:
   * a 0-score band is a deliberate "this range is bad", and the band table has its
   * own seed button, so counting them here would make the shortcut lie.
   */
  readonly blankCount = computed<number>(() => {
    this.rev();
    const scores = this.scoreValues();
    let n = 0;
    for (const q of this.assignedQuestions()) {
      if (q.type === 'TEXT') {
        if (this.textScoreOf(q.code) <= 0) n += 1;
      } else if (q.type !== 'NUMERIC') {
        for (const o of q.options) if ((scores[q.code]?.[o.code] ?? 0) <= 0) n += 1;
      }
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

  /**
   * Flattened model for the review step. "Top answer" means whatever earns the most
   * for this question's type: the best option, the best band's range, or simply
   * having answered. `ruleNote` carries the type-specific rule (the aggregation
   * mode, the band count) so the review shows everything that is about to be saved.
   */
  readonly reviewRows = computed<
    {
      code: string;
      label: string;
      weight: number;
      topLabel: string;
      topScore: number;
      ruleNote: string | null;
    }[]
  >(() => {
    this.rev();
    const scores = this.scoreValues();
    const best = this.bestByQuestion();
    return this.assignedQuestions().map((q) => {
      const row = {
        code: q.code,
        label: this.questionLabel(q),
        weight: this.weightValues()[q.code] ?? 0,
      };
      if (q.type === 'NUMERIC') {
        const rows = this.bandsOf(q.code);
        const top = rows.reduce<NumericScoreBand | null>(
          (acc, band) => (acc === null || band.score > acc.score ? band : acc),
          null,
        );
        return {
          ...row,
          topLabel: top ? this.bandRangeLabel(q, top) : '—',
          topScore: top?.score ?? 0,
          ruleNote: this.bandCountLabel(rows.length),
        };
      }
      if (q.type === 'TEXT') {
        return {
          ...row,
          topLabel: $localize`:@@scoring.editor.text_answered:Answered`,
          topScore: this.textScoreOf(q.code),
          ruleNote: null,
        };
      }
      const topCode = best[q.code] ?? '';
      const top = q.options.find((o) => o.code === topCode);
      return {
        ...row,
        topLabel: top ? this.optionLabel(top) : '—',
        topScore: scores[q.code]?.[topCode] ?? 0,
        ruleNote:
          q.type === 'MULTI_SELECT' ? this.aggregationLabel(this.aggregationOf(q.code)) : null,
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
      case 2: {
        // Name the offending question: with four kinds of control on one step,
        // "something is unscored" leaves the admin hunting.
        const pending = this.assignedQuestions().find((q) => this.questionIncomplete(q));
        if (!pending) return null;
        if (pending.type === 'NUMERIC') {
          return $localize`:@@scoring.editor.fix_bands:${this.questionLabel(pending)}:QUESTION: needs number bands that start in ascending order.`;
        }
        if (pending.type === 'TEXT') {
          return $localize`:@@scoring.editor.fix_text_score:${this.questionLabel(pending)}:QUESTION: needs a score above 0 for being answered.`;
        }
        return $localize`:@@scoring.editor.fix_zero_score:Every answer needs a score above 0.`;
      }
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
      // A weight set saved before v14.0.0 carries no rule maps — absent reads as
      // "not configured yet", which the step-3 gate then asks the admin to fill in.
      this.bands.set({ ...(active?.numericBands ?? {}) });
      this.aggregation.set(
        Object.fromEntries(
          Object.entries(active?.multiSelectRules ?? {}).map(([code, rule]) => [
            code,
            rule.aggregation,
          ]),
        ),
      );

      for (const q of questions) {
        const w = clampPct(Number(seedWeights[q.code] ?? 0));
        this.form.addControl(weightKey(q.code), this.numberControl(w));
        for (const o of q.options) {
          const s = clampPct(Number(seedScores[q.code]?.[o.code] ?? 0));
          this.form.addControl(scoreKey(q.code, o.code), this.numberControl(s));
        }
        if (q.type === 'TEXT') {
          const s = clampPct(Number(active?.textRules?.[q.code]?.answeredScore ?? 0));
          this.form.addControl(textScoreKey(q.code), this.numberControl(s));
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
    if (this.blocker()) {
      // Blocked on the answers step: open the question the footer message names,
      // so the fix is one click away instead of a hunt through collapsed rows.
      if (this.stepIndex() === 2) this.openFirstIncomplete();
      return;
    }
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
    // Entering the answers step, a picked number with no bands gets three seeded
    // from its own published range. Starting from a concrete table the admin can
    // drag beats an empty one they have to decode — and an unbanded number is the
    // one state that cannot score at all.
    if (i === 2) {
      this.seedMissingBands();
      // Land on the question that still needs work; an all-done list opens its
      // first row so the step never reads as an empty stack of headers.
      this.openFirstIncomplete();
    }
    this.stepIndex.set(i);
  }

  // ── Step-3 accordion ──────────────────────────────────────────────────
  isScoreOpen(questionCode: string): boolean {
    return this.openScore() === questionCode;
  }

  /** Clicking the open question collapses it — the header is a toggle, not a tab. */
  toggleScoreOpen(questionCode: string): void {
    this.openScore.update((open) => (open === questionCode ? null : questionCode));
  }

  scoreHeadId(questionCode: string): string {
    return `score-head-${questionCode}`;
  }

  scorePanelId(questionCode: string): string {
    return `score-panel-${questionCode}`;
  }

  /** Open the first picked question that cannot score yet, else the first one. */
  private openFirstIncomplete(): void {
    const rows = this.assignedQuestions();
    const target = rows.find((q) => this.questionIncomplete(q)) ?? rows[0];
    if (target) this.openScore.set(target.code);
  }

  /** Seed a default band table for every picked NUMERIC question that has none. */
  private seedMissingBands(): void {
    const pending = this.assignedQuestions().filter(
      (q) => q.type === 'NUMERIC' && this.bandsOf(q.code).length === 0,
    );
    if (pending.length === 0) return;
    this.bands.update((all) => {
      const next = { ...all };
      for (const q of pending) next[q.code] = seedScoreBands(q.numericMinValue, q.numericMaxValue);
      return next;
    });
    this.touch();
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
      if (q.type === 'TEXT') {
        const ctrl = this.form.controls[textScoreKey(q.code)];
        if (ctrl && ctrl.value <= 0) ctrl.setValue(BLANK_FILL_SCORE);
      }
    }
    this.form.markAsDirty();
    this.touch();
  }

  // ── Per-type scoring rules ────────────────────────────────────────────
  /** This question's band table. Empty until the admin seeds one. */
  bandsOf(questionCode: string): NumericScoreBand[] {
    this.rev();
    return this.bands()[questionCode] ?? [];
  }

  setBands(questionCode: string, rows: NumericScoreBand[]): void {
    this.bands.update((all) => ({ ...all, [questionCode]: rows }));
    this.form.markAsDirty();
    this.touch();
  }

  /** Stored aggregation, or the default the backend would apply anyway. */
  aggregationOf(questionCode: string): MultiSelectAggregation {
    this.rev();
    return this.aggregation()[questionCode] ?? 'AVERAGE';
  }

  setAggregation(questionCode: string, mode: MultiSelectAggregation): void {
    this.aggregation.update((all) => ({ ...all, [questionCode]: mode }));
    this.form.markAsDirty();
    this.touch();
  }

  /** The presence score of a TEXT question (0 = answering earns nothing). */
  textScoreOf(questionCode: string): number {
    this.rev();
    return this.form.controls[textScoreKey(questionCode)]?.value ?? 0;
  }

  setTextScore(questionCode: string, value: number | null): void {
    const ctrl = this.form.controls[textScoreKey(questionCode)];
    if (!ctrl) return;
    ctrl.setValue(clampPct(Number(value ?? 0)));
    ctrl.markAsDirty();
    this.form.markAsDirty();
    this.touch();
  }

  /** How the admin reads a question's type on the pick list and the score head. */
  typeLabel(q: WeightableQuestion): string {
    switch (q.type) {
      case 'MULTI_SELECT':
        return $localize`:@@scoring.editor.type_multi:Pick several`;
      case 'NUMERIC':
        return $localize`:@@scoring.editor.type_numeric:Number`;
      case 'TEXT':
        return $localize`:@@scoring.editor.type_text:Free text`;
      default:
        return $localize`:@@scoring.editor.type_single:Pick one`;
    }
  }

  /** What scoring this question will ask of the admin — shown before they pick it. */
  scoredByLabel(q: WeightableQuestion): string {
    switch (q.type) {
      case 'NUMERIC':
        return $localize`:@@scoring.editor.scored_by_bands:scored by number range`;
      case 'TEXT':
        return $localize`:@@scoring.editor.scored_by_presence:scored on being answered`;
      default:
        return $localize`:@@scoring.editor.scored_by_answers:${q.options.length}:COUNT: answers`;
    }
  }

  /** Display unit of a NUMERIC question, Arabic-first. */
  numericUnit(q: WeightableQuestion): string | null {
    return (this.isAr ? q.numericUnitAr : q.numericUnitEn) || q.numericUnitEn;
  }

  /** Names the select after its question — every row on this step has one. */
  aggregationAria(label: string): string {
    return $localize`:@@scoring.editor.aria.agg:${label}:NAME: — how several picks count`;
  }

  aggregationLabel(mode: MultiSelectAggregation): string {
    switch (mode) {
      case 'SUM_CAPPED':
        return $localize`:@@scoring.editor.agg_sum:Added up (capped at 100)`;
      case 'MAX':
        return $localize`:@@scoring.editor.agg_max:The best pick only`;
      case 'MIN':
        return $localize`:@@scoring.editor.agg_min:The worst pick only`;
      default:
        return $localize`:@@scoring.editor.agg_avg:Their average`;
    }
  }

  /** One line saying what the chosen mode does to a real answer. */
  aggregationHint(questionCode: string): string {
    switch (this.aggregationOf(questionCode)) {
      case 'SUM_CAPPED':
        return $localize`:@@scoring.editor.agg_hint_sum:Picking more counts for more — use this when each extra answer is genuinely better.`;
      case 'MAX':
        return $localize`:@@scoring.editor.agg_hint_max:Only the applicant's strongest pick counts; the others never help or hurt.`;
      case 'MIN':
        return $localize`:@@scoring.editor.agg_hint_min:One weak pick drags the answer down — use this when any bad item is a concern.`;
      default:
        return $localize`:@@scoring.editor.agg_hint_avg:A strong pick and a weak one land in the middle.`;
    }
  }

  /** "Below 5,000" / "5,000 → 15,000" / "15,000 and above" for the review row. */
  bandRangeLabel(q: WeightableQuestion, band: NumericScoreBand): string {
    const unit = this.numericUnit(q);
    const suffix = unit ? ` ${unit}` : '';
    if (band.from == null) {
      return $localize`:@@scoring.editor.band_below:Below ${band.to ?? ''}:TO:${suffix}:UNIT:`;
    }
    if (band.to == null) {
      return $localize`:@@scoring.editor.band_above:${band.from}:FROM:${suffix}:UNIT: and above`;
    }
    return `${band.from} → ${band.to}${suffix}`;
  }

  private bandCountLabel(count: number): string {
    return $localize`:@@scoring.editor.band_count:${count}:COUNT: bands`;
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

  /**
   * A picked question still needs work — judged BY ITS TYPE:
   *   choice  → some answer left at 0
   *   number  → no bands, or bands that do not ascend (the same rule the backend
   *             re-checks, via the shared `scoreBandsErrorFor`)
   *   text    → nothing earned for answering
   */
  questionIncomplete(q: WeightableQuestion): boolean {
    if (q.type === 'NUMERIC') {
      const rows = this.bandsOf(q.code);
      return scoreBandsErrorFor(rows) !== null || rows.every((b) => b.score <= 0);
    }
    if (q.type === 'TEXT') return this.textScoreOf(q.code) <= 0;
    const scores = this.scoreValues()[q.code] ?? {};
    return q.options.length === 0 || q.options.some((o) => (scores[o.code] ?? 0) <= 0);
  }

  /**
   * The collapsed accordion line: what this question scores by right now, or what
   * is missing. Says the same thing the footer blocker says, per row, so a
   * collapsed list is still readable at a glance instead of a stack of names.
   */
  scoreSummary(q: WeightableQuestion): string {
    if (q.type === 'NUMERIC') {
      const rows = this.bandsOf(q.code);
      const top = rows.reduce<NumericScoreBand | null>(
        (acc, band) => (acc === null || band.score > acc.score ? band : acc),
        null,
      );
      if (top === null) return $localize`:@@scoring.editor.sum_no_bands:no ranges yet`;
      if (scoreBandsErrorFor(rows) !== null || top.score <= 0) {
        return $localize`:@@scoring.editor.sum_bad_bands:ranges still need fixing`;
      }
      return $localize`:@@scoring.editor.sum_bands:${rows.length}:COUNT: ranges · best ${this.bandRangeLabel(q, top)}:BAND: at ${top.score}:SCORE:%`;
    }
    if (q.type === 'TEXT') {
      const score = this.textScoreOf(q.code);
      return score > 0
        ? $localize`:@@scoring.editor.sum_text:answering earns ${score}:SCORE:%`
        : $localize`:@@scoring.editor.sum_text_zero:answering earns nothing yet`;
    }
    if (q.options.length === 0)
      return $localize`:@@scoring.editor.sum_no_answers:no answers to score`;
    const blanks = q.options.filter((o) => this.scoreOf(q.code, o.code) <= 0).length;
    if (blanks > 0) {
      return $localize`:@@scoring.editor.sum_blanks:${blanks}:COUNT: of ${q.options.length}:TOTAL: answers still at 0`;
    }
    const topCode = this.bestByQuestion()[q.code] ?? '';
    const top = q.options.find((o) => o.code === topCode);
    return top
      ? $localize`:@@scoring.editor.sum_top:${q.options.length}:TOTAL: answers · top ${this.optionLabel(top)}:LABEL: at ${this.scoreOf(q.code, topCode)}:SCORE:%`
      : $localize`:@@scoring.editor.sum_answers:${q.options.length}:TOTAL: answers scored`;
  }

  /**
   * Build the scoring payload from the PICKED questions only, reading each control
   * by its EXACT key. Unpicked questions are omitted, so the saved
   * `questionWeights` map doubles as the assignment record — and each picked
   * question contributes exactly the rule map its own type is scored by, never a
   * rule block on the wrong type (the backend rejects that outright).
   */
  private scoringNow(): ProgramScoringWeights {
    const questionWeights: Record<string, number> = {};
    const answerScores: Record<string, Record<string, number>> = {};
    const multiSelectRules: Record<string, { aggregation: MultiSelectAggregation }> = {};
    const numericBands: Record<string, NumericScoreBand[]> = {};
    const textRules: Record<string, { answeredScore: number }> = {};
    const assigned = this.assigned();
    for (const q of this.questions()) {
      if (!assigned.has(q.code)) continue;
      questionWeights[q.code] = Number(this.form.controls[weightKey(q.code)]?.value ?? 0);
      if (q.type === 'NUMERIC') {
        numericBands[q.code] = this.bandsOf(q.code);
        continue;
      }
      if (q.type === 'TEXT') {
        textRules[q.code] = { answeredScore: this.textScoreOf(q.code) };
        continue;
      }
      const scores: Record<string, number> = {};
      for (const o of q.options) {
        scores[o.code] = Number(this.form.controls[scoreKey(q.code, o.code)]?.value ?? 0);
      }
      answerScores[q.code] = scores;
      if (q.type === 'MULTI_SELECT') {
        multiSelectRules[q.code] = { aggregation: this.aggregationOf(q.code) };
      }
    }
    return { questionWeights, answerScores, multiSelectRules, numericBands, textRules };
  }
}
