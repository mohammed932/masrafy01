import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
  model,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  ArrowDownOutline,
  ArrowUpOutline,
  DeleteOutline,
  DisconnectOutline,
  PlusOutline,
} from '@ant-design/icons-angular/icons';
import { MoneyInputDirective } from '@core/directives/money-input.directive';
import { PlatformEnumerationsService } from '@core/platform-enumerations/platform-enumerations.service';
import type { EnumerationType } from '@core/platform-enumerations/platform-enumerations.types';
import type { IncomeKeyTableRow } from '@features/bank-programs/bank-programs.types';
import { incomeKeyTableErrorFor, type IncomeKeyTableError } from './income-rule.rules';

// The verdict lives in `income-rule.rules.ts` (no Angular), so the host form and the
// unit tests can read it without instantiating a component. Re-exported here because
// every consumer of this control also wants the rule.
export { incomeKeyTableErrorFor, type IncomeKeyTableError };

/**
 * The bank's OWN table: one row per registry key, one monthly income each (FR-006).
 *
 * The key is picked from the live `professor_rank` / `military_grade` registry and is
 * never free text — the engine looks a rule up BY key, so a typo resolves to nothing
 * for every applicant with nothing on screen to say why (AS-1.9). When the registry
 * is unreachable the control fails CLOSED: it disables itself and says so, rather
 * than letting an admin type a key nobody can vouch for.
 *
 * Income cells use `appMoneyInput` (A27) so the admin reads `15,000` and the form
 * model carries `"15000"`.
 *
 * Every row action — add, remove, move up, move down — is a real button in the tab
 * order (FR-046). Reorder exists because the table is rendered in the order stored,
 * and a bank's grade list has a natural seniority that a random insertion order
 * destroys.
 */
@Component({
  selector: 'app-income-key-table',
  standalone: true,
  imports: [
    FormsModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    MoneyInputDirective,
  ],
  providers: [
    provideNzIconsPatch([
      PlusOutline,
      DeleteOutline,
      ArrowUpOutline,
      ArrowDownOutline,
      DisconnectOutline,
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- The registry-unavailable banner is about the ENUMERATION service; a fact's keys
         come with the form's own registry read, so it cannot be unavailable separately. -->
    @if (!keyOptions() && enums.unavailable()) {
      <div class="ikt__unavailable" role="alert">
        <span nz-icon nzType="disconnect" nzTheme="outline" aria-hidden="true"></span>
        <span i18n="@@bank_programs.income.registry_unavailable">
          The key registry is unavailable, so rows cannot be added yet. Retry shortly.
        </span>
      </div>
    } @else if (members().length === 0 && displayRows().length === 0) {
      <!-- No key list to offer AND nothing stored. Both halves are load-bearing: the seed
           button over an empty list sets the same empty array back and reads as a broken
           control, but a table that already holds figures must render them even when the
           key list cannot be listed — the registry read is still in flight, the fact was
           deactivated, the parent walk found nothing — because those rows are what the
           engine is quoting from, and hiding them makes a live table look unconfigured. -->
      <div class="ikt__empty">
        <p class="ikt__emptyText" i18n="@@bank_programs.income.key_table_no_keys">
          The keys for this table cannot be listed here yet, so no row can be added. Check that the
          values this table is keyed by exist on Manage values.
        </p>
      </div>
    } @else if (displayRows().length === 0) {
      <div class="ikt__empty">
        <p class="ikt__emptyText" i18n="@@bank_programs.income.key_table_empty">
          This method reads the applicant's answer and looks it up here. Add a row for every value
          the bank recognises — anything not listed produces no figures, not a zero.
        </p>
        <button nz-button nzType="default" type="button" (click)="seedAll()">
          <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@bank_programs.income.key_table_seed">Add a row for every key</span>
        </button>
      </div>
    } @else {
      <div class="ikt__head" [class.has-second]="secondRows() !== null" aria-hidden="true">
        <span i18n="@@bank_programs.income.col_key">Key</span>
        <span>{{ valueLabel() ?? defaultValueLabel }}</span>
        @if (secondRows() !== null) {
          <span>{{ secondLabel() }}</span>
        }
      </div>

      <ol class="ikt__list">
        @for (row of displayRows(); track $index) {
          <li class="ikt__row" [class.has-second]="secondRows() !== null">
            <nz-select
              class="ikt__key"
              [ngModel]="row.key"
              (ngModelChange)="setKey($index, $event)"
              [nzPlaceHolder]="keyPlaceholder"
              [attr.aria-label]="keyAriaLabel"
            >
              @for (m of members(); track m.key) {
                <nz-option [nzValue]="m.key" [nzLabel]="m.labelEn"></nz-option>
              }
            </nz-select>

            <input
              nz-input
              appMoneyInput
              type="text"
              class="ikt__income"
              [attr.aria-label]="valueLabel() ?? incomeAriaLabel"
              [ngModel]="row.incomeEGP"
              (ngModelChange)="setIncome($index, $event)"
              [ngModelOptions]="{ standalone: true }"
            />

            @if (secondRows() !== null) {
              <!-- Matched by KEY, not by index: the two columns are the same table read
                   for two kinds of customer, and a bank that fills only some of the
                   second column must not have its rows silently paired with the wrong
                   keys. Clearing a cell REMOVES that key's row, so emptying the column
                   leaves it genuinely unconfigured — which is how a bank declines it. -->
              <input
                nz-input
                appMoneyInput
                type="text"
                class="ikt__income"
                [attr.aria-label]="secondLabel()"
                [ngModel]="secondValue(row.key)"
                (ngModelChange)="setSecond(row.key, $event)"
                [ngModelOptions]="{ standalone: true }"
              />
            }

            <span class="ikt__actions">
              <button
                nz-button
                nzType="text"
                type="button"
                class="ikt__action"
                [disabled]="$index === 0"
                [attr.aria-label]="moveUpAriaLabel"
                (click)="move($index, -1)"
              >
                <span nz-icon nzType="arrow-up" nzTheme="outline" aria-hidden="true"></span>
              </button>
              <button
                nz-button
                nzType="text"
                type="button"
                class="ikt__action"
                [disabled]="$index >= displayRows().length - 1"
                [attr.aria-label]="moveDownAriaLabel"
                (click)="move($index, 1)"
              >
                <span nz-icon nzType="arrow-down" nzTheme="outline" aria-hidden="true"></span>
              </button>
              <button
                nz-button
                nzType="text"
                nzDanger
                type="button"
                class="ikt__action"
                [attr.aria-label]="removeAriaLabel"
                (click)="removeAt($index)"
              >
                <span nz-icon nzType="delete" nzTheme="outline" aria-hidden="true"></span>
              </button>
            </span>
          </li>
        }
      </ol>

      <!-- Hidden, not disabled, when every key already has a row. The button does NOT
           create a key — it re-adds a row for a key the table is missing, which is the
           return path from the trash icon beside each row. Where the key list is short
           and seeded exhaustively (three compound classes) that steady state is
           permanent, so a dead control plus a line of prose explaining why it is dead
           read as an unfinished screen and invited "this lets me add a class". Nothing
           to add, nothing on screen; delete a row and it comes back. -->
      <!-- Says it, never blocks it. Deliberately NOT fed into the error signal: the host form
           gates Save on that, and nothing here is invalid — the table is incomplete, which is
           a different thing with a different remedy. The server says the same sentence on the
           program's own page (INCOME_RULE_CLASS_ROW_MISSING) so leaving this screen does not
           lose it.

           A status role, not an alert: it is true the whole time the table is short, and an
           assertive announcement on every keystroke would be unusable. -->
      @if (missingKeys().length > 0) {
        <p class="ikt__missing" role="status">
          <span nz-icon nzType="exclamation-circle" nzTheme="outline" aria-hidden="true"></span>
          <span>{{ missingLabel() }}</span>
        </p>
      }

      @if (unusedKeys().length > 0) {
        <div class="ikt__footer">
          <button nz-button nzType="dashed" nzSize="small" type="button" (click)="addRow()">
            <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
            <span i18n="@@bank_programs.income.key_table_add">Add a row</span>
          </button>
        </div>
      }

      <!-- NO_ROWS is deliberately absent from this switch: it can only be true when
           the table is empty, and an empty table renders the empty STATE above instead
           of this list. The verdict still matters where it is read — the host form
           gates Save on it. -->
      @if (error(); as err) {
        <p class="ikt__error" role="alert">
          @switch (err) {
            @case ('DUPLICATE_KEY') {
              <span i18n="@@bank_programs.income.err_duplicate_key">
                Each key may appear once. Remove the repeated row.
              </span>
            }
            @case ('KEY_MISSING') {
              <span i18n="@@bank_programs.income.err_key_missing">
                Every row needs a key from the registry.
              </span>
            }
            @case ('INCOME_INVALID') {
              <!-- A pipeline's table holds a borrowing ceiling, a percentage, a count of
                   months — the same reason the value label is an input — so naming it an
                   income contradicts the column heading two rows above it. -->
              @if (valueLabel()) {
                <span i18n="@@bank_programs.income.err_value_invalid">
                  Every figure in this table must be greater than zero.
                </span>
              } @else {
                <span i18n="@@bank_programs.income.err_income_invalid">
                  Every assumed income must be greater than zero.
                </span>
              }
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

      .ikt__unavailable {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-2) var(--space-3);
        border: 1px dashed var(--color-border-default);
        border-radius: var(--radius-sm);
        background: var(--color-warning-bg);
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
      }

      .ikt__empty {
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

      .ikt__emptyText {
        margin: 0;
        max-inline-size: 52ch;
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }

      .ikt__list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .ikt__row,
      .ikt__head {
        display: grid;
        grid-template-columns: minmax(0, 16rem) minmax(0, 12rem) auto auto;
        align-items: center;
        gap: var(--space-3);
      }
      /* Two value columns side by side rather than two stacked tables. Same keys, two
         readings of them — and the comparison (2,000,000 → 3,000,000) is the whole
         point of the pair, which two tables 300px apart cannot show. */
      .ikt__row.has-second,
      .ikt__head.has-second {
        grid-template-columns: minmax(0, 14rem) minmax(0, 11rem) minmax(0, 11rem) auto;
      }

      .ikt__head {
        margin-block-end: var(--space-2);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--color-text-tertiary);
      }

      .ikt__income {
        font-variant-numeric: tabular-nums;
        font-feature-settings: var(--font-feature-tabular);
      }

      .ikt__actions {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
      }

      /* 2.75rem: a real touch/click target, and the same size the score-bands
         editor's row action uses so mixed sections keep one rhythm. */
      .ikt__action {
        min-block-size: 2.75rem;
        min-inline-size: 2.75rem;
        cursor: pointer;
      }
      .ikt__action[disabled] {
        cursor: not-allowed;
        opacity: 0.45;
      }

      /* Warning, not error: nothing here is invalid. Sits on the warning bed so it reads as
         the same class of thing as the unavailable-keys notice above it. */
      .ikt__missing {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        margin-block-start: var(--space-3);
        padding: var(--space-2) var(--space-3);
        border: 1px solid color-mix(in srgb, var(--color-warning) 35%, transparent);
        border-radius: var(--radius-md);
        background: var(--color-warning-bg);
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
        line-height: var(--leading-snug);
      }
      .ikt__missing [nz-icon] {
        flex: none;
        color: var(--color-warning);
      }

      .ikt__footer {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        margin-block-start: var(--space-3);
      }

      .ikt__error {
        margin: var(--space-2) 0 0;
        font-size: var(--text-xs);
        color: var(--color-error);
      }

      @media (max-width: 767px) {
        .ikt__row,
        .ikt__head {
          grid-template-columns: minmax(0, 1fr) auto;
        }
        .ikt__head {
          display: none;
        }
      }
    `,
  ],
})
export class IncomeKeyTableComponent {
  readonly enums = inject(PlatformEnumerationsService);
  /** Which label to print. The table renders names, and a name is read, not decoded. */
  private readonly isAr = inject(LOCALE_ID).startsWith('ar');

  /** Two-way bound table. `[]` is a real state the backend rejects on save. */
  readonly rows = model.required<IncomeKeyTableRow[]>();

  /**
   * Which registry the keys come from — `professor_rank` or `military_grade`.
   *
   * `null` for a REGISTRY FACT, whose keys are the bound question's own options and
   * arrive through `keyOptions` instead. Not two components: the table, its ordering,
   * its markers and its validation are identical, and only where the list of legal keys
   * comes from differs.
   */
  readonly enumerationType = input<EnumerationType | null>(null);

  /**
   * The legal keys, supplied directly — a registry fact's bound question options.
   *
   * Takes precedence over `enumerationType` when non-null. That precedence is the point:
   * a fact's keys are the QUESTION's options, so the list the bank picks from and the
   * list the applicant answers from are one list, and no enumeration sits between them
   * to drift.
   */
  readonly keyOptions = input<ReadonlyArray<{
    key: string;
    labelAr: string;
    labelEn: string;
  }> | null>(null);

  /**
   * What the value column holds, when it is not an assumed monthly income.
   *
   * A product rule's table holds a borrowing ceiling, a required percentage, a number of
   * months — never a salary — so the eleven single-fact methods' own column heading is a
   * false statement there. `null` keeps it, so nothing but a pipeline moves.
   */
  readonly valueLabel = input<string | null>(null);

  /**
   * An optional SECOND value column, keyed by the same answers as the first.
   *
   * `null` — every caller but one — is today's single-column table, unchanged. The
   * exception is a `pickByFact` pair, whose two steps are the SAME table read for two
   * kinds of customer; rendering those as two stacked tables cost 550px of screen for
   * six numbers and put the two figures being compared out of sight of each other.
   */
  readonly secondRows = model<IncomeKeyTableRow[] | null>(null);

  /** What the second column holds. Also its inputs' accessible name. */
  readonly secondLabel = input<string | null>(null);

  readonly defaultValueLabel = $localize`:@@bank_programs.income.col_income:Assumed monthly income (EGP)`;

  /**
   * Feature 011 — which row incomes are team-estimated, by registry KEY.
   *
   * Keyed rather than indexed because the stored path is
   * `incomeAssumption.keyTable.<key>.incomeEGP`: an index would silently re-point at
   * a different grade the moment a row moved, and reordering is a real action here.
   */

  readonly keyPlaceholder = $localize`:@@bank_programs.income.key_placeholder:Pick a key`;
  readonly keyAriaLabel = $localize`:@@bank_programs.income.aria.key:Registry key for this row`;
  readonly incomeAriaLabel = $localize`:@@bank_programs.income.aria.income:Assumed monthly income in EGP`;
  readonly moveUpAriaLabel = $localize`:@@bank_programs.income.aria.move_up:Move this row up`;
  readonly moveDownAriaLabel = $localize`:@@bank_programs.income.aria.move_down:Move this row down`;
  readonly removeAriaLabel = $localize`:@@bank_programs.income.aria.remove_row:Remove this row`;

  readonly members = computed<ReadonlyArray<{ key: string; labelAr: string; labelEn: string }>>(
    () => {
      const supplied = this.keyOptions();
      if (supplied) return supplied;
      const type = this.enumerationType();
      return type ? this.enums.membersFor(type)() : [];
    },
  );

  /**
   * Every row the operator must be able to SEE — the primary column, then any key the
   * SECOND column carries that the primary does not.
   *
   * The orphan half is not hypothetical: a bank may state only the top-up column (the
   * pick falls back to whichever column is configured), and a seed or API write may key
   * the two columns differently. Projected through the primary's keys alone, those
   * figures are invisible, un-editable and un-removable while the engine quotes off
   * them. They render last because they have no position in the stored primary order.
   */
  readonly displayRows = computed<readonly IncomeKeyTableRow[]>(() => {
    const primary = this.rows();
    const second = this.secondRows();
    if (second === null || second.length === 0) return primary;
    const known = new Set(primary.map((r) => r.key));
    const orphans = second
      .filter((r) => !known.has(r.key))
      .map((r) => ({ key: r.key, incomeEGP: '' }));
    return orphans.length === 0 ? primary : [...primary, ...orphans];
  });

  /**
   * The primary column's error, or — when the primary is legitimately empty because the
   * bank filled only the second column — the second column's.
   *
   * The second column was previously unvalidated, so a zero, a blank or a duplicate key
   * in it passed the whole local gate and came back as a 422 naming a step id this merged
   * editor no longer renders as a row of its own.
   */
  readonly error = computed<IncomeKeyTableError>(() => {
    const second = this.secondRows();
    const hasSecond = second !== null && second.length > 0;
    const primary = incomeKeyTableErrorFor(this.rows());
    if (primary === 'NO_ROWS' && hasSecond) return incomeKeyTableErrorFor(second);
    if (primary) return primary;
    return hasSecond ? incomeKeyTableErrorFor(second) : null;
  });

  /** Keys with no row yet — what "Add a row" can offer without creating a duplicate. */
  readonly unusedKeys = computed(() => {
    const used = new Set(this.rows().map((r) => r.key));
    return this.members().filter((m) => !used.has(m.key));
  });

  /**
   * Keys with no row an operator can SEE — what the warning counts.
   *
   * Separate from `unusedKeys`, which reads `rows()` alone. In a two-column slot a key
   * present only in the SECOND column has a visible row (`displayRows` includes it) while
   * `unusedKeys` still reports it, so warning off that would fire on a table that is fine.
   * `unusedKeys` stays as it is: adding a primary row for such a key is still correct.
   */
  readonly missingKeys = computed(() => {
    const shown = new Set(this.displayRows().map((r) => r.key));
    return this.members().filter((m) => !shown.has(m.key));
  });

  /**
   * The missing-row sentence.
   *
   * NOUN-FREE on purpose. This component serves professor ranks, military grades and compound
   * classes, and injecting a noun into an English plural is a trap in one locale and a
   * gender-agreement trap in the other. The names go in the LIST, which is where the operator
   * needs them anyway, capped at three so a table missing twenty does not print twenty.
   */
  protected missingLabel(): string {
    const missing = this.missingKeys();
    const names = this.namesOf(missing);
    return missing.length === 1
      ? $localize`:@@bank_programs.income.missing_rows_one:One row is missing — ${names}:NAMES:. Anyone whose answer falls there gets no figures, not a zero.`
      : $localize`:@@bank_programs.income.missing_rows_many:${missing.length}:COUNT: rows are missing — ${names}:NAMES:. Anyone whose answer falls in one of them gets no figures, not a zero.`;
  }

  private namesOf(list: ReadonlyArray<{ key: string; labelAr: string; labelEn: string }>): string {
    const label = (m: { labelAr: string; labelEn: string }): string =>
      this.isAr ? m.labelAr : m.labelEn;
    if (list.length <= 3) return list.map(label).join('، ');
    const shown = list.slice(0, 3).map(label).join('، ');
    return $localize`:@@bank_programs.income.missing_rows_more:${shown}:NAMES: and ${list.length - 3}:COUNT: more`;
  }

  /**
   * One row per registry key, in registry order, incomes blank.
   *
   * Offered instead of a single empty row because a rank or grade table is meant to
   * be exhaustive: a missing key is not a smaller table, it is an applicant who gets
   * no figures. Blank incomes keep the save refused until each is typed, which is
   * the intended nudge rather than a trap.
   */
  seedAll(): void {
    this.rows.set(this.members().map((m) => ({ key: m.key, incomeEGP: '' })));
  }

  addRow(): void {
    const next = this.unusedKeys()[0];
    if (!next) return;
    this.rows.set([...this.rows(), { key: next.key, incomeEGP: '' }]);
  }

  removeAt(index: number): void {
    const gone = this.displayRows()[index]?.key;
    // An orphan has no primary row to drop; removing it means dropping its second-column
    // figure, which is the only thing that made it appear.
    if (index >= this.rows().length) {
      if (gone !== undefined) this.dropSecond(gone);
      return;
    }
    this.rows.set(this.rows().filter((_, i) => i !== index));
    // The second column is keyed, so a removed key must leave with its row — otherwise
    // it survives as a figure for a key the table no longer states.
    if (gone !== undefined) this.dropSecond(gone);
  }

  /** Swap with the neighbour. Order is stored, so this is real data, not a view state. */
  move(index: number, delta: -1 | 1): void {
    // Orphans sit past the stored order and have nothing to swap with until they are typed.
    if (index >= this.rows().length) return;
    const rows = [...this.rows()];
    const target = index + delta;
    const a = rows[index];
    const b = rows[target];
    if (!a || !b) return;
    rows[index] = b;
    rows[target] = a;
    this.rows.set(rows);
    const second = this.secondRows();
    if (second !== null) this.secondRows.set(this.inPrimaryOrder(second));
  }

  setKey(index: number, key: string): void {
    const previous = this.displayRows()[index]?.key;
    if (index >= this.rows().length) {
      // Re-keying an orphan moves the second-column figure; there is still no primary row.
      if (previous !== undefined && previous !== key) this.renameSecond(previous, key);
      return;
    }
    this.rows.set(this.rows().map((row, i) => (i === index ? { ...row, key } : row)));
    // Re-keying a row re-keys BOTH columns: the row still means one answer, and leaving
    // the second column behind would file its figure under the answer just vacated.
    if (previous !== undefined && previous !== key) this.renameSecond(previous, key);
  }

  setIncome(index: number, incomeEGP: string): void {
    const orphan = this.displayRows()[index];
    // Typing into an orphan's primary cell is what promotes it to a real row of the
    // primary column — up to that moment the key existed only in the second one.
    if (index >= this.rows().length) {
      if (orphan) this.rows.set([...this.rows(), { key: orphan.key, incomeEGP }]);
      return;
    }
    this.rows.set(this.rows().map((row, i) => (i === index ? { ...row, incomeEGP } : row)));
  }

  /** Carry a re-key across to the second column, so one answer keeps one row. */
  private renameSecond(previous: string, key: string): void {
    const second = this.secondRows();
    if (second === null) return;
    this.secondRows.set(second.map((r) => (r.key === previous ? { ...r, key } : r)));
  }

  // --- the optional second column -------------------------------------------

  /**
   * The second column, indexed. Called once per row from the template, so a linear `find`
   * made the column O(rows²) per change-detection pass — fine for three unit types, not for
   * a table keyed by a list the seed says will hold hundreds.
   */
  private readonly secondByKey = computed(() => {
    const rows = this.secondRows();
    return new Map((rows ?? []).map((r) => [r.key, r.incomeEGP] as const));
  });

  protected secondValue(key: string): string {
    return this.secondByKey().get(key) ?? '';
  }

  /**
   * Upsert by key — and DELETE on empty, which is the load-bearing half: a bank that
   * does not sell the second column leaves it blank, and `stepIsConfigured` reads that
   * column as "stated nothing" only while it holds no rows. An empty string kept as a
   * row would make a blank cell look like a declared figure of zero.
   */
  protected setSecond(key: string, incomeEGP: string): void {
    if (incomeEGP === '') {
      this.dropSecond(key);
      return;
    }
    const second = this.secondRows() ?? [];
    const next = second.some((r) => r.key === key)
      ? second.map((r) => (r.key === key ? { ...r, incomeEGP } : r))
      : [...second, { key, incomeEGP }];
    // Mirror the primary's order, so the stored blob reads in the order on screen.
    this.secondRows.set(this.inPrimaryOrder(next));
  }

  private dropSecond(key: string): void {
    const second = this.secondRows();
    if (second === null) return;
    this.secondRows.set(second.filter((r) => r.key !== key));
  }

  private inPrimaryOrder(rows: readonly IncomeKeyTableRow[]): IncomeKeyTableRow[] {
    const order = new Map(this.rows().map((r, i) => [r.key, i]));
    // A key the primary column does not carry sorts LAST, not first: `?? 0` used to hoist
    // every orphan above the real first row and reorder the stored blob to match.
    const at = (key: string): number => order.get(key) ?? Number.MAX_SAFE_INTEGER;
    return [...rows].sort((a, b) => at(a.key) - at(b.key));
  }
}
