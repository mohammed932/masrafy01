import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { DeleteOutline, PlusOutline, WarningOutline } from '@ant-design/icons-angular/icons';
import type { DbrBand } from '../../features/bank-programs/bank-programs.types';

/** Mirrors the backend `validateDbrBands` reasons so the two never disagree. */
export type DbrBandsError =
  | 'NOT_ASCENDING'
  | 'DUPLICATE_BOUND'
  | 'BOUND_MISSING'
  | 'CAP_OUT_OF_RANGE'
  | null;

/**
 * Income-banded DBR table editor (FR-016 … FR-021a).
 *
 * One implementation, three hosts — bank lending policy, predefined-program
 * catalog defaults, and the bank program itself — with identical rules, so an
 * admin learns the control once.
 *
 * Semantics enforced by the UI, not just validated after the fact:
 *   - upper bounds are INCLUSIVE and must ascend
 *   - the LAST row is always the open-ended band; its bound input is replaced by
 *     a locked "and above" marker, which is why it can never be deleted or
 *     reordered into the middle
 *   - caps are constrained to 1…100
 *
 * Empty table (`[]`) means "no bands" — the host falls back to its flat cap
 * (FR-020), so a program that never used bands keeps working untouched.
 */
@Component({
  selector: 'app-dbr-bands-editor',
  standalone: true,
  imports: [FormsModule, NzButtonModule, NzIconModule, NzInputModule, NzToolTipModule],
  providers: [provideNzIconsPatch([PlusOutline, DeleteOutline, WarningOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bands">
      <div class="bands__head">
        <div>
          <h4 class="bands__title" i18n="@@dbrBands.title">Debt-burden ratio by income</h4>
          <p class="bands__hint" i18n="@@dbrBands.hint">
            Lower incomes usually carry a tighter cap. Upper bounds are inclusive; the last band
            covers everything above.
          </p>
        </div>
        @if (bands().length > 0) {
          <button
            nz-button
            nzType="text"
            nzDanger
            type="button"
            class="bands__clear"
            (click)="clearAll()"
            i18n="@@dbrBands.useFlatCap"
          >
            Use a single flat cap
          </button>
        }
      </div>

      @if (bands().length === 0) {
        <div class="bands__empty">
          <p i18n="@@dbrBands.empty">
            This program uses one flat cap for every income level.
          </p>
          <button nz-button nzType="default" type="button" (click)="startBands()">
            <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
            <span i18n="@@dbrBands.startBanding">Band it by income</span>
          </button>
        </div>
      } @else {
        <ul class="bands__list">
          @for (band of bands(); track $index) {
            <li class="band" [class.band--open]="isLast($index)">
              <span class="band__index">{{ $index + 1 }}</span>

              <label class="band__field">
                <span class="band__label" i18n="@@dbrBands.upTo">Monthly income up to</span>
                @if (isLast($index)) {
                  <span class="band__openEnded" i18n="@@dbrBands.andAbove">and above</span>
                } @else {
                  <input
                    nz-input
                    type="text"
                    inputmode="decimal"
                    class="band__input band__input--num"
                    [attr.aria-label]="upToAriaLabel"
                    [ngModel]="band.upToIncomeEGP"
                    (ngModelChange)="setBound($index, $event)"
                    [ngModelOptions]="{ standalone: true }"
                    placeholder="10000.00"
                  />
                }
              </label>

              <label class="band__field band__field--cap">
                <span class="band__label" i18n="@@dbrBands.cap">Cap %</span>
                <input
                  nz-input
                  type="text"
                  inputmode="decimal"
                  class="band__input band__input--num"
                  [attr.aria-label]="capAriaLabel"
                  [ngModel]="band.capPercent"
                  (ngModelChange)="setCap($index, $event)"
                  [ngModelOptions]="{ standalone: true }"
                  placeholder="50.0000"
                />
              </label>

              @if (isLast($index)) {
                <span class="band__lock" nz-tooltip [nzTooltipTitle]="lastRowTip">
                  <span nz-icon nzType="warning" nzTheme="outline" aria-hidden="true"></span>
                </span>
              } @else {
                <button
                  nz-button
                  nzType="text"
                  nzDanger
                  type="button"
                  class="band__remove"
                  [attr.aria-label]="removeAriaLabel"
                  (click)="removeAt($index)"
                >
                  <span nz-icon nzType="delete" nzTheme="outline" aria-hidden="true"></span>
                </button>
              }
            </li>
          }
        </ul>

        <button nz-button nzType="dashed" type="button" class="bands__add" (click)="addBand()">
          <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@dbrBands.addBand">Add band</span>
        </button>

        @if (error(); as err) {
          <p class="bands__error" role="alert">
            @switch (err) {
              @case ('NOT_ASCENDING') {
                <span i18n="@@dbrBands.error.notAscending"
                  >Each band must end higher than the one before it.</span
                >
              }
              @case ('DUPLICATE_BOUND') {
                <span i18n="@@dbrBands.error.duplicate"
                  >Two bands end at the same income.</span
                >
              }
              @case ('BOUND_MISSING') {
                <span i18n="@@dbrBands.error.boundMissing"
                  >Every band except the last needs an upper bound.</span
                >
              }
              @case ('CAP_OUT_OF_RANGE') {
                <span i18n="@@dbrBands.error.capRange">Caps must be between 1 and 100.</span>
              }
            }
          </p>
        }
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .bands__head {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-3);
      }

      .bands__title {
        margin: 0;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }

      .bands__hint {
        margin: var(--space-1) 0 0;
        font-size: var(--text-xs);
        line-height: var(--line-height-base);
        color: var(--color-text-tertiary);
        max-inline-size: 52ch;
      }

      .bands__clear,
      .bands__add {
        cursor: pointer;
      }

      .bands__empty {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-4);
        margin-block-start: var(--space-3);
        padding: var(--space-4);
        border: 1px dashed var(--color-border-default);
        border-radius: var(--radius-md);
        background: var(--color-surface-muted);
      }

      .bands__empty p {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }

      .bands__list {
        list-style: none;
        margin: var(--space-3) 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .band {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) minmax(0, 7.5rem) auto;
        align-items: end;
        gap: var(--space-3);
        padding: var(--space-3);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        background: var(--color-surface-default);
        transition: border-color var(--motion-duration-base) var(--motion-easing-standard);
      }

      .band:focus-within {
        border-color: var(--color-border-focus);
      }

      /* The open-ended band is structurally different, so it reads differently. */
      .band--open {
        background: var(--color-surface-muted);
      }

      .band__index {
        inline-size: 1.5rem;
        block-size: 1.5rem;
        display: grid;
        place-items: center;
        border-radius: var(--radius-pill);
        background: var(--color-surface-muted);
        color: var(--color-text-tertiary);
        font-size: var(--text-xxs);
        font-variant-numeric: tabular-nums;
      }

      .band--open .band__index {
        background: var(--color-info-bg);
        color: var(--color-info);
      }

      .band__field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-inline-size: 0;
      }

      .band__label {
        font-size: var(--text-xxs);
        color: var(--color-text-tertiary);
      }

      .band__input--num {
        font-variant-numeric: tabular-nums;
        font-feature-settings: var(--font-feature-tabular);
      }

      .band__openEnded {
        block-size: 2rem;
        display: flex;
        align-items: center;
        font-size: var(--text-sm);
        font-style: italic;
        color: var(--color-text-secondary);
      }

      .band__remove,
      .band__lock {
        cursor: pointer;
      }

      .band__lock {
        display: grid;
        place-items: center;
        /* 44px min touch target (WCAG 2.5.5) without inflating the desktop row. */
        block-size: 2.75rem;
        inline-size: 2.75rem;
        color: var(--color-text-tertiary);
        cursor: help;
      }

      .band__remove {
        min-block-size: 2.75rem;
        min-inline-size: 2.75rem;
      }

      .bands__add {
        margin-block-start: var(--space-3);
        inline-size: 100%;
      }

      .bands__error {
        margin: var(--space-2) 0 0;
        font-size: var(--text-xs);
        color: var(--color-error);
      }

      @media (max-width: 767px) {
        .band {
          grid-template-columns: auto 1fr auto;
        }

        .band__field--cap {
          grid-column: 2 / -1;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .band {
          transition: none;
        }
      }
    `,
  ],
})
export class DbrBandsEditorComponent {
  /** Two-way bound band table. `[]` means "no bands — use the flat cap" (FR-020). */
  readonly bands = model.required<DbrBand[]>();

  /** Flat cap of the host, used as the starting cap when banding is switched on. */
  readonly flatCapPercent = input<string>('50.0000');

  // Aria labels + tooltips are plain properties so `i18n` extraction still sees them.
  readonly upToAriaLabel = $localize`:@@dbrBands.aria.upTo:Band upper bound, monthly income in EGP`;
  readonly capAriaLabel = $localize`:@@dbrBands.aria.cap:Band cap percent`;
  readonly removeAriaLabel = $localize`:@@dbrBands.aria.remove:Remove this band`;
  readonly lastRowTip = $localize`:@@dbrBands.tip.lastRow:The last band is always open-ended — it covers every income above the band before it.`;

  /**
   * Client-side mirror of the backend `validateDbrBands`. Surfacing the same
   * verdict inline saves a round trip; the server still re-checks on save.
   */
  readonly error = computed<DbrBandsError>(() => {
    const rows = this.bands();
    if (rows.length === 0) return null;

    let previous: number | null = null;
    for (const [index, row] of rows.entries()) {
      const cap = Number(row.capPercent);
      if (!Number.isFinite(cap) || cap < 1 || cap > 100) return 'CAP_OUT_OF_RANGE';

      const isLast = index === rows.length - 1;
      if (isLast) continue;

      if (row.upToIncomeEGP === null || row.upToIncomeEGP.trim() === '') return 'BOUND_MISSING';
      const bound = Number(row.upToIncomeEGP);
      if (!Number.isFinite(bound)) return 'BOUND_MISSING';
      if (previous !== null) {
        if (bound === previous) return 'DUPLICATE_BOUND';
        if (bound < previous) return 'NOT_ASCENDING';
      }
      previous = bound;
    }
    return null;
  });

  isLast(index: number): boolean {
    return index === this.bands().length - 1;
  }

  /** Seeds a two-row table so the shape of the control is immediately obvious. */
  startBands(): void {
    this.bands.set([
      { upToIncomeEGP: '10000.00', capPercent: '35.0000' },
      { upToIncomeEGP: null, capPercent: this.flatCapPercent() },
    ]);
  }

  clearAll(): void {
    this.bands.set([]);
  }

  /** New bands are inserted BEFORE the open-ended row, which always stays last. */
  addBand(): void {
    const rows = [...this.bands()];
    rows.splice(Math.max(rows.length - 1, 0), 0, {
      upToIncomeEGP: '',
      capPercent: this.flatCapPercent(),
    });
    this.bands.set(rows);
  }

  removeAt(index: number): void {
    const rows = this.bands().filter((_, i) => i !== index);
    // Dropping to a single row leaves only the open-ended band, which is the
    // same thing as a flat cap — collapse to that rather than keep a 1-row table.
    this.bands.set(rows.length <= 1 ? [] : rows);
  }

  setBound(index: number, value: string): void {
    this.patch(index, { upToIncomeEGP: value });
  }

  setCap(index: number, value: string): void {
    this.patch(index, { capPercent: value });
  }

  private patch(index: number, patch: Partial<DbrBand>): void {
    this.bands.set(this.bands().map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }
}
