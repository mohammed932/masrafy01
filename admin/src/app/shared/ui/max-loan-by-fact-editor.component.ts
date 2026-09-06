import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { DeleteOutline, PlusOutline, WarningOutline } from '@ant-design/icons-angular/icons';
import { MoneyInputDirective } from '@core/directives/money-input.directive';
import { formatGroupedNumber } from '@core/directives/money-format';
import { DERIVED_FACTS, derivedFactByKey } from '@core/surrogate-facts';
import type { RegistryFact } from '../../features/bank-programs/bank-programs.types';
import {
  capCellsOf,
  capConfigFrom,
  capGridFrom,
  capShapeConflict,
  maxLoanByFactErrorFor,
  missingCapCells,
  withColumnFact,
  withRowFact,
  withoutColumn,
} from './max-loan-by-fact.rules';
import type {
  CapCell,
  CapGridCell,
  MaxLoanByFactConfig,
  MaxLoanByFactError,
  MaxLoanByFactRow,
  MaxLoanByFactVia,
  ProductCapShape,
} from './max-loan-by-fact.rules';

/**
 * The pure half lives in `max-loan-by-fact.rules.ts` so it can be unit-tested without
 * Angular. Re-exported here because this file is the one every host imports from, and moving
 * the type would be a rename across the wizard for no gain.
 */
export {
  capCellsOf,
  capConfigFrom,
  capGridFrom,
  capShapeConflict,
  maxLoanByFactErrorFor,
  missingCapCells,
  withColumnFact,
  withRowFact,
  withoutColumn,
} from './max-loan-by-fact.rules';
export type {
  CapCell,
  CapGridCell,
  MaxLoanByFactConfig,
  MaxLoanByFactError,
  MaxLoanByFactRow,
  MaxLoanByFactVia,
  ProductCapShape,
} from './max-loan-by-fact.rules';

/**
 * The program's MAXIMUM LOAN, keyed by an answer the applicant gave.
 *
 * This is the second table nine bank sheets print under "Loan Amount — Maximum": by property
 * type, by city, by CD tier, by school type, by branch, by company coding, by down-payment
 * bracket. It reads as "two ways to reach the figure, take the lower" and it is not — it is
 * this program's ceiling, keyed by an answer, which is why it lives beside the flat maximum
 * rather than inside the income calculation.
 *
 * Three things the control enforces rather than validates after the fact:
 *
 *   · the ROW shape follows the fact. Pick a question with options and the rows are option
 *     pickers; pick a numeric one and they are `[from, to)` band edges. Switching the fact
 *     clears the rows, because a row keyed the other way matches nothing at runtime and
 *     would read as a configured table that caps nobody.
 *   · bands are HALF-OPEN — `from` inclusive, `to` exclusive — stated on screen, so exactly
 *     500,000 lands in `500K–1M` and no operator has to guess.
 *   · `onNoMatch` is always answered. It has no platform default: "no cap" quotes far above
 *     the bank's policy and "cap zero" is a blank card, and which one a bank means is the
 *     bank's answer.
 */
@Component({
  selector: 'app-max-loan-by-fact-editor',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    FormsModule,
    MoneyInputDirective,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzRadioModule,
    NzSelectModule,
    NzToolTipModule,
  ],
  providers: [provideNzIconsPatch([DeleteOutline, PlusOutline, WarningOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (productDriven()) {
      <!-- THE PRODUCT'S GRID. No fact pickers, no Add a row, no per-row delete, no Remove
           the table: which answers key this cap and in what order is the product's
           statement, and every bank selling it caps the same answers. What differs between
           banks is the amounts, so the amounts are the only thing on screen that is a
           control. -->
      <div class="mlf">
        <p class="mlf__declared">{{ declaredBy() }}</p>

        <table class="mlf__table mlf__table--grid">
          <thead>
            <tr>
              <th>
                @if (productCap()?.bands) {
                  <span i18n="@@max_loan_by_fact.band">From … up to (not including)</span>
                } @else {
                  <span i18n="@@max_loan_by_fact.answer">Answer</span>
                }
              </th>
              @for (column of gridColumns(); track column) {
                <th class="mlf__amount-head">{{ column }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of gridRows(); track row.key) {
              <tr>
                <th scope="row" class="mlf__rowhead">
                  <span>{{ row.label }}</span>
                  @if (rowKeyIsUnknown(row.key)) {
                    <!-- The key the product declares is not an answer this question offers
                         any more. Said, never hidden: a row that matches nobody is a figure
                         the bank thinks it has stated. -->
                    <span class="mlf__stale" i18n="@@max_loan_by_fact.key_not_in_list"
                      >not an answer any more</span
                    >
                  }
                </th>
                @for (cell of row.cells; track cell.index) {
                  <td>
                    <input
                      [attr.disabled]="locked() ? '' : null"
                      nz-input
                      appMoneyInput
                      inputmode="numeric"
                      [ngModel]="cell.amount"
                      (ngModelChange)="setCell(cell.index, $event)"
                      [attr.aria-label]="row.label"
                      placeholder="1,500,000"
                    />
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>

        @if (missingCells() > 0) {
          <p class="mlf__missing" role="status">{{ missingNotice(missingCells()) }}</p>
        }

        @if (unlistedRows().length > 0) {
          <!-- Stored rows the product's grid does not declare — a blueprint that changed, an
               older seed, a key the question no longer carries. They keep their amount and
               stay editable, because the engine is still reading them; hiding them is how a
               live figure becomes unreachable. -->
          <div class="mlf__unlisted">
            <h4 i18n="@@max_loan_by_fact.unlisted_heading">Not in the product's table</h4>
            <p class="mlf__hint" i18n="@@max_loan_by_fact.unlisted_hint">
              This program still caps on these, so they are still read. Remove one only if the bank
              no longer states it.
            </p>
            @for (row of unlistedRows(); track unlistedKey(row); let i = $index) {
              <p class="mlf__unlisted-row">
                <span class="mlf__unlisted-key"
                  >{{ row.rowKey ?? row.fromInclusive
                  }}{{ row.columnKey ? ' · ' + row.columnKey : '' }}</span
                >
                <input
                  [attr.disabled]="locked() ? '' : null"
                  nz-input
                  appMoneyInput
                  inputmode="numeric"
                  [ngModel]="row.maxAmountEGP"
                  (ngModelChange)="setUnlisted(i, $event)"
                />
                <button
                  [disabled]="locked()"
                  nz-button
                  nzType="text"
                  nzDanger
                  type="button"
                  nz-tooltip
                  i18n-nzTooltipTitle="@@max_loan_by_fact.remove_row"
                  nzTooltipTitle="Remove this row"
                  (click)="removeUnlisted(i)"
                >
                  <span nz-icon nzType="delete"></span>
                </button>
              </p>
            }
          </div>
        }

        @if (productCap()?.bands) {
          <p class="mlf__hint" i18n="@@max_loan_by_fact.half_open">
            Bands are half-open: “from” counts, “up to” does not. Exactly 500,000 lands in the
            500,000 → 1,000,000 row.
          </p>
        }

        <ng-container *ngTemplateOutlet="noMatch"></ng-container>

        @if (config() !== null) {
          <p class="mlf__foot">
            <button
              [disabled]="locked()"
              nz-button
              nzType="text"
              type="button"
              (click)="clearAmounts()"
            >
              <span i18n="@@max_loan_by_fact.clear_all">Clear every amount</span>
            </button>
          </p>
        }

        @if (error(); as err) {
          <p class="mlf__error" role="alert">
            <span nz-icon nzType="warning"></span>
            <span>{{ errorText(err) }}</span>
          </p>
        }
      </div>
    } @else if (config() === null) {
      <button
        [disabled]="locked()"
        nz-button
        nzType="dashed"
        type="button"
        class="mlf__enable"
        (click)="enable()"
      >
        <span nz-icon nzType="plus"></span>
        <span i18n="@@max_loan_by_fact.enable">Cap the maximum by an answer</span>
      </button>
      <!-- One line, not two: this sits inside the loan-amount card as an OPTIONAL
           extra, and a two-line paragraph beside a dashed button reads as work the
           operator has to do. The sheet cue it used to carry ("the second table
           under ‘Loan Amount — Maximum’") is the section title's job. -->
      <p class="mlf__hint" i18n="@@max_loan_by_fact.enable_hint">
        Only if this bank’s maximum changes with an answer — property type, city, school, branch or
        down-payment bracket.
      </p>
    } @else {
      <div class="mlf">
        <div class="mlf__axes">
          <span class="mlf__label" i18n="@@max_loan_by_fact.keyed_by">Keyed by</span>
          <nz-select
            [nzDisabled]="locked()"
            class="mlf__select"
            [ngModel]="config()!.factKey"
            (ngModelChange)="changeFact($event)"
          >
            @for (fact of keyableFacts(); track fact.key) {
              <nz-option [nzValue]="fact.key" [nzLabel]="fact.label"></nz-option>
            }
          </nz-select>

          <span class="mlf__label" i18n="@@max_loan_by_fact.second_column">Second column</span>
          <nz-select
            [nzDisabled]="locked()"
            class="mlf__select"
            nzAllowClear
            [ngModel]="config()!.columnFactKey ?? null"
            (ngModelChange)="changeColumnFact($event)"
            i18n-nzPlaceHolder="@@max_loan_by_fact.no_second_column"
            nzPlaceHolder="One column"
          >
            @for (fact of columnFacts(); track fact.key) {
              <nz-option [nzValue]="fact.key" [nzLabel]="fact.label"></nz-option>
            }
          </nz-select>
        </div>

        @if (rowClassKeyable() || columnClassKeyable()) {
          <fieldset class="mlf__vias">
            <legend i18n="@@max_loan_by_fact.via_legend">What the keys name</legend>
            @if (rowClassKeyable()) {
              <label class="mlf__via">
                <input
                  [attr.disabled]="locked() ? '' : null"
                  type="checkbox"
                  [checked]="config()!.rowVia === 'parentClass'"
                  (change)="changeRowVia(rowViaChecked($event) ? 'parentClass' : 'answer')"
                />
                <span i18n="@@max_loan_by_fact.row_via_class"
                  >Key the rows by the class the answer is filed under</span
                >
              </label>
            }
            @if (columnClassKeyable()) {
              <label class="mlf__via">
                <input
                  [attr.disabled]="locked() ? '' : null"
                  type="checkbox"
                  [checked]="config()!.columnVia === 'parentClass'"
                  (change)="changeColumnVia(rowViaChecked($event) ? 'parentClass' : 'answer')"
                />
                <span i18n="@@max_loan_by_fact.column_via_class"
                  >Key the columns by the class the answer is filed under</span
                >
              </label>
            }
            <p class="mlf__hint" i18n="@@max_loan_by_fact.via_hint">
              One row per class instead of one per answer — three city tiers rather than
              twenty-seven governorates. A value added to the list later reads its class’s row on
              day one, with no edit to this table. Changing this clears the rows: the keys come from
              a different list either way.
            </p>
          </fieldset>
        }

        <table class="mlf__table">
          <thead>
            <tr>
              <th>
                @if (isNumericFact()) {
                  <span i18n="@@max_loan_by_fact.band">From … up to (not including)</span>
                } @else {
                  <span i18n="@@max_loan_by_fact.answer">Answer</span>
                }
              </th>
              @if (config()!.columnFactKey) {
                <th i18n="@@max_loan_by_fact.column">Column</th>
              }
              <th i18n="@@max_loan_by_fact.max">Maximum loan</th>
              <th class="mlf__actions"></th>
            </tr>
          </thead>
          <tbody>
            @for (row of config()!.rows; track $index) {
              <tr>
                <td>
                  @if (isNumericFact()) {
                    <span class="mlf__band">
                      <input
                        [attr.disabled]="locked() ? '' : null"
                        nz-input
                        appMoneyInput
                        inputmode="numeric"
                        [ngModel]="row.fromInclusive ?? ''"
                        (ngModelChange)="patchRow($index, { fromInclusive: $event })"
                        placeholder="250,000"
                      />
                      <span class="mlf__dash">→</span>
                      <input
                        [attr.disabled]="locked() ? '' : null"
                        nz-input
                        appMoneyInput
                        inputmode="numeric"
                        [ngModel]="row.toExclusive ?? ''"
                        (ngModelChange)="patchRow($index, { toExclusive: $event })"
                        i18n-placeholder="@@max_loan_by_fact.open_ended"
                        placeholder="and above"
                      />
                    </span>
                  } @else {
                    <nz-select
                      [nzDisabled]="locked()"
                      class="mlf__select"
                      [ngModel]="row.rowKey ?? null"
                      (ngModelChange)="patchRow($index, { rowKey: $event })"
                    >
                      @for (option of rowOptions(); track option.code) {
                        <nz-option [nzValue]="option.code" [nzLabel]="option.label"></nz-option>
                      }
                    </nz-select>
                  }
                </td>
                @if (config()!.columnFactKey) {
                  <td>
                    <nz-select
                      [nzDisabled]="locked()"
                      class="mlf__select"
                      nzAllowClear
                      [ngModel]="row.columnKey ?? null"
                      (ngModelChange)="patchRow($index, { columnKey: $event })"
                      i18n-nzPlaceHolder="@@max_loan_by_fact.every_column"
                      nzPlaceHolder="Every column"
                    >
                      @for (option of columnOptions(); track option.code) {
                        <nz-option [nzValue]="option.code" [nzLabel]="option.label"></nz-option>
                      }
                    </nz-select>
                  </td>
                }
                <td>
                  <input
                    [attr.disabled]="locked() ? '' : null"
                    nz-input
                    appMoneyInput
                    inputmode="numeric"
                    [ngModel]="row.maxAmountEGP"
                    (ngModelChange)="patchRow($index, { maxAmountEGP: $event })"
                    placeholder="1,500,000"
                  />
                </td>
                <td class="mlf__actions">
                  <button
                    [disabled]="locked()"
                    nz-button
                    nzType="text"
                    nzDanger
                    type="button"
                    nz-tooltip
                    i18n-nzTooltipTitle="@@max_loan_by_fact.remove_row"
                    nzTooltipTitle="Remove this row"
                    (click)="removeRow($index)"
                  >
                    <span nz-icon nzType="delete"></span>
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>

        <div class="mlf__foot">
          <button [disabled]="locked()" nz-button nzType="dashed" type="button" (click)="addRow()">
            <span nz-icon nzType="plus"></span>
            <span i18n="@@max_loan_by_fact.add_row">Add a row</span>
          </button>
          <button
            [disabled]="locked()"
            nz-button
            nzType="text"
            nzDanger
            type="button"
            (click)="disable()"
          >
            <span i18n="@@max_loan_by_fact.remove_table">Remove the table</span>
          </button>
        </div>

        @if (isNumericFact()) {
          <p class="mlf__hint" i18n="@@max_loan_by_fact.half_open">
            Bands are half-open: “from” counts, “up to” does not. Exactly 500,000 lands in the
            500,000 → 1,000,000 row.
          </p>
        }

        <ng-container *ngTemplateOutlet="noMatch"></ng-container>

        @if (error(); as err) {
          <p class="mlf__error" role="alert">
            <span nz-icon nzType="warning"></span>
            <span>{{ errorText(err) }}</span>
          </p>
        }
      </div>
    }

    <!-- ONE definition, two branches. The product-driven grid and the free-form table ask
         the same question, and two copies of it drifted apart the moment one of them gained
         a control the other did not — which is also two more of the same lint waiver. -->
    <ng-template #noMatch>
      <fieldset class="mlf__nomatch">
        <legend i18n="@@max_loan_by_fact.no_match">An answer with no row</legend>
        <nz-radio-group
          [nzDisabled]="locked()"
          [ngModel]="effectiveNoMatch()"
          (ngModelChange)="setNoMatch($event)"
        >
          <label nz-radio nzValue="useProgramMax">
            <span i18n="@@max_loan_by_fact.use_program_max"
              >Falls back to this program’s maximum</span
            >
          </label>
          <label nz-radio nzValue="reject">
            <span i18n="@@max_loan_by_fact.reject">Gets no figures, with a stated reason</span>
          </label>
        </nz-radio-group>
        <p class="mlf__hint" i18n="@@max_loan_by_fact.no_match_hint">
          There is no third option on purpose. “No cap” would quote above the bank’s policy and “cap
          zero” is a blank card, so one of these two has to be the bank’s answer.
        </p>
      </fieldset>
    </ng-template>
  `,
  styles: [
    `
      .mlf {
        display: grid;
        gap: 12px;
      }
      .mlf__axes {
        display: grid;
        grid-template-columns: auto minmax(180px, 1fr) auto minmax(180px, 1fr);
        align-items: center;
        gap: 8px 10px;
      }
      .mlf__label {
        font-size: 13px;
        color: var(--color-text-secondary);
      }
      .mlf__vias {
        display: grid;
        gap: 6px;
        margin: 0;
        padding: 10px 12px;
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
      }
      .mlf__vias legend {
        padding-inline: 6px;
        font-size: 12px;
        color: var(--color-text-secondary);
      }
      .mlf__via {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--color-text-primary);
        cursor: pointer;
      }
      .mlf__select {
        width: 100%;
      }
      .mlf__table {
        width: 100%;
        border-collapse: collapse;
      }
      .mlf__table th {
        text-align: start;
        font-size: 12px;
        font-weight: 600;
        color: var(--color-text-secondary);
        padding: 4px 6px;
      }
      .mlf__table td {
        padding: 4px 6px;
        vertical-align: middle;
      }
      .mlf__band {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .mlf__dash {
        color: var(--color-text-secondary);
      }
      .mlf__actions {
        width: 44px;
        text-align: end;
      }
      .mlf__foot {
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }
      /* THE PRODUCT'S GRID.
         One screen row per answer with a box per column, which is how the sheets print it —
         and which puts the two figures being compared on one line instead of six stacked
         rows. Secondary ink on the lede, never tertiary: it is a sentence that has to be
         read, and tertiary measures 3.83:1 on a card in light mode. */
      .mlf__declared {
        margin: 0;
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
      }
      .mlf__table--grid th.mlf__rowhead {
        inline-size: 40%;
        font-weight: var(--font-semibold);
        color: var(--color-text-primary);
        vertical-align: middle;
      }
      .mlf__table--grid .mlf__amount-head {
        inline-size: 30%;
      }
      /* A column of money compares digit by digit or it compares nothing. */
      .mlf__table--grid input {
        font-variant-numeric: tabular-nums;
      }
      .mlf__stale {
        display: inline-block;
        margin-inline-start: var(--space-2);
        padding-inline: var(--space-2);
        border-radius: var(--radius-sm);
        background: var(--color-warning-bg);
        color: var(--color-text-primary);
        font-size: var(--text-xs);
        font-weight: var(--font-normal);
      }
      .mlf__missing {
        margin: 0;
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
      }
      .mlf__unlisted {
        border-block-start: 1px solid var(--color-border-default);
        padding-block-start: var(--space-3);
        display: grid;
        gap: var(--space-2);
      }
      .mlf__unlisted h4 {
        margin: 0;
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        color: var(--color-text-primary);
      }
      .mlf__unlisted-row {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        margin: 0;
      }
      .mlf__unlisted-key {
        flex: 1;
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
      }

      .mlf__hint {
        margin: 0;
        font-size: 12px;
        color: var(--color-text-secondary);
      }
      .mlf__nomatch {
        /* The token this used to name is defined by no palette in this theme, so the
           declaration was invalid at computed-value time and the fieldset had no border. */
        border: 1px solid var(--color-border-default);
        border-radius: 8px;
        padding: 10px 12px;
        display: grid;
        gap: 6px;
      }
      .mlf__nomatch legend {
        font-size: 12px;
        font-weight: 600;
        padding: 0 4px;
      }
      .mlf__error {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 0;
        padding: 6px 10px;
        border-radius: 8px;
        background: var(--color-warning-bg);
        color: var(--color-warning);
        font-size: 13px;
      }
      .mlf__enable {
        width: 100%;
      }
    `,
  ],
})
export class MaxLoanByFactEditorComponent {
  /** Every fact the registry can serve, as the host already computed it. */
  readonly facts = input<readonly RegistryFact[]>([]);

  /** `null` = this program states no cap table, which is the common case. */
  readonly config = model<MaxLoanByFactConfig | null>(null);

  /**
   * The derived per-bank axes, as fact-shaped rows: known here · topping up a loan here ·
   * holds a card or deposit here.
   *
   * None has a registry row or a bound question, so this screen reads their labels and
   * columns from the one place that carries them (`@core/surrogate-facts`). Column-only: a
   * cap keyed by one of them alone would be a table with two rows and no subject.
   */
  private readonly derivedFacts = DERIVED_FACTS;

  // --- the product's declared grid -------------------------------------------------------
  //
  // When the program's catalog name resolves to a surrogate product whose blueprint declares
  // a cap, this control stops being a table builder. The axes and the keys are the product's,
  // in the order its sheet prints them, and the only thing the bank states is the amounts —
  // which is what the operator asked for and what nine of the source sheets actually print.

  /** The grid this product declares, or `null` for a program with no product cap. */
  readonly productCap = input<ProductCapShape | null>(null);

  /** The amounts an operator set once on the product, for a bank that has typed none. */
  readonly productDefaults = input<readonly MaxLoanByFactRow[]>([]);

  /** The product's own name, for the one line that says where the grid came from. */
  readonly productLabel = input<string>('');

  /**
   * Every control refused the pointer, for a program that has not yet said HOW it works the
   * figure out. Additive and default-off, so the four other mounts are byte-identical.
   *
   * The grid may already be on screen while locked — `seedCapFromProduct` runs when the rule
   * arrives, before any way is picked — and that is right: the operator sees the product's
   * grid greyed, under one line on the card that says what to do first. The `config` model is
   * never touched, so nothing here can change a stored figure; only the pointer is refused.
   */
  readonly locked = input<boolean>(false);

  /**
   * Is the grid the product's?
   *
   * FALSE when a stored table is keyed some other way. Re-keying it to the product's axes
   * would leave every one of its rows matching nothing at runtime — a table that reads as
   * configured and caps nobody, which is the exact failure `withRowFact` clears rows to
   * avoid. The free-form controls stay, the server refuses the state on the next save and
   * names it, and nothing here hides it.
   */
  protected readonly productDriven = computed<boolean>(() => {
    const shape = this.productCap();
    return (
      shape !== null && capCellsOf(shape).length > 0 && !capShapeConflict(shape, this.config())
    );
  });

  /**
   * `onNoMatch` before there is a table to store it on.
   *
   * The bank's answer, defaulted from the product's — never forced to it.
   * `ABK-PER-DOCTORS_CLINIC` stores `reject` where its blueprint declares `useProgramMax`,
   * and the comment beside that seed says why: a doctor whose city arrives unanswered on an
   * older snapshot would otherwise be quoted the top-up Cairo cell, frozen onto an immutable
   * offer.
   */
  private readonly pendingNoMatch = signal<'useProgramMax' | 'reject' | null>(null);

  protected readonly effectiveNoMatch = computed<'useProgramMax' | 'reject'>(
    () =>
      this.config()?.onNoMatch ??
      this.pendingNoMatch() ??
      this.productCap()?.onNoMatch ??
      'useProgramMax',
  );

  /** The declared cells with their amounts, plus anything stored outside the grid. */
  private readonly grid = computed(() => {
    const shape = this.productCap();
    if (shape === null) return { declared: [], unlisted: [] };
    return capGridFrom(shape, this.config(), this.productDefaults());
  });

  /** The grid as the sheet prints it: one screen row per key, one box per column. */
  protected readonly gridRows = computed<
    Array<{ key: string; label: string; cells: Array<{ index: number; amount: string }> }>
  >(() => {
    const shape = this.productCap();
    if (shape === null) return [];
    const width = Math.max(1, shape.columnKeys?.length ?? 1);
    const declared = this.grid().declared;
    const rows: Array<{
      key: string;
      label: string;
      cells: Array<{ index: number; amount: string }>;
    }> = [];
    for (let start = 0; start < declared.length; start += width) {
      const head = declared[start];
      if (head === undefined) continue;
      rows.push({
        key: head.cell.rowKey ?? `${head.cell.fromInclusive ?? ''}..${head.cell.toExclusive ?? ''}`,
        label: this.rowLabelOf(head.cell),
        cells: declared
          .slice(start, start + width)
          .map((entry, offset) => ({ index: start + offset, amount: entry.amount })),
      });
    }
    return rows;
  });

  /** The column headings, or one unnamed column. */
  protected readonly gridColumns = computed<string[]>(() => {
    const shape = this.productCap();
    const keys = shape?.columnKeys ?? [];
    if (keys.length === 0) return [this.maxLabel];
    const options = this.optionsFor(shape?.columnFactKey, shape?.columnVia);
    return keys.map((key) => options.find((o) => o.code === key)?.label ?? key);
  });

  /** Declared cells still holding no figure — a warning, never an error. */
  protected readonly missingCells = computed<number>(() => {
    const shape = this.productCap();
    return shape === null
      ? 0
      : missingCapCells(shape, this.config(), this.productDefaults()).length;
  });

  /**
   * The rows the grid does not declare, as the operator is editing them.
   *
   * A DRAFT, because deriving them from the config made a blanked box destroy its own row:
   * `capConfigFrom` drops a row with no amount, the derived list re-indexed under the caret,
   * and the next keystroke overwrote the row that had shifted up. Two typed figures gone, in
   * a lane whose whole purpose is that no typed figure is ever lost — and with no Add-a-row
   * to put them back.
   *
   * `null` means "follow the config", which is every arrival; a write forks it. A row leaves
   * only through its own delete button.
   */
  private readonly unlistedDraft = signal<readonly MaxLoanByFactRow[] | null>(null);

  protected readonly unlistedRows = computed<readonly MaxLoanByFactRow[]>(
    () => this.unlistedDraft() ?? this.grid().unlisted,
  );

  /** A stable identity per unlisted row, so `@for` never re-binds a box to another row. */
  protected unlistedKey(row: MaxLoanByFactRow): string {
    return `${row.rowKey ?? `${row.fromInclusive ?? ''}..${row.toExclusive ?? ''}`}|${row.columnKey ?? '_'}`;
  }

  /**
   * A declared row's name.
   *
   * A key the live question no longer carries falls back to the key itself and is flagged —
   * NEVER hidden. That is the `twin_house` / `twin_or_town_house` trap: the row matches
   * nobody, and a grid that quietly dropped it would read as complete while the bank's real
   * figure sat unreachable.
   */
  private rowLabelOf(cell: CapCell): string {
    if (cell.rowKey === undefined) {
      const from = formatGroupedNumber(cell.fromInclusive ?? '0');
      return cell.toExclusive === null || cell.toExclusive === undefined
        ? $localize`:@@max_loan_by_fact.band_open:${from}:FROM: and above`
        : $localize`:@@max_loan_by_fact.band_range:${from}:FROM: → ${formatGroupedNumber(cell.toExclusive)}:TO:`;
    }
    const shape = this.productCap();
    const options = this.optionsFor(shape?.factKey, shape?.rowVia);
    return options.find((o) => o.code === cell.rowKey)?.label ?? cell.rowKey;
  }

  protected rowKeyIsUnknown(key: string): boolean {
    const shape = this.productCap();
    if (shape === null || shape.rowKeys === undefined) return false;
    const options = this.optionsFor(shape.factKey, shape.rowVia);
    return options.length > 0 && !options.some((o) => o.code === key);
  }

  /** Write one box. The whole config is rebuilt, so a cleared box drops its row. */
  protected setCell(index: number, amount: string): void {
    const declared = this.grid().declared.map((entry, i) =>
      i === index ? { ...entry, amount } : entry,
    );
    this.writeGrid(declared, this.unlistedRows());
  }

  /** Edit one of the rows the grid does not declare. The row stays even when emptied. */
  protected setUnlisted(index: number, amount: string): void {
    const next = this.unlistedRows().map((row, i) =>
      i === index ? { ...row, maxAmountEGP: amount } : row,
    );
    this.unlistedDraft.set(next);
    this.writeGrid(this.grid().declared, next);
  }

  protected removeUnlisted(index: number): void {
    const next = this.unlistedRows().filter((_, i) => i !== index);
    this.unlistedDraft.set(next);
    this.writeGrid(this.grid().declared, next);
  }

  /** One writer, so the stored order and the two lanes can never be assembled differently. */
  private writeGrid(declared: readonly CapGridCell[], unlisted: readonly MaxLoanByFactRow[]): void {
    const shape = this.productCap();
    if (shape === null) return;
    this.config.set(
      capConfigFrom(shape, { declared, unlisted }, this.effectiveNoMatch(), this.config()?.rows),
    );
  }

  /**
   * Empty every box.
   *
   * `disable()` under the only name that is true here: the table is not removed, because the
   * product still declares it — what goes is this bank's amounts, and the grid stays on
   * screen ready to be typed into again.
   */
  protected clearAmounts(): void {
    this.pendingNoMatch.set(this.effectiveNoMatch());
    this.unlistedDraft.set([]);
    this.config.set(null);
  }

  protected setNoMatch(value: 'useProgramMax' | 'reject'): void {
    this.pendingNoMatch.set(value);
    const current = this.config();
    if (current !== null) this.config.set({ ...current, onNoMatch: value });
  }

  protected readonly maxLabel = $localize`:@@max_loan_by_fact.max:Maximum loan`;

  /**
   * What an empty box means — and it is NOT the same sentence for both shapes.
   *
   * On a KEYED grid a blank cell is a legitimate partial table: the answer falls to the rule
   * below, which is what `onNoMatch` exists to state. On a BANDED one it is not, and saying
   * so was a lie the save then contradicted: the bands are a contiguous run, so a blank in
   * the middle leaves a hole between two stored edges and both this editor's own check and
   * the server refuse it (`bands_gap`). Told it was fine, the operator met a blocked Continue
   * with nothing on screen to fix.
   */
  protected missingNotice(count: number): string {
    if (this.productCap()?.bands) {
      return count === 1
        ? $localize`:@@max_loan_by_fact.missing_band_one:One bracket has no figure. Every bracket needs one — a gap in the middle is refused.`
        : $localize`:@@max_loan_by_fact.missing_band_many:${count}:COUNT: brackets have no figure. Every bracket needs one — a gap in the middle is refused.`;
    }
    return count === 1
      ? $localize`:@@max_loan_by_fact.missing_one:One box is empty. Anyone whose answer lands there is handled by the rule below.`
      : $localize`:@@max_loan_by_fact.missing_many:${count}:COUNT: boxes are empty. Anyone whose answer lands in one of them is handled by the rule below.`;
  }

  protected declaredBy(): string {
    const shape = this.productCap();
    const fact = this.facts().find((f) => f.key === shape?.factKey)?.label ?? shape?.factKey ?? '';
    const column = shape?.columnFactKey;
    const columnLabel =
      column === undefined
        ? null
        : (derivedFactByKey(column)?.label ??
          this.facts().find((f) => f.key === column)?.label ??
          column);
    const product = this.productLabel();
    return columnLabel === null
      ? $localize`:@@max_loan_by_fact.declared_one:${product}:PRODUCT: caps the maximum by ${fact}:FACT:.`
      : $localize`:@@max_loan_by_fact.declared_two:${product}:PRODUCT: caps the maximum by ${fact}:FACT:, split by ${columnLabel}:COLUMN:.`;
  }

  /** Facts a ROW may be keyed by — anything bound to an answerable question. */
  protected readonly keyableFacts = computed(() =>
    this.facts()
      .filter((f) => f.question !== undefined)
      .map((f) => ({ key: f.key, label: f.label })),
  );

  /** Facts a COLUMN may be keyed by — choice answers only; a number has no branches. */
  protected readonly columnFacts = computed(() => [
    ...this.derivedFacts.map((f) => ({ key: f.key, label: f.label })),
    ...this.facts()
      .filter((f) => f.question?.type === 'SINGLE_SELECT')
      .map((f) => ({ key: f.key, label: f.label })),
  ]);

  protected readonly isNumericFact = computed(() => {
    const key = this.config()?.factKey;
    if (key === undefined) return false;
    return this.facts().find((f) => f.key === key)?.question?.type === 'NUMERIC';
  });

  protected readonly rowOptions = computed(() =>
    this.optionsFor(this.config()?.factKey, this.config()?.rowVia),
  );

  protected readonly columnOptions = computed(() =>
    this.optionsFor(this.config()?.columnFactKey, this.config()?.columnVia),
  );

  /**
   * Whether a fact's answers are filed under classes — i.e. whether keying by the class is
   * even a thing this fact can do.
   *
   * The same guard the income rule's own class column applies: a control offered on a fact
   * with no classes can only ever produce a table that matches nothing.
   */
  private classKeyable(key: string): boolean {
    if (derivedFactByKey(key)) return false;
    const question = this.facts().find((f) => f.key === key)?.question;
    if (!question || question.type !== 'SINGLE_SELECT') return false;
    return question.parentOptions.length > 0;
  }

  protected readonly rowClassKeyable = computed(() => {
    const key = this.config()?.factKey;
    return key !== undefined && this.classKeyable(key);
  });

  protected readonly columnClassKeyable = computed(() => {
    const key = this.config()?.columnFactKey;
    return key !== undefined && this.classKeyable(key);
  });

  protected readonly error = computed(() =>
    maxLoanByFactErrorFor(this.config(), this.isNumericFact(), {
      rowIsDerived: derivedFactByKey(this.config()?.factKey ?? '') !== undefined,
      columnIsDerived: derivedFactByKey(this.config()?.columnFactKey ?? '') !== undefined,
    }),
  );

  private optionsFor(
    key: string | undefined,
    via: MaxLoanByFactVia | undefined,
  ): Array<{ code: string; label: string }> {
    if (key === undefined) return [];
    const derived = derivedFactByKey(key);
    if (derived) return derived.options.map((o) => ({ code: o.code, label: o.label }));
    const question = this.facts().find((f) => f.key === key)?.question;
    // On a class axis the key IS a class, so the picker has to offer the classes — three
    // city tiers, not twenty-seven governorates. Offering the answers there is how a table
    // ends up spelling option codes no row will ever be looked up by.
    const source = via === 'parentClass' ? question?.parentOptions : question?.options;
    return (source ?? []).map((o) => ({
      code: o.code,
      label: this.isAr ? o.labelAr : o.labelEn,
    }));
  }

  private readonly isAr = document.documentElement.lang.startsWith('ar');

  protected enable(): void {
    const first = this.keyableFacts()[0];
    this.config.set({
      factKey: first?.key ?? '',
      rows: [],
      // The safe default, and the only one that changes nothing for an applicant the table
      // does not mention. `reject` is always a deliberate pick.
      onNoMatch: 'useProgramMax',
    });
  }

  protected disable(): void {
    this.config.set(null);
  }

  protected changeFact(factKey: string): void {
    const current = this.config();
    if (current === null || current.factKey === factKey) return;
    this.config.set(withRowFact(current, factKey, (key) => this.classKeyable(key)));
  }

  protected changeColumnFact(columnFactKey: string | null): void {
    const current = this.config();
    if (current === null) return;
    this.config.set(withColumnFact(current, columnFactKey, (key) => this.classKeyable(key)));
  }

  /** The checkbox's own state, without an `$any` cast in the template (A15). */
  protected rowViaChecked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  protected changeRowVia(via: MaxLoanByFactVia): void {
    const current = this.config();
    if (current === null || (current.rowVia ?? 'answer') === via) return;
    // The keys are drawn from a different list either way, so every row is cleared with the
    // axis — the same reason changing the fact clears them.
    this.config.set({ ...current, rowVia: via, rows: [] });
  }

  protected changeColumnVia(via: MaxLoanByFactVia): void {
    const current = this.config();
    if (current === null || (current.columnVia ?? 'answer') === via) return;
    this.config.set({
      ...current,
      columnVia: via,
      rows: current.rows.map((row) => withoutColumn(row)),
    });
  }

  protected changeNoMatch(onNoMatch: 'useProgramMax' | 'reject'): void {
    const current = this.config();
    if (current === null) return;
    this.config.set({ ...current, onNoMatch });
  }

  protected addRow(): void {
    const current = this.config();
    if (current === null) return;
    this.config.set({ ...current, rows: [...current.rows, { maxAmountEGP: '' }] });
  }

  protected removeRow(index: number): void {
    const current = this.config();
    if (current === null) return;
    this.config.set({ ...current, rows: current.rows.filter((_, i) => i !== index) });
  }

  protected patchRow(index: number, patch: Partial<MaxLoanByFactRow>): void {
    const current = this.config();
    if (current === null) return;
    this.config.set({
      ...current,
      rows: current.rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    });
  }

  protected errorText(error: Exclude<MaxLoanByFactError, null>): string {
    switch (error) {
      case 'NO_ROWS':
        return $localize`:@@max_loan_by_fact.err_no_rows:This table has no rows, so it caps nobody. Add a row or remove the table.`;
      case 'ROW_MISSING_KEY':
        return $localize`:@@max_loan_by_fact.err_row_missing_key:One row states no answer, so nothing can match it.`;
      case 'DUPLICATE_ROW':
        return $localize`:@@max_loan_by_fact.err_duplicate:Two rows state the same answer. The second one would never be read.`;
      case 'AMOUNT_INVALID':
        return $localize`:@@max_loan_by_fact.err_amount:Every row needs a maximum above zero. A zero would be a blank card, not a cap.`;
      case 'VIA_NOT_APPLICABLE':
        return $localize`:@@max_loan_by_fact.err_via:This table is keyed by the class an answer is filed under, but that answer is not filed under anything. Key it by the answer itself.`;
      case 'BANDS_GAP':
        return $localize`:@@max_loan_by_fact.err_gap:There is a gap between two bands. An answer that falls in it matches no row.`;
      case 'BANDS_OVERLAP':
        return $localize`:@@max_loan_by_fact.err_overlap:Two bands overlap. The first one written would silently win.`;
    }
  }
}
