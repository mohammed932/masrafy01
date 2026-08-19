import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
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
import { ValueSourceMarkerComponent } from '@features/bank-programs/value-source/value-source-marker.component';
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
    ValueSourceMarkerComponent,
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
    } @else if (rows().length === 0) {
      <div class="ikt__empty">
        <p class="ikt__emptyText" i18n="@@bank_programs.income.key_table_empty">
          This method reads the applicant's answer and looks it up here. Add a row for every value
          the bank recognises — anything not listed produces no figures, not a zero.
        </p>
        <button nz-button nzType="primary" type="button" (click)="seedAll()">
          <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@bank_programs.income.key_table_seed">Add a row for every key</span>
        </button>
      </div>
    } @else {
      <div class="ikt__head" aria-hidden="true">
        <span i18n="@@bank_programs.income.col_key">Key</span>
        <span i18n="@@bank_programs.income.col_income">Assumed monthly income (EGP)</span>
      </div>

      <ol class="ikt__list">
        @for (row of rows(); track $index) {
          <li class="ikt__row">
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
              [attr.aria-label]="incomeAriaLabel"
              [ngModel]="row.incomeEGP"
              (ngModelChange)="setIncome($index, $event)"
              [ngModelOptions]="{ standalone: true }"
            />

            <!-- Beside the number it describes, readable without opening anything
                 (FR-032). Every income in a bank's table is a figure someone either
                 read off a PDF or guessed. -->
            <app-value-source-marker
              [compact]="true"
              [estimated]="isEstimated(row.key)"
              (estimatedChange)="markEstimated(row.key, $event)"
              [fieldLabel]="row.key"
            ></app-value-source-marker>

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
                [disabled]="$index === rows().length - 1"
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

      <div class="ikt__footer">
        <button
          nz-button
          nzType="dashed"
          nzSize="small"
          type="button"
          [disabled]="unusedKeys().length === 0"
          (click)="addRow()"
        >
          <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@bank_programs.income.key_table_add">Add a row</span>
        </button>
        @if (unusedKeys().length === 0) {
          <span class="ikt__hint" i18n="@@bank_programs.income.key_table_all_used">
            Every key in the registry already has a row.
          </span>
        }
      </div>

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
              <span i18n="@@bank_programs.income.err_income_invalid">
                Every assumed income must be greater than zero.
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

      .ikt__footer {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        margin-block-start: var(--space-3);
      }

      .ikt__hint {
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
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
   * Feature 011 — which row incomes are team-estimated, by registry KEY.
   *
   * Keyed rather than indexed because the stored path is
   * `incomeAssumption.keyTable.<key>.incomeEGP`: an index would silently re-point at
   * a different grade the moment a row moved, and reordering is a real action here.
   */
  readonly estimatedKeys = input<ReadonlySet<string>>(new Set());
  readonly estimatedKeysChange = output<{ key: string; estimated: boolean }>();

  isEstimated(key: string): boolean {
    return this.estimatedKeys().has(key);
  }

  markEstimated(key: string, estimated: boolean): void {
    this.estimatedKeysChange.emit({ key, estimated });
  }

  /**
   * A row's KEY changed or the row went away, so the marker path addressing it has to
   * follow (FR-032). The band editor announces structural edits for the same reason;
   * a key table needs it too, because its path is the key rather than the position.
   */
  readonly keyStructureChange = output<
    | { kind: 'rename'; from: string; to: string }
    | { kind: 'remove'; key: string }
    | { kind: 'reset' }
  >();

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

  readonly error = computed<IncomeKeyTableError>(() => incomeKeyTableErrorFor(this.rows()));

  /** Keys with no row yet — what "Add a row" can offer without creating a duplicate. */
  readonly unusedKeys = computed(() => {
    const used = new Set(this.rows().map((r) => r.key));
    return this.members().filter((m) => !used.has(m.key));
  });

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
    // Every income is blank now, so nothing carried over can still be "the figure we
    // estimated" — the markers go with the numbers they described.
    this.keyStructureChange.emit({ kind: 'reset' });
  }

  addRow(): void {
    const next = this.unusedKeys()[0];
    if (!next) return;
    this.rows.set([...this.rows(), { key: next.key, incomeEGP: '' }]);
  }

  removeAt(index: number): void {
    const removed = this.rows()[index];
    this.rows.set(this.rows().filter((_, i) => i !== index));
    // The row is gone, so its marker names nothing. Left behind it would be pruned
    // on save — silently un-marking a guessed income if that key ever came back.
    if (removed) this.keyStructureChange.emit({ kind: 'remove', key: removed.key });
  }

  /** Swap with the neighbour. Order is stored, so this is real data, not a view state. */
  move(index: number, delta: -1 | 1): void {
    const rows = [...this.rows()];
    const target = index + delta;
    const a = rows[index];
    const b = rows[target];
    if (!a || !b) return;
    rows[index] = b;
    rows[target] = a;
    this.rows.set(rows);
  }

  setKey(index: number, key: string): void {
    const previous = this.rows()[index];
    this.rows.set(this.rows().map((row, i) => (i === index ? { ...row, key } : row)));
    // A key-table marker is addressed BY KEY, so re-picking the key renames the path
    // the marker lives at. Without this the flag stayed on the old key: the row now
    // rendered "Bank stated", the stale path was pruned away on save, and the guessed
    // income sailed through the activation gate unmarked and off the waiting list.
    if (previous && previous.key !== key) {
      this.keyStructureChange.emit({ kind: 'rename', from: previous.key, to: key });
    }
  }

  setIncome(index: number, incomeEGP: string): void {
    this.rows.set(this.rows().map((row, i) => (i === index ? { ...row, incomeEGP } : row)));
  }
}
