import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerRef, NZ_DRAWER_DATA } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { FormDrawerComponent, DrawerSectionComponent } from '@shared/ui';
import { MoneyInputDirective } from '@core/directives/money-input.directive';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode } from '@core/auth/auth.types';
import {
  LoanEngineApiService,
  type EffectRow,
  type LoanEngineEffect,
  type LoanEngineOption,
  type LoanEngineOverride,
  type LoanEngineProgramSlice,
  type LoanEngineQuestionDetail,
  type NoMatch,
} from './loan-engine.api.service';
import {
  CriterionFieldComponent,
  criterionGroup,
  criterionOf,
  type CriterionControls,
} from './criterion-field.component';
import { effectIsMoney, effectLabel, effectUnit, problemText } from './loan-engine.labels';
import { TryAnswerComponent, type TryOutcome } from './try-answer.component';

export interface EffectRowsSheetData {
  question: Omit<LoanEngineQuestionDetail, 'programs'>;
  program: LoanEngineProgramSlice;
  effect: LoanEngineEffect;
  /** sales_manager reads; only super_admin writes. */
  canEdit: boolean;
}

interface RowControls {
  criterion: FormGroup<CriterionControls>;
  value: FormControl<string>;
}

/**
 * Feature 013 — one program's rows for one effect of one question, as a side sheet.
 *
 * A NUMBER question is a list of bands the operator adds; a PICK question is one fixed row
 * per option (blank = this bank states nothing for it); TEXT is the one row "answered".
 * Extra income is one figure: the share of the stated amount this bank counts.
 */
@Component({
  selector: 'app-effect-rows-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    MoneyInputDirective,
    FormDrawerComponent,
    DrawerSectionComponent,
    CriterionFieldComponent,
    TryAnswerComponent,
  ],
  template: `
    <app-form-drawer
      [title]="title"
      [subtitle]="subtitle"
      [hint]="hint()"
      [submitLabel]="saveLabel"
      [submitDisabled]="!data.canEdit || form.invalid"
      [submitting]="saving()"
      (cancelled)="ref.close()"
      (submitted)="save()"
    >
      <span drawerIcon aria-hidden="true">≡</span>

      <app-drawer-section [label]="rowsLabel" [hint]="rowsHint">
        @if (data.effect === 'extra_income') {
          <label class="er__single">
            <span i18n="@@lengine.sheet.extra_label"
              >Share of the stated amount this bank counts</span
            >
            <span class="er__value">
              <input
                nz-input
                appMoneyInput
                [appMoneyInput]="false"
                inputmode="decimal"
                [formControl]="single"
                [readonly]="!data.canEdit"
              />
              <span class="er__unit">%</span>
            </span>
          </label>
        } @else {
          <ol class="er__rows">
            @for (row of rows.controls; track row; let i = $index) {
              <li class="er__row" [class.er__row--bad]="badRow() === i">
                <span class="er__n" aria-hidden="true">{{ i + 1 }}</span>
                <app-criterion-field
                  [group]="row.controls.criterion"
                  [type]="data.question.type"
                  [options]="options"
                  [fixedOption]="isPick"
                  [disabled]="!data.canEdit"
                  [grouped]="false"
                />
                <span class="er__arrow" aria-hidden="true">→</span>
                <span class="er__value">
                  <input
                    nz-input
                    appMoneyInput
                    [appMoneyInput]="money"
                    inputmode="decimal"
                    [formControl]="row.controls.value"
                    [attr.aria-label]="valueAria(i)"
                    [placeholder]="isPick ? blankLabel : ''"
                    [readonly]="!data.canEdit"
                  />
                  <span class="er__unit">{{ unit }}</span>
                </span>
                @if (data.canEdit && !isPick && data.question.type !== 'TEXT') {
                  <button
                    nz-button
                    nzType="text"
                    type="button"
                    class="er__remove"
                    [attr.aria-label]="removeAria(i)"
                    (click)="remove(i)"
                  >
                    ×
                  </button>
                }
              </li>
            }
          </ol>
          @if (data.canEdit && data.question.type === 'NUMERIC') {
            <button
              nz-button
              nzType="dashed"
              type="button"
              (click)="add()"
              i18n="@@lengine.sheet.add_row"
            >
              Add a band
            </button>
          }
          @if (overlap()) {
            <p class="er__warn" role="status" i18n="@@lengine.sheet.overlap">
              Two bands overlap. The first one in this list wins where they do.
            </p>
          }
          @if (data.question.type === 'MULTI_SELECT') {
            <p class="er__note" i18n="@@lengine.sheet.multi_note">
              An applicant who picks several answers gets the figure of the first one in this list.
            </p>
          }
        }
      </app-drawer-section>

      @if (data.effect !== 'extra_income') {
        <app-drawer-section [label]="noMatchLabel">
          <nz-select class="er__nomatch" [formControl]="onNoMatch" [nzDisabled]="!data.canEdit">
            @for (o of noMatchOptions; track o.value) {
              <nz-option [nzValue]="o.value" [nzLabel]="o.label"></nz-option>
            }
          </nz-select>
        </app-drawer-section>
      }

      <app-drawer-section [label]="tryLabel" [hint]="tryHint">
        <app-try-answer
          [question]="data.question"
          [category]="data.program.category"
          [programCode]="data.program.programCode"
          [draft]="draft()"
        />
      </app-drawer-section>

      @if (error(); as e) {
        <p class="er__error" role="alert">{{ e }}</p>
      }
    </app-form-drawer>
  `,
  styles: [
    `
      .er__rows {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: var(--space-2);
      }
      .er__row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-2);
        padding: var(--space-2);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        background: var(--color-surface-default);
      }
      .er__row--bad {
        border-color: var(--color-error);
      }
      .er__n {
        min-inline-size: 1.5rem;
        color: var(--color-text-tertiary);
        font-variant-numeric: tabular-nums;
      }
      .er__arrow {
        color: var(--color-text-tertiary);
      }
      :host-context([dir='rtl']) .er__arrow {
        transform: scaleX(-1);
      }
      .er__value {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
      }
      .er__value input {
        inline-size: 8rem;
      }
      .er__unit {
        color: var(--color-text-secondary);
      }
      .er__remove {
        margin-inline-start: auto;
      }
      .er__single {
        display: grid;
        gap: var(--space-2);
      }
      .er__nomatch {
        inline-size: 100%;
      }
      .er__warn,
      .er__note {
        margin: var(--space-2) 0 0;
        color: var(--color-text-secondary);
      }
      .er__warn {
        color: var(--color-warning);
      }
      .er__error {
        margin: var(--space-3) var(--space-5);
        color: var(--color-error);
      }
    `,
  ],
})
export class EffectRowsSheetComponent {
  readonly data = inject<EffectRowsSheetData>(NZ_DRAWER_DATA);
  readonly ref = inject<NzDrawerRef<EffectRowsSheetComponent, LoanEngineProgramSlice>>(NzDrawerRef);
  private readonly api = inject(LoanEngineApiService);
  private readonly errors = inject(ErrorCodeService);
  private readonly isAr = document.documentElement.lang.startsWith('ar');

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly badRow = signal<number | null>(null);

  readonly isPick =
    this.data.question.type === 'SINGLE_SELECT' || this.data.question.type === 'MULTI_SELECT';
  readonly options: LoanEngineOption[] = this.data.question.options;
  readonly money = effectIsMoney(this.data.effect);
  readonly unit = effectUnit(this.data.effect);
  private readonly state = this.data.program.effects[this.data.effect];

  readonly title = `${effectLabel(this.data.effect)} · ${this.questionLabel()}`;
  readonly subtitle = `${this.data.program.bankName} — ${this.data.program.friendlyName}`;
  readonly saveLabel = $localize`:@@lengine.sheet.save:Save rows`;
  readonly rowsLabel = $localize`:@@lengine.sheet.rows:This bank's figure for each answer`;
  readonly rowsHint = this.isPick
    ? $localize`:@@lengine.sheet.rows_hint_pick:Leave an answer blank when this bank states nothing for it.`
    : $localize`:@@lengine.sheet.rows_hint:Each row is one band of answers and the figure the bank gives it.`;
  readonly noMatchLabel = $localize`:@@lengine.sheet.nomatch:When no row matches the answer`;
  readonly tryLabel = $localize`:@@lengine.sheet.try:Try an answer`;
  readonly tryHint = $localize`:@@lengine.sheet.try_hint:Prices a sample applicant with these rows before you save. Nothing is written.`;
  readonly blankLabel = $localize`:@@lengine.sheet.blank:no figure`;

  readonly noMatchOptions: { value: NoMatch; label: string }[] =
    this.data.effect === 'cap'
      ? [
          {
            value: 'useProgramMax',
            label: $localize`:@@lengine.nm.program_max:Use the program's own cap`,
          },
          { value: 'reject', label: $localize`:@@lengine.nm.reject:Refuse the quote` },
        ]
      : [
          {
            value: 'useFallback',
            label: $localize`:@@lengine.nm.fallback:Use the program's own figure`,
          },
          { value: 'reject', label: $localize`:@@lengine.nm.reject:Refuse the quote` },
        ];

  readonly onNoMatch = new FormControl<NoMatch>(
    this.state.onNoMatch ?? (this.data.effect === 'cap' ? 'useProgramMax' : 'useFallback'),
    { nonNullable: true },
  );
  readonly single = new FormControl<string>(this.state.rows[0]?.value ?? '', { nonNullable: true });
  readonly rows = new FormArray<FormGroup<RowControls>>(this.initialRows());
  readonly form = new FormGroup({
    rows: this.rows,
    onNoMatch: this.onNoMatch,
    single: this.single,
  });

  /** The form, as the PUT / simulate override would carry it — recomputed on every edit. */
  private readonly version = signal(0);
  readonly draft = computed<LoanEngineOverride>(() => {
    this.version();
    return {
      programCode: this.data.program.programCode,
      target: this.data.effect,
      questionCode: this.data.question.questionCode,
      rows: this.bodyRows(),
      ...(this.data.effect === 'extra_income' ? {} : { onNoMatch: this.onNoMatch.value }),
    };
  });

  readonly overlap = computed(() => {
    this.version();
    if (this.data.question.type !== 'NUMERIC') return false;
    const spans = this.bodyRows()
      .map((r) => spanOf(r.criterion))
      .filter((s): s is Span => s !== null);
    for (let i = 0; i < spans.length; i++) {
      for (let j = i + 1; j < spans.length; j++) {
        if (overlaps(spans[i] as Span, spans[j] as Span)) return true;
      }
    }
    return false;
  });

  readonly hint = computed(() =>
    this.data.canEdit
      ? null
      : $localize`:@@lengine.sheet.readonly:Read only — your role can view rules but not change them.`,
  );

  constructor() {
    this.form.valueChanges.subscribe(() => this.version.update((v) => v + 1));
  }

  add(): void {
    this.rows.push(this.rowGroup(null, ''));
  }

  remove(i: number): void {
    this.rows.removeAt(i);
  }

  valueAria(i: number): string {
    return $localize`:@@lengine.sheet.value_aria:Figure for row ${i + 1}:n:`;
  }

  removeAria(i: number): string {
    return $localize`:@@lengine.sheet.remove_aria:Remove row ${i + 1}:n:`;
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    this.badRow.set(null);
    try {
      const res = await this.api.putEffect(
        this.data.question.questionCode,
        this.data.program.programCode,
        this.data.effect,
        {
          expectedVersion: this.data.program.version,
          rows: this.bodyRows(),
          ...(this.data.effect === 'extra_income' ? {} : { onNoMatch: this.onNoMatch.value }),
        },
      );
      this.ref.close(res.program);
    } catch (err) {
      this.showError(err);
    } finally {
      this.saving.set(false);
    }
  }

  private showError(err: unknown): void {
    const body =
      err instanceof HttpErrorResponse
        ? (err.error as { code?: string; meta?: Record<string, unknown> })
        : null;
    const code = body?.code ?? 'INTERNAL_ERROR';
    const problem = problemText(body?.meta?.['problem']);
    const row = body?.meta?.['row'];
    if (typeof row === 'number') this.badRow.set(row);
    if (code === 'CONFLICT_STALE_DATA') {
      this.error.set(
        $localize`:@@lengine.sheet.stale:Someone changed this program while you were editing. Close the sheet and open it again.`,
      );
      return;
    }
    this.error.set(problem ?? this.errors.toLocalizedMessage(code as ErrorCode, body?.meta));
  }

  /** The rows the API takes: pick rows with no figure are left out. */
  private bodyRows(): EffectRow[] {
    if (this.data.effect === 'extra_income') {
      const v = this.single.value.trim();
      return v === '' ? [] : [{ criterion: null, value: v }];
    }
    return this.rows.controls
      .map((g) => ({
        criterion: criterionOf(g.controls.criterion, this.data.question.type),
        value: g.controls.value.value.trim(),
      }))
      .filter((r) => r.value !== '');
  }

  private initialRows(): FormGroup<RowControls>[] {
    if (this.data.effect === 'extra_income') return [];
    if (this.isPick) {
      // One fixed row per option, in the question's order — the order "first match wins" reads.
      return this.options.map((o) => {
        const stored = this.state.rows.find(
          (r) => r.criterion !== null && 'option' in r.criterion && r.criterion.option === o.code,
        );
        return this.rowGroup({ option: o.code }, stored?.value ?? '');
      });
    }
    if (this.data.question.type === 'TEXT') {
      return [this.rowGroup({ answered: true }, this.state.rows[0]?.value ?? '')];
    }
    return this.state.rows.length === 0
      ? [this.rowGroup(null, '')]
      : this.state.rows.map((r) => this.rowGroup(r.criterion, r.value));
  }

  private rowGroup(criterion: EffectRow['criterion'], value: string): FormGroup<RowControls> {
    return new FormGroup<RowControls>({
      criterion: criterionGroup(criterion),
      value: new FormControl<string>(value, { nonNullable: true }),
    });
  }

  private questionLabel(): string {
    return this.isAr ? this.data.question.labelAr : this.data.question.labelEn;
  }
}

interface Span {
  lo: number;
  loIn: boolean;
  hi: number;
  hiIn: boolean;
}

function spanOf(c: EffectRow['criterion']): Span | null {
  if (c === null || !('op' in c) || c.op === 'custom') return null;
  const a = Number(c.a);
  const b = 'b' in c ? Number(c.b) : NaN;
  if (!Number.isFinite(a)) return null;
  switch (c.op) {
    case 'lt':
      return { lo: -Infinity, loIn: false, hi: a, hiIn: false };
    case 'lte':
      return { lo: -Infinity, loIn: false, hi: a, hiIn: true };
    case 'gte':
      return { lo: a, loIn: true, hi: Infinity, hiIn: false };
    case 'gt':
      return { lo: a, loIn: false, hi: Infinity, hiIn: false };
    case 'eq':
      return { lo: a, loIn: true, hi: a, hiIn: true };
    case 'between':
      return Number.isFinite(b) ? { lo: a, loIn: true, hi: b, hiIn: true } : null;
    case 'range':
      return Number.isFinite(b) ? { lo: a, loIn: true, hi: b, hiIn: false } : null;
  }
}

function overlaps(x: Span, y: Span): boolean {
  const [first, second] = x.lo < y.lo || (x.lo === y.lo && x.loIn) ? [x, y] : [y, x];
  if (first.hi > second.lo) return true;
  return first.hi === second.lo && first.hiIn && second.loIn;
}

export type { TryOutcome };
