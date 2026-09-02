import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { DeleteOutline, PlusOutline, WarningOutline } from '@ant-design/icons-angular/icons';
import { MoneyInputDirective } from '@core/directives/money-input.directive';
import { DERIVED_FACTS, derivedFactByKey } from '@core/surrogate-facts';
import type { RegistryFact } from '../../features/bank-programs/bank-programs.types';

/** One cell of the table. Mirrors the backend `MaxLoanByFactRow` exactly. */
export interface MaxLoanByFactRow {
  rowKey?: string;
  fromInclusive?: string;
  toExclusive?: string | null;
  columnKey?: string;
  maxAmountEGP: string;
}

/** Mirrors the backend `MaxLoanByFactConfig`. */
export interface MaxLoanByFactConfig {
  factKey: string;
  columnFactKey?: string;
  rows: MaxLoanByFactRow[];
  onNoMatch: 'useProgramMax' | 'reject';
}

/** The subset of the backend's reasons this editor can see before a save. */
export type MaxLoanByFactError =
  | 'NO_ROWS'
  | 'ROW_MISSING_KEY'
  | 'DUPLICATE_ROW'
  | 'AMOUNT_INVALID'
  | 'BANDS_GAP'
  | 'BANDS_OVERLAP'
  | null;

/**
 * The row without its column. Written as a rebuild rather than a rest-destructure so the
 * discarded key needs no throwaway binding, and so an added field has to be listed here
 * deliberately rather than carried by accident.
 */
function withoutColumn(row: MaxLoanByFactRow): MaxLoanByFactRow {
  const next: MaxLoanByFactRow = { maxAmountEGP: row.maxAmountEGP };
  if (row.rowKey !== undefined) next.rowKey = row.rowKey;
  if (row.fromInclusive !== undefined) next.fromInclusive = row.fromInclusive;
  if (row.toExclusive !== undefined) next.toExclusive = row.toExclusive;
  return next;
}

function cellOf(row: MaxLoanByFactRow): string {
  const key = row.rowKey ?? `${row.fromInclusive ?? ''}..${row.toExclusive ?? ''}`;
  return `${key}|${row.columnKey ?? '_'}`;
}

/**
 * Client-side mirror of `validateMaxLoanByFact`, as a pure function so a host can gate its
 * own save on the same verdict the editor shows inline — including while the editor is not
 * rendered, which is every wizard step the admin has left.
 *
 * Deliberately a SUBSET: whether a fact exists and whether an option code is real are the
 * registry's questions, and the registry is the server's. The server re-checks everything on
 * save; this only saves the round trip on what the browser can already see.
 */
export function maxLoanByFactErrorFor(
  config: MaxLoanByFactConfig | null,
  isNumericFact: boolean,
): MaxLoanByFactError {
  if (config === null) return null;
  if (config.rows.length === 0) return 'NO_ROWS';

  const seen = new Set<string>();
  for (const row of config.rows) {
    const amount = Number(row.maxAmountEGP);
    if (!Number.isFinite(amount) || amount <= 0) return 'AMOUNT_INVALID';
    if (isNumericFact) {
      if (row.fromInclusive === undefined && row.toExclusive === undefined) {
        return 'ROW_MISSING_KEY';
      }
    } else if (row.rowKey === undefined || row.rowKey === '') {
      return 'ROW_MISSING_KEY';
    }
    const cell = cellOf(row);
    if (seen.has(cell)) return 'DUPLICATE_ROW';
    seen.add(cell);
  }

  if (!isNumericFact) return null;

  // Bands, per column: two columns each state their own run, and a gap in one is not a gap
  // in the other.
  const columns = new Set(config.rows.map((r) => r.columnKey ?? '_'));
  for (const column of columns) {
    const run = config.rows
      .filter((r) => (r.columnKey ?? '_') === column)
      .map((r) => ({
        from: Number(r.fromInclusive ?? '0'),
        to: r.toExclusive === null || r.toExclusive === undefined ? null : Number(r.toExclusive),
      }))
      .sort((a, b) => a.from - b.from);
    for (let i = 1; i < run.length; i += 1) {
      const previous = run[i - 1];
      const current = run[i];
      if (previous === undefined || current === undefined) continue;
      if (previous.to === null) return 'BANDS_OVERLAP';
      if (previous.to < current.from) return 'BANDS_GAP';
      if (previous.to > current.from) return 'BANDS_OVERLAP';
    }
  }
  return null;
}

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
    @if (config() === null) {
      <button nz-button nzType="dashed" type="button" class="mlf__enable" (click)="enable()">
        <span nz-icon nzType="plus"></span>
        <span i18n="@@max_loan_by_fact.enable">Cap the maximum by an answer</span>
      </button>
      <p class="mlf__hint" i18n="@@max_loan_by_fact.enable_hint">
        For a sheet that prints a second table under “Loan Amount — Maximum” — by property type,
        city, school, branch, or a down-payment bracket.
      </p>
    } @else {
      <div class="mlf">
        <div class="mlf__axes">
          <span class="mlf__label" i18n="@@max_loan_by_fact.keyed_by">Keyed by</span>
          <nz-select
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
                        nz-input
                        appMoneyInput
                        inputmode="numeric"
                        [ngModel]="row.fromInclusive ?? ''"
                        (ngModelChange)="patchRow($index, { fromInclusive: $event })"
                        placeholder="250,000"
                      />
                      <span class="mlf__dash">→</span>
                      <input
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
          <button nz-button nzType="dashed" type="button" (click)="addRow()">
            <span nz-icon nzType="plus"></span>
            <span i18n="@@max_loan_by_fact.add_row">Add a row</span>
          </button>
          <button nz-button nzType="text" nzDanger type="button" (click)="disable()">
            <span i18n="@@max_loan_by_fact.remove_table">Remove the table</span>
          </button>
        </div>

        @if (isNumericFact()) {
          <p class="mlf__hint" i18n="@@max_loan_by_fact.half_open">
            Bands are half-open: “from” counts, “up to” does not. Exactly 500,000 lands in the
            500,000 → 1,000,000 row.
          </p>
        }

        <fieldset class="mlf__nomatch">
          <legend i18n="@@max_loan_by_fact.no_match">An answer with no row</legend>
          <nz-radio-group [ngModel]="config()!.onNoMatch" (ngModelChange)="changeNoMatch($event)">
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
            There is no third option on purpose. “No cap” would quote above the bank’s policy and
            “cap zero” is a blank card, so one of these two has to be the bank’s answer.
          </p>
        </fieldset>

        @if (error(); as err) {
          <p class="mlf__error" role="alert">
            <span nz-icon nzType="warning"></span>
            <span>{{ errorText(err) }}</span>
          </p>
        }
      </div>
    }
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
      .mlf__hint {
        margin: 0;
        font-size: 12px;
        color: var(--color-text-secondary);
      }
      .mlf__nomatch {
        border: 1px solid var(--color-border);
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

  protected readonly rowOptions = computed(() => this.optionsFor(this.config()?.factKey));

  protected readonly columnOptions = computed(() => this.optionsFor(this.config()?.columnFactKey));

  protected readonly error = computed(() =>
    maxLoanByFactErrorFor(this.config(), this.isNumericFact()),
  );

  private optionsFor(key: string | undefined): Array<{ code: string; label: string }> {
    if (key === undefined) return [];
    const derived = derivedFactByKey(key);
    if (derived) return derived.options.map((o) => ({ code: o.code, label: o.label }));
    const question = this.facts().find((f) => f.key === key)?.question;
    return (question?.options ?? []).map((o) => ({
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
    // Rows are CLEARED, not carried: a row keyed the other way round matches nothing at
    // runtime, so carrying them would leave a table that reads as configured and caps
    // nobody — the exact failure this whole feature exists to make impossible.
    this.config.set({ ...current, factKey, rows: [] });
  }

  protected changeColumnFact(columnFactKey: string | null): void {
    const current = this.config();
    if (current === null) return;
    if (columnFactKey === null) {
      // Dropping the axis drops every row's column, so no row is left pointing at a column
      // that no longer exists.
      this.config.set({
        factKey: current.factKey,
        onNoMatch: current.onNoMatch,
        rows: current.rows.map((row) => withoutColumn(row)),
      });
      return;
    }
    this.config.set({
      ...current,
      columnFactKey,
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
      case 'BANDS_GAP':
        return $localize`:@@max_loan_by_fact.err_gap:There is a gap between two bands. An answer that falls in it matches no row.`;
      case 'BANDS_OVERLAP':
        return $localize`:@@max_loan_by_fact.err_overlap:Two bands overlap. The first one written would silently win.`;
    }
  }
}
