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
import { NzMessageService } from 'ng-zorro-antd/message';
import { MoneyInputDirective } from '@core/directives/money-input.directive';
import {
  LOAN_CATEGORIES,
  QuestionnaireApiService,
  type GroupTreeRow,
  type LoanCategory,
  type OptionRow,
  type QuestionRow,
  type SimulatedAnswer,
  type SimulationResult,
} from './questionnaire.api.service';

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
                <li class="match" [class.ineligible]="!m.eligible">
                  <div class="m-head">
                    <div class="m-id">
                      <span class="m-bank">{{ m.bankName }}</span>
                      <span class="m-prog">{{ m.programFriendlyName }}</span>
                    </div>
                    <div class="prob" [attr.data-tier]="m.approvalTier">
                      <span class="prob-num">{{ pct(m.approvalProbability) }}%</span>
                      <span class="prob-tier">{{ tierLabel(m.approvalTier) }}</span>
                    </div>
                  </div>
                  <div class="m-tags">
                    @if (m.eligible) {
                      <span class="tag ok" i18n="@@sim.eligible">Eligible</span>
                    } @else {
                      <span class="tag bad" i18n="@@sim.ineligible">Not eligible</span>
                    }
                    @if (m.bankIsFeatured) { <span class="tag feat" i18n="@@sim.featured">Featured</span> }
                    @if (m.usedDefaultWeights) {
                      <span class="tag warn" i18n="@@sim.default_weights">default weights</span>
                    }
                  </div>
                  <!-- Figures are additive: rendered only once the quote pipeline
                       supplies them, never as a "null EGP" placeholder. -->
                  @if (m.effectiveRatePercent !== null || m.monthlyInstallmentEGP !== null) {
                    <dl class="m-figs">
                      @if (m.effectiveRatePercent !== null) {
                        <div><dt i18n="@@sim.rate">Rate</dt><dd class="numeric">{{ m.effectiveRatePercent }}%</dd></div>
                      }
                      @if (m.monthlyInstallmentEGP !== null) {
                        <div>
                          <dt i18n="@@sim.installment">Installment</dt>
                          <dd class="numeric">{{ m.monthlyInstallmentEGP }} EGP</dd>
                        </div>
                      }
                      @if (m.maxAffordableAmountEGP !== null) {
                        <div>
                          <dt i18n="@@sim.max_loan">Max loan</dt>
                          <dd class="numeric">{{ m.maxAffordableAmountEGP }} EGP</dd>
                        </div>
                      }
                      @if (m.figures; as f) {
                        <div>
                          <dt i18n="@@sim.dbr">DBR</dt>
                          <dd class="numeric">{{ f.dbrPercent }}% / {{ f.dbrCapPercent }}%</dd>
                        </div>
                        <div>
                          <dt i18n="@@sim.binding">Binding</dt>
                          <dd>{{ humanizeReason(f.bindingConstraint) }}</dd>
                        </div>
                        @if (f.dbrBandIndex !== null) {
                          <div>
                            <dt i18n="@@sim.dbr_band">DBR band</dt>
                            <dd class="numeric">#{{ f.dbrBandIndex }}</dd>
                          </div>
                        }
                      }
                    </dl>
                  }
                  <!-- An unquotable program stays listed with its reason: DBR
                       shapes the amount, never whether a program appears (A33). -->
                  @if (m.figuresUnavailableReason !== null) {
                    <div class="reasons">
                      <span class="reason">{{ humanizeReason(m.figuresUnavailableReason) }}</span>
                    </div>
                  }
                  @if (m.rejectionReasons.length > 0) {
                    <div class="reasons">
                      @for (r of m.rejectionReasons; track r) {
                        <span class="reason">{{ humanizeReason(r) }}</span>
                      }
                    </div>
                  }
                </li>
              }
            </ul>
          }
        </div>
      } @else if (total() === 0) {
        <p class="muted" i18n="@@sim.no_questions">No published questions yet.</p>
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
                  <div class="field">
                    @if (isMoney(q)) {
                      <input
                        class="ctl"
                        type="text"
                        inputmode="numeric"
                        appMoneyInput
                        [formControl]="numericCtrl"
                        [attr.aria-label]="questionText(q)"
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
                        [attr.aria-label]="questionText(q)"
                      />
                    }
                    @if (unitText(q); as u) { <span class="unit">{{ u }}</span> }
                  </div>
                  @if (numericHint(q); as h) { <p class="hint">{{ h }}</p> }
                  @if (numericError(); as e) { <p class="err">{{ e }}</p> }
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

              <div class="wiz-foot">
                <button nz-button (click)="back()" [disabled]="step() === 0" i18n="@@sim.back">Back</button>
                <button nz-button nzType="primary" (click)="next()" [disabled]="!canAdvance()" i18n="@@sim.next">
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
                <button nz-button (click)="back()" i18n="@@sim.back">Back</button>
                <button
                  nz-button
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
        animation: step-in 240ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      @keyframes step-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; } }
      @media (prefers-reduced-motion: reduce) { .step-card { animation: none; } .progress-bar span { transition: none; } }

      .q-text {
        margin: 0 0 var(--space-5, 20px); font-size: var(--text-xl, 20px);
        font-weight: 700; line-height: 1.3; display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;
      }
      .opt-tag {
        font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
        color: var(--color-text-secondary, #6b7280);
        background: var(--bg-subtle, #f6f8fa); padding: 1px 8px; border-radius: 999px;
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
      }
      .ctl:focus { outline: none; border-color: var(--ant-primary-color, #0869c3); }
      .unit { font-size: 14px; font-weight: 600; color: var(--color-text-secondary, #6b7280); }
      .hint { margin: var(--space-2, 8px) 0 0; font-size: 12px; color: var(--color-text-secondary, #6b7280); }
      .err { margin: var(--space-2, 8px) 0 0; font-size: 12px; font-weight: 600; color: var(--ant-error-color, #c1666b); }

      .wiz-foot { display: flex; justify-content: space-between; gap: var(--space-3, 12px); margin-block-start: var(--space-6, 24px); }
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
      .match { border: 1px solid var(--color-border-default, #eceff3); border-radius: var(--radius-md, 10px); padding: var(--space-4, 16px); }
      .match.ineligible { opacity: 0.85; }
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
      .m-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-block-start: var(--space-3, 12px); }
      .tag { font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: var(--radius-pill, 999px); }
      .tag.ok { background: color-mix(in srgb, var(--ant-success-color, #2e7d4f) 14%, #fff); color: var(--ant-success-color, #2e7d4f); }
      .tag.bad { background: color-mix(in srgb, var(--ant-error-color, #c1666b) 14%, #fff); color: var(--ant-error-color, #c1666b); }
      .tag.feat { background: color-mix(in srgb, var(--ant-primary-color, #0869c3) 14%, #fff); color: var(--ant-primary-color, #0869c3); }
      .tag.warn { background: color-mix(in srgb, var(--ant-warning-color, #b8860b) 16%, #fff); color: var(--ant-warning-color, #b8860b); }
      .m-figs { display: flex; gap: var(--space-5, 20px); margin: var(--space-3, 12px) 0 0; }
      .m-figs div { display: flex; flex-direction: column; }
      .m-figs dt { font-size: 11px; color: var(--color-text-secondary, #6b7280); }
      .m-figs dd { margin: 0; font-weight: 600; }
      .numeric { font-variant-numeric: tabular-nums lining-nums; }
      .reasons { display: flex; flex-wrap: wrap; gap: 6px; margin-block-start: var(--space-3, 12px); }
      .reason {
        font-size: 11px; font-weight: 600; padding: 2px 9px; border-radius: var(--radius-pill, 999px);
        background: color-mix(in srgb, var(--ant-error-color, #c1666b) 10%, #fff); color: var(--ant-error-color, #c1666b);
      }
    `,
  ],
})
export class MatchingSimulatorPage {
  private readonly api = inject(QuestionnaireApiService);
  private readonly message = inject(NzMessageService);
  private readonly isAr = inject(LOCALE_ID).startsWith('ar');

  readonly categories = LOAN_CATEGORIES;
  readonly category = signal<LoanCategory>('personal');
  readonly tree = signal<GroupTreeRow[]>([]);
  readonly loadingTree = signal(false);
  readonly answers = signal<Record<string, AnswerValue>>({});
  readonly running = signal(false);
  readonly result = signal<SimulationResult | null>(null);
  readonly step = signal(0);

  /** Typed controls for the two free-entry types (Principle XXII — no ngModel). */
  readonly numericCtrl = new FormControl<string>('', { nonNullable: true });
  readonly textCtrl = new FormControl<string>('', { nonNullable: true });

  /** Active questions across all groups, minus the ones a branch rule hides. */
  readonly questions = computed<QuestionRow[]>(() => {
    const active = this.tree()
      .flatMap((g) => g.questions)
      .filter((q) => q.isActive);
    const byCode = new Map(active.map((q) => [q.code, q]));
    const answers = this.answers();
    return active.filter((q) => isVisible(q, answers, byCode));
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
  }

  pickCategory(c: LoanCategory): void {
    if (c === this.category()) return;
    this.category.set(c);
    // Questions are global (Feature 010) — only the program set being simulated
    // changes with the category, so keep the answers and just drop a stale result.
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
  tierLabel(tier: string): string {
    return tier.replace(/_/g, ' ');
  }
  humanizeReason(code: string): string {
    return code.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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
