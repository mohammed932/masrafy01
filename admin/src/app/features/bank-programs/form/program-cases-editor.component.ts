import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { FigureFieldComponent } from '@shared/income-rule/figure-field.component';
import type { RegistryFact } from '../bank-programs.types';
import type { Criterion } from '@features/loan-engine/loan-engine.api.service';
import { criterionText, opLabel } from '@features/loan-engine/loan-engine.labels';
import {
  CASE_FIGURES,
  caseProblem,
  nextCaseId,
  type CaseFigure,
  type ProgramCase,
} from './program-cases.rules';

type Op = 'gte' | 'lte' | 'gt' | 'lt' | 'eq';

/**
 * The bank's CASES (v36.4.0): "China + Used + made before 2020 → finance 50%, 48 months".
 *
 * One block per case, read top to bottom like the bank's own card: WHEN (the answers, all of
 * them), THEN (the figures it replaces, or Refuse). The first case that matches is applied,
 * so the order is the operator's to set. Nothing is saved here — every change is handed up
 * and goes with the program's one Save.
 */
@Component({
  selector: 'app-program-cases-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // FormsModule only for the pickers' ngModel on local draft signals — the cases themselves
  // are one value handed up, like the plans table's grids.
  imports: [FormsModule, NzButtonModule, NzSelectModule, FigureFieldComponent],
  template: `
    <header class="cs-head">
      <h2 class="card-title" id="casesTitle" i18n="@@cases.title">Cases</h2>
      <p class="card-sub" i18n="@@cases.sub">
        Answers that together change this bank's offer, e.g. China + used + made before 2020 →
        finance 50%. Checked from the top: the first case that matches is used, and a figure left
        blank stays as the program states it.
      </p>
    </header>

    @if (cases().length > 0) {
      <ol class="cs-list" aria-labelledby="casesTitle">
        @for (c of cases(); track c.id; let i = $index; let first = $first; let last = $last) {
          <li class="cs-case" [class.is-bad]="caseProblem(c) !== null && !isBlank(c)">
            <div class="cs-top">
              <span class="cs-num" aria-hidden="true">{{ i + 1 }}</span>
              <p class="cs-sum">{{ summary(c) }}</p>
              <span class="cs-tools">
                <button
                  type="button"
                  class="cs-icon"
                  [disabled]="first"
                  [attr.aria-label]="moveUpAria(i)"
                  (click)="move(i, -1)"
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d="M8 12.5v-9M4 7.5l4-4 4 4"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.6"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  class="cs-icon"
                  [disabled]="last"
                  [attr.aria-label]="moveDownAria(i)"
                  (click)="move(i, 1)"
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d="M8 3.5v9M4 8.5l4 4 4-4"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.6"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  class="cs-icon"
                  [attr.aria-label]="removeAria(i)"
                  (click)="removeCase(i)"
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d="M4 4l8 8M12 4l-8 8"
                      stroke="currentColor"
                      stroke-width="1.6"
                      stroke-linecap="round"
                    />
                  </svg>
                </button>
              </span>
            </div>

            <div class="cs-part">
              <span class="cs-eyebrow" i18n="@@cases.when">When</span>
              <ul class="cs-chips">
                @for (cr of c.allOf; track $index; let j = $index) {
                  <li class="cs-chip">
                    <span>{{ criterionLine(cr.factKey, cr.criterion) }}</span>
                    <button
                      type="button"
                      class="cs-chip-x"
                      [attr.aria-label]="removeAnswerAria(cr.factKey, cr.criterion)"
                      (click)="removeAnswer(i, j)"
                    >
                      <svg viewBox="0 0 16 16" aria-hidden="true">
                        <path
                          d="M5 5l6 6M11 5l-6 6"
                          stroke="currentColor"
                          stroke-width="1.6"
                          stroke-linecap="round"
                        />
                      </svg>
                    </button>
                  </li>
                }
                @if (addingTo() !== c.id) {
                  <li>
                    <button type="button" class="cs-add" (click)="startAdding(c.id)">
                      <span aria-hidden="true">+</span>
                      <span i18n="@@cases.add_answer">Add an answer</span>
                    </button>
                  </li>
                }
              </ul>

              @if (addingTo() === c.id) {
                <div class="cs-picker" role="group" [attr.aria-label]="addAnswerAria">
                  <nz-select
                    class="cs-pick cs-pick--q"
                    nzShowSearch
                    [nzDropdownMatchSelectWidth]="false"
                    [nzPlaceHolder]="pickQuestionText"
                    [attr.aria-label]="pickQuestionText"
                    [ngModel]="draftFact()"
                    (ngModelChange)="pickFact($event)"
                  >
                    @for (f of pickable(); track f.key) {
                      <nz-option [nzValue]="f.key" [nzLabel]="f.question?.label ?? f.label" />
                    }
                  </nz-select>
                  @if (draftFactRow(); as f) {
                    @if (f.question?.type === 'NUMERIC') {
                      <nz-select
                        class="cs-pick cs-pick--op"
                        [attr.aria-label]="pickOpText"
                        [ngModel]="draftOp()"
                        (ngModelChange)="draftOp.set($event)"
                      >
                        @for (op of ops; track op) {
                          <nz-option [nzValue]="op" [nzLabel]="opLabel(op)" />
                        }
                      </nz-select>
                      <app-figure-field
                        fieldId="csDraftNumber"
                        [ariaLabel]="numberAria"
                        [value]="draftNumber()"
                        (valueChange)="draftNumber.set(clean($event))"
                      />
                    } @else {
                      <nz-select
                        class="cs-pick"
                        nzShowSearch
                        [nzDropdownMatchSelectWidth]="false"
                        [nzPlaceHolder]="pickAnswerText"
                        [attr.aria-label]="pickAnswerText"
                        [ngModel]="draftOption()"
                        (ngModelChange)="draftOption.set($event)"
                      >
                        @for (o of f.question?.options ?? []; track o.code) {
                          <nz-option [nzValue]="o.code" [nzLabel]="optionText(o)" />
                        }
                      </nz-select>
                    }
                  }
                  <button
                    nz-button
                    nzType="primary"
                    type="button"
                    [disabled]="draftCriterion() === null"
                    (click)="commitAnswer(i)"
                    i18n="@@cases.add"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    class="cs-link"
                    (click)="cancelAdding()"
                    i18n="@@cases.cancel"
                  >
                    Cancel
                  </button>
                </div>
              }
            </div>

            <div class="cs-part">
              <span class="cs-eyebrow" i18n="@@cases.then">Then</span>
              <div class="cs-seg" role="radiogroup" [attr.aria-label]="thenAria">
                <button
                  type="button"
                  role="radio"
                  [attr.aria-checked]="c.refuse !== true"
                  (click)="setRefuse(i, false)"
                  i18n="@@cases.change"
                >
                  Change the figures
                </button>
                <button
                  type="button"
                  role="radio"
                  [attr.aria-checked]="c.refuse === true"
                  (click)="setRefuse(i, true)"
                  i18n="@@cases.refuse"
                >
                  Refuse
                </button>
              </div>
              @if (c.refuse === true) {
                <p class="cs-note" i18n="@@cases.refuse_note">
                  The bank does not lend in this case. The customer is not shown this program.
                </p>
              } @else {
                <div class="cs-figs">
                  @for (k of figures; track k) {
                    <div class="cs-fig">
                      <label class="cs-fig-label" [attr.for]="'cs-' + c.id + '-' + k">{{
                        figureLabel(k)
                      }}</label>
                      <app-figure-field
                        [fieldId]="'cs-' + c.id + '-' + k"
                        [unit]="figureUnit(k)"
                        [money]="k === 'minAmountEGP' || k === 'maxAmountEGP'"
                        [value]="figureValue(c, k)"
                        (valueChange)="setFigure(i, k, $event)"
                        [placeholder]="dash"
                      />
                    </div>
                  }
                </div>
              }
            </div>

            @if (caseProblem(c); as p) {
              @if (isBlank(c)) {
                <p class="cs-note">{{ problemText(p) }}</p>
              } @else {
                <p class="field-error" role="alert">{{ problemText(p) }}</p>
              }
            }
          </li>
        }
      </ol>
    }

    <div>
      <button nz-button nzType="default" type="button" (click)="addCase()" i18n="@@cases.add_case">
        + Add a case
      </button>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .cs-head {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .cs-head .card-sub {
        max-inline-size: 70ch;
      }
      .cs-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .cs-case {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4) var(--space-4);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        background: var(--color-surface-default);
      }
      .cs-case.is-bad {
        border-color: var(--color-error);
      }
      .cs-top {
        display: flex;
        align-items: center;
        gap: var(--space-3);
      }
      .cs-num {
        flex: none;
        display: inline-grid;
        place-items: center;
        inline-size: 1.5rem;
        block-size: 1.5rem;
        border-radius: 50%;
        background: var(--color-surface-muted);
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        font-variant-numeric: tabular-nums;
      }
      .cs-sum {
        flex: 1 1 auto;
        min-inline-size: 0;
        margin: 0;
        color: var(--color-text-primary);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        overflow-wrap: anywhere;
      }
      .cs-tools {
        flex: none;
        display: flex;
        gap: var(--space-1);
      }
      .cs-icon {
        display: inline-grid;
        place-items: center;
        inline-size: 1.75rem;
        block-size: 1.75rem;
        border: 0;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--color-text-secondary);
        cursor: pointer;
      }
      .cs-icon svg {
        inline-size: 0.875rem;
        block-size: 0.875rem;
      }
      .cs-icon:hover:not(:disabled) {
        background: var(--color-surface-muted);
        color: var(--color-text-primary);
      }
      .cs-icon:disabled {
        opacity: 0.35;
        cursor: default;
      }
      .cs-part {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .cs-eyebrow {
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: var(--tracking-wide);
        text-transform: uppercase;
        color: var(--color-text-secondary);
      }
      .cs-chips {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
      }
      .cs-chip {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding-block: var(--space-1);
        padding-inline: var(--space-3) var(--space-1);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-full);
        background: var(--color-surface-elevated);
        color: var(--color-text-primary);
        font-size: var(--text-sm);
      }
      .cs-chip-x {
        display: inline-grid;
        place-items: center;
        inline-size: 1.25rem;
        block-size: 1.25rem;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: var(--color-text-secondary);
        cursor: pointer;
      }
      .cs-chip-x svg {
        inline-size: 0.75rem;
        block-size: 0.75rem;
      }
      .cs-chip-x:hover {
        background: var(--color-surface-muted);
        color: var(--color-text-primary);
      }
      .cs-add,
      .cs-link {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        border: 0;
        background: none;
        padding: var(--space-1) 0;
        color: var(--color-brand-primary);
        font: inherit;
        font-size: var(--text-sm);
        cursor: pointer;
      }
      .cs-add:hover,
      .cs-link:hover {
        text-decoration: underline;
      }
      .cs-picker {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-3);
        border-radius: var(--radius-md);
        background: var(--color-surface-elevated);
      }
      .cs-pick {
        min-inline-size: 12rem;
        max-inline-size: 100%;
      }
      .cs-pick--q {
        min-inline-size: 16rem;
      }
      .cs-pick--op {
        min-inline-size: 8rem;
      }
      .cs-seg {
        display: inline-flex;
        align-self: flex-start;
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        overflow: hidden;
      }
      .cs-seg button {
        border: 0;
        background: var(--color-surface-default);
        padding: var(--space-1) var(--space-3);
        color: var(--color-text-primary);
        font: inherit;
        font-size: var(--text-sm);
        cursor: pointer;
      }
      .cs-seg button + button {
        border-inline-start: 1px solid var(--color-border-default);
      }
      .cs-seg button[aria-checked='true'] {
        background: var(--color-brand-primary);
        color: var(--color-text-on-brand);
        font-weight: var(--font-weight-semibold);
      }
      .cs-note {
        margin: 0;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }
      .cs-figs {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(12.5rem, 1fr));
        gap: var(--space-3);
      }
      .cs-fig {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-inline-size: 0;
      }
      .cs-fig-label {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }
      .field-error {
        margin: 0;
        color: var(--color-error);
        font-size: var(--text-sm);
      }
      .cs-icon:focus-visible,
      .cs-chip-x:focus-visible,
      .cs-add:focus-visible,
      .cs-link:focus-visible,
      .cs-seg button:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
    `,
  ],
})
export class ProgramCasesEditorComponent {
  readonly cases = input.required<readonly ProgramCase[]>();
  readonly facts = input.required<readonly RegistryFact[]>();
  readonly casesChange = output<ProgramCase[]>();

  private readonly isAr = inject(LOCALE_ID).startsWith('ar');
  protected readonly figures = CASE_FIGURES;
  protected readonly ops: readonly Op[] = ['gte', 'lte', 'gt', 'lt', 'eq'];
  protected readonly opLabel = opLabel;
  protected readonly caseProblem = caseProblem;
  protected readonly dash = '—';

  protected readonly pickQuestionText = $localize`:@@cases.pick_question:Which question`;
  protected readonly pickAnswerText = $localize`:@@cases.pick_answer:Which answer`;
  protected readonly pickOpText = $localize`:@@cases.pick_op:How it compares`;
  protected readonly numberAria = $localize`:@@cases.number:The number`;
  protected readonly addAnswerAria = $localize`:@@cases.add_answer_aria:Add an answer to this case`;
  protected readonly thenAria = $localize`:@@cases.then_aria:What this case does`;

  /** The case whose answer picker is open, and the picker's draft. */
  protected readonly addingTo = signal<string | null>(null);
  protected readonly draftFact = signal<string | null>(null);
  protected readonly draftOption = signal<string | null>(null);
  protected readonly draftOp = signal<Op>('gte');
  protected readonly draftNumber = signal('');

  /** Questions a case can read: a choice or a number, with a question behind the fact. */
  protected readonly pickable = computed(() =>
    this.facts()
      .filter(
        (f) =>
          f.question !== undefined &&
          f.question !== null &&
          f.question.active &&
          (f.question.type === 'NUMERIC' || f.question.options.length > 0),
      )
      .slice()
      .sort((a, b) => (a.question?.label ?? a.label).localeCompare(b.question?.label ?? b.label)),
  );

  protected readonly draftFactRow = computed(
    () => this.facts().find((f) => f.key === this.draftFact()) ?? null,
  );

  /** A case nothing has been put in yet: its problem is a hint, not an error. */
  protected isBlank(c: ProgramCase): boolean {
    return c.allOf.length === 0 && c.refuse !== true && Object.keys(c.effects).length === 0;
  }

  protected readonly draftCriterion = computed<Criterion | null>(() => {
    const f = this.draftFactRow();
    if (f === null) return null;
    if (f.question?.type === 'NUMERIC') {
      const n = this.draftNumber();
      return /^\d+(\.\d+)?$/.test(n) ? { op: this.draftOp(), a: n } : null;
    }
    const o = this.draftOption();
    return o === null ? null : { option: o };
  });

  protected clean(raw: string): string {
    return raw.replace(/,/g, '').trim();
  }

  private emit(next: ProgramCase[]): void {
    this.casesChange.emit(next);
  }

  private patchCase(i: number, fn: (c: ProgramCase) => ProgramCase): void {
    this.emit(this.cases().map((c, k) => (k === i ? fn(c) : c)));
  }

  // --- labels ------------------------------------------------------------------------

  protected optionText(o: { labelAr: string; labelEn: string }): string {
    return (this.isAr ? o.labelAr : o.labelEn) || o.labelEn;
  }

  private factLabel(factKey: string): string {
    const f = this.facts().find((x) => x.key === factKey);
    return f?.question?.label ?? f?.label ?? factKey;
  }

  private answerText(factKey: string, criterion: Criterion): string {
    const f = this.facts().find((x) => x.key === factKey);
    return criterionText(criterion, (code) => {
      const o = f?.question?.options.find((x) => x.code === code);
      return o ? this.optionText(o) : code;
    });
  }

  protected criterionLine(factKey: string, criterion: Criterion): string {
    return `${this.factLabel(factKey)}: ${this.answerText(factKey, criterion)}`;
  }

  protected figureLabel(k: CaseFigure): string {
    switch (k) {
      case 'ratePercent':
        return $localize`:@@cases.fig_rate:Rate`;
      case 'ltvCeilingPercent':
        return $localize`:@@cases.fig_share:Share financed`;
      case 'minAmountEGP':
        return $localize`:@@cases.fig_min_amount:Smallest loan`;
      case 'maxAmountEGP':
        return $localize`:@@cases.fig_max_amount:Largest loan`;
      case 'minMonths':
        return $localize`:@@cases.fig_min_months:Shortest term`;
      case 'maxMonths':
        return $localize`:@@cases.fig_max_months:Longest term`;
    }
  }

  protected figureUnit(k: CaseFigure): string {
    if (k === 'ratePercent' || k === 'ltvCeilingPercent') return '%';
    if (k === 'minAmountEGP' || k === 'maxAmountEGP') return 'EGP';
    return $localize`:@@cases.months:months`;
  }

  protected figureValue(c: ProgramCase, k: CaseFigure): string {
    const v = c.effects[k];
    return v === undefined ? '' : String(v);
  }

  /** The case as one line: "Brand: BMW + Model year: at least 2020 → Rate 14%, Longest term 48 months". */
  protected summary(c: ProgramCase): string {
    const when =
      c.allOf.length === 0
        ? $localize`:@@cases.sum_no_answers:No answers yet`
        : c.allOf.map((cr) => this.answerText(cr.factKey, cr.criterion)).join(' + ');
    if (c.refuse === true) return `${when} → ${$localize`:@@cases.sum_refuse:refused`}`;
    const then = CASE_FIGURES.filter((k) => c.effects[k] !== undefined)
      .map((k) => {
        const unit = this.figureUnit(k);
        const value = String(c.effects[k]);
        return unit === '%'
          ? `${this.figureLabel(k)} ${value}%`
          : `${this.figureLabel(k)} ${value} ${unit}`;
      })
      .join(', ');
    return then === '' ? when : `${when} → ${then}`;
  }

  protected problemText(p: NonNullable<ReturnType<typeof caseProblem>>): string {
    switch (p) {
      case 'no_answers':
        return $localize`:@@cases.err_no_answers:Add at least one answer.`;
      case 'no_figures':
        return $localize`:@@cases.err_no_figures:Type at least one figure, or choose Refuse.`;
      case 'range':
        return $localize`:@@cases.err_range:A rate or a share is a percentage above 0 and up to 100.`;
      case 'months_order':
        return $localize`:@@cases.err_months:The shortest term is longer than the longest.`;
      case 'amounts_order':
        return $localize`:@@cases.err_amounts:The smallest loan is bigger than the largest.`;
    }
  }

  protected moveUpAria(i: number): string {
    return $localize`:@@cases.move_up:Move case ${i + 1}:N: up`;
  }

  protected moveDownAria(i: number): string {
    return $localize`:@@cases.move_down:Move case ${i + 1}:N: down`;
  }

  protected removeAria(i: number): string {
    return $localize`:@@cases.remove:Remove case ${i + 1}:N:`;
  }

  protected removeAnswerAria(factKey: string, criterion: Criterion): string {
    const what = this.criterionLine(factKey, criterion);
    return $localize`:@@cases.remove_answer:Remove ${what}:WHAT:`;
  }

  // --- edits -------------------------------------------------------------------------

  protected addCase(): void {
    const id = nextCaseId(this.cases());
    this.emit([...this.cases(), { id, allOf: [], effects: {} }]);
    this.startAdding(id);
  }

  protected removeCase(i: number): void {
    this.emit(this.cases().filter((_, k) => k !== i));
  }

  protected move(i: number, by: -1 | 1): void {
    const next = [...this.cases()];
    const j = i + by;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    this.emit(next);
  }

  protected startAdding(caseId: string): void {
    this.addingTo.set(caseId);
    this.draftFact.set(null);
    this.draftOption.set(null);
    this.draftOp.set('gte');
    this.draftNumber.set('');
  }

  protected cancelAdding(): void {
    this.addingTo.set(null);
  }

  protected pickFact(key: string | null): void {
    this.draftFact.set(key);
    this.draftOption.set(null);
    this.draftNumber.set('');
  }

  protected commitAnswer(i: number): void {
    const factKey = this.draftFact();
    const criterion = this.draftCriterion();
    if (factKey === null || criterion === null) return;
    this.patchCase(i, (c) => ({ ...c, allOf: [...c.allOf, { factKey, criterion }] }));
    this.addingTo.set(null);
  }

  protected removeAnswer(i: number, j: number): void {
    this.patchCase(i, (c) => ({ ...c, allOf: c.allOf.filter((_, k) => k !== j) }));
  }

  protected setRefuse(i: number, refuse: boolean): void {
    this.patchCase(i, (c) => {
      const next: ProgramCase = { ...c };
      if (refuse) next.refuse = true;
      else delete next.refuse;
      return next;
    });
  }

  protected setFigure(i: number, k: CaseFigure, raw: string): void {
    const value = this.clean(raw);
    this.patchCase(i, (c) => {
      const effects = { ...c.effects };
      if (value === '') {
        delete effects[k];
      } else if (k === 'minMonths' || k === 'maxMonths') {
        const n = Number(value);
        if (Number.isInteger(n) && n > 0) effects[k] = n;
        else delete effects[k];
      } else {
        effects[k] = value;
      }
      return { ...c, effects };
    });
  }
}
