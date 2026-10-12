import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { DeleteOutline, ImportOutline, PlusOutline } from '@ant-design/icons-angular/icons';
import { formatGroupedNumber } from '@core/directives/money-format';
import { MoneyInputDirective } from '@core/directives/money-input.directive';
import type { IncomeBand } from '@features/bank-programs/bank-programs.types';
import { bandsOnProductEdges } from './catalog-defaults';
import { incomeBandsErrorFor, type IncomeBandsError } from './income-rule.rules';

// The verdict lives in `income-rule.rules.ts` (no Angular) — see that file for why
// `gap` and `overlap` have no client token. Re-exported because every consumer of
// this control also wants the rule.
export { incomeBandsErrorFor, type IncomeBandsError };

/** Another group's amounts, read off the SAME ranges as the table's own column. */
export interface BandColumn {
  /** The group, as the heading over its amounts names it. */
  readonly label: string;
  /** What this column stores. `[]` is "not filled in" — the rule then reads the first column. */
  readonly bands: readonly IncomeBand[];
  /** The product's ranges and figures for THIS column under a lock, else `null` — `lockedEdges`, per column. */
  readonly lockedEdges: readonly IncomeBand[] | null;
}

/** One column's table, rewritten. `index` counts the columns BESIDE the first, from 0. */
export interface BandColumnChange {
  readonly index: number;
  readonly bands: IncomeBand[];
}

/**
 * Income bands, EDGES ONLY, half-open `[fromInclusive, toExclusive)`.
 *
 * A band's end IS the next band's start, so typing either box moves the other and
 * **gaps and overlaps stay unrepresentable rather than merely validated**. An
 * uncovered value earns the applicant no figures at all, so a hole in the table is
 * not a smaller table — it is a customer told nothing.
 *
 * The FIRST edge is a real, editable box, not "No minimum": a bank's value table may
 * start above zero, and below that floor the correct outcome is a stated reason
 * (`SURROGATE_NO_MATCHING_ROW`), never a zero income. The cell is an EGP money input
 * (`appMoneyInput`, A27).
 */
@Component({
  selector: 'app-income-bands-editor',
  standalone: true,
  imports: [FormsModule, NzButtonModule, NzIconModule, NzInputModule, MoneyInputDirective],
  // Every glyph this template names, patched here. `NzIconDirective` patches only the
  // NEAREST patch service's set, so an icon a host happens to have registered is an icon that
  // renders by luck — and ng-zorro THROWS on an unregistered name rather than rendering the
  // blank the schema promises. Found by driving the screen: the first spelling of the button
  // below used `download`, which nothing had registered.
  providers: [provideNzIconsPatch([PlusOutline, DeleteOutline, ImportOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.is-multi]': 'multi()',
    '[class.is-wide]': 'columnCount() > 2',
    '[style.--ib-columns]': 'columnCount()',
  },
  template: `
    @if (rows().length === 0) {
      <div class="ib__empty">
        <p class="ib__emptyText" i18n="@@bank_programs.income.bands_empty">
          This method reads a number and looks up the band it falls in. Enter the edges — a band's
          end is the next band's start, so no gap or overlap is possible.
        </p>
        <div class="ib__emptyActions">
          <!-- The sheet's own brackets, when a predefined product knows them: the brackets
               are the SHAPE of the table (which ranges exist), and typing six of them by hand
               off a photograph is where an edge gets mistyped. The figure beside each stays
               empty — that one is the bank's. -->
          @if (suggested().length > 0) {
            <button nz-button nzType="primary" type="button" (click)="useSuggested()">
              <span nz-icon nzType="import" nzTheme="outline" aria-hidden="true"></span>
              <span i18n="@@bank_programs.income.bands_sheet"
                >Use the {{ suggested().length }} brackets from the sheet</span
              >
            </button>
          }
          <button
            nz-button
            [nzType]="suggested().length > 0 ? 'default' : 'primary'"
            type="button"
            (click)="seed()"
          >
            <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
            <span i18n="@@bank_programs.income.bands_seed">Start with three bands</span>
          </button>
        </div>
      </div>
    } @else {
      <!-- ONE grid for the header and every row, so the columns line up down the whole
           table however many amount columns there are (subgrid, below). -->
      <div class="ib__table">
        <div class="ib__head" aria-hidden="true">
          <span class="ib__headRange">
            <span i18n="@@bank_programs.income.col_from">From</span>
            <span class="ib__arrow">→</span>
            <span i18n="@@bank_programs.income.col_to">To</span>
          </span>
          @if (multi()) {
            <!-- What every amount column holds, said once over all of them, and the group each
               column prices under it. Stacked tables said "Amount (EGP)" once per table and
               named the group in a caption above it, which is the same two facts in the
               order a table header already has. -->
            <span class="ib__headGroup">{{ valueLabel() ?? defaultValueLabel }}</span>
            <span class="ib__headColumn">{{ columnLabel() }}</span>
            @for (column of moreColumns(); track $index) {
              <span class="ib__headColumn">{{ column.label }}</span>
            }
          } @else {
            <span>{{ valueLabel() ?? defaultValueLabel }}</span>
          }
        </div>

        <ol class="ib__list">
          @for (band of rows(); track $index; let row = $index) {
            <li class="ib__row">
              <span class="ib__range">
                @if (locked()) {
                  <!-- THE RANGE IS THE PRODUCT'S, so it is rendered as the fact it is rather
                     than as a box with the keystrokes thrown away. A disabled input would
                     read as "you may type here later" and announces nothing to a screen
                     reader; a read-only one is still a tab stop on a value that cannot
                     move. The whole row is named by the group's own label above it. -->
                  <span class="ib__edge is-fixed">{{ edgeText(band.fromInclusive) }}</span>
                  <span class="ib__arrow" aria-hidden="true">→</span>
                  <span class="ib__edge is-fixed">{{
                    band.toExclusive ? edgeText(band.toExclusive) : noMaximumPlaceholder
                  }}</span>
                } @else {
                  <input
                    nz-input
                    appMoneyInput
                    type="text"
                    class="ib__edge"
                    [attr.aria-label]="fromAriaLabel"
                    [ngModel]="band.fromInclusive"
                    (ngModelChange)="setEdge(row, $event)"
                    [ngModelOptions]="{ standalone: true }"
                  />
                  <span class="ib__arrow" aria-hidden="true">→</span>
                  @if (row < rows().length - 1) {
                    <input
                      nz-input
                      appMoneyInput
                      type="text"
                      class="ib__edge"
                      [attr.aria-label]="toAriaLabel"
                      [ngModel]="band.toExclusive"
                      (ngModelChange)="setUpperEdge(row, $event)"
                      [ngModelOptions]="{ standalone: true }"
                    />
                  } @else {
                    <!-- The LAST band's ceiling is a real, editable box, not a fixed "No
                     maximum" label. Legacy years tables close their top band on purpose
                     (a 51-year practitioner resolves to nothing today, and opening it
                     would start paying them), so rendering that row as open-ended showed
                     the admin a table the program does not have — and the first edit
                     silently made the lie true. Blank means open-ended. -->
                    <input
                      nz-input
                      appMoneyInput
                      type="text"
                      class="ib__edge"
                      [attr.aria-label]="lastToAriaLabel"
                      [placeholder]="noMaximumPlaceholder"
                      [ngModel]="band.toExclusive"
                      (ngModelChange)="setLastUpperEdge($event)"
                      [ngModelOptions]="{ standalone: true }"
                    />
                  }
                }
                @if (unit()) {
                  <span class="ib__unit">{{ unit() }}</span>
                }
              </span>

              <span class="ib__cell">
                @if (multi()) {
                  <!-- The column's name ON the cell, shown only once the header is gone (a
                     narrow panel). Hidden from assistive tech: the box is already named by
                     the same words. -->
                  <span class="ib__cellLabel" aria-hidden="true">{{ columnLabel() }}</span>
                }
                @if (inherited()) {
                  <!-- The figure is the PRODUCT's and the engine reads it, so it is rendered as
                     the fact it is. A box holding somebody else's number reads as this bank's
                     the moment it is on screen, and the first keystroke would freeze a live
                     default into a copy. -->
                  <span class="ib__income is-fixed">{{ edgeText(band.incomeEGP) }}</span>
                } @else {
                  <input
                    nz-input
                    appMoneyInput
                    type="text"
                    class="ib__income"
                    [attr.aria-label]="multi() ? columnLabel() : incomeAriaLabel()"
                    [placeholder]="productFigure(row)"
                    [ngModel]="band.incomeEGP"
                    (ngModelChange)="setIncome(row, $event)"
                    [ngModelOptions]="{ standalone: true }"
                  />
                }
              </span>

              @for (column of moreColumns(); track $index; let c = $index) {
                <span class="ib__cell">
                  <span class="ib__cellLabel" aria-hidden="true">{{ column.label }}</span>
                  @if (inherited()) {
                    <span class="ib__income is-fixed">{{ edgeText(moreValue(c, row)) }}</span>
                  } @else {
                    <input
                      nz-input
                      appMoneyInput
                      type="text"
                      class="ib__income"
                      [attr.aria-label]="column.label"
                      [placeholder]="moreProductFigure(c, row)"
                      [ngModel]="moreValue(c, row)"
                      (ngModelChange)="setColumnIncome(c, row, $event)"
                      [ngModelOptions]="{ standalone: true }"
                    />
                  }
                </span>
              }

              @if (!locked() && !inherited() && rows().length > 1) {
                <button
                  nz-button
                  nzType="text"
                  nzDanger
                  type="button"
                  class="ib__remove"
                  [attr.aria-label]="removeAriaLabel"
                  (click)="removeAt(row)"
                >
                  <span nz-icon nzType="delete" nzTheme="outline" aria-hidden="true"></span>
                </button>
              } @else {
                <span class="ib__removeSpacer" aria-hidden="true"></span>
              }
            </li>
          }
        </ol>
      </div>

      @if (inherited()) {
        <p class="ib__hint" i18n="@@bank_programs.income.bands_inherited_hint">
          These are the product's and every bank selling it quotes them. Nothing here is this bank's
          yet.
        </p>
      } @else if (locked()) {
        <p class="ib__hint" i18n="@@bank_programs.income.bands_locked_hint">
          The ranges are the product's and are the same at every bank selling it. Only the amount
          beside each one is this bank's — leave a box as it is to quote what the product states.
        </p>
      } @else {
        <p class="ib__hint" i18n="@@bank_programs.income.bands_link_hint">
          A band's end is the next band's start — edit either box and the other follows. A value
          below the first edge produces no figures, which is stated to the customer, never shown as
          zero.
        </p>

        <div class="ib__actions">
          <button nz-button nzType="dashed" nzSize="small" type="button" (click)="addBand()">
            <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
            <span i18n="@@bank_programs.income.bands_add">Add a band</span>
          </button>
          <button
            nz-button
            nzType="text"
            nzSize="small"
            type="button"
            (click)="clear()"
            i18n="@@bank_programs.income.bands_clear"
          >
            Remove all bands
          </button>
        </div>
      }

      <!-- NO_BANDS is absent for the same reason as NO_ROWS in the key table: an
           empty table renders the empty STATE, so this branch could never show. The
           verdict is still read by the host's Save gate. -->
      @if (error(); as err) {
        <p class="ib__error" role="alert">
          @switch (err) {
            @case ('EDGE_MISSING') {
              <span i18n="@@bank_programs.income.err_edge_missing">
                Every band needs a starting value.
              </span>
            }
            @case ('NOT_ASCENDING') {
              <span i18n="@@bank_programs.income.err_not_ascending">
                Each band must start higher than the one before it, and the top band must end above
                where it starts — or be left open.
              </span>
            }
            @case ('INCOME_INVALID') {
              <span i18n="@@bank_programs.income.err_band_income_invalid">
                Every assumed income must be greater than zero.
              </span>
            }
            @case ('FIRST_NOT_ZERO') {
              <span i18n="@@bank_programs.income.err_first_not_zero">
                The first range must start at 0, or a low score matches no row and the program
                quotes nothing.
              </span>
            }
            @case ('LAST_NOT_OPEN') {
              <span i18n="@@bank_programs.income.err_last_not_open">
                Leave the top range's end empty, or a high score matches no row and the program
                quotes nothing.
              </span>
            }
          }
        </p>
      }
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .ib__emptyActions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
        justify-content: center;
      }

      .ib__empty {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-4);
        /* Capped: space-between on a full-width block threw the seed button half a
           screen from the sentence that explains it, which is worst where these stack —
           a product rule renders one per unfilled table. */
        max-inline-size: 46rem;
        padding: var(--space-4);
        border: 1px dashed var(--color-border-default);
        border-radius: var(--radius-md);
        background: var(--color-surface-muted);
      }

      .ib__emptyText {
        margin: 0;
        max-inline-size: 52ch;
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }

      .ib__list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .ib__row,
      .ib__head {
        display: grid;
        grid-template-columns: minmax(0, 24rem) minmax(0, 12rem) auto auto;
        align-items: center;
        gap: var(--space-3);
      }

      .ib__head {
        margin-block-end: var(--space-2);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--color-text-tertiary);
      }

      .ib__headRange {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
      }

      .ib__headRange > span:first-child,
      .ib__headRange > span:last-child {
        inline-size: 7.5rem;
      }

      .ib__range {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        min-inline-size: 0;
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }

      .ib__edge,
      .ib__income {
        inline-size: 7.5rem;
        font-variant-numeric: tabular-nums;
        font-feature-settings: var(--font-feature-tabular);
      }

      /* A range the bank cannot move: set on the field's own line so the row still reads as
         a table, but with no border and no ground — a box drawn around a value nobody can
         type into is the affordance this mode exists to withdraw. */
      .ib__edge.is-fixed,
      .ib__income.is-fixed {
        display: inline-block;
        min-block-size: var(--size-field);
        padding-block: calc((var(--size-field) - 1.5rem) / 2);
        line-height: 1.5rem;
        color: var(--color-text-primary);
        white-space: nowrap;
      }

      .ib__income {
        inline-size: 100%;
      }

      /* The grid item a figure sits in, so a column's name can ride on top of its box once
         the header is gone. One box and no name in every single-column table. */
      .ib__cell {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-inline-size: 0;
      }

      .ib__cellLabel {
        display: none;
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
      }

      .ib__arrow {
        color: var(--color-text-tertiary);
      }

      .ib__unit {
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
      }

      /* SECONDARY, not tertiary. Both hints are sentences an operator reads for meaning —
         the locked one is the only thing on screen that says why the range column cannot be
         typed into — and tertiary measures 3.83:1 on a card in light mode, under 4.5:1
         (DESIGN_SYSTEM.md; measured on this very line). */
      .ib__hint {
        margin: var(--space-2) 0 0;
        max-inline-size: 68ch;
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
      }

      .ib__actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        margin-block-start: var(--space-3);
      }

      .ib__remove {
        min-block-size: 2.75rem;
        min-inline-size: 2.75rem;
        cursor: pointer;
      }

      .ib__removeSpacer {
        inline-size: 2.75rem;
      }

      .ib__error {
        margin: var(--space-2) 0 0;
        font-size: var(--text-xs);
        color: var(--color-error);
      }

      @media (max-width: 767px) {
        :host(:not(.is-multi)) .ib__row {
          grid-template-columns: minmax(0, 1fr) auto;
        }
        :host(:not(.is-multi)) .ib__range {
          grid-column: 1 / -1;
        }
        :host(:not(.is-multi)) .ib__head {
          display: none;
        }
      }

      /* --- several amount columns: ONE table ----------------------------------
         The ranges down the side once, an amount column per group. A size container, so the
         table answers the width of the panel it sits in rather than the window's: the same
         editor renders in a full-width card and in a narrow sheet. */
      :host(.is-multi) {
        container: bands / inline-size;
      }

      /* Without subgrid, a fixed range column still lines every row up — the range is the
         only cell whose width the figures beside it depend on. */
      :host(.is-multi) .ib__row,
      :host(.is-multi) .ib__head {
        grid-template-columns: 17.5rem repeat(var(--ib-columns), minmax(0, 11rem)) auto;
      }

      :host(.is-multi) .ib__range {
        grid-column: 1;
      }

      @supports (grid-template-columns: subgrid) {
        /* One set of tracks for the header and every row: the range is as wide as its
           boxes and no wider, and the amount columns share what is left, up to the width
           one figure needs. */
        :host(.is-multi) .ib__table {
          display: grid;
          grid-template-columns: max-content repeat(var(--ib-columns), minmax(0, 11rem)) auto;
          column-gap: var(--space-3);
        }
        :host(.is-multi) .ib__list {
          display: grid;
          row-gap: var(--space-2);
        }
        :host(.is-multi) .ib__head,
        :host(.is-multi) .ib__list,
        :host(.is-multi) .ib__row {
          grid-column: 1 / -1;
          grid-template-columns: subgrid;
        }
      }

      /* Two header rows: what the amounts are, spanning every amount column over a hairline,
         then the group each column prices — bottom-aligned, so a name that wraps grows
         upward and the boxes stay where the eye expects them. */
      :host(.is-multi) .ib__head {
        row-gap: var(--space-1);
        align-items: end;
      }

      :host(.is-multi) .ib__headRange {
        grid-row: 2;
        grid-column: 1;
      }

      .ib__headGroup {
        grid-row: 1;
        grid-column: 2 / -2;
        padding-block-end: var(--space-1);
        border-block-end: 1px solid var(--color-border-default);
      }

      /* A NAME, so it is set as one: sentence case, the caption weight the stacked tables
         gave it, and secondary ink — it is the only thing that says which column is whose. */
      .ib__headColumn {
        grid-row: 2;
        color: var(--color-text-secondary);
        font-weight: var(--font-semibold);
        letter-spacing: normal;
        text-transform: none;
      }

      /* Too narrow for the amounts beside the range: the range takes its own line, the
         amounts sit under it, and each box carries its column's name, because the header
         that named them is gone.

         WHERE that happens depends on how many amount columns there are — the range column,
         about seven rem per amount and the gaps — so a pair keeps its table down to 36.5rem
         and three or more switch at 44.25rem. A container query cannot read the count, so
         the two widths are two blocks over one set of rules. */
      @container bands (max-width: 44.25rem) {
        :host(.is-wide) .ib__head {
          display: none;
        }
        :host(.is-wide) .ib__table {
          display: block;
        }
        :host(.is-wide) .ib__list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        :host(.is-wide) .ib__row {
          grid-template-columns: repeat(var(--ib-columns), minmax(0, 1fr)) auto;
          row-gap: var(--space-1);
        }
        /* A hairline between bands: each is a range and a run of boxes now, and without it
           the boxes of one band read as the start of the next. */
        :host(.is-wide) .ib__row + .ib__row {
          padding-block-start: var(--space-3);
          border-block-start: 1px solid var(--color-border-default);
        }
        :host(.is-wide) .ib__range {
          grid-row: 1;
          grid-column: 1 / -2;
        }
        :host(.is-wide) .ib__remove,
        :host(.is-wide) .ib__removeSpacer {
          grid-row: 1;
          grid-column: -2;
        }
        /* Bottom-aligned, so a name that wraps grows upward and the boxes stay level. */
        :host(.is-wide) .ib__cell {
          grid-row: 2;
          align-self: end;
        }
        :host(.is-wide) .ib__cellLabel {
          display: block;
        }
      }

      @container bands (max-width: 36.5rem) {
        :host(.is-multi) .ib__head {
          display: none;
        }
        :host(.is-multi) .ib__table {
          display: block;
        }
        :host(.is-multi) .ib__list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        :host(.is-multi) .ib__row {
          grid-template-columns: repeat(var(--ib-columns), minmax(0, 1fr)) auto;
          row-gap: var(--space-1);
        }
        /* A hairline between bands: each is a range and a run of boxes now, and without it
           the boxes of one band read as the start of the next. */
        :host(.is-multi) .ib__row + .ib__row {
          padding-block-start: var(--space-3);
          border-block-start: 1px solid var(--color-border-default);
        }
        :host(.is-multi) .ib__range {
          grid-row: 1;
          grid-column: 1 / -2;
        }
        :host(.is-multi) .ib__remove,
        :host(.is-multi) .ib__removeSpacer {
          grid-row: 1;
          grid-column: -2;
        }
        /* Bottom-aligned, so a name that wraps grows upward and the boxes stay level. */
        :host(.is-multi) .ib__cell {
          grid-row: 2;
          align-self: end;
        }
        :host(.is-multi) .ib__cellLabel {
          display: block;
        }
      }

      /* A phone: one amount per line. */
      @container bands (max-width: 26rem) {
        :host(.is-multi) .ib__row {
          grid-template-columns: minmax(0, 1fr) auto;
        }
        :host(.is-multi) .ib__cell {
          grid-row: auto;
          grid-column: 1 / -1;
        }
      }
    `,
  ],
})
export class IncomeBandsEditorComponent {
  /** Two-way bound band table. `[]` is a real state the backend rejects on save. */
  readonly bands = model.required<IncomeBand[]>();

  /** Display unit of the underlying value ("years", "EGP") — label only. */
  readonly unit = input<string | null>(null);

  /**
   * The surrogate product's own bands, when the RANGES are the product's and not this bank's.
   *
   * `null` — every caller that has no product behind the box: the catalog variant, where these
   * ranges are the ones being authored, and a hand-wired name rule that publishes none. With
   * rows, the range column stops being editable and the table on screen is always the
   * product's, carrying this bank's figure against each range it has typed one for.
   *
   * WHY THE RANGES ARE NOT THE BANK'S. Which brackets exist is the SHAPE of the table, and a
   * surrogate product owns its shape exactly as it owns `steps` and `gates`
   * (`mergeProductRuleStructure` on the server). Band edges were only ever per-bank because
   * they happen to be stored inside `stepParams` beside the figures — two banks selling one
   * product off different brackets is not a product with two shapes, it is one product
   * nobody can read.
   */
  readonly lockedEdges = input<readonly IncomeBand[] | null>(null);

  /** Are the ranges the product's? */
  protected readonly locked = computed<boolean>(() => (this.lockedEdges()?.length ?? 0) > 0);

  /**
   * The whole table is the PRODUCT's and this bank has stated none of it.
   *
   * Different from `lockedEdges`, which locks the ranges and leaves the figures editable.
   * Here the figures are the product's too, because the engine reads them
   * (`withInheritedSlots`) — so the table is rendered as the fact it is, and a bank that wants
   * its own gets a button rather than boxes that already look filled in.
   */
  readonly inherited = input<boolean>(false);

  /**
   * Must this table answer EVERY value?
   *
   * The I-Score tiers, and nothing else: their figure multiplies an amount the rule has
   * already produced, so a score the table misses destroys the quote instead of shrinking it.
   * Mirrors the server's own `coverAll` (`validateBands`), which is what refuses the save.
   */
  readonly coverAll = input<boolean>(false);

  /**
   * The table on screen.
   *
   * Locked, it is the product's ranges carrying this bank's figures — matched BY EDGE in
   * `bandsOnProductEdges`, never by position. Unlocked it is simply what the bank stores, so
   * every existing caller is byte-identical.
   */
  protected readonly rows = computed<IncomeBand[]>(() => {
    const edges = this.lockedEdges();
    if (edges === null || edges.length === 0) return this.bands();
    return bandsOnProductEdges(edges, this.bands());
  });

  /**
   * Brackets a published sheet prints for this box, offered while the table is empty.
   *
   * Edges only, and never written on their own: a band row with no figure beside it is
   * refused by the save-time validator, so these reach the form and are stored only once an
   * operator has typed each figure. Empty for every caller that has none, which is all of
   * them but a product created from the library.
   */
  readonly suggested = input<readonly IncomeBand[]>([]);

  /**
   * What the value column holds, when it is not an assumed monthly income.
   *
   * A product rule's bands hold a borrowing ceiling, a required percentage, a number of
   * months — never a salary — so the eleven single-fact methods' own column heading is a
   * false statement there. `null` keeps it, so nothing but a pipeline moves.
   */
  readonly valueLabel = input<string | null>(null);

  /**
   * More amount columns over the SAME ranges — a pick's other groups, drawn beside this
   * table's own instead of as tables of their own under it.
   *
   * Stacked, a compound's two down-payment columns cost twice the height for four numbers
   * each, repeated the ranges, and put the two figures being compared — 750,000 against
   * 1,250,000 for the same down payment — a screen apart. Empty for every caller but a
   * product rule's pick, so every other table is byte-identical.
   *
   * The ranges stay ONE set: a band added, removed or re-cut here is added, removed or re-cut
   * in every column that holds rows (`reshape`).
   */
  readonly moreColumns = input<readonly BandColumn[]>([]);

  /** The heading of this table's OWN amount column, when others sit beside it. */
  readonly columnLabel = input<string | null>(null);

  /** A column beside the first was rewritten. The first column writes through `bands`. */
  readonly moreColumnChange = output<BandColumnChange>();

  protected readonly multi = computed<boolean>(() => this.moreColumns().length > 0);

  /** Every amount column, the first included — the grid's column count. */
  protected readonly columnCount = computed<number>(() => this.moreColumns().length + 1);

  /**
   * Each column beside the first as it is on screen, row for row against `rows()`.
   *
   * Under a lock, the product's ranges carrying that column's figures, matched by edge as
   * the first column's are. Unlocked, simply what the column stores: its rows are the first
   * column's rows by construction, because every edit to the ranges reaches every column.
   */
  protected readonly moreRows = computed<IncomeBand[][]>(() =>
    this.moreColumns().map((column) => {
      const edges = column.lockedEdges;
      if (edges === null || edges.length === 0) return [...column.bands];
      return bandsOnProductEdges(edges, column.bands);
    }),
  );

  readonly defaultValueLabel = $localize`:@@bank_programs.income.col_income:Assumed monthly income (EGP)`;

  readonly fromAriaLabel = $localize`:@@bank_programs.income.aria.band_from:Band starts at`;
  readonly toAriaLabel = $localize`:@@bank_programs.income.aria.band_to:Band ends at — also the next band's start`;
  readonly lastToAriaLabel = $localize`:@@bank_programs.income.aria.band_last_to:Top band ends at — leave empty for no maximum`;
  readonly noMaximumPlaceholder = $localize`:@@bank_programs.income.no_maximum:No maximum`;
  readonly defaultIncomeAriaLabel = $localize`:@@bank_programs.income.aria.band_income:Assumed monthly income in EGP`;

  /**
   * The value cell's accessible name, taken from the column heading whenever there is one.
   *
   * Left as the default it announced "assumed monthly income in EGP" on every cell of a
   * PERCENTAGE table — the heading above said "Percentage (%)" and the accessible name said
   * something else about the same box.
   */
  protected readonly incomeAriaLabel = computed<string>(
    () => this.valueLabel() ?? this.defaultIncomeAriaLabel,
  );
  readonly removeAriaLabel = $localize`:@@bank_programs.income.aria.remove_band:Remove this band`;

  // Over the DISPLAYED rows, which under a lock are the product's. Reading the stored table
  // instead would report a program that has typed nothing as having no table at all, on a
  // screen showing a full one.
  readonly error = computed<IncomeBandsError>(() => {
    // An INHERITED table is the product's; a verdict on it would ask this bank to fix a
    // table it cannot edit, and the product screen is where that message belongs.
    if (this.inherited()) return null;
    const own = incomeBandsErrorFor(this.rows(), { coverAll: this.coverAll() });
    if (own !== null) return own;
    // A column beside the first is judged only once it HOLDS rows — the save gate's own rule
    // (`stepBandsHaveError`). Left empty it reads the first column, which is a decision, not
    // a gap, and a verdict there would refuse a table the save accepts.
    const columns = this.moreColumns();
    for (const [index, rows] of this.moreRows().entries()) {
      if ((columns[index]?.bands.length ?? 0) === 0) continue;
      const verdict = incomeBandsErrorFor(rows, { coverAll: this.coverAll() });
      if (verdict !== null) return verdict;
    }
    return null;
  });

  /**
   * Three ascending bands with blank incomes. A blank table is the one state that
   * produces nothing, so the empty view offers a shape rather than a single row for
   * the admin to decode. Edges are left for the admin to type: guessing a bank's
   * years-vs-EGP thresholds would be inventing policy.
   */
  /** Take the sheet's brackets, figures left blank. Replaces nothing — the table is empty. */
  useSuggested(): void {
    const rows = this.suggested();
    if (rows.length === 0) return;
    this.bands.set(rows.map((row) => ({ ...row, incomeEGP: '' })));
  }

  seed(): void {
    this.bands.set([
      { fromInclusive: '0', toExclusive: '', incomeEGP: '' },
      { fromInclusive: '', toExclusive: '', incomeEGP: '' },
      { fromInclusive: '', toExclusive: null, incomeEGP: '' },
    ]);
  }

  /** The whole table, every column with it — the ranges they all read are gone. */
  clear(): void {
    this.reshape([], () => []);
  }

  /**
   * Splits the LAST band in two. The new row inherits the old ceiling, so a table
   * whose top band is closed stays closed — appending an open-ended row instead
   * would hand every value above that ceiling an income the bank never quoted.
   */
  addBand(): void {
    const rows = [...this.bands()];
    const last = rows[rows.length - 1];
    if (!last) {
      this.seed();
      return;
    }
    rows.splice(
      rows.length - 1,
      1,
      { ...last, toExclusive: '' },
      { fromInclusive: '', toExclusive: last.toExclusive, incomeEGP: last.incomeEGP },
    );
    // Every column splits its top figure the same way the first does: both halves keep it.
    this.reshape(relink(rows), (figures) => {
      const top = figures[figures.length - 1] ?? '';
      return [...figures.slice(0, -1), top, top];
    });
  }

  /**
   * Removing a band hands its range to the band before it — the neighbour's upper
   * edge moves up, which is what keeps the table gapless without the admin
   * re-typing an edge.
   */
  removeAt(index: number): void {
    const rows = this.bands();
    const remaining = rows.filter((_, i) => i !== index);
    const removed = rows[index];
    const newLast = remaining[remaining.length - 1];
    // Removing the TOP band hands its CEILING to the band that becomes the top one.
    // Without this the table would stop where the removed row began, silently
    // dropping its whole range — the mirror of the rule one line up.
    if (index === rows.length - 1 && newLast !== undefined) {
      remaining[remaining.length - 1] = { ...newLast, toExclusive: removed?.toExclusive ?? null };
    }
    this.reshape(relink(remaining), (figures) => figures.filter((_, i) => i !== index));
  }

  setEdge(index: number, value: string): void {
    this.reshape(
      relink(this.bands().map((row, i) => (i === index ? { ...row, fromInclusive: value } : row))),
      (figures) => figures,
    );
  }

  /**
   * Typing a band's UPPER edge is the same edit as typing the next band's lower
   * edge, so it routes through `setEdge` and `relink` mirrors the value straight
   * back. Writing `toExclusive` directly would give the boundary two owners, which
   * is exactly how a gap appears. Never called on the LAST row: nothing follows it to
   * mirror, so its ceiling is its own value and is written by `setLastUpperEdge`.
   */
  setUpperEdge(index: number, value: string): void {
    this.setEdge(index + 1, value);
  }

  /**
   * The TOP band's ceiling, which no next row mirrors — so it is written directly.
   * Blank means open-ended (`null`), which is how the admin says "and everything
   * above". `relink` leaves this value alone for exactly this reason.
   */
  setLastUpperEdge(value: string): void {
    const rows = this.bands();
    if (rows.length === 0) return;
    const lastIndex = rows.length - 1;
    const trimmed = (value ?? '').trim();
    this.reshape(
      rows.map((row, i) => (i === lastIndex ? { ...row, toExclusive: trimmed || null } : row)),
      (figures) => figures,
    );
  }

  setIncome(index: number, value: string): void {
    // `rows()`, not `bands()`. Under a lock the stored table may hold nothing at all — the
    // figures on screen are the product's — so writing over the stored array would store one
    // row where the operator can see six. Writing the displayed set makes the first keystroke
    // commit the product's ranges along with the figure, which is what the screen promises.
    this.bands.set(this.rows().map((row, i) => (i === index ? { ...row, incomeEGP: value } : row)));
  }

  /**
   * One figure in a column BESIDE the first.
   *
   * A column with no rows yet takes the table's ranges with its first figure — the commit
   * `setIncome` makes for the first column, and the only way an empty column becomes a
   * filled one. Emptying every box of a column the product states no figures for un-fills it
   * again, so it reads the first column: in one table there is no "Remove all bands" of its
   * own to do that with. A column the product DOES price keeps its rows — the product says
   * the column exists, and a blank there is the refusal the verdict then shows.
   */
  protected setColumnIncome(column: number, index: number, value: string): void {
    const spec = this.moreColumns()[column];
    if (spec === undefined) return;
    const shown = this.moreRows()[column] ?? [];
    const base = shown.length > 0 ? shown : this.rows().map((row) => ({ ...row, incomeEGP: '' }));
    const next = base.map((row, i) => (i === index ? { ...row, incomeEGP: value } : row));
    const productPrices = (spec.lockedEdges ?? []).some((row) => row.incomeEGP.trim() !== '');
    const blank = next.every((row) => row.incomeEGP.trim() === '');
    this.moreColumnChange.emit({ index: column, bands: blank && !productPrices ? [] : next });
  }

  /**
   * The first column's new table, and the same reshaping applied to every column beside it
   * that holds rows.
   *
   * The ranges are ONE set down the side of the table, so a band added, removed or re-cut is
   * added, removed or re-cut in every column at once — two copies of the ranges is how two
   * columns end up cut differently, and then they are not one table any more. `figures`
   * moves a column's amounts the way the edit moved the first column's rows. A column with
   * no rows stays empty: it reads the first column, so the ranges are its already.
   *
   * Only ever reached unlocked. Under a lock the ranges are the product's and nothing on
   * screen can move them.
   */
  private reshape(
    next: IncomeBand[],
    figures: (amounts: readonly string[]) => readonly string[],
  ): void {
    this.bands.set(next);
    this.moreColumns().forEach((column, index) => {
      if (column.bands.length === 0) return;
      const moved = figures(column.bands.map((band) => band.incomeEGP));
      this.moreColumnChange.emit({
        index,
        bands: next.map((row, i) => ({
          fromInclusive: row.fromInclusive,
          toExclusive: row.toExclusive,
          incomeEGP: moved[i] ?? '',
        })),
      });
    });
  }

  /** One figure in a column beside the first, as the box shows it. */
  protected moreValue(column: number, index: number): string {
    return this.moreRows()[column]?.[index]?.incomeEGP ?? '';
  }

  /** The product's own figure for one box beside the first — `productFigure`, per column. */
  protected moreProductFigure(column: number, index: number): string {
    const raw = this.moreColumns()[column]?.lockedEdges?.[index]?.incomeEGP ?? '';
    return raw === '' ? '' : formatGroupedNumber(raw);
  }

  /** A locked range, as text. Grouped like the box it replaces, so a column of them lines up. */
  protected edgeText(raw: string): string {
    return formatGroupedNumber(raw);
  }

  /** The product's own figure for one row, shown as the placeholder a cleared box falls back to. */
  protected productFigure(index: number): string {
    const raw = this.lockedEdges()?.[index]?.incomeEGP ?? '';
    return raw === '' ? '' : formatGroupedNumber(raw);
  }
}

/**
 * Re-derive every `toExclusive` from the NEXT row's `fromInclusive`. Upper edges are
 * not independent data — treating them as such is how a table ends up with a gap
 * nobody typed.
 *
 * The LAST row is the exception on both counts: nothing follows it to mirror, and its
 * ceiling is its own value. It is carried through untouched rather than pinned to
 * `null`, because a closed top band is a legal rule ("above this, nothing") and every
 * legacy years table has one — pinning it open turned an unrelated edit into a raise
 * for everyone above the ceiling.
 *
 * Note the asymmetry with the score-bands editor: the first row's `fromInclusive` is
 * NOT nulled here, because an income table's floor is a real, meaningful value.
 */
function relink(rows: readonly IncomeBand[]): IncomeBand[] {
  const lastIndex = rows.length - 1;
  return rows.map((row, i) => ({
    fromInclusive: row.fromInclusive,
    // Blank IS open-ended on the last row, normalised here so the payload carries
    // `null` rather than an empty string the backend reads as a malformed edge.
    toExclusive:
      i === lastIndex ? openEndedOr(row.toExclusive) : (rows[i + 1]?.fromInclusive ?? ''),
    incomeEGP: row.incomeEGP,
  }));
}

/** An empty ceiling means "and everything above" — the editor's own reading. */
function openEndedOr(toExclusive: string | null | undefined): string | null {
  return toExclusive && toExclusive.trim() !== '' ? toExclusive : null;
}
