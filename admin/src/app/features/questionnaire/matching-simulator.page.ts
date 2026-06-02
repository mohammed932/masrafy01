import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import {
  LOAN_CATEGORIES,
  QuestionnaireApiService,
  type GroupTreeRow,
  type LoanCategory,
  type OptionRow,
  type QuestionRow,
  type SimulationResult,
} from './questionnaire.api.service';

/**
 * Admin matching simulator (read-only). A guided one-question-per-step flow
 * runs the SAME full engine + per-bank approval scoring the mobile app uses —
 * eligibility, installment, approval % — without creating an application.
 */
@Component({
  standalone: true,
  selector: 'mf-matching-simulator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, NzButtonModule, NzSpinModule, NzEmptyModule],
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
                  @if (m.eligible) {
                    <dl class="m-figs">
                      <div><dt i18n="@@sim.rate">Rate</dt><dd class="numeric">{{ m.effectiveRatePercent }}%</dd></div>
                      <div><dt i18n="@@sim.installment">Installment</dt><dd class="numeric">{{ m.monthlyInstallmentEGP }} EGP</dd></div>
                    </dl>
                  } @else if (m.rejectionReasons.length > 0) {
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
        <p class="muted" i18n="@@sim.no_questions">No published questions for this category yet.</p>
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
            <div class="step-card" [class.reduce]="false">
              <h2 class="q-text">
                {{ questionText(q) }}
                @if (!q.isRequired) { <span class="opt-tag" i18n="@@sim.optional">optional</span> }
              </h2>
              <div class="opts">
                @for (o of q.options; track o.code) {
                  <button
                    type="button"
                    class="opt"
                    [class.sel]="answers()[q.code] === o.code"
                    (click)="choose(q.code, o.code)"
                  >
                    <span class="opt-mark" aria-hidden="true"></span>
                    <span class="opt-label">{{ optionText(o) }}</span>
                  </button>
                }
              </div>
              <div class="wiz-foot">
                <button nz-button (click)="back()" [disabled]="step() === 0" i18n="@@sim.back">Back</button>
                <button
                  nz-button
                  nzType="primary"
                  (click)="next()"
                  [disabled]="q.isRequired && !answers()[q.code]"
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
                    <span class="r-a" [class.empty]="!answers()[q.code]">{{ answerLabel(q) }}</span>
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
      .opt.sel {
        border-color: var(--ant-primary-color, #0869c3);
        background: color-mix(in srgb, var(--ant-primary-color, #0869c3) 7%, var(--bg-surface, #fff));
      }
      .opt.sel .opt-mark { border-color: var(--ant-primary-color, #0869c3); }
      .opt.sel .opt-mark::after {
        content: ''; position: absolute; inset: 3px; border-radius: 50%;
        background: var(--ant-primary-color, #0869c3);
      }
      .opt-label { font-weight: 500; }

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
  readonly answers = signal<Record<string, string>>({});
  readonly running = signal(false);
  readonly result = signal<SimulationResult | null>(null);
  readonly step = signal(0);

  /** Flat, ordered list of active questions across all groups. */
  readonly questions = computed<QuestionRow[]>(() =>
    this.tree()
      .flatMap((g) => g.questions)
      .filter((q) => q.isActive),
  );
  readonly total = computed(() => this.questions().length);
  /** null on the review step (step === total). */
  readonly current = computed<QuestionRow | null>(() => this.questions()[this.step()] ?? null);
  readonly onReview = computed(() => this.total() > 0 && this.step() >= this.total());
  readonly progressPct = computed(() =>
    this.total() === 0 ? 0 : Math.round((Math.min(this.step(), this.total()) / this.total()) * 100),
  );
  readonly answeredCount = computed(() => Object.values(this.answers()).filter(Boolean).length);

  constructor() {
    void this.loadTree();
  }

  async pickCategory(c: LoanCategory): Promise<void> {
    if (c === this.category()) return;
    this.category.set(c);
    this.reset();
    await this.loadTree();
  }

  /** Pick an option, then auto-advance for a guided flow. */
  choose(questionCode: string, optionCode: string): void {
    this.answers.update((a) => ({ ...a, [questionCode]: optionCode }));
    this.next();
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
    const answers = Object.entries(this.answers())
      .filter(([, v]) => Boolean(v))
      .map(([questionCode, optionCode]) => ({ questionCode, optionCode }));
    if (answers.length === 0) return;
    this.running.set(true);
    try {
      this.result.set(await this.api.simulateMatching(this.category(), answers));
    } catch {
      this.message.error($localize`:@@sim.failed:Simulation failed`);
    } finally {
      this.running.set(false);
    }
  }

  questionText(q: QuestionRow): string {
    return (this.isAr ? q.questionAr : q.questionEn) || q.questionEn;
  }
  optionText(o: Pick<OptionRow, 'labelAr' | 'labelEn'>): string {
    return (this.isAr ? o.labelAr : o.labelEn) || o.labelEn;
  }
  answerLabel(q: QuestionRow): string {
    const code = this.answers()[q.code];
    const opt = q.options.find((o) => o.code === code);
    return opt ? this.optionText(opt) : '—';
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

  private reset(): void {
    this.answers.set({});
    this.result.set(null);
    this.step.set(0);
  }

  private async loadTree(): Promise<void> {
    this.loadingTree.set(true);
    try {
      this.tree.set(await this.api.tree(this.category()));
    } finally {
      this.loadingTree.set(false);
    }
  }
}
