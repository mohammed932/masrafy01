/**
 * Author ONE thing a surrogate product asks about — the list, the question and the fact, in
 * one pass.
 *
 * WHY IT IS ONE DIALOG AND NOT THREE SCREENS. What a no-payslip product reads is three rows in
 * three tables that are only correct together:
 *
 *   · a LIST     (`enumeration_type_def` + its `platform_enumeration` values) — the answers
 *   · a QUESTION (`question` + `question_option`)                             — the wording
 *   · a FACT     (`platform_enumeration` of type `surrogate_fact`)            — the join, and
 *                                                                               what a bank's
 *                                                                               table is keyed
 *                                                                               by
 *
 * Made separately they line up only if `question_option.code` happens to equal
 * `platform_enumeration.key` — which the ordinary create cannot arrange, because it mints a
 * code by slugging a label. Before this, only a seed script could produce the combination,
 * which is why adding a no-payslip product was a release. The server closes the gap with
 * `optionsFromEnumerationType`; this is the screen that uses it.
 *
 * NOT ATOMIC, and it says so as it goes. Four tables across two feature modules cannot be one
 * request without a composite endpoint that would have to re-validate both halves; what the
 * flow does instead is order the writes so that a failure leaves something an operator can
 * finish rather than something they have to unpick — list, then values, then question (which
 * mints the options from the values), then fact. Break after step two and you have an empty
 * list on the product's own page. Break after step three and you have a question that works,
 * with a "connect it" action still to run.
 *
 * A CLASS LIST IS OPTIONAL AND ASKED UP FRONT. A value of a filed-under kind is born filed —
 * `resolveParentKey` refuses a create with no parent — so the class cannot be added later by
 * the board; the board only MOVES what is already filed. The dialog therefore writes the class
 * list first and every value names its class.
 */
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { DeleteOutline, PlusOutline } from '@ant-design/icons-angular/icons';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzModalRef, NZ_MODAL_DATA } from 'ng-zorro-antd/modal';
import { LOAN_CATEGORIES, categoryLabel, type LoanCategory } from '@core/loan-category';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode } from '@core/auth/auth.types';
import { LookupsApiService } from '@features/lookups/lookups.api.service';
import { QuestionnaireApiService } from '@features/questionnaire/questionnaire.api.service';
import { EnumerationTypesService } from './enumeration-types.service';
import { uniqueSlug } from './slug';

export interface ProductFactDialogData {
  /** The product authoring this. Stamped on the list and on the fact as provenance. */
  productKey: string;
  productLabel: string;
}

export interface ProductFactResult {
  /** The fact's key — the question code, since a fact and its question are one concept. */
  factKey: string;
  /** Every list this run created, so the caller can re-read the registry once. */
  listTypes: string[];
}

type LabelPair = FormGroup<{ labelEn: FormControl<string>; labelAr: FormControl<string> }>;
type ValueRow = FormGroup<{
  labelEn: FormControl<string>;
  labelAr: FormControl<string>;
  /** Index into the class array, or `-1` when the list is not grouped. */
  classIndex: FormControl<number>;
}>;

const FACT_TYPE = 'surrogate_fact';

@Component({
  selector: 'app-product-fact-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, NzButtonModule, NzIconModule, NzInputModule, NzSelectModule],
  providers: [provideNzIconsPatch([DeleteOutline, PlusOutline])],
  template: `
    <form [formGroup]="form" class="wrap">
      <fieldset class="block">
        <legend i18n="@@pfd.kind.legend">What kind of answer is it?</legend>
        <div class="kinds" role="radiogroup" [attr.aria-label]="kindAria">
          <button
            type="button"
            class="kind"
            role="radio"
            [attr.aria-checked]="kind() === 'choice'"
            [class.is-on]="kind() === 'choice'"
            (click)="setKind('choice')"
          >
            <span class="kind-title" i18n="@@pfd.kind.choice">One of a list</span>
            <span class="kind-note" i18n="@@pfd.kind.choice_note"
              >The applicant picks a name. A bank prices one row per name — or per class, if you
              group them.</span
            >
          </button>
          <button
            type="button"
            class="kind"
            role="radio"
            [attr.aria-checked]="kind() === 'number'"
            [class.is-on]="kind() === 'number'"
            (click)="setKind('number')"
          >
            <span class="kind-title" i18n="@@pfd.kind.number">A number</span>
            <span class="kind-note" i18n="@@pfd.kind.number_note"
              >The applicant types a figure. A bank prices it in bands.</span
            >
          </button>
        </div>
      </fieldset>

      <fieldset class="block">
        <legend i18n="@@pfd.q.legend">What the applicant is asked</legend>
        <label class="field">
          <span class="lbl" i18n="@@pfd.q.en">Question (English)</span>
          <input nz-input formControlName="questionEn" [placeholder]="qPlaceholderEn()" />
        </label>
        <label class="field">
          <span class="lbl" i18n="@@pfd.q.ar">Question (Arabic)</span>
          <input nz-input formControlName="questionAr" dir="rtl" [placeholder]="qPlaceholderAr()" />
        </label>
        <label class="field">
          <span class="lbl" i18n="@@pfd.q.help_en"
            >Hint under the question (English, optional)</span
          >
          <input nz-input formControlName="helperEn" />
        </label>
        <label class="field">
          <span class="lbl" i18n="@@pfd.q.help_ar">Hint under the question (Arabic, optional)</span>
          <input nz-input formControlName="helperAr" dir="rtl" />
        </label>

        <!-- A DIV, not a label: nz-select renders no form element a "for" can point at, so
             wrapping it in a label associates the text with nothing and a screen reader
             announces the control unnamed. aria-labelledby names it for real. -->
        <div class="field">
          <span class="lbl" id="pfd-cats" i18n="@@pfd.q.categories">Asked of applicants for</span>
          <nz-select
            formControlName="categories"
            nzMode="multiple"
            aria-labelledby="pfd-cats"
            [nzPlaceHolder]="categoriesPlaceholder"
          >
            @for (c of allCategories; track c) {
              <nz-option [nzValue]="c" [nzLabel]="categoryName(c)" />
            }
          </nz-select>
        </div>
        <p class="hint" i18n="@@pfd.q.categories_hint">
          A question assigned to nothing is asked by nobody, so the product can never quote.
        </p>

        <label class="check">
          <input type="checkbox" formControlName="isRequired" />
          <span i18n="@@pfd.q.required">Everyone must answer it</span>
        </label>
        <p class="hint" i18n="@@pfd.q.required_hint">
          Left off, an applicant who skips it sees this product listed with a stated reason and no
          figures — which is usually kinder than blocking the whole application.
        </p>
      </fieldset>

      @if (kind() === 'choice') {
        <fieldset class="block">
          <legend i18n="@@pfd.list.legend">The list of answers</legend>
          <label class="field">
            <span class="lbl" i18n="@@pfd.list.en">List name (English)</span>
            <input nz-input formControlName="listEn" [placeholder]="listPlaceholderEn" />
          </label>
          <label class="field">
            <span class="lbl" i18n="@@pfd.list.ar">List name (Arabic)</span>
            <input nz-input formControlName="listAr" dir="rtl" />
          </label>
          <p class="hint" i18n="@@pfd.list.hint">
            This list belongs to {{ data.productLabel }} and is edited on its page, not under Manage
            values.
          </p>

          <label class="check">
            <input type="checkbox" formControlName="grouped" (change)="onGroupedChange()" />
            <span i18n="@@pfd.list.grouped">Group these into classes a bank prices by</span>
          </label>
          <p class="hint" i18n="@@pfd.list.grouped_hint">
            Use this when there are more answers than any bank would price one by one. The bank
            fills one figure per class; the applicant still picks a name.
          </p>

          @if (grouped()) {
            <div class="rows" formArrayName="classes">
              <p class="rows-title" i18n="@@pfd.class.title">The classes</p>
              @for (row of classes.controls; track $index; let i = $index) {
                <div class="row" [formGroupName]="i">
                  <input nz-input formControlName="labelEn" [placeholder]="classPlaceholderEn" />
                  <input
                    nz-input
                    formControlName="labelAr"
                    dir="rtl"
                    [placeholder]="arPlaceholder"
                  />
                  <button
                    type="button"
                    class="icon"
                    [disabled]="classes.length <= 1"
                    [attr.aria-label]="removeClassAria"
                    (click)="removeClass(i)"
                  >
                    <span nz-icon nzType="delete" nzTheme="outline"></span>
                  </button>
                </div>
              }
              <button type="button" class="linkish" (click)="addClass()">
                <span nz-icon nzType="plus" nzTheme="outline"></span>
                <span i18n="@@pfd.class.add">Add a class</span>
              </button>
            </div>
          }

          <div class="rows" formArrayName="values">
            <p class="rows-title" i18n="@@pfd.value.title">The answers</p>
            @for (row of values.controls; track $index; let i = $index) {
              <div class="row" [formGroupName]="i">
                <input nz-input formControlName="labelEn" [placeholder]="valuePlaceholderEn" />
                <input nz-input formControlName="labelAr" dir="rtl" [placeholder]="arPlaceholder" />
                @if (grouped()) {
                  <nz-select formControlName="classIndex" [nzPlaceHolder]="classPlaceholder">
                    @for (c of classNames(); track c.index) {
                      <nz-option [nzValue]="c.index" [nzLabel]="c.label" />
                    }
                  </nz-select>
                }
                <button
                  type="button"
                  class="icon"
                  [disabled]="values.length <= 2"
                  [attr.aria-label]="removeValueAria"
                  (click)="removeValue(i)"
                >
                  <span nz-icon nzType="delete" nzTheme="outline"></span>
                </button>
              </div>
            }
            <button type="button" class="linkish" (click)="addValue()">
              <span nz-icon nzType="plus" nzTheme="outline"></span>
              <span i18n="@@pfd.value.add">Add an answer</span>
            </button>
          </div>
          <p class="hint" i18n="@@pfd.value.hint">
            At least two. You can add more later on the product's page — they reach the
            questionnaire straight away.
          </p>
        </fieldset>
      } @else {
        <fieldset class="block">
          <legend i18n="@@pfd.num.legend">What the figure may be</legend>
          <div class="row three">
            <label class="field">
              <span class="lbl" i18n="@@pfd.num.min">Lowest</span>
              <input nz-input formControlName="minValue" inputmode="decimal" />
            </label>
            <label class="field">
              <span class="lbl" i18n="@@pfd.num.max">Highest</span>
              <input nz-input formControlName="maxValue" inputmode="decimal" />
            </label>
            <label class="field">
              <span class="lbl" i18n="@@pfd.num.step">Steps of</span>
              <input nz-input formControlName="step" inputmode="decimal" />
            </label>
          </div>
          <div class="row">
            <label class="field">
              <span class="lbl" i18n="@@pfd.num.unit_en">Unit (English)</span>
              <input nz-input formControlName="unitEn" [placeholder]="unitPlaceholder" />
            </label>
            <label class="field">
              <span class="lbl" i18n="@@pfd.num.unit_ar">Unit (Arabic)</span>
              <input nz-input formControlName="unitAr" dir="rtl" />
            </label>
          </div>
        </fieldset>
      }

      @if (progress(); as step) {
        <p class="notice" role="status">{{ step }}</p>
      }
      @if (errorMessage(); as message) {
        <p class="notice is-bad" role="alert">{{ message }}</p>
      }

      <footer class="foot">
        <button nz-button type="button" (click)="cancel()" i18n="@@common.cancel">Cancel</button>
        <button
          nz-button
          nzType="primary"
          type="button"
          [disabled]="form.invalid || submitting()"
          [nzLoading]="submitting()"
          (click)="save()"
        >
          <span i18n="@@pfd.save">Add it</span>
        </button>
      </footer>
    </form>
  `,
  styles: [
    `
      .wrap {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
      }
      .block {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-lg);
        padding: var(--space-4);
        margin: 0;
      }
      legend {
        font-weight: var(--font-semibold);
        padding-inline: var(--space-2);
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .lbl {
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }
      .hint {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--text-tertiary);
        line-height: 1.5;
      }
      .kinds {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
        gap: var(--space-3);
      }
      .kind {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        text-align: start;
        padding: var(--space-3);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-lg);
        background: var(--bg-surface);
        cursor: pointer;
      }
      .kind.is-on {
        border-color: var(--primary);
        background: color-mix(in srgb, var(--primary) 8%, var(--bg-surface));
      }
      .kind-title {
        font-weight: var(--font-semibold);
      }
      .kind-note {
        font-size: var(--text-sm);
        color: var(--text-tertiary);
        line-height: 1.5;
      }
      .check {
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }
      .rows {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .rows-title {
        margin: 0;
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--text-secondary);
      }
      .row {
        display: grid;
        grid-template-columns: 1fr 1fr auto;
        gap: var(--space-2);
        align-items: center;
      }
      .row.three {
        grid-template-columns: repeat(3, 1fr);
      }
      .icon {
        border: 0;
        background: transparent;
        color: var(--error);
        cursor: pointer;
        padding: var(--space-1);
      }
      .icon:disabled {
        color: var(--text-tertiary);
        cursor: not-allowed;
      }
      .linkish {
        align-self: flex-start;
        border: 0;
        background: transparent;
        color: var(--primary);
        cursor: pointer;
        padding: 0;
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
      }
      .notice {
        margin: 0;
        padding: var(--space-3);
        border-radius: var(--radius-lg);
        background: var(--bg-subtle);
        font-size: var(--text-sm);
      }
      .notice.is-bad {
        background: color-mix(in srgb, var(--error) 10%, var(--bg-surface));
        color: var(--error);
      }
      .foot {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-2);
      }
    `,
  ],
})
export class ProductFactDialogComponent {
  protected readonly data = inject<ProductFactDialogData>(NZ_MODAL_DATA);
  private readonly modal = inject(NzModalRef<ProductFactDialogComponent, ProductFactResult>);
  private readonly fb = inject(FormBuilder);
  private readonly lookups = inject(LookupsApiService);
  private readonly questions = inject(QuestionnaireApiService);
  private readonly enumTypes = inject(EnumerationTypesService);
  private readonly errors = inject(ErrorCodeService);

  protected readonly allCategories = LOAN_CATEGORIES;
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  /** Named so a partial failure says which of the four writes got there. */
  protected readonly progress = signal<string | null>(null);

  protected readonly kindAria = $localize`:@@pfd.kind.aria:What kind of answer`;
  // Per kind: a compound example over a Lowest/Highest/Unit form reads as the wrong branch.
  private readonly qPhChoiceEn = $localize`:@@pfd.q.ph_en:e.g. Which compound is the unit in?`;
  private readonly qPhChoiceAr = $localize`:@@pfd.q.ph_ar:مثال: الوحدة في أي كومباوند؟`;
  private readonly qPhNumberEn = $localize`:@@pfd.q.ph_num_en:e.g. What is the car worth?`;
  private readonly qPhNumberAr = $localize`:@@pfd.q.ph_num_ar:مثال: كم قيمة السيارة؟`;
  protected readonly listPlaceholderEn = $localize`:@@pfd.list.ph_en:e.g. Compounds`;
  protected readonly classPlaceholderEn = $localize`:@@pfd.class.ph_en:e.g. Class A`;
  protected readonly valuePlaceholderEn = $localize`:@@pfd.value.ph_en:e.g. Mivida`;
  protected readonly arPlaceholder = $localize`:@@pfd.ph_ar:بالعربية`;
  protected readonly classPlaceholder = $localize`:@@pfd.class.pick:Class`;
  protected readonly categoriesPlaceholder = $localize`:@@pfd.q.categories_ph:Pick at least one`;
  protected readonly unitPlaceholder = $localize`:@@pfd.num.unit_ph:e.g. EGP`;
  protected readonly removeClassAria = $localize`:@@pfd.class.remove:Remove this class`;
  protected readonly removeValueAria = $localize`:@@pfd.value.remove:Remove this answer`;

  protected readonly form = this.fb.nonNullable.group({
    kind: this.fb.nonNullable.control<'choice' | 'number'>('choice'),
    questionEn: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(500)]),
    questionAr: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(500)]),
    helperEn: this.fb.nonNullable.control(''),
    helperAr: this.fb.nonNullable.control(''),
    isRequired: this.fb.nonNullable.control(false),
    categories: this.fb.nonNullable.control<LoanCategory[]>(
      ['personal'],
      [Validators.required, Validators.minLength(1)],
    ),
    listEn: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(160)]),
    listAr: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(160)]),
    grouped: this.fb.nonNullable.control(false),
    classes: this.fb.array<LabelPair>([this.labelPair(), this.labelPair()]),
    values: this.fb.array<ValueRow>([this.valueRow(), this.valueRow()]),
    minValue: this.fb.nonNullable.control('0'),
    maxValue: this.fb.nonNullable.control(''),
    step: this.fb.nonNullable.control('1'),
    unitEn: this.fb.nonNullable.control(''),
    unitAr: this.fb.nonNullable.control(''),
  });

  protected get classes(): FormArray<LabelPair> {
    return this.form.controls.classes;
  }
  protected get values(): FormArray<ValueRow> {
    return this.form.controls.values;
  }

  // Read straight off the form rather than mirrored into signals: these ARE form state, and a
  // second copy is a second thing to keep in step for no reader that needs one (A11's reason,
  // if not its letter). Change detection runs on the events that move them.
  protected kind(): 'choice' | 'number' {
    return this.form.controls.kind.value;
  }

  protected qPlaceholderEn(): string {
    return this.kind() === 'choice' ? this.qPhChoiceEn : this.qPhNumberEn;
  }

  protected qPlaceholderAr(): string {
    return this.kind() === 'choice' ? this.qPhChoiceAr : this.qPhNumberAr;
  }

  protected grouped(): boolean {
    return this.form.controls.grouped.value;
  }

  /** The class picker's options. Index-based: the keys are not minted until save. */
  protected classNames(): { index: number; label: string }[] {
    return this.classes.controls.map((row, index) => {
      const typed = row.controls.labelEn.value.trim();
      return {
        index,
        label: typed === '' ? this.unnamedClass(index + 1) : typed,
      };
    });
  }

  private unnamedClass(n: number): string {
    return $localize`:@@pfd.class.unnamed:Class ${n}:index:`;
  }

  protected categoryName(c: LoanCategory): string {
    return categoryLabel(c);
  }

  protected setKind(kind: 'choice' | 'number'): void {
    this.form.controls.kind.setValue(kind);
    this.syncEnabledBranches();
  }

  protected onGroupedChange(): void {
    this.syncEnabledBranches();
  }

  /**
   * Enable exactly the controls that are on screen, and DISABLE the rest.
   *
   * Not cosmetic — without it the dialog cannot be submitted at all, on either branch. Angular
   * validates every control in the group whether or not a template renders it, so the two
   * required labels on each of the `values` rows kept the form invalid while the operator was
   * filling in a NUMBER, and the `classes` rows did the same whenever grouping was off. The
   * Save button reads `form.invalid`, so both states were a permanently dead button with
   * nothing on screen to explain it.
   *
   * `disable()` rather than clearing validators one control at a time: a disabled control is
   * out of validity AND out of `value`, so there is one rule here rather than a rule here and
   * a matching set of `if`s in `save()`. `getRawValue()` still reads them, which is why the
   * submit path is unchanged.
   */
  private syncEnabledBranches(): void {
    const choice = this.form.controls.kind.value === 'choice';
    const grouped = choice && this.form.controls.grouped.value;
    const opts = { emitEvent: false } as const;

    for (const c of [
      this.form.controls.listEn,
      this.form.controls.listAr,
      this.form.controls.grouped,
      this.form.controls.values,
    ]) {
      if (choice) c.enable(opts);
      else c.disable(opts);
    }
    if (grouped) this.form.controls.classes.enable(opts);
    else this.form.controls.classes.disable(opts);

    for (const c of [
      this.form.controls.minValue,
      this.form.controls.maxValue,
      this.form.controls.step,
      this.form.controls.unitEn,
      this.form.controls.unitAr,
    ]) {
      if (choice) c.disable(opts);
      else c.enable(opts);
    }
  }

  constructor() {
    // The form is born on the CHOICE branch with grouping off, so the numeric block and the
    // class rows have to start disabled or the button is dead before the operator types.
    this.syncEnabledBranches();
  }

  protected addClass(): void {
    this.classes.push(this.labelPair());
  }
  protected removeClass(index: number): void {
    if (this.classes.length > 1) this.classes.removeAt(index);
  }
  protected addValue(): void {
    this.values.push(this.valueRow());
  }
  protected removeValue(index: number): void {
    if (this.values.length > 2) this.values.removeAt(index);
  }

  protected cancel(): void {
    this.modal.close(undefined);
  }

  /**
   * Four writes, in the only order that works.
   *
   * The class list before the answers (a value of a filed-under kind is born filed), the
   * answers before the question (the question mints its options FROM them), the question
   * before the fact (the fact is bound to it by code). Every step names itself in
   * `progress`, so a failure halfway says where it stopped rather than leaving the operator
   * to guess which half exists.
   */
  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.errorMessage.set(null);
    this.submitting.set(true);
    const created: string[] = [];
    try {
      const v = this.form.getRawValue();
      const isChoice = v.kind === 'choice';
      let listType: string | null = null;

      if (isChoice) {
        const taken = new Set(this.enumTypes.definitions().map((d) => d.key));

        let parentType: string | null = null;
        if (v.grouped) {
          this.progress.set($localize`:@@pfd.step.classes:Creating the classes…`);
          parentType = uniqueSlug(`${v.listEn} class`, taken);
          taken.add(parentType);
          await this.lookups.createType({
            key: parentType,
            labelEn: $localize`:@@pfd.class.list_name:${v.listEn}:list: classes`,
            labelAr: v.listAr,
            onValuesRail: false,
            surrogateProductKey: this.data.productKey,
          });
          created.push(parentType);
          const classKeys = new Set<string>();
          for (const [index, row] of this.classes.controls.entries()) {
            const key = uniqueSlug(row.controls.labelEn.value, classKeys);
            classKeys.add(key);
            await this.lookups.create({
              type: parentType,
              key,
              labelEn: row.controls.labelEn.value,
              labelAr: row.controls.labelAr.value,
              sortOrder: index,
            });
            this.classKeyByIndex.set(index, key);
          }
        }

        this.progress.set($localize`:@@pfd.step.list:Creating the list…`);
        listType = uniqueSlug(v.listEn, taken);
        await this.lookups.createType({
          key: listType,
          labelEn: v.listEn,
          labelAr: v.listAr,
          onValuesRail: false,
          surrogateProductKey: this.data.productKey,
          ...(parentType !== null ? { parentTypeKey: parentType } : {}),
        });
        created.push(listType);

        this.progress.set($localize`:@@pfd.step.values:Adding the answers…`);
        const valueKeys = new Set<string>();
        for (const [index, row] of this.values.controls.entries()) {
          const key = uniqueSlug(row.controls.labelEn.value, valueKeys);
          valueKeys.add(key);
          const classKey =
            parentType === null
              ? null
              : (this.classKeyByIndex.get(row.controls.classIndex.value) ?? null);
          await this.lookups.create({
            type: listType,
            key,
            labelEn: row.controls.labelEn.value,
            labelAr: row.controls.labelAr.value,
            sortOrder: index,
            ...(classKey !== null ? { parentKey: classKey } : {}),
          });
        }
      }

      this.progress.set($localize`:@@pfd.step.question:Writing the question…`);
      const question = await this.questions.createQuestionWithOptions({
        questionEn: v.questionEn,
        questionAr: v.questionAr,
        ...(v.helperEn !== '' ? { helperTextEn: v.helperEn } : {}),
        ...(v.helperAr !== '' ? { helperTextAr: v.helperAr } : {}),
        isRequired: v.isRequired,
        categories: v.categories,
        type: isChoice ? 'SINGLE_SELECT' : 'NUMERIC',
        ...(isChoice
          ? { optionsFromEnumerationType: listType ?? '' }
          : {
              numeric: {
                minValue: v.minValue || '0',
                ...(v.maxValue !== '' ? { maxValue: v.maxValue } : {}),
                ...(v.step !== '' ? { step: v.step } : {}),
                ...(v.unitEn !== '' ? { unitEn: v.unitEn } : {}),
                ...(v.unitAr !== '' ? { unitAr: v.unitAr } : {}),
              },
            }),
      });

      this.progress.set($localize`:@@pfd.step.fact:Connecting it to the calculation…`);
      // The fact's key IS the question code: a fact and its question are one concept, and a
      // second naming scheme would be a translation layer to keep in step.
      const fact = await this.lookups.create({
        type: FACT_TYPE,
        key: question.code,
        labelEn: v.questionEn,
        labelAr: v.questionAr,
        surrogateProductKey: this.data.productKey,
      });
      await this.lookups.setBoundQuestion(fact.id, question.code);

      await this.enumTypes.refresh();
      this.modal.close({ factKey: question.code, listTypes: created });
    } catch (error) {
      const code = (error as { code?: ErrorCode }).code ?? 'INTERNAL_ERROR';
      this.errorMessage.set(this.errors.toLocalizedMessage(code as ErrorCode));
      // Whatever landed, landed. Refresh so the page shows it rather than pretending the run
      // never happened — a half-built fact is finishable, an invisible one is not.
      await this.enumTypes.refresh();
    } finally {
      this.progress.set(null);
      this.submitting.set(false);
    }
  }

  /** Class index → the key minted for it, filled during save. */
  private readonly classKeyByIndex = new Map<number, string>();

  private labelPair(): LabelPair {
    return this.fb.nonNullable.group({
      labelEn: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(160)]),
      labelAr: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(160)]),
    });
  }

  private valueRow(): ValueRow {
    return this.fb.nonNullable.group({
      labelEn: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(160)]),
      labelAr: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(160)]),
      classIndex: this.fb.nonNullable.control(0),
    });
  }
}
