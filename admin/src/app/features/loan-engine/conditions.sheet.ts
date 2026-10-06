import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerRef, NZ_DRAWER_DATA } from 'ng-zorro-antd/drawer';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { FormDrawerComponent, DrawerSectionComponent } from '@shared/ui';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode } from '@core/auth/auth.types';
import {
  GATE_REASON_CODES,
  LoanEngineApiService,
  type ConditionBody,
  type GateReasonCode,
  type LoanEngineOption,
  type LoanEngineProgramSlice,
  type LoanEngineQuestionSummary,
} from './loan-engine.api.service';
import {
  CriterionFieldComponent,
  criterionGroup,
  criterionOf,
  type CriterionControls,
} from './criterion-field.component';
import { gateReasonErrorCode, problemText } from './loan-engine.labels';
import type { QuestionType } from '../questionnaire/questionnaire.api.service';

export interface ConditionsSheetData {
  /** Only who the program is and its conditions: the sheet never reads an effect. */
  program: Pick<
    LoanEngineProgramSlice,
    'programCode' | 'bankName' | 'friendlyName' | 'category' | 'version' | 'conditions'
  >;
  /** Linked questions of the program's loan type — what a criterion may read. */
  questions: LoanEngineQuestionSummary[];
  canEdit: boolean;
}

interface CriterionRowControls {
  questionCode: FormControl<string>;
  criterion: FormGroup<CriterionControls>;
}

interface ConditionControls {
  id: FormControl<string>;
  reasonCode: FormControl<GateReasonCode>;
  anyOf: FormArray<FormGroup<CriterionRowControls>>;
}

/**
 * Feature 013 — a program's ELIGIBILITY CONDITIONS, as a side sheet.
 *
 * Every condition must hold; a condition holds when ANY of its lines does — which is how an
 * exemption is written ("two years in business, OR a guarantor"). A failed condition does not
 * hide the program: the applicant sees it refused, with the reason picked here (Principle V).
 * Amount, term, income, debts, employment, age and I-Score are refused by the server — they
 * shape the amount and are never a gate (A33).
 */
@Component({
  selector: 'app-conditions-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    NzButtonModule,
    NzSelectModule,
    FormDrawerComponent,
    DrawerSectionComponent,
    CriterionFieldComponent,
  ],
  template: `
    <app-form-drawer
      [title]="title"
      [subtitle]="subtitle"
      [hint]="hint"
      [submitLabel]="saveLabel"
      [submitDisabled]="!data.canEdit"
      [submitting]="saving()"
      (cancelled)="ref.close()"
      (submitted)="save()"
    >
      <span drawerIcon aria-hidden="true">✓</span>

      @for (cond of conditions.controls; track cond; let ci = $index) {
        <app-drawer-section [label]="conditionLabel(ci)">
          <div class="cs__cond" [class.cs__cond--bad]="badCondition() === ci">
            <div class="cs__reason">
              <span [id]="'cs-reason-' + ci" i18n="@@lengine.cond.reason"
                >Reason the applicant is shown</span
              >
              <nz-select
                [formControl]="cond.controls.reasonCode"
                [nzDisabled]="!data.canEdit"
                [attr.aria-labelledby]="'cs-reason-' + ci"
              >
                @for (r of reasons; track r) {
                  <nz-option [nzValue]="r" [nzLabel]="reasonText(r)"></nz-option>
                }
              </nz-select>
            </div>

            <ol class="cs__lines">
              @for (line of cond.controls.anyOf.controls; track line; let li = $index) {
                <li class="cs__line">
                  @if (li > 0) {
                    <span class="cs__or" i18n="@@lengine.cond.or">or</span>
                  }
                  <nz-select
                    class="cs__q"
                    nzShowSearch
                    [formControl]="line.controls.questionCode"
                    [nzDisabled]="!data.canEdit"
                    [attr.aria-label]="questionAria"
                    [nzPlaceHolder]="questionPlaceholder"
                  >
                    @for (q of data.questions; track q.questionCode) {
                      <nz-option
                        [nzValue]="q.questionCode"
                        [nzLabel]="questionLabel(q)"
                      ></nz-option>
                    }
                  </nz-select>
                  @if (typeOf(line.controls.questionCode.value); as t) {
                    <app-criterion-field
                      [group]="line.controls.criterion"
                      [type]="t"
                      [options]="optionsOf(line.controls.questionCode.value)"
                      [disabled]="!data.canEdit"
                    />
                  }
                  @if (data.canEdit && cond.controls.anyOf.length > 1) {
                    <button
                      nz-button
                      nzType="text"
                      type="button"
                      [attr.aria-label]="removeLineAria"
                      (click)="cond.controls.anyOf.removeAt(li)"
                    >
                      ×
                    </button>
                  }
                </li>
              }
            </ol>
            @if (data.canEdit) {
              <div class="cs__acts">
                <button
                  nz-button
                  nzType="dashed"
                  type="button"
                  (click)="addLine(cond)"
                  i18n="@@lengine.cond.add_or"
                >
                  Add an "or"
                </button>
                <button
                  nz-button
                  nzType="text"
                  nzDanger
                  type="button"
                  (click)="conditions.removeAt(ci)"
                  i18n="@@lengine.cond.remove"
                >
                  Remove condition
                </button>
              </div>
            }
          </div>
        </app-drawer-section>
      } @empty {
        <p class="cs__empty" i18n="@@lengine.cond.none">
          No conditions — this bank quotes every applicant its tables can price.
        </p>
      }

      @if (data.canEdit) {
        <div class="cs__add">
          <button nz-button type="button" (click)="addCondition()" i18n="@@lengine.cond.add">
            Add a condition
          </button>
        </div>
      }

      @if (requiredNote(); as n) {
        <p class="cs__note" role="status">{{ n }}</p>
      }
      @if (error(); as e) {
        <p class="cs__error" role="alert">{{ e }}</p>
      }
    </app-form-drawer>
  `,
  styles: [
    `
      .cs__cond {
        display: grid;
        gap: var(--space-3);
        padding: var(--space-3);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        background: var(--color-surface-default);
      }
      .cs__cond--bad {
        border-color: var(--color-error);
      }
      .cs__reason {
        display: grid;
        gap: var(--space-1);
      }
      .cs__lines {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: var(--space-2);
      }
      .cs__line {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
      }
      .cs__or {
        color: var(--color-text-tertiary);
        font-weight: var(--font-weight-semibold);
      }
      .cs__q {
        min-inline-size: 16rem;
      }
      .cs__acts,
      .cs__add {
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
      }
      .cs__add {
        padding: 0 var(--space-5);
      }
      .cs__empty,
      .cs__note {
        margin: var(--space-3) var(--space-5);
        color: var(--color-text-secondary);
      }
      .cs__error {
        margin: var(--space-3) var(--space-5);
        color: var(--color-error);
      }
    `,
  ],
})
export class ConditionsSheetComponent {
  readonly data = inject<ConditionsSheetData>(NZ_DRAWER_DATA);
  readonly ref = inject<NzDrawerRef<ConditionsSheetComponent, LoanEngineProgramSlice>>(NzDrawerRef);
  private readonly api = inject(LoanEngineApiService);
  private readonly errors = inject(ErrorCodeService);
  private readonly isAr = document.documentElement.lang.startsWith('ar');

  readonly reasons = GATE_REASON_CODES;
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly badCondition = signal<number | null>(null);
  readonly requiredNote = signal<string | null>(null);
  /** Option lists, fetched once per question picked. */
  private readonly optionsByQuestion = signal<Record<string, LoanEngineOption[]>>({});

  readonly title = $localize`:@@lengine.cond.title:Who this program quotes`;
  readonly subtitle = `${this.data.program.bankName} — ${this.data.program.friendlyName}`;
  readonly hint = $localize`:@@lengine.cond.hint:Every condition must hold. An applicant who fails one sees this program refused, with the reason you pick.`;
  readonly saveLabel = $localize`:@@lengine.cond.save:Save conditions`;
  readonly questionAria = $localize`:@@lengine.cond.question_aria:Question`;
  readonly questionPlaceholder = $localize`:@@lengine.cond.question_ph:Pick a question`;
  readonly removeLineAria = $localize`:@@lengine.cond.remove_line:Remove this line`;

  readonly conditions = new FormArray<FormGroup<ConditionControls>>(
    this.data.program.conditions.map((c) =>
      this.conditionGroup(
        c.id,
        c.reasonCode,
        c.anyOf
          .filter((l) => l.questionCode !== null)
          .map((l) => ({ questionCode: l.questionCode as string, criterion: l.criterion })),
      ),
    ),
  );

  constructor() {
    for (const code of new Set(
      this.data.program.conditions.flatMap((c) => c.anyOf.map((l) => l.questionCode)),
    )) {
      if (code !== null) void this.loadOptions(code);
    }
  }

  conditionLabel(i: number): string {
    return $localize`:@@lengine.cond.n:Condition ${i + 1}:n:`;
  }

  reasonText(code: GateReasonCode): string {
    return this.errors.toLocalizedMessage(gateReasonErrorCode(code) as ErrorCode);
  }

  questionLabel(q: LoanEngineQuestionSummary): string {
    return this.isAr ? q.labelAr : q.labelEn;
  }

  typeOf(code: string): QuestionType | null {
    return this.data.questions.find((q) => q.questionCode === code)?.type ?? null;
  }

  optionsOf(code: string): LoanEngineOption[] {
    return this.optionsByQuestion()[code] ?? [];
  }

  private questionPicked(line: FormGroup<CriterionRowControls>, code: string): void {
    line.controls.criterion.reset();
    void this.loadOptions(code).then((options) => {
      const first = options[0]?.code ?? '';
      line.controls.criterion.controls.option.setValue(first);
    });
  }

  addCondition(): void {
    const used = new Set(this.conditions.controls.map((c) => c.controls.id.value));
    let n = this.conditions.length + 1;
    while (used.has(`condition_${n}`)) n++;
    this.conditions.push(this.conditionGroup(`condition_${n}`, 'GATE_NOT_MET', []));
  }

  addLine(cond: FormGroup<ConditionControls>): void {
    cond.controls.anyOf.push(this.lineGroup('', null));
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    this.badCondition.set(null);
    this.requiredNote.set(null);
    try {
      const conditions: ConditionBody[] = this.conditions.controls.map((c) => ({
        id: c.controls.id.value,
        reasonCode: c.controls.reasonCode.value,
        anyOf: c.controls.anyOf.controls
          .filter((l) => l.controls.questionCode.value !== '')
          .map((l) => ({
            questionCode: l.controls.questionCode.value,
            criterion: criterionOf(
              l.controls.criterion,
              this.typeOf(l.controls.questionCode.value) ?? 'SINGLE_SELECT',
            ),
          })),
      }));
      const res = await this.api.putConditions(this.data.program.programCode, {
        expectedVersion: this.data.program.version,
        conditions,
      });
      this.ref.close(res.program);
    } catch (err) {
      const body =
        err instanceof HttpErrorResponse
          ? (err.error as { code?: string; meta?: Record<string, unknown> })
          : null;
      const row = body?.meta?.['row'];
      if (typeof row === 'number') this.badCondition.set(row);
      this.error.set(
        body?.code === 'CONFLICT_STALE_DATA'
          ? $localize`:@@lengine.sheet.stale:Someone changed this program while you were editing. Close the sheet and open it again.`
          : (problemText(body?.meta?.['problem']) ??
              this.errors.toLocalizedMessage(
                (body?.code ?? 'INTERNAL_ERROR') as ErrorCode,
                body?.meta,
              )),
      );
    } finally {
      this.saving.set(false);
    }
  }

  private conditionGroup(
    id: string,
    reasonCode: GateReasonCode,
    lines: {
      questionCode: string;
      criterion: ConditionBody['anyOf'][number]['criterion'] | null;
    }[],
  ): FormGroup<ConditionControls> {
    const anyOf = new FormArray<FormGroup<CriterionRowControls>>(
      (lines.length === 0 ? [{ questionCode: '', criterion: null }] : lines).map((l) =>
        this.lineGroup(l.questionCode, l.criterion),
      ),
    );
    return new FormGroup<ConditionControls>({
      id: new FormControl<string>(id, { nonNullable: true }),
      reasonCode: new FormControl<GateReasonCode>(reasonCode, { nonNullable: true }),
      anyOf,
    });
  }

  private lineGroup(
    questionCode: string,
    criterion: ConditionBody['anyOf'][number]['criterion'] | null,
  ): FormGroup<CriterionRowControls> {
    const line = new FormGroup<CriterionRowControls>({
      questionCode: new FormControl<string>(questionCode, { nonNullable: true }),
      criterion: criterionGroup(criterion),
    });
    // A new question means new options: the old criterion cannot describe it.
    line.controls.questionCode.valueChanges.subscribe((code) => this.questionPicked(line, code));
    return line;
  }

  private async loadOptions(code: string): Promise<LoanEngineOption[]> {
    if (code === '') return [];
    const known = this.optionsByQuestion()[code];
    if (known !== undefined) return known;
    const detail = await this.api.question(code);
    this.optionsByQuestion.update((m) => ({ ...m, [code]: detail.options }));
    return detail.options;
  }
}
