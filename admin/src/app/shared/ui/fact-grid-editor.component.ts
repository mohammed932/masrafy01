import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { DeleteOutline, PlusOutline, WarningOutline } from '@ant-design/icons-angular/icons';
import type { RegistryFact } from '../../features/bank-programs/bank-programs.types';
import {
  MAX_GRID_AXES,
  REACHABLE_TENOR_MONTHS,
  cellForAxes,
  factGridErrorFor,
  uncoveredTenors,
  withAxisCount,
} from './fact-grid.rules';
import type {
  FactGridConfig,
  FactGridError,
  FactGridKey,
  FactGridValueKind,
} from './fact-grid.rules';

export {
  MAX_GRID_AXES,
  REACHABLE_TENOR_MONTHS,
  emptyFactGrid,
  factGridErrorFor,
  uncoveredTenors,
} from './fact-grid.rules';
export type {
  FactGridAxis,
  FactGridCell,
  FactGridConfig,
  FactGridError,
  FactGridKey,
  FactGridValueKind,
} from './fact-grid.rules';

/** The term axis, by fact key — the engine derives it per quote, so it has no question. */
const TENOR_FACT_KEY = 'tenor_months';

/**
 * A table this bank prices — or shortens a term — by, keyed on up to four of its applicants'
 * own answers.
 *
 * ─── Why a ROW LIST and not the grid its sibling draws ────────────────────────
 *
 * `app-max-loan-by-fact-editor` renders a real two-dimensional table: answers down the side,
 * a second axis across the top. That is the right shape for exactly two axes and it does not
 * survive a third — ADIB's used-car card is down payment × term × insurance, and a cube has
 * no flat rendering. So this control states one row per CELL, with a column per axis, which
 * is how the bank's own card reads once it is more than a square: "30% down, 3–5 years, with
 * cover → 14.29%".
 *
 * The cap editor is deliberately left alone. It edits live tables that quote money today, and
 * generalising a reviewed control to a shape none of its callers needs is how that breaks.
 * What the two SHARE is the vocabulary an operator has already learnt here: the same
 * half-open `[from, to)` band stated on screen, the same "which answers key this" fact
 * picker, and the same rule that `onNoMatch` is always answered because neither reading of a
 * miss is one the platform may pick on a bank's behalf.
 *
 * ─── Why the coverage panel exists ────────────────────────────────────────────
 *
 * A rate table cannot be checked by looking at it. The questionnaire lets a customer ask for
 * any of twenty terms; a bank's card prints three or four bands, and the gaps between them
 * are invisible until a real applicant falls in one. The panel names them.
 */
@Component({
  selector: 'app-fact-grid-editor',
  standalone: true,
  imports: [
    FormsModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzRadioModule,
    NzSelectModule,
  ],
  providers: [provideNzIconsPatch([DeleteOutline, PlusOutline, WarningOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fgd">
      <!-- ① THE AXES. What this table is keyed by, and in what order — the order is the
           column order below, so an operator lays the table out the way their sheet reads. -->
      <section class="fgd__axes">
        <h4 class="fgd__micro" i18n="@@fact_grid.axes">What this table is keyed by</h4>
        @for (axis of config().axes; track $index) {
          <div class="fgd__axis">
            <nz-select
              class="fgd__fact"
              [ngModel]="axis.factKey"
              (ngModelChange)="setAxisFact($index, $event)"
              nzShowSearch
              [nzPlaceHolder]="axisPlaceholder"
            >
              @for (fact of facts(); track fact.key) {
                <nz-option [nzValue]="fact.key" [nzLabel]="fact.label"></nz-option>
              }
            </nz-select>
            @if (axisHasClasses($index)) {
              <nz-radio-group
                [ngModel]="axis.via ?? 'answer'"
                (ngModelChange)="setAxisVia($index, $event)"
                nzSize="small"
              >
                <label nz-radio-button nzValue="answer" i18n="@@fact_grid.via_answer">
                  The answer
                </label>
                <label nz-radio-button nzValue="parentClass" i18n="@@fact_grid.via_class">
                  Its class
                </label>
              </nz-radio-group>
            }
            @if (config().axes.length > 1) {
              <button
                nz-button
                nzType="text"
                nzSize="small"
                type="button"
                [attr.aria-label]="removeAxisAria"
                (click)="removeAxis($index)"
              >
                <span nz-icon nzType="delete"></span>
              </button>
            }
          </div>
        }
        @if (config().axes.length < maxAxes) {
          <button nz-button nzType="dashed" nzSize="small" type="button" (click)="addAxis()">
            <span nz-icon nzType="plus"></span>
            <span i18n="@@fact_grid.add_axis">Add another axis</span>
          </button>
        }
      </section>

      <!-- ② THE CELLS. One row per combination the bank's card prints. A box left blank is
           "whatever the answer", which is how one figure covers a whole axis. -->
      <div class="fgd__scroll">
        <table class="fgd__table">
          <thead>
            <tr>
              @for (axis of config().axes; track $index) {
                <th>{{ factLabel(axis.factKey) }}</th>
              }
              <th class="fgd__value-head">
                @if (valueKind() === 'months') {
                  <span i18n="@@fact_grid.value_months">Longest term (months)</span>
                } @else {
                  <span i18n="@@fact_grid.value_rate">Rate %</span>
                }
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (cell of config().cells; track $index; let cellIndex = $index) {
              <tr>
                @for (axis of config().axes; track $index; let axisIndex = $index) {
                  <td>
                    @if (isChoiceAxis(axisIndex)) {
                      <nz-select
                        class="fgd__key"
                        [ngModel]="choiceKeyOf(cell.keys[axisIndex])"
                        (ngModelChange)="setChoiceKey(cellIndex, axisIndex, $event)"
                        nzAllowClear
                        [nzPlaceHolder]="anyPlaceholder"
                        [attr.aria-label]="keyAria(cellIndex, axisIndex)"
                      >
                        @for (option of axisOptions(axisIndex); track option.code) {
                          <nz-option [nzValue]="option.code" [nzLabel]="option.label"></nz-option>
                        }
                      </nz-select>
                    } @else {
                      <span class="fgd__band">
                        <input
                          nz-input
                          class="fgd__edge"
                          [ngModel]="bandEdgeOf(cell.keys[axisIndex], 'from')"
                          (ngModelChange)="setBandEdge(cellIndex, axisIndex, 'from', $event)"
                          [attr.aria-label]="edgeAria(cellIndex, axisIndex, 'from')"
                          inputmode="numeric"
                        />
                        <span class="fgd__dash" aria-hidden="true">–</span>
                        <input
                          nz-input
                          class="fgd__edge"
                          [ngModel]="bandEdgeOf(cell.keys[axisIndex], 'to')"
                          (ngModelChange)="setBandEdge(cellIndex, axisIndex, 'to', $event)"
                          [attr.aria-label]="edgeAria(cellIndex, axisIndex, 'to')"
                          inputmode="numeric"
                        />
                      </span>
                    }
                  </td>
                }
                <td>
                  <input
                    nz-input
                    class="fgd__value"
                    [ngModel]="cell.value"
                    (ngModelChange)="setValue(cellIndex, $event)"
                    [attr.aria-label]="valueAria(cellIndex)"
                    inputmode="decimal"
                  />
                </td>
                <td>
                  @if (config().cells.length > 1) {
                    <button
                      nz-button
                      nzType="text"
                      nzSize="small"
                      type="button"
                      [attr.aria-label]="removeCellAria(cellIndex)"
                      (click)="removeCell(cellIndex)"
                    >
                      <span nz-icon nzType="delete"></span>
                    </button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <button nz-button nzType="dashed" nzSize="small" type="button" (click)="addCell()">
        <span nz-icon nzType="plus"></span>
        <span i18n="@@fact_grid.add_cell">Add a row</span>
      </button>
      <p class="fgd__hint" i18n="@@fact_grid.band_hint">
        Ranges include the first number and stop before the last, so 12–61 means one to five years.
        Leave a box empty to mean “whatever the answer”.
      </p>

      <!-- ③ WHAT HAPPENS TO SOMEBODY NO ROW COVERS. Never defaulted: see the backend's
           FACT_GRID_NO_MATCH_ACTIONS. -->
      <section class="fgd__nomatch">
        <h4 class="fgd__micro" i18n="@@fact_grid.no_match">If no row matches the customer</h4>
        <nz-radio-group
          [ngModel]="config().onNoMatch"
          (ngModelChange)="setOnNoMatch($event)"
          nzSize="small"
        >
          <label nz-radio nzValue="reject">
            @if (valueKind() === 'months') {
              <span i18n="@@fact_grid.reject_months">
                This bank does not finance them — say so, with a reason
              </span>
            } @else {
              <span i18n="@@fact_grid.reject_rate">
                This bank quotes them no price — say so, with a reason
              </span>
            }
          </label>
          <label nz-radio nzValue="useFallback">
            @if (valueKind() === 'months') {
              <span i18n="@@fact_grid.fallback_months">
                Fall back to this program’s own longest term
              </span>
            } @else {
              <span i18n="@@fact_grid.fallback_rate">
                Fall back to this program’s other rate settings
              </span>
            }
          </label>
        </nz-radio-group>
      </section>

      <!-- ④ COVERAGE. The one thing the table above cannot show by being looked at. -->
      @if (uncovered().length > 0) {
        <p class="fgd__warn">
          <span nz-icon nzType="warning" aria-hidden="true"></span>
          <span i18n="@@fact_grid.uncovered">
            A customer can ask for {{ uncovered().length }} term(s) this table prices nothing for:
            {{ uncoveredLabel() }} months. They will get the answer chosen above — ask the bank what
            it charges for these.
          </span>
        </p>
      }

      @if (error(); as e) {
        <p class="fgd__error">{{ errorLabel(e) }}</p>
      }
    </div>
  `,
  styles: [
    `
      .fgd {
        display: grid;
        gap: var(--space-3);
      }
      .fgd__micro {
        margin: 0 0 var(--space-2);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-text-secondary);
      }
      .fgd__axes {
        display: grid;
        gap: var(--space-2);
        justify-items: start;
      }
      .fgd__axis {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-wrap: wrap;
      }
      .fgd__fact {
        min-width: 15rem;
      }
      /* The table scrolls in ITS OWN box. Four axes of band edges is ~70rem, and without
         this the PAGE scrolls sideways — which the house measures at 0 on every screen, and
         which pushes the wizard's own action bar off to the side. */
      .fgd__scroll {
        overflow-x: auto;
      }
      .fgd__table {
        width: 100%;
        border-collapse: collapse;
      }
      .fgd__table th,
      .fgd__table td {
        padding: var(--space-2);
        border-block-end: 1px solid var(--color-border-default);
        text-align: start;
        vertical-align: middle;
      }
      .fgd__table th {
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        color: var(--color-text-secondary);
      }
      .fgd__key {
        min-width: 11rem;
      }
      .fgd__band {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
      }
      .fgd__edge,
      .fgd__value {
        width: 7rem;
        /* Figures line up column to column, which is how a mistyped edge is seen. */
        font-variant-numeric: tabular-nums;
        text-align: end;
      }
      .fgd__dash {
        color: var(--color-text-secondary);
      }
      .fgd__hint,
      .fgd__warn,
      .fgd__error {
        margin: 0;
        font-size: var(--text-xs);
        /* Secondary, not tertiary: every one of these is a sentence somebody has to READ,
           and tertiary ink measures under 4.5:1 on this ground in light mode. */
        color: var(--color-text-secondary);
      }
      .fgd__warn {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        padding: var(--space-2);
        border-radius: var(--radius-sm);
        background: var(--color-warning-bg);
        color: var(--color-text-primary);
      }
      .fgd__error {
        color: var(--color-text-primary);
        font-weight: var(--font-semibold);
      }
      .fgd__nomatch label {
        display: block;
      }
      /* A pointer can hit a 24px icon button; a thumb cannot. Applied only where there is no
         hover, so the dense desktop table keeps its density. */
      @media (hover: none) {
        .fgd__axis button,
        .fgd__table button {
          min-width: 44px;
          min-height: 44px;
        }
      }
    `,
  ],
})
export class FactGridEditorComponent {
  readonly config = model.required<FactGridConfig>();
  readonly facts = input.required<readonly RegistryFact[]>();
  readonly valueKind = input.required<FactGridValueKind>();

  readonly maxAxes = MAX_GRID_AXES;
  readonly axisPlaceholder = $localize`:@@fact_grid.pick_fact:Pick a question`;
  readonly anyPlaceholder = $localize`:@@fact_grid.any:Any`;
  readonly removeAxisAria = $localize`:@@fact_grid.remove_axis:Remove this axis`;

  /**
   * Accessible names that say WHICH box this is.
   *
   * The column heading names the axis to somebody who can see the table; a screen reader in
   * forms mode reads the input alone, so four axes over six rows announced twenty-four
   * boxes all called "From, inclusive". Each one now carries its row number and its axis,
   * which is the only way to tell them apart without leaving the field.
   */
  edgeAria(cellIndex: number, axisIndex: number, edge: 'from' | 'to'): string {
    const axis = this.factLabel(this.config().axes[axisIndex]?.factKey ?? '');
    const row = cellIndex + 1;
    return edge === 'from'
      ? $localize`:@@fact_grid.from_aria:Row ${row}:row:, ${axis}:axis:, from — including this number`
      : $localize`:@@fact_grid.to_aria:Row ${row}:row:, ${axis}:axis:, up to — not including this number`;
  }

  keyAria(cellIndex: number, axisIndex: number): string {
    const axis = this.factLabel(this.config().axes[axisIndex]?.factKey ?? '');
    return $localize`:@@fact_grid.key_aria:Row ${cellIndex + 1}:row:, ${axis}:axis:`;
  }

  removeCellAria(cellIndex: number): string {
    return $localize`:@@fact_grid.remove_cell:Remove row ${cellIndex + 1}:row:`;
  }

  readonly error = computed(() => factGridErrorFor(this.config(), this.valueKind()));

  /**
   * The terms a customer can pick that no row covers.
   *
   * Only computed when an axis actually reads the term — on a grid keyed by origin and model
   * year there is no term to be uncovered, and a panel counting twenty of them would be
   * noise about a question this table never asks.
   */
  readonly uncovered = computed(() => {
    const index = this.config().axes.findIndex((a) => a.factKey === TENOR_FACT_KEY);
    return index < 0 ? [] : uncoveredTenors(this.config(), index, REACHABLE_TENOR_MONTHS);
  });

  readonly uncoveredLabel = computed(() => this.uncovered().join(', '));

  valueAria(cellIndex: number): string {
    const row = cellIndex + 1;
    return this.valueKind() === 'months'
      ? $localize`:@@fact_grid.value_months_aria:Row ${row}:row:, longest term in months`
      : $localize`:@@fact_grid.value_rate_aria:Row ${row}:row:, rate percent`;
  }

  factLabel(key: string): string {
    return this.facts().find((f) => f.key === key)?.label ?? key;
  }

  /** A choice axis renders pickers; a numeric one renders band edges. */
  isChoiceAxis(index: number): boolean {
    const key = this.config().axes[index]?.factKey;
    const fact = this.facts().find((f) => f.key === key);
    // Unknown while the registry loads, and a NUMERIC-shaped fallback is the safe one: the
    // band inputs accept anything an operator types, where an empty option list would offer
    // them nothing at all.
    return fact?.question?.type === 'SINGLE_SELECT' || fact?.question?.type === 'MULTI_SELECT';
  }

  axisHasClasses(index: number): boolean {
    const key = this.config().axes[index]?.factKey;
    const fact = this.facts().find((f) => f.key === key);
    return (fact?.question?.parentOptions?.length ?? 0) > 0;
  }

  axisOptions(index: number): ReadonlyArray<{ code: string; label: string }> {
    const axis = this.config().axes[index];
    const fact = this.facts().find((f) => f.key === axis?.factKey);
    const list =
      axis?.via === 'parentClass'
        ? (fact?.question?.parentOptions ?? [])
        : (fact?.question?.options ?? []);
    // Locale picked on the same rule the sibling editor uses. An option list rendered in
    // English inside an Arabic form is the defect v24.0.0 fixed for the document lists.
    return list.map((o) => ({ code: o.code, label: this.isAr ? o.labelAr : o.labelEn }));
  }

  private readonly isAr = document.documentElement.lang.startsWith('ar');

  choiceKeyOf(key: FactGridKey | undefined): string | null {
    return key !== null && key !== undefined && 'key' in key ? key.key : null;
  }

  bandEdgeOf(key: FactGridKey | undefined, edge: 'from' | 'to'): string {
    if (key === null || key === undefined || 'key' in key) return '';
    const raw = edge === 'from' ? key.fromInclusive : key.toExclusive;
    return raw ?? '';
  }

  addAxis(): void {
    const next = { ...this.config(), axes: [...this.config().axes, { factKey: '' }] };
    this.config.set(withAxisCount(next));
  }

  removeAxis(index: number): void {
    const next = { ...this.config(), axes: this.config().axes.filter((_, i) => i !== index) };
    this.config.set(withAxisCount(next, index));
  }

  setAxisFact(index: number, factKey: string): void {
    const axes = this.config().axes.map((a, i) => (i === index ? { factKey } : a));
    // Every key on this axis is cleared: a key shaped for the old fact matches nothing at
    // runtime and would read as a configured table that prices nobody — the same rule the
    // cap editor states for switching its row fact.
    const cells = this.config().cells.map((cell) => ({
      ...cell,
      keys: cell.keys.map((k, i) => (i === index ? null : k)),
    }));
    this.config.set({ ...this.config(), axes, cells });
  }

  setAxisVia(index: number, via: 'answer' | 'parentClass'): void {
    const axes = this.config().axes.map((a, i) => (i === index ? { ...a, via } : a));
    const cells = this.config().cells.map((cell) => ({
      ...cell,
      keys: cell.keys.map((k, i) => (i === index ? null : k)),
    }));
    this.config.set({ ...this.config(), axes, cells });
  }

  addCell(): void {
    this.config.set({
      ...this.config(),
      cells: [...this.config().cells, cellForAxes(this.config().axes)],
    });
  }

  removeCell(index: number): void {
    this.config.set({
      ...this.config(),
      cells: this.config().cells.filter((_, i) => i !== index),
    });
  }

  setChoiceKey(cellIndex: number, axisIndex: number, code: string | null): void {
    this.patchKey(cellIndex, axisIndex, code ? { key: code } : null);
  }

  setBandEdge(cellIndex: number, axisIndex: number, edge: 'from' | 'to', raw: string): void {
    const current = this.config().cells[cellIndex]?.keys[axisIndex];
    const band = current !== null && current !== undefined && !('key' in current) ? current : {};
    const next = { ...band, [edge === 'from' ? 'fromInclusive' : 'toExclusive']: raw || undefined };
    const stated = next.fromInclusive !== undefined || next.toExclusive !== undefined;
    this.patchKey(cellIndex, axisIndex, stated ? next : null);
  }

  setValue(cellIndex: number, value: string): void {
    this.config.set({
      ...this.config(),
      cells: this.config().cells.map((c, i) => (i === cellIndex ? { ...c, value } : c)),
    });
  }

  setOnNoMatch(onNoMatch: 'useFallback' | 'reject'): void {
    this.config.set({ ...this.config(), onNoMatch });
  }

  errorLabel(error: FactGridError): string {
    switch (error) {
      case 'AXES_EMPTY':
        return $localize`:@@fact_grid.err_axes:This table is keyed by nothing — pick at least one question.`;
      case 'AXIS_MISSING_FACT':
        return $localize`:@@fact_grid.err_axis_fact:One axis has no question picked.`;
      case 'AXIS_DUPLICATE':
        return $localize`:@@fact_grid.err_axis_dup:Two axes read the same question — the second one narrows nothing.`;
      case 'CELLS_EMPTY':
        return $localize`:@@fact_grid.err_cells:Add at least one row.`;
      case 'CELL_ARITY':
        return $localize`:@@fact_grid.err_arity:A row does not line up with the axes above.`;
      case 'CELL_ALL_WILDCARD':
        return $localize`:@@fact_grid.err_wildcard:A row leaves every box empty, so it would price every customer. Fill at least one, or use the setting below.`;
      case 'CELL_KEY_INVALID':
        return $localize`:@@fact_grid.err_key:A range needs at least one of its two numbers.`;
      case 'CELL_VALUE_INVALID':
        return this.valueKind() === 'months'
          ? $localize`:@@fact_grid.err_months:Every row needs a whole number of months, above zero and up to 480.`
          : $localize`:@@fact_grid.err_rate:Every row needs a rate above zero.`;
    }
  }

  private patchKey(cellIndex: number, axisIndex: number, key: FactGridKey): void {
    this.config.set({
      ...this.config(),
      cells: this.config().cells.map((c, i) =>
        i === cellIndex ? { ...c, keys: c.keys.map((k, j) => (j === axisIndex ? key : k)) } : c,
      ),
    });
  }
}
