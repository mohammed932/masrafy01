import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { MoneyInputDirective } from '@core/directives/money-input.directive';
import type { QuestionType } from '../questionnaire/questionnaire.api.service';
import type { Criterion, LoanEngineOption, NumberOp } from './loan-engine.api.service';
import { NUMBER_OPS, opLabel, opTakesTwo } from './loan-engine.labels';

/**
 * Feature 013 — one answer criterion's fields, shaped by the question's type:
 * a NUMBER is an operator and one or two figures, a PICK is one of its options, and
 * free TEXT can only be "answered" (its words are never compared — they may hold PII).
 * Shared by the effect sheet and the conditions sheet, so a criterion reads the same in both.
 */
export interface CriterionControls {
  op: FormControl<NumberOp>;
  a: FormControl<string>;
  b: FormControl<string>;
  option: FormControl<string>;
}

export function criterionGroup(
  criterion: Criterion | null,
  fallbackOption = '',
): FormGroup<CriterionControls> {
  const op: NumberOp =
    criterion !== null && 'op' in criterion && criterion.op !== 'custom' ? criterion.op : 'gte';
  const a = criterion !== null && 'op' in criterion && criterion.op !== 'custom' ? criterion.a : '';
  const b =
    criterion !== null &&
    'op' in criterion &&
    (criterion.op === 'between' || criterion.op === 'range')
      ? criterion.b
      : '';
  const option = criterion !== null && 'option' in criterion ? criterion.option : fallbackOption;
  return new FormGroup<CriterionControls>({
    op: new FormControl<NumberOp>(op, { nonNullable: true }),
    a: new FormControl<string>(a, { nonNullable: true }),
    b: new FormControl<string>(b, { nonNullable: true }),
    option: new FormControl<string>(option, { nonNullable: true }),
  });
}

/** The form back into the API's criterion, for the question's type. */
export function criterionOf(group: FormGroup<CriterionControls>, type: QuestionType): Criterion {
  const v = group.getRawValue();
  if (type === 'TEXT') return { answered: true };
  if (type !== 'NUMERIC') return { option: v.option };
  return opTakesTwo(v.op)
    ? { op: v.op as 'between' | 'range', a: v.a.trim(), b: v.b.trim() }
    : { op: v.op as 'lt' | 'lte' | 'gte' | 'gt' | 'eq', a: v.a.trim() };
}

@Component({
  selector: 'app-criterion-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, NzInputModule, NzSelectModule, MoneyInputDirective],
  template: `
    @switch (kind()) {
      @case ('number') {
        <span class="cf">
          <nz-select
            class="cf__op"
            [formControl]="group().controls.op"
            [nzDisabled]="disabled()"
            [attr.aria-label]="opAria"
          >
            @for (op of ops; track op) {
              <nz-option [nzValue]="op" [nzLabel]="label(op)"></nz-option>
            }
          </nz-select>
          <input
            nz-input
            class="cf__num"
            appMoneyInput
            [appMoneyInput]="grouped()"
            inputmode="decimal"
            [formControl]="group().controls.a"
            [attr.aria-label]="aAria"
            [readonly]="disabled()"
          />
          @if (two()) {
            <span class="cf__dash" aria-hidden="true">–</span>
            <input
              nz-input
              class="cf__num"
              appMoneyInput
              [appMoneyInput]="grouped()"
              inputmode="decimal"
              [formControl]="group().controls.b"
              [attr.aria-label]="bAria"
              [readonly]="disabled()"
            />
          }
        </span>
      }
      @case ('pick') {
        @if (fixedOption()) {
          <span class="cf__fixed">{{ optionLabel(group().controls.option.value) }}</span>
        } @else {
          <nz-select
            class="cf__pick"
            [formControl]="group().controls.option"
            [nzDisabled]="disabled()"
            nzShowSearch
            [attr.aria-label]="optionAria"
          >
            @for (o of options(); track o.code) {
              <nz-option [nzValue]="o.code" [nzLabel]="optionLabel(o.code)"></nz-option>
            }
          </nz-select>
        }
      }
      @case ('text') {
        <span class="cf__fixed" i18n="@@lengine.crit.answered_long">Any answer given</span>
      }
    }
  `,
  styles: [
    `
      .cf {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        flex-wrap: wrap;
      }
      .cf__op {
        min-inline-size: 13rem;
      }
      .cf__num {
        inline-size: 9rem;
      }
      .cf__pick {
        min-inline-size: 14rem;
      }
      .cf__dash {
        color: var(--color-text-secondary);
      }
      .cf__fixed {
        color: var(--color-text-primary);
        font-weight: var(--font-weight-medium);
      }
    `,
  ],
})
export class CriterionFieldComponent {
  readonly group = input.required<FormGroup<CriterionControls>>();
  readonly type = input.required<QuestionType>();
  readonly options = input<LoanEngineOption[]>([]);
  /** A pick row whose option is fixed (the effect sheet: one row per option). */
  readonly fixedOption = input(false);
  readonly disabled = input(false);
  /** Group thousands — a money question's figures (A27). */
  readonly grouped = input(false);

  readonly ops = NUMBER_OPS;
  readonly opAria = $localize`:@@lengine.crit.op_aria:How the answer compares`;
  readonly aAria = $localize`:@@lengine.crit.a_aria:Figure`;
  readonly bAria = $localize`:@@lengine.crit.b_aria:Second figure`;
  readonly optionAria = $localize`:@@lengine.crit.option_aria:Answer`;

  private readonly isAr = document.documentElement.lang.startsWith('ar');

  readonly kind = computed<'number' | 'pick' | 'text'>(() => {
    const t = this.type();
    return t === 'NUMERIC' ? 'number' : t === 'TEXT' ? 'text' : 'pick';
  });

  /** Read on each check: a pick in the select above marks this OnPush view dirty. */
  two(): boolean {
    return opTakesTwo(this.group().controls.op.value);
  }

  label(op: NumberOp): string {
    return opLabel(op);
  }

  optionLabel(code: string): string {
    const o = this.options().find((x) => x.code === code);
    if (o === undefined) return code;
    return this.isAr ? o.labelAr : o.labelEn;
  }
}
