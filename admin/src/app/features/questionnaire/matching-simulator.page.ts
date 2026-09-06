import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  LOCALE_ID,
  computed,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzDrawerService } from 'ng-zorro-antd/drawer';
import { MoneyInputDirective } from '@core/directives/money-input.directive';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode } from '@core/auth/auth.types';
import {
  LOAN_CATEGORIES,
  QuestionnaireApiService,
  type GroupTreeRow,
  type LoanCategory,
  type OptionRow,
  type QuestionRow,
  type SimulatedAnswer,
  type SimulationMatch,
  type SimulationResult,
} from './questionnaire.api.service';
import { bindingConstraintLabel } from './simulation-labels';
import {
  SimulatedOfferDrawerComponent,
  type SimulatedOfferDrawerData,
} from './simulated-offer.drawer';

/** One applicant answer held by the wizard — exactly one value key is populated. */
interface AnswerValue {
  optionCode?: string;
  optionCodes?: string[];
  textValue?: string;
  numericValue?: string;
}

/** Money-bearing NUMERIC questions get the thousands-grouping input (A27). */
const MONEY_UNITS: ReadonlySet<string> = new Set(['EGP', 'egp', 'جنيه', 'ج.م']);

// ---- Itemised obligations ---------------------------------------------------
// Mirrors `DEBT_TYPES_QUESTION_CODE` / `OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE` /
// `MONEY_FIELD_BINDINGS.existing_obligations` on the backend, and the same three on
// mobile. Code constants in all three places because A33 forbids storing the binding
// on `Question` — so the codes travel by mirror, not by column.

/** The MULTI_SELECT whose picks decide which amount questions are asked. */
const DEBT_TYPES_QUESTION_CODE = 'current_loans';

/** The DERIVED total. Summed from the parts, never typed — see `derivedTotalOf`. */
const OBLIGATIONS_TOTAL_QUESTION_CODE = 'current_installments';

/** The pick whose amount question states a LIMIT rather than an instalment. */
const CREDIT_CARD_DEBT_TYPE_OPTION = 'credit_cards';

/**
 * Share of the stated total card limit that counts as a monthly commitment.
 * Mirrors `CREDIT_CARD_LIMIT_MONTHLY_PERCENT` on the backend: a card has no fixed
 * instalment and an undrawn limit can be drawn tomorrow, so the portfolio limit is
 * stated and discounted here rather than counted in full.
 */
const CREDIT_CARD_LIMIT_MONTHLY_PERCENT = 5;

/** Debt-type option code → the NUMERIC question capturing its monthly figure. */
const OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE: Readonly<Record<string, string>> = Object.freeze({
  car_loan: 'obligation_car_loan',
  [CREDIT_CARD_DEBT_TYPE_OPTION]: 'credit_card_total_limit',
  personal_loan: 'obligation_personal_loan',
  mortgage: 'obligation_mortgage',
  other: 'obligation_other',
});

/**
 * The monthly commitment one stated per-debt figure contributes: identity for a
 * real instalment, the discounted share for a card limit. An unmapped pick passes
 * through at face value rather than dropping out of the total.
 */
function obligationMonthlyAmount(debtTypeOptionCode: string, statedEGP: number): number {
  if (debtTypeOptionCode !== CREDIT_CARD_DEBT_TYPE_OPTION) return statedEGP;
  return Number(((statedEGP * CREDIT_CARD_LIMIT_MONTHLY_PERCENT) / 100).toFixed(2));
}

/** The debt types picked on the source question, across both single/multi shapes. */
function pickedDebtTypes(answers: Record<string, AnswerValue>): readonly string[] {
  const source = answers[DEBT_TYPES_QUESTION_CODE];
  if (!source) return [];
  return [...(source.optionCodes ?? []), ...(source.optionCode ? [source.optionCode] : [])];
}

/**
 * The obligations total implied by the per-debt amounts, or `null` when the debt-type
 * question has not been answered (the pre-itemised fallback, where the total is typed).
 *
 * Summed over the PICKED types only, so an amount left behind by un-ticking a type is
 * ignored — the same rule `resolveObligations` applies server-side. Kept in lockstep
 * with the mobile wizard so the simulator cannot show the admin a total the applicant's
 * own app would never produce.
 */
function derivedTotalOf(answers: Record<string, AnswerValue>): string | null {
  const picked = pickedDebtTypes(answers);
  if (picked.length === 0) return null;
  let total = 0;
  for (const debtType of picked) {
    const itemCode = OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE[debtType];
    if (itemCode === undefined) continue; // e.g. the explicit "none" pick
    const raw = answers[itemCode]?.numericValue?.trim() ?? '';
    if (raw === '') continue;
    const value = Number(raw);
    // Not `+= value`: the credit-card answer is a LIMIT, and only its discounted
    // share is a monthly burden — the same conversion `resolveObligations` applies.
    if (Number.isFinite(value)) total += obligationMonthlyAmount(debtType, value);
  }
  return total.toFixed(2);
}

/**
 * Thousands grouping for bounds, steps and review values, so the hint under a
 * money field reads in the same shape as the field itself (1,000 — not 1000).
 * `en-US` digits deliberately: it is what `MoneyInputDirective` renders, and a
 * hint that groups differently from the input reads as a different number.
 */
/** Above this many options a SINGLE_SELECT renders as a searchable dropdown
 *  instead of a radio column (bank registry ≈ 11, governorates ≈ 27). */
const LONG_OPTION_LIST_THRESHOLD = 8;

/**
 * Questions shown per wizard step. One-per-step turned a 22-question walk into 22
 * button presses; a small batch keeps each step readable while cutting the walk to
 * a handful of steps. Slicing the VISIBLE list (not the raw pool) keeps branching
 * intact — a revealed child lands in its own position, not at the end.
 */
const QUESTIONS_PER_STEP = 3;

/** Fixed-size slices of the visible question list, in order. */
function chunk(questions: readonly QuestionRow[], size: number): QuestionRow[][] {
  const pages: QuestionRow[][] = [];
  for (let i = 0; i < questions.length; i += size) pages.push(questions.slice(i, i + size));
  return pages;
}

function grouped(value: number | string): string {
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numeric)) return String(value);
  return numeric.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/**
 * A question is visible when it has no branch rule, or when the rule's source
 * question was answered with (or without, for `not_equals`) the named option.
 * Mirrors `isQuestionVisible` in the backend questionnaire service — an answer
 * to a hidden question is neither collected nor sent.
 */
function isVisible(
  q: QuestionRow,
  answers: Record<string, AnswerValue>,
  byCode: ReadonlyMap<string, QuestionRow>,
): boolean {
  const rule = q.enabledWhen;
  if (!rule?.questionCode || !rule.optionCode) return true;
  if (!byCode.has(rule.questionCode)) return true; // dangling rule: never hide
  const source = answers[rule.questionCode];
  const picked = [
    ...(source?.optionCodes ?? []),
    ...(source?.optionCode ? [source.optionCode] : []),
  ];
  const matches = picked.includes(rule.optionCode);
  return rule.operator === 'not_equals' ? !matches : matches;
}

/**
 * Admin matching simulator (read-only). A guided flow of a few questions per step
 * runs the SAME pricing pipeline the mobile app uses — eligibility, the rate
 * cascade, the debt-burden ceiling — without creating an application. All four
 * question types (single pick, multi pick, text, number) are answerable, and
 * every answer is validated and carried into the figures work.
 */
@Component({
  standalone: true,
  selector: 'mf-matching-simulator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MoneyInputDirective,
    NzButtonModule,
    NzSpinModule,
    NzEmptyModule,
    NzSelectModule,
  ],
  template: `
    <section class="page">
      <header class="head">
        <h1 i18n="@@sim.title">Matching simulator</h1>
        <p class="muted" i18n="@@sim.subtitle">
          Walk a sample applicant through the questionnaire and see what every active program would
          quote — eligibility, amount, rate, installment. Nothing is saved.
        </p>
      </header>

      <div class="cat-row" role="tablist" aria-label="Loan category">
        @for (c of categories; track c) {
          <button
            type="button"
            class="cat-pill"
            [class.on]="category() === c"
            (click)="pickCategory(c)"
          >
            {{ c }}
          </button>
        }
      </div>

      @if (loadingTree()) {
        <nz-spin nzSimple />
      } @else if (result() !== null) {
        <!-- ── Results ───────────────────────────────────────── -->
        <div class="results">
          <div class="results-head">
            <h2 class="section-h" i18n="@@sim.results">Results</h2>
            <button nz-button (click)="editAnswers()" i18n="@@sim.edit">← Edit answers</button>
          </div>
          @if (result()!.matches.length === 0) {
            <nz-empty
              nzNotFoundContent="No programs evaluated"
              i18n-nzNotFoundContent="@@sim.empty"
            />
          } @else {
            <ul class="matches">
              @for (m of result()!.matches; track m.programCode) {
                <!-- The whole card opens the offer drawer. Keyboard reaches it the
                     same way (Enter / Space on the focused row), so the pointer
                     shortcut adds no control the keyboard lacks. -->
                <li
                  class="match"
                  role="button"
                  tabindex="0"
                  [attr.aria-label]="openLabelFor(m)"
                  (click)="openOffer(m)"
                  (keydown.enter)="openOffer(m)"
                  (keydown.space)="openOffer(m); $event.preventDefault()"
                >
                  <div class="m-head">
                    <div class="m-id">
                      <span class="m-bank">{{ m.bankName }}</span>
                      <span class="m-prog">{{ m.programFriendlyName }}</span>
                    </div>
                    <!-- The installment anchors the card because it is what the list
                         is ordered on — the figure that explains the row's place. -->
                    @if (m.figures; as f) {
                      <div class="m-anchor">
                        <span class="m-anchor-num"
                          >{{ money(f.monthlyInstallmentEGP) }}
                          <span class="m-anchor-ccy">EGP</span></span
                        >
                        <span class="m-anchor-unit" i18n="@@sim.installment">Installment</span>
                      </div>
                    }
                  </div>
                  <!-- Registry facts only. "Eligible" is NOT one: gating is dropped
                       for MVP, so every program carries eligible=true and a tag
                       saying so would be decoration, not information (A33). -->
                  <div class="m-tags">
                    @if (m.bankIsFeatured) {
                      <span class="tag feat" i18n="@@sim.featured">Featured</span>
                    }
                    @if (m.isShariaCompliant) {
                      <span class="tag ok" i18n="@@sim.sharia">Sharia-compliant</span>
                    }
                  </div>
                  <!-- The installment is the headline above; these two say how it
                       was arrived at. The rest of the money block lives in the
                       drawer. Rendered only once the quote pipeline supplies them,
                       never as "null EGP". -->
                  @if (m.figures; as f) {
                    <dl class="m-figs">
                      <div>
                        <dt i18n="@@sim.rate">Rate</dt>
                        <dd class="numeric">{{ pctText(f.effectiveRatePercent) }}%</dd>
                      </div>
                      <div>
                        <dt i18n="@@sim.binding">Capped by</dt>
                        <dd>{{ bindingLabel(f.bindingConstraint) }}</dd>
                      </div>
                    </dl>
                  } @else if (m.figuresUnavailableReason !== null) {
                    <!-- An unquotable program stays listed with its reason: DBR
                         shapes the amount, never whether a program appears (A33). -->
                    <p class="m-reason">{{ reasonText(m.figuresUnavailableReason) }}</p>
                  }
                  <span class="m-more" aria-hidden="true" i18n="@@sim.open_offer"
                    >Offer details →</span
                  >
                </li>
              }
            </ul>
          }
        </div>
      } @else if (total() === 0) {
        @if (anyActiveQuestions()) {
          <p class="muted" i18n="@@sim.no_category_questions">
            No questions are assigned to this loan category yet.
          </p>
        } @else {
          <p class="muted" i18n="@@sim.no_questions">No published questions yet.</p>
        }
      } @else {
        <!-- ── Wizard ────────────────────────────────────────── -->
        <div class="wizard">
          <div class="progress">
            <div class="progress-bar"><span [style.inline-size.%]="progressPct()"></span></div>
            <span class="progress-text">
              @if (onReview()) {
                <span i18n="@@sim.review">Review</span>
              } @else if (pageStart() === pageEnd()) {
                <ng-container i18n="@@sim.step"
                  >Question {{ pageStart() }} of {{ total() }}</ng-container
                >
              } @else {
                <ng-container i18n="@@sim.step_range"
                  >Questions {{ pageStart() }}–{{ pageEnd() }} of {{ total() }}</ng-container
                >
              }
            </span>
          </div>

          @if (currentPage(); as page) {
            <div class="step-card">
              <!-- Several questions per step, not one: an admin walking a sample
                   applicant through 22 questions should not press Next 22 times.
                   Branch children still appear the moment their source is
                   answered — the page is a slice of the VISIBLE list, so a newly
                   revealed question lands in place instead of after the walk. -->
              <div class="q-page">
                @for (q of page; track q.code) {
                  <div class="q-block" [class.wide]="isWide(q)">
                    <h2 class="q-text">
                      {{ questionText(q) }}
                      @if (!q.isRequired) {
                        <span class="opt-tag" i18n="@@sim.optional">optional</span>
                      }
                    </h2>
                    <!-- The admin-authored sub-label the app shows under the prompt.
                       Rendered here too or the simulator misrepresents the question:
                       the credit-card figure means a total LIMIT across every card,
                       which only this line says. -->
                    @if (questionHelper(q); as helper) {
                      <p class="hint q-helper">{{ helper }}</p>
                    }

                    @switch (q.type) {
                      @case ('MULTI_SELECT') {
                        <div class="opts">
                          @for (o of q.options; track o.code) {
                            <button
                              type="button"
                              class="opt multi"
                              [class.sel]="isPicked(q, o.code)"
                              [attr.aria-pressed]="isPicked(q, o.code)"
                              (click)="toggle(q, o.code)"
                            >
                              <span class="opt-mark box" aria-hidden="true"></span>
                              <span class="opt-label">{{ optionText(o) }}</span>
                            </button>
                          }
                        </div>
                      }
                      @case ('NUMERIC') {
                        @if (isDerivedTotal(q)) {
                          <!-- Computed, not typed: the applicant states each debt and the
                             server re-sums the parts, so a total typed here would be
                             ignored (or rejected on apply). Shown with its breakdown so
                             the number explains itself rather than merely being locked. -->
                          <output class="ctl-affix derived" aria-live="polite">
                            <span class="ctl">{{
                              groupedText(answers()[q.code]?.numericValue ?? '0')
                            }}</span>
                            @if (unitText(q); as u) {
                              <span class="unit" aria-hidden="true">{{ u }}</span>
                            }
                          </output>
                          <p class="hint derived-note" i18n="@@sim.derived_total">
                            Added up from the payments above — not typed.
                          </p>
                          @if (derivedTotalParts(); as parts) {
                            @if (parts.length > 0) {
                              <ul class="derived-parts">
                                @for (part of parts; track part.label) {
                                  <li>
                                    <span>{{ part.label }}</span
                                    ><b>{{ part.value }}</b>
                                  </li>
                                }
                              </ul>
                            }
                          }
                        } @else {
                          <!-- <label>, not <div>: it makes the whole affix box — unit
                             included — a click target that focuses the input, natively.
                             The accessible name still comes from aria-label, which
                             carries the unit so it is spoken as well as shown. -->
                          <label class="ctl-affix" [class.invalid]="numericErrorFor(q) !== null">
                            @if (isMoney(q)) {
                              <input
                                class="ctl"
                                type="text"
                                inputmode="numeric"
                                appMoneyInput
                                [formControl]="numericCtrl(q)"
                                [attr.aria-label]="numericAriaLabel(q)"
                                [attr.aria-invalid]="numericErrorFor(q) !== null"
                                [attr.aria-describedby]="numericDescribedBy(q)"
                              />
                            } @else {
                              <!-- Text input, not type="number": NumberValueAccessor would
                                 push a number into a string control. Bounds are checked
                                 by numericErrorFor, the same rules the API applies. -->
                              <input
                                class="ctl"
                                type="text"
                                inputmode="decimal"
                                [formControl]="numericCtrl(q)"
                                [attr.aria-label]="numericAriaLabel(q)"
                                [attr.aria-invalid]="numericErrorFor(q) !== null"
                                [attr.aria-describedby]="numericDescribedBy(q)"
                              />
                            }
                            @if (unitText(q); as u) {
                              <span class="unit" aria-hidden="true">{{ u }}</span>
                            }
                          </label>
                          <!-- Hint + error share ONE slot so every paired question has
                             the same three parts (heading / control / footnote) and
                             the subgrid can line the fields up across the row. -->
                          <div class="q-foot">
                            @if (numericHint(q); as h) {
                              <p class="hint" [id]="'hint-' + q.code">{{ h }}</p>
                            }
                            @if (numericErrorFor(q); as e) {
                              <p class="err" [id]="'err-' + q.code" role="alert">{{ e }}</p>
                            }
                          </div>
                        }
                      }
                      @case ('TEXT') {
                        <div class="field">
                          <input
                            class="ctl"
                            type="text"
                            [formControl]="textCtrl(q)"
                            [attr.maxlength]="q.textMaxLength"
                            [attr.aria-label]="questionText(q)"
                          />
                        </div>
                      }
                      @default {
                        @if (isLongList(q)) {
                          <!-- Registry-backed lists (banks, governorates) are too long to
                             read as a radio column — one searchable dropdown instead. -->
                          <div class="field">
                            <nz-select
                              class="sel-ctl select-comfy"
                              nzDropdownClassName="select-comfy-dropdown"
                              [nzOptionHeightPx]="42"
                              [formControl]="choiceCtrl(q)"
                              nzShowSearch
                              nzAllowClear
                              [nzPlaceHolder]="pickPlaceholder"
                              [attr.aria-label]="questionText(q)"
                            >
                              @for (o of q.options; track o.code) {
                                <nz-option [nzValue]="o.code" [nzLabel]="optionText(o)"></nz-option>
                              }
                            </nz-select>
                          </div>
                          <div class="q-foot">
                            <p class="hint" i18n="@@sim.search_hint">
                              {{ q.options.length }} options — type to search
                            </p>
                          </div>
                        } @else {
                          <div class="opts">
                            @for (o of q.options; track o.code) {
                              <button
                                type="button"
                                class="opt"
                                [class.sel]="answers()[q.code]?.optionCode === o.code"
                                (click)="choose(q.code, o.code)"
                              >
                                <span class="opt-mark" aria-hidden="true"></span>
                                <span class="opt-label">{{ optionText(o) }}</span>
                              </button>
                            }
                          </div>
                        }
                      }
                    }
                  </div>
                }
              </div>

              <div class="wiz-foot">
                <button
                  nz-button
                  nzSize="large"
                  (click)="back()"
                  [disabled]="step() === 0"
                  i18n="@@sim.back"
                >
                  Back
                </button>
                <button
                  nz-button
                  nzSize="large"
                  nzType="primary"
                  (click)="next()"
                  [disabled]="!canAdvance()"
                  i18n="@@sim.next"
                >
                  Next
                </button>
              </div>
            </div>
          } @else {
            <!-- Review step -->
            <div class="step-card">
              <h2 class="q-text" i18n="@@sim.review_h">Review answers</h2>
              <ul class="review">
                @for (q of questions(); track q.code; let i = $index) {
                  <li class="review-row" (click)="goToQuestion(i)">
                    <span class="r-q">{{ questionText(q) }}</span>
                    <span class="r-a" [class.empty]="!isAnswered(q)">{{ answerLabel(q) }}</span>
                  </li>
                }
              </ul>
              <div class="wiz-foot">
                <button nz-button nzSize="large" (click)="back()" i18n="@@sim.back">Back</button>
                <button
                  nz-button
                  nzSize="large"
                  nzType="primary"
                  [nzLoading]="running()"
                  [disabled]="answeredCount() === 0"
                  (click)="run()"
                >
                  <span i18n="@@sim.run">Run simulation</span>
                  <span class="count">{{ answeredCount() }}/{{ total() }}</span>
                </button>
              </div>
            </div>
          }
        </div>
      }
    </section>
  `,
  styles: [
    `
      /* Wide enough for two question columns and a two-up option list. The old
         760px cap was sized for a single-question step and left most of the
         dashboard's width unused once a step started carrying three. */
      .page {
        padding: var(--space-6, 24px);
        max-inline-size: 1080px;
        margin-inline: auto;
      }
      .head {
        margin-block-end: var(--space-5, 20px);
      }
      .head h1 {
        margin: 0;
        font-size: var(--text-2xl, 24px);
        font-weight: var(--font-weight-bold, 700);
      }
      .muted {
        color: var(--color-text-secondary, #6b7280);
      }
      .section-h {
        margin: 0;
        font-size: var(--text-lg, 18px);
        font-weight: 700;
      }

      .cat-row {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2, 8px);
        margin-block-end: var(--space-5, 20px);
      }
      .cat-pill {
        text-transform: capitalize;
        cursor: pointer;
        min-block-size: 40px;
        padding: 7px 18px;
        border-radius: var(--radius-pill, 999px);
        border: 1px solid var(--color-border-default, #e5e7eb);
        background: var(--bg-surface, #fff);
        color: var(--color-text-primary, #1a2433);
        font-size: 14px;
        font-weight: 600;
        transition:
          background 120ms ease,
          border-color 120ms ease,
          color 120ms ease;
      }
      .cat-pill:hover {
        border-color: var(--ant-primary-color, #0869c3);
      }
      .cat-pill.on {
        background: var(--ant-primary-color, #0869c3);
        color: #fff;
        border-color: var(--ant-primary-color, #0869c3);
      }

      /* ── Wizard ── */
      .progress {
        display: flex;
        align-items: center;
        gap: var(--space-3, 12px);
        margin-block-end: var(--space-4, 16px);
      }
      .progress-bar {
        flex: 1;
        block-size: 6px;
        border-radius: 999px;
        background: var(--color-border-default, #eceff3);
        overflow: hidden;
      }
      .progress-bar span {
        display: block;
        block-size: 100%;
        border-radius: 999px;
        background: var(--ant-primary-color, #0869c3);
        transition: inline-size 280ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .progress-text {
        font-size: 12px;
        font-weight: 600;
        color: var(--color-text-secondary, #6b7280);
        white-space: nowrap;
      }

      .step-card {
        background: var(--bg-surface, #fff);
        border: 1px solid var(--color-border-default, #eceff3);
        border-radius: var(--radius-lg, 14px);
        padding: var(--space-6, 24px);
        box-shadow: var(--shadow-sm, 0 1px 2px rgba(43, 35, 32, 0.06));
        animation: step-in 240ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      @keyframes step-in {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .step-card {
          animation: none;
        }
        .progress-bar span {
          transition: none;
        }
      }

      /* Several questions per step, paired across two columns. A number field is
         ~250px of content in a 700px card — stacking them full-width pushed the
         third question off-screen and left half the card empty. Option columns
         and the itemised total keep the full width (.wide); everything typed
         or picked from a dropdown shares a row. Spacing does the separating:
         12px binds a question to its field, 32px breaks one question from the
         next — no rules needed once the rhythm carries the grouping. */
      .q-page {
        display: grid;
        align-items: start;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-6, 32px) var(--space-5, 24px);
      }
      .q-block.wide {
        grid-column: 1 / -1;
      }
      @media (max-width: 640px) {
        .q-page {
          grid-template-columns: 1fr;
        }
      }

      /* Two questions side by side only line up if their headings, fields and
         footnotes sit on SHARED rows — a one-line question next to a two-line one
         otherwise floats its input half a line high. Subgrid hands the three parts
         to the parent's tracks; the row-gap override keeps the parts of a question
         12px apart while questions stay 32px apart. Without subgrid support the
         block just stacks, which is the pre-pairing layout — no breakage. */
      @supports (grid-template-rows: subgrid) {
        .q-page > .q-block:not(.wide) {
          display: grid;
          grid-template-rows: subgrid;
          grid-row: span 3;
          row-gap: var(--space-3, 12px);
          /* The page sets align-items:start for the wide blocks; a subgrid must
             span its tracks instead, or the shared rows collapse under it. */
          align-self: stretch;
        }
        .q-page > .q-block:not(.wide) .q-text {
          margin-block-end: 0;
        }
      }
      /* Footnote slot: present even when empty, so the row exists for every pair. */
      .q-foot > .hint:first-child,
      .q-foot > .err:first-child {
        margin-block-start: 0;
      }

      .q-text {
        margin: 0 0 var(--space-3, 12px);
        font-size: var(--text-lg, 18px);
        font-weight: 700;
        line-height: 1.3;
        letter-spacing: -0.012em;
        display: flex;
        align-items: baseline;
        gap: 10px;
        flex-wrap: wrap;
      }
      /* Sits between the prompt and the control, so it owns the gap on BOTH sides:
         the paired-column rule above zeroes the title's bottom margin, which would
         otherwise leave this line touching the input. Sentence-cased and left at
         hint weight — it explains the figure, it does not compete with the ask. */
      .q-helper {
        margin: calc(-1 * var(--space-1, 4px)) 0 var(--space-3, 12px);
        line-height: 1.45;
        max-inline-size: 60ch;
      }
      /* Reads as a footnote to the question, not a second badge competing with
         it — the required case is the one that carries weight, and it is silent. */
      .opt-tag {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-text-tertiary, #9aa1ab);
        border: 1px solid var(--color-border-default, #e5e7eb);
        padding: 1px 7px;
        border-radius: 999px;
      }

      /* Option rows wrap into columns instead of running one 1000px-wide row per
         choice: at the card's width a full-bleed row puts the label alone at the
         start of a long empty strip, and seven of them is a scroll. auto-fill
         with a 300px floor means narrow cards keep the single column. */
      .opts {
        display: grid;
        gap: var(--space-2, 8px);
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      }
      .opt {
        display: flex;
        align-items: center;
        gap: 12px;
        inline-size: 100%;
        min-block-size: 52px;
        padding: 12px 16px;
        cursor: pointer;
        text-align: start;
        border: 1.5px solid var(--color-border-default, #e5e7eb);
        border-radius: var(--radius-md, 10px);
        background: var(--bg-surface, #fff);
        font-size: 15px;
        color: var(--color-text-primary, #1a2433);
        transition:
          border-color 120ms ease,
          background 120ms ease;
      }
      .opt:hover {
        border-color: color-mix(in srgb, var(--ant-primary-color, #0869c3) 50%, transparent);
      }
      .opt:focus-visible {
        outline: 2px solid var(--ant-primary-color, #0869c3);
        outline-offset: 2px;
      }
      .opt-mark {
        flex: none;
        inline-size: 20px;
        block-size: 20px;
        border-radius: 50%;
        border: 2px solid var(--color-border-strong, #c7ccd4);
        position: relative;
        transition: border-color 120ms ease;
      }
      .opt-mark.box {
        border-radius: var(--radius-sm, 6px);
      }
      .opt.sel {
        border-color: var(--ant-primary-color, #0869c3);
        background: color-mix(
          in srgb,
          var(--ant-primary-color, #0869c3) 7%,
          var(--bg-surface, #fff)
        );
      }
      .opt.sel .opt-mark {
        border-color: var(--ant-primary-color, #0869c3);
      }
      .opt.sel .opt-mark::after {
        content: '';
        position: absolute;
        inset: 3px;
        border-radius: 50%;
        background: var(--ant-primary-color, #0869c3);
      }
      .opt.sel .opt-mark.box::after {
        border-radius: 2px;
        inset: 3px;
      }

      /* ── Typed inputs ── */
      .field {
        display: flex;
        align-items: center;
        gap: var(--space-3, 12px);
      }
      .ctl {
        flex: 1;
        min-block-size: 52px;
        padding: 12px 16px;
        font-size: 15px;
        border: 1.5px solid var(--color-border-default, #e5e7eb);
        border-radius: var(--radius-md, 10px);
        background: var(--bg-surface, #fff);
        color: var(--color-text-primary, #1a2433);
        font-variant-numeric: tabular-nums lining-nums;
        transition:
          border-color 120ms ease,
          box-shadow 120ms ease;
      }
      .ctl:hover {
        border-color: color-mix(in srgb, var(--ant-primary-color, #0869c3) 50%, transparent);
      }
      /* The native outline is dropped, so the ring has to come back as a halo —
         a border-colour change alone is not a focus indicator. */
      .ctl:focus {
        outline: none;
        border-color: var(--ant-primary-color, #0869c3);
        box-shadow: var(--focus-halo, 0 0 0 3px rgba(8, 105, 195, 0.15));
      }

      /* Unit-suffixed number field. The BOX owns the border, background and every
         state; the input inside is stripped bare so the unit sits within the
         control rather than floating beside it. */
      .ctl-affix {
        display: flex;
        align-items: stretch;
        gap: 10px;
        cursor: text;
        min-block-size: 52px;
        padding-inline: 16px;
        border: 1.5px solid var(--color-border-default, #e5e7eb);
        border-radius: var(--radius-md, 10px);
        background: var(--bg-surface, #fff);
        transition:
          border-color 120ms ease,
          box-shadow 120ms ease;
      }
      .ctl-affix:hover {
        border-color: color-mix(in srgb, var(--ant-primary-color, #0869c3) 50%, transparent);
      }
      .ctl-affix:focus-within {
        border-color: var(--ant-primary-color, #0869c3);
        box-shadow: var(--focus-halo, 0 0 0 3px rgba(8, 105, 195, 0.15));
      }
      .ctl-affix.invalid {
        border-color: var(--ant-error-color, #c1666b);
      }
      .ctl-affix.invalid:focus-within {
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--ant-error-color, #c1666b) 22%, transparent);
      }
      /* Border/padding/halo now belong to the box — the input must add none of
         its own, or it draws a second control inside the first. */
      .ctl-affix .ctl {
        min-block-size: 0;
        padding-inline: 0;
        border: none;
        background: none;
      }
      .ctl-affix .ctl:hover,
      .ctl-affix .ctl:focus {
        border: none;
        box-shadow: none;
      }

      /* The derived total reads as an OUTPUT, not a disabled input: filled ground,
         dashed edge, no caret, no hover affordance — nothing that invites a click
         that will not take. Full text contrast is kept, because the value itself is
         not muted information; only its editability is gone. */
      .ctl-affix.derived {
        cursor: default;
        align-items: center;
        border-style: dashed;
        background: var(--bg-subtle, #f6f8fa);
      }
      .ctl-affix.derived:hover {
        border-color: var(--color-border-default, #e5e7eb);
      }
      .ctl-affix.derived .ctl {
        align-self: center;
        font-size: 16px;
        font-weight: 650;
        font-variant-numeric: tabular-nums;
      }
      .derived-note {
        font-style: italic;
      }
      .derived-parts {
        display: grid;
        gap: 4px;
        margin-block: 8px 0;
        padding-inline-start: 0;
        list-style: none;
        font-size: 13px;
        color: var(--color-text-secondary, #6b7280);
      }
      .derived-parts li {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding-block: 3px;
        border-block-end: 1px dashed var(--color-border-subtle, #eef1f4);
      }
      .derived-parts li:last-child {
        border-block-end: none;
      }
      .derived-parts b {
        font-weight: 650;
        font-variant-numeric: tabular-nums;
      }

      .unit {
        flex: none;
        align-self: center;
        user-select: none;
        font-size: 14px;
        font-weight: 600;
        letter-spacing: 0.01em;
        color: var(--color-text-tertiary, #9aa1ab);
      }
      .ctl-affix:focus-within .unit {
        color: var(--color-text-secondary, #6b7280);
      }
      /* Full-bleed like every sibling control: a 420px cap left the field
         orphaned against the card's inline edge. Height/skin: .select-comfy. */
      .sel-ctl {
        flex: 1;
        min-inline-size: 0;
      }
      .hint {
        margin: var(--space-2, 8px) 0 0;
        font-size: 12px;
        color: var(--color-text-secondary, #6b7280);
      }
      .err {
        margin: var(--space-2, 8px) 0 0;
        font-size: 12px;
        font-weight: 600;
        color: var(--ant-error-color, #c1666b);
      }

      .wiz-foot {
        display: flex;
        justify-content: space-between;
        gap: var(--space-3, 12px);
        margin-block-start: var(--space-6, 24px);
        padding-block-start: var(--space-4, 16px);
        border-block-start: 1px solid var(--color-border-default, #eceff3);
      }
      .count {
        margin-inline-start: 8px;
        background: rgba(255, 255, 255, 0.25);
        padding: 0 8px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 700;
      }

      .review {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
      }
      .review-row {
        display: flex;
        justify-content: space-between;
        gap: var(--space-4, 16px);
        cursor: pointer;
        padding: var(--space-3, 12px) 0;
        border-block-end: 1px solid var(--color-border-default, #f0f0f0);
      }
      .review-row:hover .r-q {
        color: var(--ant-primary-color, #0869c3);
      }
      .r-q {
        font-size: 14px;
      }
      .r-a {
        font-weight: 600;
        text-align: end;
      }
      .r-a.empty {
        color: var(--color-text-secondary, #9aa1ab);
        font-weight: 400;
      }

      /* ── Results ── */
      .results-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-block-end: var(--space-4, 16px);
      }
      .matches {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-3, 12px);
      }
      /* The card IS the control: it needs the four states a button needs, and a
         focus ring the pointer affordance alone would not give a keyboard user. */
      .match {
        position: relative;
        cursor: pointer;
        border: 1px solid var(--color-border-default, #eceff3);
        border-radius: var(--radius-md, 10px);
        padding: var(--space-4, 16px);
        background: var(--bg-surface, #fff);
        transition:
          border-color 120ms ease,
          box-shadow 120ms ease,
          transform 120ms ease;
      }
      .match:hover {
        border-color: color-mix(in srgb, var(--ant-primary-color, #0869c3) 45%, transparent);
        box-shadow: var(--shadow-sm, 0 1px 2px rgba(43, 35, 32, 0.06));
      }
      .match:active {
        transform: translateY(1px);
      }
      .match:focus-visible {
        outline: 2px solid var(--ant-primary-color, #0869c3);
        outline-offset: 2px;
      }
      @media (prefers-reduced-motion: reduce) {
        .match {
          transition: none;
        }
        .match:active {
          transform: none;
        }
      }
      .m-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: var(--space-3, 12px);
      }
      .m-id {
        display: flex;
        flex-direction: column;
        min-inline-size: 0;
      }
      .m-bank {
        font-weight: 700;
      }
      .m-prog {
        font-size: 13px;
        color: var(--color-text-secondary, #6b7280);
      }
      .m-anchor {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        text-align: end;
        flex: none;
      }
      .m-anchor-num {
        font-size: 22px;
        font-weight: 800;
        line-height: 1;
        font-variant-numeric: tabular-nums;
        color: var(--color-text-primary, #1f2430);
      }
      .m-anchor-ccy {
        font-size: 13px;
        font-weight: 700;
      }
      .m-anchor-unit {
        font-size: 11px;
        font-weight: 600;
        color: var(--color-text-secondary, #6b7280);
      }
      .m-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-block-start: var(--space-3, 12px);
      }
      .tag {
        font-size: 11px;
        font-weight: 700;
        padding: 2px 9px;
        border-radius: var(--radius-pill, 999px);
      }
      .tag.ok {
        background: color-mix(in srgb, var(--ant-success-color, #2e7d4f) 14%, #fff);
        color: var(--ant-success-color, #2e7d4f);
      }
      .tag.feat {
        background: color-mix(in srgb, var(--ant-primary-color, #0869c3) 14%, #fff);
        color: var(--ant-primary-color, #0869c3);
      }
      .tag.warn {
        background: color-mix(in srgb, var(--ant-warning-color, #b8860b) 16%, #fff);
        color: var(--ant-warning-color, #b8860b);
      }
      .m-figs {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-5, 20px);
        margin: var(--space-3, 12px) 0 0;
      }
      .m-figs div {
        display: flex;
        flex-direction: column;
        min-inline-size: 0;
      }
      .m-figs dt {
        font-size: 11px;
        color: var(--color-text-secondary, #6b7280);
      }
      .m-figs dd {
        margin: 0;
        font-weight: 600;
      }
      .numeric {
        font-variant-numeric: tabular-nums lining-nums;
      }
      /* Not a red pill: an unquotable program is a configuration/answer state, not
         a rejection, and the sentence has to be readable to say which. */
      .m-reason {
        margin: var(--space-3, 12px) 0 0;
        font-size: 12px;
        line-height: 1.5;
        color: var(--color-text-secondary, #6b7280);
        border-inline-start: 3px solid var(--ant-warning-color, #b8860b);
        padding-inline-start: 10px;
      }
      .m-more {
        display: block;
        margin-block-start: var(--space-3, 12px);
        font-size: 12px;
        font-weight: 600;
        color: var(--ant-primary-color, #0869c3);
        opacity: 0.75;
        transition: opacity 120ms ease;
      }
      .match:hover .m-more,
      .match:focus-visible .m-more {
        opacity: 1;
      }
    `,
  ],
})
export class MatchingSimulatorPage {
  private readonly api = inject(QuestionnaireApiService);
  private readonly message = inject(NzMessageService);
  private readonly drawer = inject(NzDrawerService);
  private readonly errors = inject(ErrorCodeService);
  private readonly isAr = inject(LOCALE_ID).startsWith('ar');

  readonly categories = LOAN_CATEGORIES;
  readonly category = signal<LoanCategory>('personal');
  readonly tree = signal<GroupTreeRow[]>([]);
  readonly loadingTree = signal(false);
  readonly answers = signal<Record<string, AnswerValue>>({});
  readonly running = signal(false);
  readonly result = signal<SimulationResult | null>(null);
  readonly step = signal(0);

  private readonly destroyRef = inject(DestroyRef);

  /**
   * Typed controls for the free-entry types + the long-list dropdown (Principle
   * XXII — no ngModel), one per question code.
   *
   * A step now shows several questions at once, so a single shared control per
   * type would have every field on the page writing the same value. Created on
   * first render and cached, so the binding hands the template a stable instance
   * and a paged-away answer is still in its control on the way back.
   */
  private readonly numericCtrls = new Map<string, FormControl<string>>();
  private readonly textCtrls = new Map<string, FormControl<string>>();
  private readonly choiceCtrls = new Map<string, FormControl<string | null>>();

  readonly pickPlaceholder = $localize`:@@sim.pick_one:Choose one`;

  /** True while the pool holds any active question at all — separates "nothing
   *  published" from "nothing assigned to THIS category" in the empty state. */
  readonly anyActiveQuestions = computed(() =>
    this.tree().some((g) => g.questions.some((q) => q.isActive)),
  );

  /**
   * The questions this category asks, minus the ones a branch rule hides.
   *
   * Category assignment is authoritative (Principle V, v12.0.0): the chip picks
   * BOTH which programs are simulated and which of the global pool's questions
   * the applicant is asked — empty `categories` means parked, asked by nobody.
   * `byCode` is built from the already-filtered set so branch resolution matches
   * `resolveSelectedOptions`, which also maps codes only over the asked set: a
   * rule pointing outside this category is dangling, and `isVisible` shows the
   * child rather than hiding it.
   */
  readonly questions = computed<QuestionRow[]>(() => {
    const category = this.category();
    const asked = this.tree()
      .flatMap((g) => g.questions)
      .filter((q) => q.isActive && q.categories.includes(category));
    const byCode = new Map(asked.map((q) => [q.code, q]));
    const answers = this.answers();
    return asked.filter((q) => isVisible(q, answers, byCode));
  });
  readonly total = computed(() => this.questions().length);
  /** The visible questions cut into steps. `step()` indexes THIS, not questions. */
  readonly pages = computed<QuestionRow[][]>(() => chunk(this.questions(), QUESTIONS_PER_STEP));
  readonly pageCount = computed(() => this.pages().length);
  /** null on the review step (step >= pageCount). */
  readonly currentPage = computed<QuestionRow[] | null>(() => this.pages()[this.step()] ?? null);
  readonly onReview = computed(() => this.pageCount() > 0 && this.step() >= this.pageCount());
  /** 1-based question numbers covered by this step, for the progress line. */
  readonly pageStart = computed(() => this.step() * QUESTIONS_PER_STEP + 1);
  readonly pageEnd = computed(() =>
    Math.min(this.pageStart() + (this.currentPage()?.length ?? 1) - 1, this.total()),
  );
  /** Questions left behind, not steps: the bar tracks the walk the admin sees. */
  readonly progressPct = computed(() => {
    const total = this.total();
    if (total === 0) return 0;
    const done = Math.min(this.step() * QUESTIONS_PER_STEP, total);
    return Math.round((done / total) * 100);
  });
  readonly answeredCount = computed(
    () => this.questions().filter((q) => this.isAnswered(q)).length,
  );

  /** Client-side mirror of the backend's `ANSWER_OUT_OF_RANGE` rules. */
  numericErrorFor(q: QuestionRow): string | null {
    if (q.type !== 'NUMERIC') return null;
    const raw = this.answers()[q.code]?.numericValue ?? '';
    if (raw === '') return null;
    const value = Number(raw);
    if (!Number.isFinite(value)) return $localize`:@@sim.err_number:Enter a number`;
    const min = q.numericMinValue === null ? null : Number(q.numericMinValue);
    const max = q.numericMaxValue === null ? null : Number(q.numericMaxValue);
    const step = q.numericStep === null ? null : Number(q.numericStep);
    if ((min !== null && value < min) || (max !== null && value > max)) {
      return this.rangeMessage(min, max);
    }
    // Steps are measured from the minimum (or zero), exactly as the API checks.
    if (step !== null && step > 0) {
      const offset = value - (min ?? 0);
      // Integer-cent arithmetic: floats cannot represent a 0.01 step remainder.
      const remainder = Math.round(offset * 100) % Math.round(step * 100);
      if (remainder !== 0) {
        return $localize`:@@sim.err_step:Must be a multiple of ${grouped(step)}:step:`;
      }
    }
    return null;
  }

  /** Blocks Next while ANY question on the step is unanswered-required or invalid. */
  readonly canAdvance = computed(() => {
    const page = this.currentPage();
    if (page === null) return true;
    return page.every(
      (q) => this.numericErrorFor(q) === null && (!q.isRequired || this.isAnswered(q)),
    );
  });

  constructor() {
    void this.loadTree();
  }

  /**
   * The control backing one free-entry / dropdown question, created on demand.
   *
   * Seeded from the answer already held (paging back must not blank a field) and
   * read `untracked` so the lookup never enrols the template's change detection
   * in the `answers` signal on the control's behalf.
   */
  numericCtrl(q: QuestionRow): FormControl<string> {
    const existing = this.numericCtrls.get(q.code);
    if (existing) return existing;
    const seed = untracked(() => this.answers()[q.code]?.numericValue ?? '');
    const ctrl = new FormControl<string>(seed, { nonNullable: true });
    ctrl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((raw) => {
      const trimmed = raw.trim();
      this.setAnswer(q.code, trimmed === '' ? null : { numericValue: trimmed });
    });
    this.numericCtrls.set(q.code, ctrl);
    return ctrl;
  }

  textCtrl(q: QuestionRow): FormControl<string> {
    const existing = this.textCtrls.get(q.code);
    if (existing) return existing;
    const seed = untracked(() => this.answers()[q.code]?.textValue ?? '');
    const ctrl = new FormControl<string>(seed, { nonNullable: true });
    ctrl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((raw) => {
      const trimmed = raw.trim();
      this.setAnswer(q.code, trimmed === '' ? null : { textValue: trimmed });
    });
    this.textCtrls.set(q.code, ctrl);
    return ctrl;
  }

  choiceCtrl(q: QuestionRow): FormControl<string | null> {
    const existing = this.choiceCtrls.get(q.code);
    if (existing) return existing;
    const seed = untracked(() => this.answers()[q.code]?.optionCode ?? null);
    const ctrl = new FormControl<string | null>(seed);
    ctrl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((code) => {
      this.setAnswer(q.code, code ? { optionCode: code } : null);
    });
    this.choiceCtrls.set(q.code, ctrl);
    return ctrl;
  }

  /** Long option lists come from a registry (banks, governorates) — a searchable
   *  dropdown beats a radio column the admin has to scroll. */
  isLongList(q: QuestionRow): boolean {
    return q.options.length > LONG_OPTION_LIST_THRESHOLD;
  }

  /**
   * Questions that claim the whole row rather than half of it: an option column
   * (its rows carry sentence-length labels) and the derived total (it renders a
   * breakdown list under the value). A single control — number, text, or the
   * searchable dropdown — reads fine at half width and pairs with its neighbour.
   */
  isWide(q: QuestionRow): boolean {
    if (q.type === 'NUMERIC') return this.isDerivedTotal(q);
    if (q.type === 'TEXT') return false;
    return !this.isLongList(q); // radio / checkbox column
  }

  pickCategory(c: LoanCategory): void {
    if (c === this.category()) return;
    this.category.set(c);
    // The chip changes the ASKED question set, not just the program set, so the
    // step index no longer points at the same question — restart the walk.
    // Answers survive: `payload()` maps over `questions()`, so an answer to a
    // question this category never asks is dropped from the request instead of
    // being rejected by the API as an unknown code.
    this.step.set(0);
    this.result.set(null);
  }

  /** Pick a single-select option. No auto-advance: the step holds sibling
   *  questions, and jumping on the first pick would skip them. */
  choose(questionCode: string, optionCode: string): void {
    this.setAnswer(questionCode, { optionCode });
  }

  isPicked(q: QuestionRow, optionCode: string): boolean {
    return (this.answers()[q.code]?.optionCodes ?? []).includes(optionCode);
  }

  /** Multi-select has no auto-advance — the admin picks, then presses Next. */
  toggle(q: QuestionRow, optionCode: string): void {
    const picked = this.answers()[q.code]?.optionCodes ?? [];
    const next = picked.includes(optionCode)
      ? picked.filter((c) => c !== optionCode)
      : [...picked, optionCode];
    this.setAnswer(q.code, next.length === 0 ? null : { optionCodes: next });
  }

  next(): void {
    if (this.step() < this.pageCount()) this.step.update((s) => s + 1);
  }
  back(): void {
    if (this.step() > 0) this.step.update((s) => s - 1);
  }
  /** Review rows are per question — open the step that question sits on. */
  goToQuestion(index: number): void {
    this.step.set(Math.floor(index / QUESTIONS_PER_STEP));
  }
  editAnswers(): void {
    this.result.set(null);
  }

  async run(): Promise<void> {
    const payload = this.payload();
    if (payload.length === 0) return;
    this.running.set(true);
    try {
      this.result.set(await this.api.simulateMatching(this.category(), payload));
    } catch {
      this.message.error($localize`:@@sim.failed:Simulation failed`);
    } finally {
      this.running.set(false);
    }
  }

  isMoney(q: QuestionRow): boolean {
    return (
      MONEY_UNITS.has((q.numericUnitEn ?? '').trim()) ||
      MONEY_UNITS.has((q.numericUnitAr ?? '').trim())
    );
  }
  /** Thousands grouping for the read-only derived total, matching the money inputs. */
  groupedText(value: string): string {
    return grouped(value);
  }
  /**
   * True when the total is computed from the parts and must therefore be shown
   * read-only. False on a snapshot that predates the itemised questions, where the
   * total is the only thing asked and has to stay typeable.
   */
  isDerivedTotal(q: QuestionRow): boolean {
    return q.code === OBLIGATIONS_TOTAL_QUESTION_CODE && pickedDebtTypes(this.answers()).length > 0;
  }
  /** The per-debt amounts making up the total, for the read-only breakdown list. */
  derivedTotalParts(): readonly { readonly label: string; readonly value: string }[] {
    const answers = this.answers();
    // The visible list is enough: an amount question is visible exactly when its
    // debt type is picked, which is the same condition this loop walks.
    const byCode = new Map(this.questions().map((q) => [q.code, q]));
    const parts: { label: string; value: string }[] = [];
    for (const debtType of pickedDebtTypes(answers)) {
      const itemCode = OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE[debtType];
      if (itemCode === undefined) continue;
      const raw = answers[itemCode]?.numericValue?.trim() ?? '';
      if (raw === '') continue;
      const q = byCode.get(itemCode);
      const value = Number(raw);
      // The CONTRIBUTION, not the stated figure. Listing a 150 000 card limit as a
      // line item under a 9 500 total reads as broken arithmetic; the stated limit
      // is still on screen in its own field right above.
      const monthly = Number.isFinite(value) ? obligationMonthlyAmount(debtType, value) : null;
      parts.push({
        label: q ? this.questionText(q) : itemCode,
        value: grouped(monthly === null ? raw : monthly.toFixed(2)),
      });
    }
    return parts;
  }
  unitText(q: QuestionRow): string | null {
    return (this.isAr ? q.numericUnitAr : q.numericUnitEn) || q.numericUnitEn;
  }
  /** The unit is rendered as a visual suffix (`aria-hidden`), so it has to reach
   *  screen readers through the field's name instead. */
  numericAriaLabel(q: QuestionRow): string {
    const unit = this.unitText(q);
    const label = this.questionText(q);
    return unit ? `${label} (${unit})` : label;
  }

  /** Hint and error are separate nodes below the box — point the field at them
   *  so the range rule and the violation are announced with it, not orphaned. */
  numericDescribedBy(q: QuestionRow): string | null {
    const ids = [
      this.numericHint(q) === null ? null : `hint-${q.code}`,
      this.numericErrorFor(q) === null ? null : `err-${q.code}`,
    ].filter((id): id is string => id !== null);
    return ids.length > 0 ? ids.join(' ') : null;
  }

  numericHint(q: QuestionRow): string | null {
    const min = q.numericMinValue;
    const max = q.numericMaxValue;
    if (min === null && max === null) return null;
    return this.rangeMessage(min === null ? null : Number(min), max === null ? null : Number(max));
  }

  questionText(q: QuestionRow): string {
    return (this.isAr ? q.questionAr : q.questionEn) || q.questionEn;
  }
  /** The admin-authored sub-label, or null when the question carries none. Falls
   *  back across locales the same way the prompt does, so a helper written in only
   *  one language still reaches the reader instead of vanishing. */
  questionHelper(q: QuestionRow): string | null {
    const text = ((this.isAr ? q.helperTextAr : q.helperTextEn) || q.helperTextEn || '').trim();
    return text === '' ? null : text;
  }
  optionText(o: Pick<OptionRow, 'labelAr' | 'labelEn'>): string {
    return (this.isAr ? o.labelAr : o.labelEn) || o.labelEn;
  }

  isAnswered(q: QuestionRow): boolean {
    const value = this.answers()[q.code];
    if (!value) return false;
    return Boolean(
      value.optionCode ||
      (value.optionCodes && value.optionCodes.length > 0) ||
      value.textValue ||
      value.numericValue,
    );
  }

  answerLabel(q: QuestionRow): string {
    const value = this.answers()[q.code];
    if (!value) return '—';
    if (value.numericValue) {
      const shown = grouped(value.numericValue);
      const unit = this.unitText(q);
      return unit ? `${shown} ${unit}` : shown;
    }
    if (value.textValue) return value.textValue;
    const codes = value.optionCode ? [value.optionCode] : (value.optionCodes ?? []);
    const labels = codes
      .map((c) => q.options.find((o) => o.code === c))
      .filter((o): o is OptionRow => o !== undefined)
      .map((o) => this.optionText(o));
    return labels.length > 0 ? labels.join('، ') : '—';
  }

  bindingLabel(constraint: string): string {
    return bindingConstraintLabel(constraint);
  }
  /** Figures-unavailable reasons are error codes — one localized catalog (A22). */
  reasonText(code: string): string {
    return this.errors.toLocalizedMessage(code as ErrorCode);
  }
  /** Thousands grouping on the STRING: a Decimal never becomes a float (Principle I). */
  money(value: string): string {
    const [whole = '0', frac] = value.split('.');
    const negative = whole.startsWith('-');
    const digits = (negative ? whole.slice(1) : whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${negative ? '-' : ''}${digits}${frac ? `.${frac}` : ''}`;
  }
  /** `18.5000` → `18.5`. Trailing-zero trim only — no arithmetic. */
  pctText(value: string): string {
    if (!value.includes('.')) return value;
    const trimmed = value.replace(/0+$/, '').replace(/\.$/, '');
    return trimmed === '' || trimmed === '-' ? '0' : trimmed;
  }

  openLabelFor(m: SimulationMatch): string {
    return $localize`:@@sim.open_offer_aria:Offer details for ${m.bankName}:bank: — ${m.programFriendlyName}:program:`;
  }

  /**
   * Drill into one simulated program. The drawer re-fetches that program's
   * registry terms itself; everything else it shows is the response already in
   * hand, so pressing a card runs no second simulation and cannot disagree with
   * the list it was opened from.
   */
  openOffer(m: SimulationMatch): void {
    this.drawer.create<SimulatedOfferDrawerComponent, SimulatedOfferDrawerData>({
      nzContent: SimulatedOfferDrawerComponent,
      nzData: { match: m },
      nzTitle: m.bankName,
      nzWidth: 'min(560px, calc(100vw - 48px))',
      nzPlacement: 'right',
    });
  }

  /** Only VISIBLE, answered questions are sent — a hidden answer must not score. */
  private payload(): SimulatedAnswer[] {
    const answers = this.answers();
    return this.questions()
      .filter((q) => this.isAnswered(q))
      .map((q) => ({ questionCode: q.code, ...answers[q.code] }));
  }

  private setAnswer(questionCode: string, value: AnswerValue | null): void {
    this.answers.update((current) => {
      const next = { ...current };
      if (value === null) delete next[questionCode];
      else next[questionCode] = value;
      // Re-derived on EVERY answer change, not only on the amount fields: un-ticking
      // a debt type has to drop its amount back out of the sum too. Written as an
      // ordinary answer so it validates, submits and scores through exactly the same
      // path a typed one would.
      const derived = derivedTotalOf(next);
      if (derived !== null) next[OBLIGATIONS_TOTAL_QUESTION_CODE] = { numericValue: derived };
      return next;
    });
  }

  private rangeMessage(min: number | null, max: number | null): string {
    if (min !== null && max !== null) {
      return $localize`:@@sim.range:Between ${grouped(min)}:min: and ${grouped(max)}:max:`;
    }
    if (min !== null) return $localize`:@@sim.range_min:${grouped(min)}:min: or more`;
    return $localize`:@@sim.range_max:${grouped(max ?? 0)}:max: or less`;
  }

  private async loadTree(): Promise<void> {
    this.loadingTree.set(true);
    try {
      this.tree.set(await this.api.tree());
    } finally {
      this.loadingTree.set(false);
    }
  }
}
