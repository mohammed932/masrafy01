import { ChangeDetectionStrategy, Component, computed, effect, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { MoneyInputDirective } from '../../core/directives/money-input.directive';
import { DeleteOutline, PlusOutline, WarningOutline } from '@ant-design/icons-angular/icons';
import type { RegistryFact } from '../../features/bank-programs/bank-programs.types';
import {
  DOWN_PAYMENT_PERCENT_FACT_KEY,
  MAX_GRID_AXES,
  REACHABLE_TENOR_MONTHS,
  TENOR_FACT_KEY,
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
  DOWN_PAYMENT_PERCENT_FACT_KEY,
  MAX_GRID_AXES,
  REACHABLE_TENOR_MONTHS,
  TENOR_FACT_KEY,
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

/**
 * The two axes the engine works out per quote, offered in the picker beside the real facts.
 *
 * They are NOT in the fact registry and never will be — a registry fact is a question bound to
 * an answer, and neither of these has one: the share is money divided by money and the term is
 * what the loan is repaid over. `RESERVED_FACT_KEYS` exists to stop an operator ever creating
 * a question under either key.
 *
 * Offered here anyway, because leaving them out made the control unable to express the table
 * the whole feature was built for: ADIB's card is down payment x term x insurance, and two of
 * those three are these. The picker read the registry alone, so an operator could key a grid
 * on a car's origin but not on the deposit — and the editor's own tenor-coverage panel, which
 * only fires when an axis reads the term, could never fire at all.
 *
 * Both are NUMERIC, which is what makes the cells render as band edges rather than pickers.
 */
const DERIVED_AXES: ReadonlyArray<{ key: string; label: string }> = [
  {
    key: DOWN_PAYMENT_PERCENT_FACT_KEY,
    label: $localize`:@@fact_grid.axis_down_payment:Down payment (% of the price)`,
  },
  { key: TENOR_FACT_KEY, label: $localize`:@@fact_grid.axis_tenor:Loan term (months)` },
];

/**
 * What to call one axis of a grid.
 *
 * Exported because a CLOSED grid still has to be describable: the product screen folds its
 * five plan tables and states what each one holds, and a caller reading the registry alone
 * would silently drop BOTH derived axes — including the deposit, which is the axis every one
 * of those tables is keyed by first. A second copy of these two labels in the caller is the
 * drift this list was collapsed into one place to prevent.
 *
 * An axis with no fact picked yet, or one naming a fact this session cannot resolve, answers
 * the empty string: it names nothing, and a raw slug is worse than saying nothing at all.
 */
export function factGridAxisLabel(key: string, facts: readonly RegistryFact[]): string {
  const derived = DERIVED_AXES.find((axis) => axis.key === key);
  if (derived !== undefined) return derived.label;
  return facts.find((fact) => fact.key === key)?.label ?? '';
}

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
    MoneyInputDirective,
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
           column order below, so an operator lays the table out the way their sheet reads.
           Withheld entirely when the axis is locked to down payment: there is nothing to
           configure, and a picker with one immovable choice reads as broken rather than as
           simplified. -->
      @if (!lockAxisToDownPayment() && !hideAxes()) {
      <section class="fgd__axes">
        <!-- Withheld per caller, not per grid: the heading names what the pickers below
             already say for themselves once the table has real column headers under it
             (a caller may still want it on a grid an operator is building from scratch). -->
        @if (!hideAxesLabel()) {
          <h4 class="fgd__micro" i18n="@@fact_grid.axes">What this table is keyed by</h4>
        }
        <!-- ONE wrapping row, not a column of one select each. These ARE the table's
             columns and they read left to right below, so stacked they described a
             left-to-right thing top to bottom — three 32px selects and three detached
             bins, ~200px of chrome before the first figure. -->
        <div class="fgd__axis-list">
          @for (axis of config().axes; track $index) {
            <div class="fgd__axis">
              <nz-select
                class="fgd__fact"
                [ngModel]="axis.factKey"
                (ngModelChange)="setAxisFact($index, $event)"
                nzShowSearch
                [nzPlaceHolder]="axisPlaceholder"
              >
                @for (fact of axisChoices(); track fact.key) {
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
        </div>
      </section>
      }

      <!-- ② THE CELLS. One row per combination the bank's card prints. A box left blank is
           "whatever the answer", which is how one figure covers a whole axis. Capped to
           [maxVisibleRows] rows tall, when set, so a table with real bank data (the car
           card's 20-row rate table) does not push the rest of the page below the fold — the
           rows are still all there, and still all editable, just under a scrollbar. -->
      <div class="fgd__scroll" [style.maxHeight.px]="scrollMaxHeightPx()">
        <table class="fgd__table">
          <thead>
            <tr>
              @for (axis of config().axes; track $index) {
                <th>{{ factLabel(axis.factKey) }}</th>
              }
              <th class="fgd__value-head">
                @switch (valueKind()) {
                  @case ('months') {
                    @if (monthsBound() === 'min') {
                      <span i18n="@@fact_grid.value_months_min">Shortest term (months)</span>
                    } @else {
                      <span i18n="@@fact_grid.value_months">Longest term (months)</span>
                    }
                  }
                  @case ('sharePercent') {
                    <span i18n="@@fact_grid.value_share">Financed share %</span>
                  }
                  @case ('amountEGP') {
                    <span i18n="@@fact_grid.value_amount">Smallest loan (EGP)</span>
                  }
                  @default {
                    <span i18n="@@fact_grid.value_rate">Rate %</span>
                  }
                }
              </th>
              <!-- Deliberately unnamed: the column holds one Remove button per row and each
                   carries its own label naming the row it deletes, so a heading here would be
                   announced before every one of them and add nothing. -->
              <th class="fgd__act-head"></th>
            </tr>
          </thead>
          <tbody>
            @for (cell of config().cells; track $index; let cellIndex = $index) {
              <tr [class.is-group-start]="startsGroup(cellIndex)">
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
                <td class="fgd__value-cell">
                  <!-- GROUPED only when the cell holds money (A27). amountEGP is the first
                       money-typed kind this editor has ever had, and a seven-digit floor
                       rendered as 1000000 is the one figure here where an extra zero is
                       invisible: it composes by max, so it silently raises the smallest loan
                       the bank will write. A rate, a share and a month count are not money and
                       keep their ungrouped digits; the directive reports the same raw string
                       either way, so nothing downstream changes. -->
                  <input
                    nz-input
                    class="fgd__value"
                    appMoneyInput
                    [appMoneyInput]="valueKind() === 'amountEGP'"
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
        display: block;
      }
      /* The axes ARE the columns below, so they lay out the way the columns do. Stacked,
         three of them cost ~200px of chrome above the first figure and put three detached
         bins in a column of their own. */
      .fgd__axis-list {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2) var(--space-3);
      }
      .fgd__axis {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        flex-wrap: wrap;
      }
      .fgd__fact {
        min-width: 13rem;
      }
      /* The table scrolls in ITS OWN box. Four axes of band edges is ~70rem, and without
         this the PAGE scrolls sideways — which the house measures at 0 on every screen, and
         which pushes the wizard's own action bar off to the side. overflow-y is harmless
         with no [maxVisibleRows] set (there is no max-height for it to act on); with one it
         is what keeps the extra rows a scroll away instead of clipped and unreachable. */
      .fgd__scroll {
        overflow-x: auto;
        overflow-y: auto;
      }
      .fgd__table {
        width: 100%;
        border-collapse: collapse;
      }
      .fgd__table th,
      .fgd__table td {
        padding: var(--space-2);
        text-align: start;
        vertical-align: middle;
      }
      /* A rule under every row draws twenty lines through a table whose rows come in five
         groups of four — the deposit band repeats down the first column and the eye has to
         count to find where one band ends. So the row divider goes SUBTLE and the boundary
         between one first-axis value and the next carries the strong one: five blocks,
         readable without reading a single figure.

         Derived from the cells themselves and never stored: a table somebody has left out
         of order shows as fragmented groups, which is the truth about it. */
      .fgd__table tbody td {
        border-block-end: 1px solid var(--border-subtle);
      }
      .fgd__table tbody tr.is-group-start:not(:first-child) td {
        border-block-start: 1px solid var(--color-border-default);
      }
      .fgd__table thead th {
        padding-block-end: var(--space-2);
        border-block-end: 1px solid var(--color-border-default);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--color-text-secondary);
      }
      /* Its figures are end-aligned and tabular, so the heading follows them — and the
         column shrinks to the input so "end" lands on the input's own edge rather than at
         the far side of a column stretched by the axes beside it. Specificity has to beat
         the .fgd__table th rule, which sets start on every heading. */
      .fgd__table th.fgd__value-head,
      .fgd__table td.fgd__value-cell {
        inline-size: 1%;
        white-space: nowrap;
        text-align: start;
      }
      .fgd__act-head {
        inline-size: 1%;
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
        text-align: start;
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

  /**
   * Which END of the term a `months` table states. Default `'max'`, which is every caller
   * that predates the plan tables.
   *
   * `months` was one kind for one field until `tenor.minMonthsByFact` existed, so every label
   * on it says "longest" — and a row titled *Shortest term* opened a table headed *LONGEST
   * TERM (MONTHS)* whose boxes announced themselves as "longest term in months". One screen
   * contradicting itself about the figure an operator is typing.
   *
   * A bound rather than a free label: what changes between the two is one word in four places,
   * and a caller-supplied string would let two hosts describe one field differently — and
   * would have to be translated by whoever passed it.
   */
  readonly monthsBound = input<'max' | 'min'>('max');

  /**
   * The rate card is sold by down payment and nothing else — every seeded rate table keys on
   * it alone, and the axis controls (pick a second question, add a third, remove the only
   * one) offer a generality this table has never used and that an operator could reach for
   * by mistake, keying a rate off a question the sheet never mentions. `true` hides the whole
   * "what this table is keyed by" section and pins the sole axis to the down-payment fact —
   * every other grid (tenor, LTV, the vehicle-age ceiling) is genuinely multi-axis and keeps
   * its picker.
   */
  readonly lockAxisToDownPayment = input(false);

  /** Hides the axis pickers without touching the stored axes — the table stays keyed as saved. */
  readonly hideAxes = input(false);

  /**
   * Hides the "What this table is keyed by" heading while leaving the pickers under it in
   * place. For a caller whose column headers already say the same thing one scroll down (the
   * car rate table's axes ARE `DOWN PAYMENT` / `WHERE THE CAR WAS BUILT` / `WHAT THE CAR RUNS
   * ON`, printed again as the header row) the heading is the one thing on screen saying
   * nothing new — never withheld together with the pickers themselves, which stay reachable
   * so an operator can still repoint an axis.
   */
  readonly hideAxesLabel = input(false);

  /**
   * Caps the row list to roughly this many rows tall, under a scroll, rather than rendering
   * every row open on the page. `null` (every caller that predates this) renders them all —
   * most of this editor's tables hold two or three rows and a cap would just add a border for
   * nothing to scroll. The car card's rate table holds 20 real, bank-quoted rows (5 deposit
   * bands × origin × fuel), and unfolded that is most of a screen's height before the next
   * plan even comes into view.
   */
  readonly maxVisibleRows = input<number | null>(null);

  /** Measured off the live table: a `td`/`th` pair at `--space-2` padding plus its content. */
  private static readonly HEADER_HEIGHT_PX = 35;
  private static readonly ROW_HEIGHT_PX = 61;

  /** `null` renders unclipped — `[style.maxHeight.px]` with `null` sets no inline style at all. */
  protected readonly scrollMaxHeightPx = computed<number | null>(() => {
    const rows = this.maxVisibleRows();
    if (rows === null || rows <= 0) return null;
    return (
      FactGridEditorComponent.HEADER_HEIGHT_PX + rows * FactGridEditorComponent.ROW_HEIGHT_PX
    );
  });

  readonly maxAxes = MAX_GRID_AXES;
  readonly axisPlaceholder = $localize`:@@fact_grid.pick_fact:Pick a question`;
  readonly anyPlaceholder = $localize`:@@fact_grid.any:Any`;
  readonly removeAxisAria = $localize`:@@fact_grid.remove_axis:Remove this axis`;

  constructor() {
    // Pins the axis rather than assuming the caller starts from `emptyFactGrid()` — a program
    // already saved with the down-payment axis is left alone (the guard reads it right back
    // out and does nothing), and a fresh grid is corrected on the first render instead of
    // rendering one blank "Pick a question" select the operator can no longer see a use for.
    effect(() => {
      if (!this.lockAxisToDownPayment()) return;
      const axes = this.config().axes;
      if (axes.length === 1 && axes[0]?.factKey !== DOWN_PAYMENT_PERCENT_FACT_KEY) {
        this.setAxisFact(0, DOWN_PAYMENT_PERCENT_FACT_KEY);
      }
    });
  }

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
   * What the axis picker offers: the two derived axes first, then the registry.
   *
   * First because they are the two every auto card is laid out by, and a picker that buries
   * them under thirty questions is one an operator scrolls past. A tenor grid drops the term
   * itself — keying the ceiling on the term computes the thing it is deciding, which the
   * server refuses as `axis_circular`, so it is not offered rather than offered and refused.
   */
  readonly axisChoices = computed(() => {
    const derived = DERIVED_AXES.filter(
      (a) => !(this.valueKind() === 'months' && a.key === TENOR_FACT_KEY),
    );
    return [...derived, ...this.facts().map((f) => ({ key: f.key, label: f.label }))];
  });

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
    switch (this.valueKind()) {
      case 'months':
        return this.monthsBound() === 'min'
          ? $localize`:@@fact_grid.value_months_min_aria:Row ${row}:row:, shortest term in months`
          : $localize`:@@fact_grid.value_months_aria:Row ${row}:row:, longest term in months`;
      case 'sharePercent':
        return $localize`:@@fact_grid.value_share_aria:Row ${row}:row:, financed share percent`;
      case 'amountEGP':
        return $localize`:@@fact_grid.value_amount_aria:Row ${row}:row:, smallest loan in pounds`;
      default:
        return $localize`:@@fact_grid.value_rate_aria:Row ${row}:row:, rate percent`;
    }
  }

  factLabel(key: string): string {
    return this.axisChoices().find((f) => f.key === key)?.label ?? key;
  }

  /**
   * Whether this row opens a new block — its FIRST axis states something different from the
   * row above it.
   *
   * The rate card this control was built for prints twenty rows over five deposit bands, so
   * the first column repeats itself four times running and a rule under every row gives the
   * eye nothing to count by. The strong divider moves to the boundary, and the table reads
   * as the five plans it is.
   *
   * Derived, never stored, and never a sort: a table left out of order shows as fragmented
   * blocks, which is the truth about it and is the one thing re-ordering here would hide.
   */
  startsGroup(cellIndex: number): boolean {
    if (cellIndex === 0) return true;
    const cells = this.config().cells;
    const key = (i: number): string => JSON.stringify(cells[i]?.keys[0] ?? null);
    return key(cellIndex) !== key(cellIndex - 1);
  }

  private isDerivedAxis(key: string | undefined): boolean {
    return key !== undefined && DERIVED_AXES.some((a) => a.key === key);
  }

  /** A choice axis renders pickers; a numeric one renders band edges. */
  isChoiceAxis(index: number): boolean {
    const key = this.config().axes[index]?.factKey;
    // Both derived axes are numbers — a percentage and a month count — so they render band
    // edges. Answered before the registry lookup, which would never find them.
    if (this.isDerivedAxis(key)) return false;
    const fact = this.facts().find((f) => f.key === key);
    // Unknown while the registry loads, and a NUMERIC-shaped fallback is the safe one: the
    // band inputs accept anything an operator types, where an empty option list would offer
    // them nothing at all.
    return fact?.question?.type === 'SINGLE_SELECT' || fact?.question?.type === 'MULTI_SELECT';
  }

  axisHasClasses(index: number): boolean {
    const key = this.config().axes[index]?.factKey;
    // A number is filed under no class, so the answer/class toggle is not offered — and the
    // server refuses `parentClass` on a numeric axis outright (`axis_class_on_numeric`).
    if (this.isDerivedAxis(key)) return false;
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
        switch (this.valueKind()) {
          case 'months':
            return $localize`:@@fact_grid.err_months:Every row needs a whole number of months, above zero and up to 480.`;
          case 'sharePercent':
            return $localize`:@@fact_grid.err_share:Every row needs a share above zero and at most 100.`;
          case 'amountEGP':
            return $localize`:@@fact_grid.err_amount:Every row needs an amount above zero.`;
          default:
            return $localize`:@@fact_grid.err_rate:Every row needs a rate above zero.`;
        }
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
