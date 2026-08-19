import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { DeleteOutline, PlusOutline } from '@ant-design/icons-angular/icons';
import { MoneyInputDirective } from '@core/directives/money-input.directive';
import { ValueSourceMarkerComponent } from '@features/bank-programs/value-source/value-source-marker.component';
import type { IncomeBand } from '@features/bank-programs/bank-programs.types';
import { incomeBandsErrorFor, type IncomeBandsError } from './income-rule.rules';

// The verdict lives in `income-rule.rules.ts` (no Angular) — see that file for why
// `gap` and `overlap` have no client token. Re-exported because every consumer of
// this control also wants the rule.
export { incomeBandsErrorFor, type IncomeBandsError };

/**
 * Income bands, EDGES ONLY, half-open `[fromInclusive, toExclusive)`.
 *
 * Modelled on the shipped `app-score-bands-editor` (constitution v14.0.0) and for
 * the same reason recorded there: a band's end IS the next band's start, so typing
 * either box moves the other and **gaps and overlaps stay unrepresentable rather
 * than merely validated**. An uncovered value earns the applicant no figures at all,
 * so a hole in the table is not a smaller table — it is a customer told nothing.
 *
 * Two deliberate differences from the score editor:
 *
 *   1. The FIRST edge is a real, editable box, not "No minimum". A bank's value
 *      table may start above zero, and below that floor the correct outcome is a
 *      stated reason (`SURROGATE_NO_MATCHING_ROW`), never a zero income.
 *   2. The cell is an EGP money input (`appMoneyInput`, A27), not a 0–100 score,
 *      which is why this is a sibling component rather than a reuse.
 */
@Component({
  selector: 'app-income-bands-editor',
  standalone: true,
  imports: [
    FormsModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    MoneyInputDirective,
    ValueSourceMarkerComponent,
  ],
  providers: [provideNzIconsPatch([PlusOutline, DeleteOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (bands().length === 0) {
      <div class="ib__empty">
        <p class="ib__emptyText" i18n="@@bank_programs.income.bands_empty">
          This method reads a number and looks up the band it falls in. Enter the edges — a band's
          end is the next band's start, so no gap or overlap is possible.
        </p>
        <button nz-button nzType="primary" type="button" (click)="seed()">
          <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@bank_programs.income.bands_seed">Start with three bands</span>
        </button>
      </div>
    } @else {
      <div class="ib__head" aria-hidden="true">
        <span class="ib__headRange">
          <span i18n="@@bank_programs.income.col_from">From</span>
          <span class="ib__arrow">→</span>
          <span i18n="@@bank_programs.income.col_to">To</span>
        </span>
        <span i18n="@@bank_programs.income.col_income">Assumed monthly income (EGP)</span>
      </div>

      <ol class="ib__list">
        @for (band of bands(); track $index) {
          <li class="ib__row">
            <span class="ib__range">
              <input
                nz-input
                appMoneyInput
                type="text"
                class="ib__edge"
                [attr.aria-label]="fromAriaLabel"
                [ngModel]="band.fromInclusive"
                (ngModelChange)="setEdge($index, $event)"
                [ngModelOptions]="{ standalone: true }"
              />
              <span class="ib__arrow" aria-hidden="true">→</span>
              @if ($index < bands().length - 1) {
                <input
                  nz-input
                  appMoneyInput
                  type="text"
                  class="ib__edge"
                  [attr.aria-label]="toAriaLabel"
                  [ngModel]="band.toExclusive"
                  (ngModelChange)="setUpperEdge($index, $event)"
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
              @if (unit()) {
                <span class="ib__unit">{{ unit() }}</span>
              }
            </span>

            <input
              nz-input
              appMoneyInput
              type="text"
              class="ib__income"
              [attr.aria-label]="incomeAriaLabel"
              [ngModel]="band.incomeEGP"
              (ngModelChange)="setIncome($index, $event)"
              [ngModelOptions]="{ standalone: true }"
            />

            <!-- Marks the band's INCOME. The edges are the bank's own thresholds and
                 are marked separately if ever needed; the income is the figure that
                 gets guessed. -->
            <app-value-source-marker
              [compact]="true"
              [estimated]="isEstimated($index)"
              (estimatedChange)="markEstimated($index, $event)"
            ></app-value-source-marker>

            @if (bands().length > 1) {
              <button
                nz-button
                nzType="text"
                nzDanger
                type="button"
                class="ib__remove"
                [attr.aria-label]="removeAriaLabel"
                (click)="removeAt($index)"
              >
                <span nz-icon nzType="delete" nzTheme="outline" aria-hidden="true"></span>
              </button>
            } @else {
              <span class="ib__removeSpacer" aria-hidden="true"></span>
            }
          </li>
        }
      </ol>

      <p class="ib__hint" i18n="@@bank_programs.income.bands_link_hint">
        A band's end is the next band's start — edit either box and the other follows. A value below
        the first edge produces no figures, which is stated to the customer, never shown as zero.
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

      .ib__empty {
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

      .ib__income {
        inline-size: 100%;
      }

      .ib__arrow {
        color: var(--color-text-tertiary);
      }

      .ib__unit {
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
      }

      .ib__hint {
        margin: var(--space-2) 0 0;
        max-inline-size: 68ch;
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
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
        .ib__row {
          grid-template-columns: minmax(0, 1fr) auto;
        }
        .ib__range {
          grid-column: 1 / -1;
        }
        .ib__head {
          display: none;
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
   * Which band INCOMES are team-estimated, by index.
   *
   * Indexed, unlike the key table: a band has no natural identity beyond its position,
   * and the stored path is `incomeAssumption.bands.<index>.incomeEGP`. An index is
   * only a stable name for as long as the rows above it stay put, which is why every
   * structural edit is ANNOUNCED — see `structureChange`.
   */
  readonly estimatedIndexes = input<ReadonlySet<number>>(new Set());
  readonly estimatedIndexesChange = output<{ index: number; estimated: boolean }>();

  /**
   * A structural edit, so the host can move its index-keyed markers with the rows.
   *
   * Without this the incomes moved and the markers did not: removing a band left the
   * "we estimated this" flag pointing at whatever row inherited the index — a number
   * the bank DID state — while the guessed one went unmarked and the program could go
   * live on it. `addBand` needs no event: it splits the LAST row, so the new row is
   * appended and no existing index shifts.
   */
  readonly structureChange = output<{ kind: 'remove'; index: number } | { kind: 'reset' }>();

  isEstimated(index: number): boolean {
    return this.estimatedIndexes().has(index);
  }

  markEstimated(index: number, estimated: boolean): void {
    this.estimatedIndexesChange.emit({ index, estimated });
  }

  readonly fromAriaLabel = $localize`:@@bank_programs.income.aria.band_from:Band starts at`;
  readonly toAriaLabel = $localize`:@@bank_programs.income.aria.band_to:Band ends at — also the next band's start`;
  readonly lastToAriaLabel = $localize`:@@bank_programs.income.aria.band_last_to:Top band ends at — leave empty for no maximum`;
  readonly noMaximumPlaceholder = $localize`:@@bank_programs.income.no_maximum:No maximum`;
  readonly incomeAriaLabel = $localize`:@@bank_programs.income.aria.band_income:Assumed monthly income in EGP`;
  readonly removeAriaLabel = $localize`:@@bank_programs.income.aria.remove_band:Remove this band`;

  readonly error = computed<IncomeBandsError>(() => incomeBandsErrorFor(this.bands()));

  /**
   * Three ascending bands with blank incomes. A blank table is the one state that
   * produces nothing, so the empty view offers a shape rather than a single row for
   * the admin to decode. Edges are left for the admin to type: guessing a bank's
   * years-vs-EGP thresholds would be inventing policy.
   */
  seed(): void {
    this.bands.set([
      { fromInclusive: '0', toExclusive: '', incomeEGP: '' },
      { fromInclusive: '', toExclusive: '', incomeEGP: '' },
      { fromInclusive: '', toExclusive: null, incomeEGP: '' },
    ]);
    this.structureChange.emit({ kind: 'reset' });
  }

  clear(): void {
    this.bands.set([]);
    this.structureChange.emit({ kind: 'reset' });
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
    this.bands.set(relink(rows));
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
    this.bands.set(relink(remaining));
    this.structureChange.emit({ kind: 'remove', index });
  }

  setEdge(index: number, value: string): void {
    this.bands.set(
      relink(this.bands().map((row, i) => (i === index ? { ...row, fromInclusive: value } : row))),
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
    this.bands.set(
      rows.map((row, i) => (i === lastIndex ? { ...row, toExclusive: trimmed || null } : row)),
    );
  }

  setIncome(index: number, value: string): void {
    this.bands.set(
      this.bands().map((row, i) => (i === index ? { ...row, incomeEGP: value } : row)),
    );
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
