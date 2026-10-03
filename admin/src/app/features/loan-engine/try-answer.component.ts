import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { MoneyInputDirective, formatGroupedNumber } from '@core/directives/money-input.directive';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode } from '@core/auth/auth.types';
import type { LoanCategory } from '@core/loan-category';
import {
  DEBT_TYPES_QUESTION_CODE,
  I_SCORE_QUESTION_CODE,
  MONEY_QUESTION_CODES,
  NO_DEBTS_OPTION_CODE,
} from '@core/money-question-codes';
import type { SimulatedAnswer } from '../questionnaire/questionnaire.api.service';
import {
  LoanEngineApiService,
  type LoanEngineOverride,
  type LoanEngineQuestionDetail,
  type TriedProgram,
} from './loan-engine.api.service';
import { gateReasonErrorCode, problemText } from './loan-engine.labels';
import type { GateReasonCode } from './loan-engine.api.service';

/** One side of the comparison, already in words. */
export interface TryOutcome {
  ok: boolean;
  text: string;
}

/**
 * The sample applicant every try uses, so "saved" and "with these rows" differ ONLY by the
 * draft. Stated on screen — a figure is meaningless without the applicant it was priced for.
 */
const SAMPLE = {
  monthlyIncome: '30000',
  requestedAmount: '300000',
  tenorMonths: '60',
  iScore: '700',
} as const;

/**
 * Feature 013 (US3) — "try an answer": prices one program for a sample applicant twice, as
 * saved and with the unsaved draft, through the admin simulator (`programOverrides`). The
 * server checks the draft exactly as its save would, so a refusal here is the save's refusal.
 */
@Component({
  selector: 'app-try-answer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    MoneyInputDirective,
  ],
  template: `
    <div class="ta">
      <p class="ta__sample" i18n="@@lengine.try.sample">
        Sample applicant: income {{ grouped(sample.monthlyIncome) }}, asks
        {{ grouped(sample.requestedAmount) }} over {{ sample.tenorMonths }} months, I-Score
        {{ sample.iScore }}, no existing debts.
      </p>
      <div class="ta__ask">
        @switch (question().type) {
          @case ('NUMERIC') {
            <input
              nz-input
              class="ta__input"
              appMoneyInput
              [appMoneyInput]="false"
              inputmode="decimal"
              [formControl]="answer"
              [attr.aria-label]="answerAria"
            />
          }
          @case ('TEXT') {
            <input
              nz-input
              class="ta__input"
              [formControl]="answer"
              [attr.aria-label]="answerAria"
            />
          }
          @default {
            <nz-select
              class="ta__pick"
              [formControl]="answer"
              [attr.aria-label]="answerAria"
              nzShowSearch
            >
              @for (o of question().options; track o.code) {
                <nz-option [nzValue]="o.code" [nzLabel]="isAr ? o.labelAr : o.labelEn"></nz-option>
              }
            </nz-select>
          }
        }
        <button
          nz-button
          type="button"
          [nzLoading]="busy()"
          [disabled]="answer.value.trim() === ''"
          (click)="run()"
          i18n="@@lengine.try.run"
        >
          Try
        </button>
      </div>
      @if (saved(); as s) {
        <dl class="ta__out">
          <div>
            <dt i18n="@@lengine.try.saved">As saved</dt>
            <dd [class.ta__no]="!s.ok">{{ s.text }}</dd>
          </div>
          @if (withDraft(); as d) {
            <div>
              <dt i18n="@@lengine.try.draft">With these rows</dt>
              <dd [class.ta__no]="!d.ok">{{ d.text }}</dd>
            </div>
          }
        </dl>
      }
      @if (error(); as e) {
        <p class="ta__error" role="alert">{{ e }}</p>
      }
    </div>
  `,
  styles: [
    `
      .ta {
        display: grid;
        gap: var(--space-2);
      }
      .ta__sample {
        margin: 0;
        color: var(--color-text-secondary);
      }
      .ta__ask {
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
      }
      .ta__input {
        inline-size: 10rem;
      }
      .ta__pick {
        min-inline-size: 14rem;
      }
      .ta__out {
        display: grid;
        gap: var(--space-1);
        margin: 0;
      }
      .ta__out div {
        display: flex;
        gap: var(--space-2);
      }
      .ta__out dt {
        min-inline-size: 8rem;
        color: var(--color-text-secondary);
      }
      .ta__out dd {
        margin: 0;
        font-variant-numeric: tabular-nums;
      }
      .ta__no {
        color: var(--color-warning);
      }
      .ta__error {
        margin: 0;
        color: var(--color-error);
      }
    `,
  ],
})
export class TryAnswerComponent {
  readonly question = input.required<Omit<LoanEngineQuestionDetail, 'programs'>>();
  readonly category = input.required<LoanCategory>();
  readonly programCode = input.required<string>();
  /** The unsaved draft, or `null` to price only as saved. */
  readonly draft = input<LoanEngineOverride | null>(null);

  private readonly api = inject(LoanEngineApiService);
  private readonly errors = inject(ErrorCodeService);
  readonly isAr = document.documentElement.lang.startsWith('ar');
  readonly sample = SAMPLE;
  readonly answerAria = $localize`:@@lengine.try.answer_aria:Sample answer`;

  readonly answer = new FormControl<string>('', { nonNullable: true });
  readonly busy = signal(false);
  readonly saved = signal<TryOutcome | null>(null);
  readonly withDraft = signal<TryOutcome | null>(null);
  readonly error = signal<string | null>(null);

  grouped(raw: string): string {
    return formatGroupedNumber(raw);
  }

  async run(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const answers = this.answers();
      const draft = this.draft();
      const [plain, drafted] = await Promise.all([
        this.api.tryAnswers(this.category(), answers, []),
        draft === null
          ? Promise.resolve(null)
          : this.api.tryAnswers(this.category(), answers, [draft]),
      ]);
      this.saved.set(this.outcome(plain));
      this.withDraft.set(drafted === null ? null : this.outcome(drafted));
    } catch (err) {
      const body =
        err instanceof HttpErrorResponse
          ? (err.error as { code?: string; meta?: Record<string, unknown> })
          : null;
      this.withDraft.set(null);
      this.error.set(
        problemText(body?.meta?.['problem']) ??
          this.errors.toLocalizedMessage((body?.code ?? 'INTERNAL_ERROR') as ErrorCode, body?.meta),
      );
    } finally {
      this.busy.set(false);
    }
  }

  private answers(): SimulatedAnswer[] {
    const q = this.question();
    const value = this.answer.value.trim();
    const mine: SimulatedAnswer =
      q.type === 'NUMERIC'
        ? { questionCode: q.questionCode, numericValue: value }
        : q.type === 'TEXT'
          ? { questionCode: q.questionCode, textValue: value }
          : q.type === 'MULTI_SELECT'
            ? { questionCode: q.questionCode, optionCodes: [value] }
            : { questionCode: q.questionCode, optionCode: value };
    const sample: SimulatedAnswer[] = [
      { questionCode: MONEY_QUESTION_CODES.monthlyIncome, numericValue: SAMPLE.monthlyIncome },
      { questionCode: MONEY_QUESTION_CODES.requestedAmount, numericValue: SAMPLE.requestedAmount },
      { questionCode: MONEY_QUESTION_CODES.tenorMonths, numericValue: SAMPLE.tenorMonths },
      { questionCode: I_SCORE_QUESTION_CODE, numericValue: SAMPLE.iScore },
      // No existing debts: the debt-burden questions are money inputs the quote needs answered.
      { questionCode: DEBT_TYPES_QUESTION_CODE, optionCodes: [NO_DEBTS_OPTION_CODE] },
      { questionCode: MONEY_QUESTION_CODES.existingObligations, numericValue: '0' },
    ];
    // The question being tried wins over the sample's own answer to it.
    const base = sample.filter((a) => a.questionCode !== q.questionCode);
    return [...base, mine];
  }

  private outcome(matches: TriedProgram[]): TryOutcome {
    const m = matches.find((x) => x.programCode === this.programCode());
    if (m === undefined) {
      return { ok: false, text: $localize`:@@lengine.try.not_listed:Not offered for this sample.` };
    }
    if (m.figures !== null) {
      const f = m.figures;
      return {
        ok: true,
        text: $localize`:@@lengine.try.figures:${Number(f.effectiveRatePercent)}:rate:% · ${formatGroupedNumber(f.offeredAmountEGP)}:amount: EGP · ${f.effectiveTenorMonths}:months: months`,
      };
    }
    const gate = m.gateReasonCode;
    const code =
      gate !== null && gate !== undefined
        ? gateReasonErrorCode(gate as GateReasonCode)
        : (m.figuresUnavailableReason ?? 'INTERNAL_ERROR');
    return { ok: false, text: this.errors.toLocalizedMessage(code as ErrorCode) };
  }
}
