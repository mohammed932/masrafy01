import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  effect,
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
import { approvalTierLabel, bindingConstraintLabel } from './simulation-labels';
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

/**
 * Thousands grouping for bounds, steps and review values, so the hint under a
 * money field reads in the same shape as the field itself (1,000 — not 1000).
 * `en-US` digits deliberately: it is what `MoneyInputDirective` renders, and a
 * hint that groups differently from the input reads as a different number.
 */
/** Above this many options a SINGLE_SELECT renders as a searchable dropdown
 *  instead of a radio column (bank registry ≈ 11, governorates ≈ 27). */
const LONG_OPTION_LIST_THRESHOLD = 8;

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
  const picked = [...(source?.optionCodes ?? []), ...(source?.optionCode ? [source.optionCode] : [])];
  const matches = picked.includes(rule.optionCode);
  return rule.operator === 'not_equals' ? !matches : matches;
}

/**
 * Admin matching simulator (read-only). A guided one-question-per-step flow
 * runs the SAME per-bank approval scoring the mobile app uses — without creating
 * an application. All four question types (single pick, multi pick, text,
 * number) are answerable; only single pick carries an answer score (R9), the
 * rest are validated and carried for the figures work.
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
          Walk a sample applicant through the questionnaire and see what every active program
          would decide — eligibility, installment, approval probability. Nothing is saved.
        </p>
      </header>

      <div class="cat-row" role="tablist" aria-label="Loan category">
        @for (c of categories; track c) {
          <button type="button" class="cat-pill" [class.on]="category() === c" (click)="pickCategory(c)">
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
            <nz-empty nzNotFoundContent="No programs evaluated" i18n-nzNotFoundContent="@@sim.empty" />
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
                    <div class="prob" [attr.data-tier]="m.usedDefaultWeights ? 'unrated' : m.approvalTier">
                      <span class="prob-num">{{ pct(m.approvalProbability) }}%</span>
                      <span class="prob-tier">{{ tierLabel(m) }}</span>
                    </div>
                  </div>
                  <!-- Registry facts only. "Eligible" is NOT one: gating is dropped
                       for MVP, so every program carries eligible=true and a tag
                       saying so would be decoration, not information (A33). -->
                  <div class="m-tags">
                    @if (m.bankIsFeatured) { <span class="tag feat" i18n="@@sim.featured">Featured</span> }
                    @if (m.isShariaCompliant) {
                      <span class="tag ok" i18n="@@sim.sharia">Sharia-compliant</span>
                    }
                    @if (m.usedDefaultWeights) {
                      <span class="tag warn" i18n="@@sim.tier.unrated">Not rated</span>
                    }
                  </div>
                  <!-- Card carries the three figures a ranking is read on; the rest
                       of the money block lives in the drawer. Rendered only once
                       the quote pipeline supplies them, never as "null EGP". -->
                  @if (m.figures; as f) {
                    <dl class="m-figs">
                      <div>
                        <dt i18n="@@sim.installment">Installment</dt>
                        <dd class="numeric">{{ money(f.monthlyInstallmentEGP) }} EGP</dd>
                      </div>
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
              } @else {
                <ng-container i18n="@@sim.step">Question {{ step() + 1 }} of {{ total() }}</ng-container>
              }
            </span>
          </div>

          @if (current(); as q) {
            <div class="step-card">
              <h2 class="q-text">
                {{ questionText(q) }}
                @if (!q.isRequired) { <span class="opt-tag" i18n="@@sim.optional">optional</span> }
              </h2>

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
                  <!-- <label>, not <div>: it makes the whole affix box — unit
                       included — a click target that focuses the input, natively.
                       The accessible name still comes from aria-label, which
                       carries the unit so it is spoken as well as shown. -->
                  <label class="ctl-affix" [class.invalid]="numericError() !== null">
                    @if (isMoney(q)) {
                      <input
                        class="ctl"
                        type="text"
                        inputmode="numeric"
                        appMoneyInput
                        [formControl]="numericCtrl"
                        [attr.aria-label]="numericAriaLabel(q)"
                        [attr.aria-invalid]="numericError() !== null"
                        [attr.aria-describedby]="numericDescribedBy(q)"
                      />
                    } @else {
                      <!-- Text input, not type="number": NumberValueAccessor would
                           push a number into a string control. Bounds are checked
                           by numericError, the same rules the API applies. -->
                      <input
                        class="ctl"
                        type="text"
                        inputmode="decimal"
                        [formControl]="numericCtrl"
                        [attr.aria-label]="numericAriaLabel(q)"
                        [attr.aria-invalid]="numericError() !== null"
                        [attr.aria-describedby]="numericDescribedBy(q)"
                      />
                    }
                    @if (unitText(q); as u) { <span class="unit" aria-hidden="true">{{ u }}</span> }
                  </label>
                  @if (numericHint(q); as h) { <p class="hint" [id]="'hint-' + q.code">{{ h }}</p> }
                  @if (numericError(); as e) { <p class="err" [id]="'err-' + q.code" role="alert">{{ e }}</p> }
                }
                @case ('TEXT') {
                  <div class="field">
                    <input
                      class="ctl"
                      type="text"
                      [formControl]="textCtrl"
                      [attr.maxlength]="q.textMaxLength"
                      [attr.aria-label]="questionText(q)"
                    />
                  </div>
                }
                @default {
                  @if (isLongList(q)) {
                    <!-- Registry-backed lists (banks, governorates) are too long to
                         read as a radio column — one searchable dropdown instead.
                         No auto-advance here: the admin picks, then presses Next. -->
                    <div class="field">
                      <nz-select
                        class="sel-ctl select-comfy"
                        nzDropdownClassName="select-comfy-dropdown"
                        [nzOptionHeightPx]="42"
                        [formControl]="choiceCtrl"
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
                    <p class="hint" i18n="@@sim.search_hint">
                      {{ q.options.length }} options — type to search
                    </p>
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

              <div class="wiz-foot">
                <button nz-button nzSize="large" (click)="back()" [disabled]="step() === 0" i18n="@@sim.back">
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
                  <li class="review-row" (click)="goTo(i)">
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
      .page { padding: var(--space-6, 24px); max-inline-size: 760px; margin-inline: auto; }
      .head { margin-block-end: var(--space-5, 20px); }
      .head h1 { margin: 0; font-size: var(--text-2xl, 24px); font-weight: var(--font-weight-bold, 700); }
      .muted { color: var(--color-text-secondary, #6b7280); }
      .section-h { margin: 0; font-size: var(--text-lg, 18px); font-weight: 700; }

      .cat-row { display: flex; flex-wrap: wrap; gap: var(--space-2, 8px); margin-block-end: var(--space-5, 20px); }
      .cat-pill {
        text-transform: capitalize; cursor: pointer; min-block-size: 40px;
        padding: 7px 18px; border-radius: var(--radius-pill, 999px);
        border: 1px solid var(--color-border-default, #e5e7eb);
        background: var(--bg-surface, #fff); color: var(--color-text-primary, #1a2433);
        font-size: 14px; font-weight: 600;
        transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
      }
      .cat-pill:hover { border-color: var(--ant-primary-color, #0869c3); }
      .cat-pill.on { background: var(--ant-primary-color, #0869c3); color: #fff; border-color: var(--ant-primary-color, #0869c3); }

      /* ── Wizard ── */
      .progress { display: flex; align-items: center; gap: var(--space-3, 12px); margin-block-end: var(--space-4, 16px); }
      .progress-bar { flex: 1; block-size: 6px; border-radius: 999px; background: var(--color-border-default, #eceff3); overflow: hidden; }
      .progress-bar span {
        display: block; block-size: 100%; border-radius: 999px;
        background: var(--ant-primary-color, #0869c3);
        transition: inline-size 280ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .progress-text { font-size: 12px; font-weight: 600; color: var(--color-text-secondary, #6b7280); white-space: nowrap; }

      .step-card {
        background: var(--bg-surface, #fff); border: 1px solid var(--color-border-default, #eceff3);
        border-radius: var(--radius-lg, 14px); padding: var(--space-6, 24px);
        box-shadow: var(--shadow-sm, 0 1px 2px rgba(43, 35, 32, 0.06));
        animation: step-in 240ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      @keyframes step-in {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @media (prefers-reduced-motion: reduce) { .step-card { animation: none; } .progress-bar span { transition: none; } }

      .q-text {
        margin: 0 0 var(--space-5, 20px); font-size: var(--text-xl, 20px);
        font-weight: 700; line-height: 1.3; letter-spacing: -0.012em;
        display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;
      }
      /* Reads as a footnote to the question, not a second badge competing with
         it — the required case is the one that carries weight, and it is silent. */
      .opt-tag {
        font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
        color: var(--color-text-tertiary, #9aa1ab);
        border: 1px solid var(--color-border-default, #e5e7eb);
        padding: 1px 7px; border-radius: 999px;
      }

      .opts { display: flex; flex-direction: column; gap: var(--space-2, 8px); }
      .opt {
        display: flex; align-items: center; gap: 12px; inline-size: 100%;
        min-block-size: 52px; padding: 12px 16px; cursor: pointer; text-align: start;
        border: 1.5px solid var(--color-border-default, #e5e7eb);
        border-radius: var(--radius-md, 10px); background: var(--bg-surface, #fff);
        font-size: 15px; color: var(--color-text-primary, #1a2433);
        transition: border-color 120ms ease, background 120ms ease;
      }
      .opt:hover { border-color: color-mix(in srgb, var(--ant-primary-color, #0869c3) 50%, transparent); }
      .opt:focus-visible { outline: 2px solid var(--ant-primary-color, #0869c3); outline-offset: 2px; }
      .opt-mark {
        flex: none; inline-size: 20px; block-size: 20px; border-radius: 50%;
        border: 2px solid var(--color-border-strong, #c7ccd4); position: relative;
        transition: border-color 120ms ease;
      }
      .opt-mark.box { border-radius: var(--radius-sm, 6px); }
      .opt.sel {
        border-color: var(--ant-primary-color, #0869c3);
        background: color-mix(in srgb, var(--ant-primary-color, #0869c3) 7%, var(--bg-surface, #fff));
      }
      .opt.sel .opt-mark { border-color: var(--ant-primary-color, #0869c3); }
      .opt.sel .opt-mark::after {
        content: ''; position: absolute; inset: 3px; border-radius: 50%;
        background: var(--ant-primary-color, #0869c3);
      }
      .opt.sel .opt-mark.box::after { border-radius: 2px; inset: 3px; }

      /* ── Typed inputs ── */
      .field { display: flex; align-items: center; gap: var(--space-3, 12px); }
      .ctl {
        flex: 1; min-block-size: 52px; padding: 12px 16px; font-size: 15px;
        border: 1.5px solid var(--color-border-default, #e5e7eb);
        border-radius: var(--radius-md, 10px); background: var(--bg-surface, #fff);
        color: var(--color-text-primary, #1a2433); font-variant-numeric: tabular-nums lining-nums;
        transition: border-color 120ms ease, box-shadow 120ms ease;
      }
      .ctl:hover { border-color: color-mix(in srgb, var(--ant-primary-color, #0869c3) 50%, transparent); }
      /* The native outline is dropped, so the ring has to come back as a halo —
         a border-colour change alone is not a focus indicator. */
      .ctl:focus {
        outline: none; border-color: var(--ant-primary-color, #0869c3);
        box-shadow: var(--focus-halo, 0 0 0 3px rgba(8, 105, 195, 0.15));
      }

      /* Unit-suffixed number field. The BOX owns the border, background and every
         state; the input inside is stripped bare so the unit sits within the
         control rather than floating beside it. */
      .ctl-affix {
        display: flex; align-items: stretch; gap: 10px; cursor: text;
        min-block-size: 52px; padding-inline: 16px;
        border: 1.5px solid var(--color-border-default, #e5e7eb);
        border-radius: var(--radius-md, 10px); background: var(--bg-surface, #fff);
        transition: border-color 120ms ease, box-shadow 120ms ease;
      }
      .ctl-affix:hover { border-color: color-mix(in srgb, var(--ant-primary-color, #0869c3) 50%, transparent); }
      .ctl-affix:focus-within {
        border-color: var(--ant-primary-color, #0869c3);
        box-shadow: var(--focus-halo, 0 0 0 3px rgba(8, 105, 195, 0.15));
      }
      .ctl-affix.invalid { border-color: var(--ant-error-color, #c1666b); }
      .ctl-affix.invalid:focus-within {
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--ant-error-color, #c1666b) 22%, transparent);
      }
      /* Border/padding/halo now belong to the box — the input must add none of
         its own, or it draws a second control inside the first. */
      .ctl-affix .ctl {
        min-block-size: 0; padding-inline: 0; border: none; background: none;
      }
      .ctl-affix .ctl:hover, .ctl-affix .ctl:focus { border: none; box-shadow: none; }

      .unit {
        flex: none; align-self: center; user-select: none;
        font-size: 14px; font-weight: 600; letter-spacing: 0.01em;
        color: var(--color-text-tertiary, #9aa1ab);
      }
      .ctl-affix:focus-within .unit { color: var(--color-text-secondary, #6b7280); }
      /* Full-bleed like every sibling control: a 420px cap left the field
         orphaned against the card's inline edge. Height/skin: .select-comfy. */
      .sel-ctl { flex: 1; min-inline-size: 0; }
      .hint { margin: var(--space-2, 8px) 0 0; font-size: 12px; color: var(--color-text-secondary, #6b7280); }
      .err { margin: var(--space-2, 8px) 0 0; font-size: 12px; font-weight: 600; color: var(--ant-error-color, #c1666b); }

      .wiz-foot {
        display: flex; justify-content: space-between; gap: var(--space-3, 12px);
        margin-block-start: var(--space-6, 24px); padding-block-start: var(--space-4, 16px);
        border-block-start: 1px solid var(--color-border-default, #eceff3);
      }
      .count {
        margin-inline-start: 8px; background: rgba(255, 255, 255, 0.25);
        padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 700;
      }

      .review { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
      .review-row {
        display: flex; justify-content: space-between; gap: var(--space-4, 16px); cursor: pointer;
        padding: var(--space-3, 12px) 0; border-block-end: 1px solid var(--color-border-default, #f0f0f0);
      }
      .review-row:hover .r-q { color: var(--ant-primary-color, #0869c3); }
      .r-q { font-size: 14px; }
      .r-a { font-weight: 600; text-align: end; }
      .r-a.empty { color: var(--color-text-secondary, #9aa1ab); font-weight: 400; }

      /* ── Results ── */
      .results-head { display: flex; align-items: center; justify-content: space-between; margin-block-end: var(--space-4, 16px); }
      .matches { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-3, 12px); }
      /* The card IS the control: it needs the four states a button needs, and a
         focus ring the pointer affordance alone would not give a keyboard user. */
      .match {
        position: relative; cursor: pointer;
        border: 1px solid var(--color-border-default, #eceff3);
        border-radius: var(--radius-md, 10px); padding: var(--space-4, 16px);
        background: var(--bg-surface, #fff);
        transition: border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease;
      }
      .match:hover {
        border-color: color-mix(in srgb, var(--ant-primary-color, #0869c3) 45%, transparent);
        box-shadow: var(--shadow-sm, 0 1px 2px rgba(43, 35, 32, 0.06));
      }
      .match:active { transform: translateY(1px); }
      .match:focus-visible { outline: 2px solid var(--ant-primary-color, #0869c3); outline-offset: 2px; }
      @media (prefers-reduced-motion: reduce) { .match { transition: none; } .match:active { transform: none; } }
      .m-head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3, 12px); }
      .m-id { display: flex; flex-direction: column; min-inline-size: 0; }
      .m-bank { font-weight: 700; }
      .m-prog { font-size: 13px; color: var(--color-text-secondary, #6b7280); }
      .prob { display: flex; flex-direction: column; align-items: flex-end; text-align: end; }
      .prob-num { font-size: 22px; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; }
      .prob-tier { font-size: 11px; font-weight: 600; text-transform: capitalize; color: var(--color-text-secondary, #6b7280); }
      .prob[data-tier='excellent'] .prob-num, .prob[data-tier='good'] .prob-num { color: var(--ant-success-color, #2e7d4f); }
      .prob[data-tier='moderate'] .prob-num { color: var(--ant-warning-color, #b8860b); }
      .prob[data-tier='low'] .prob-num, .prob[data-tier='very_low'] .prob-num { color: var(--ant-error-color, #c1666b); }
      /* An unconfigured program is grey, not red: "not rated" and "rated badly"
         must never look the same (v13.0.0). */
      .prob[data-tier='unrated'] .prob-num { color: var(--color-text-tertiary, #9aa1ab); }
      .m-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-block-start: var(--space-3, 12px); }
      .tag { font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: var(--radius-pill, 999px); }
      .tag.ok { background: color-mix(in srgb, var(--ant-success-color, #2e7d4f) 14%, #fff); color: var(--ant-success-color, #2e7d4f); }
      .tag.feat { background: color-mix(in srgb, var(--ant-primary-color, #0869c3) 14%, #fff); color: var(--ant-primary-color, #0869c3); }
      .tag.warn { background: color-mix(in srgb, var(--ant-warning-color, #b8860b) 16%, #fff); color: var(--ant-warning-color, #b8860b); }
      .m-figs { display: flex; flex-wrap: wrap; gap: var(--space-5, 20px); margin: var(--space-3, 12px) 0 0; }
      .m-figs div { display: flex; flex-direction: column; min-inline-size: 0; }
      .m-figs dt { font-size: 11px; color: var(--color-text-secondary, #6b7280); }
      .m-figs dd { margin: 0; font-weight: 600; }
      .numeric { font-variant-numeric: tabular-nums lining-nums; }
      /* Not a red pill: an unquotable program is a configuration/answer state, not
         a rejection, and the sentence has to be readable to say which. */
      .m-reason {
        margin: var(--space-3, 12px) 0 0; font-size: 12px; line-height: 1.5;
        color: var(--color-text-secondary, #6b7280);
        border-inline-start: 3px solid var(--ant-warning-color, #b8860b);
        padding-inline-start: 10px;
      }
      .m-more {
        display: block; margin-block-start: var(--space-3, 12px);
        font-size: 12px; font-weight: 600; color: var(--ant-primary-color, #0869c3);
        opacity: 0.75; transition: opacity 120ms ease;
      }
      .match:hover .m-more, .match:focus-visible .m-more { opacity: 1; }
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

  /** Typed controls for the free-entry types + the long-list dropdown
   *  (Principle XXII — no ngModel). */
  readonly numericCtrl = new FormControl<string>('', { nonNullable: true });
  readonly textCtrl = new FormControl<string>('', { nonNullable: true });
  readonly choiceCtrl = new FormControl<string | null>(null);

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
  /** null on the review step (step >= total). */
  readonly current = computed<QuestionRow | null>(() => this.questions()[this.step()] ?? null);
  readonly onReview = computed(() => this.total() > 0 && this.step() >= this.total());
  readonly progressPct = computed(() =>
    this.total() === 0 ? 0 : Math.round((Math.min(this.step(), this.total()) / this.total()) * 100),
  );
  readonly answeredCount = computed(() => this.questions().filter((q) => this.isAnswered(q)).length);

  /** Client-side mirror of the backend's `ANSWER_OUT_OF_RANGE` rules. */
  readonly numericError = computed<string | null>(() => {
    const q = this.current();
    if (!q || q.type !== 'NUMERIC') return null;
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
  });

  /** Blocks Next on an unanswered required question or an invalid number. */
  readonly canAdvance = computed(() => {
    const q = this.current();
    if (!q) return true;
    if (this.numericError() !== null) return false;
    return !q.isRequired || this.isAnswered(q);
  });

  constructor() {
    void this.loadTree();

    // Seed the free-entry controls when the step changes. `answers` is read
    // untracked so typing does not reset the field being typed into.
    effect(() => {
      const q = this.current();
      untracked(() => {
        const value = q ? this.answers()[q.code] : undefined;
        this.numericCtrl.setValue(value?.numericValue ?? '', { emitEvent: false });
        this.textCtrl.setValue(value?.textValue ?? '', { emitEvent: false });
        this.choiceCtrl.setValue(value?.optionCode ?? null, { emitEvent: false });
      });
    });

    this.numericCtrl.valueChanges.pipe(takeUntilDestroyed()).subscribe((raw) => {
      const q = this.current();
      if (!q) return;
      const trimmed = raw.trim();
      this.setAnswer(q.code, trimmed === '' ? null : { numericValue: trimmed });
    });
    this.textCtrl.valueChanges.pipe(takeUntilDestroyed()).subscribe((raw) => {
      const q = this.current();
      if (!q) return;
      const trimmed = raw.trim();
      this.setAnswer(q.code, trimmed === '' ? null : { textValue: trimmed });
    });
    this.choiceCtrl.valueChanges.pipe(takeUntilDestroyed()).subscribe((code) => {
      const q = this.current();
      if (!q) return;
      this.setAnswer(q.code, code ? { optionCode: code } : null);
    });
  }

  /** Long option lists come from a registry (banks, governorates) — a searchable
   *  dropdown beats a radio column the admin has to scroll. */
  isLongList(q: QuestionRow): boolean {
    return q.options.length > LONG_OPTION_LIST_THRESHOLD;
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

  /** Pick a single-select option, then auto-advance for a guided flow. */
  choose(questionCode: string, optionCode: string): void {
    this.setAnswer(questionCode, { optionCode });
    this.next();
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
    if (this.step() < this.total()) this.step.update((s) => s + 1);
  }
  back(): void {
    if (this.step() > 0) this.step.update((s) => s - 1);
  }
  goTo(i: number): void {
    this.step.set(i);
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
    return MONEY_UNITS.has((q.numericUnitEn ?? '').trim()) || MONEY_UNITS.has((q.numericUnitAr ?? '').trim());
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
      this.numericError() === null ? null : `err-${q.code}`,
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

  pct(p: number): number {
    return Math.round(p * 100);
  }
  tierLabel(match: SimulationMatch): string {
    return approvalTierLabel(match);
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
