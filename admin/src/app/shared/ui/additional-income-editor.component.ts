import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

/** One source and the share of it this bank counts. Mirrors the server DTO exactly. */
export interface AdditionalIncomeSource {
  factKey: string;
  percent: string;
}

export interface AdditionalIncomeConfig {
  sources: AdditionalIncomeSource[];
  capPercentOfBasic?: string;
}

/** A source the questionnaire asks about, as the host already computed it. */
export interface AdditionalIncomeOption {
  key: string;
  label: string;
}

/**
 * Money the applicant earns beside the basic figure, counted at this bank's own weight.
 *
 * ── WHY A ROW PER SOURCE AND NOT ONE PERCENTAGE ───────────────────────────────
 * The sheet this exists for states four different weights — rent at 50%, certificate returns
 * at 75%, fixed allowances at 100%, variable at 75% — and then one ceiling over the total. A
 * single "other income %" field cannot say that, and a bank that means "half the rent" would
 * have to enter a number that is right for one applicant and wrong for the next.
 *
 * ── EVERY SOURCE IS DRAWN, EMPTY OR NOT ───────────────────────────────────────
 * The list is short and fixed by the questionnaire, so all of it is on screen with a blank
 * percentage meaning "this bank counts none of it". An add-a-row control would make the
 * common edit — change one weight — a two-step operation, and would hide from the operator
 * that a source exists at all. A blank row is not sent: `emit` drops it, so a program that
 * counts nothing carries no policy rather than an object full of blanks.
 *
 * ── THE CEILING IS SEPARATE, AND ABSENT IS NOT A HUNDRED ──────────────────────
 * A bank that states no ceiling counts every weighted pound. Leaving the field blank stores
 * nothing, which is what "the sheet does not say" means; typing 100 stores a real limit that
 * happens to equal the basic figure. The two look alike on one applicant and diverge on the
 * one whose rent exceeds their salary.
 */
@Component({
  selector: 'app-additional-income-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="aie">
      @if (options().length === 0) {
        <p class="aie__empty" i18n="@@additional_income.no_sources">
          The questionnaire is not asking about any other income yet, so there is nothing to weigh
          here.
        </p>
      } @else {
        <table class="aie__table">
          <thead>
            <tr>
              <th scope="col" i18n="@@additional_income.col_source">Source</th>
              <th scope="col" i18n="@@additional_income.col_counted">Counted at</th>
            </tr>
          </thead>
          <tbody>
            @for (option of options(); track option.key) {
              <tr>
                <th scope="row" class="aie__label">{{ option.label }}</th>
                <td>
                  <span class="aie__field">
                    <input
                      class="aie__input"
                      type="text"
                      inputmode="decimal"
                      [value]="percentFor(option.key)"
                      (input)="setPercent(option.key, $any($event.target).value)"
                      [attr.aria-label]="option.label"
                    />
                    <span class="aie__unit" aria-hidden="true">%</span>
                  </span>
                </td>
              </tr>
            }
          </tbody>
        </table>

        <label class="aie__cap">
          <span class="aie__cap-label" i18n="@@additional_income.cap">
            All of it together may not exceed
          </span>
          <span class="aie__field">
            <input
              class="aie__input"
              type="text"
              inputmode="decimal"
              [value]="config()?.capPercentOfBasic ?? ''"
              (input)="setCap($any($event.target).value)"
            />
            <span class="aie__unit" aria-hidden="true">%</span>
          </span>
          <span class="aie__cap-tail" i18n="@@additional_income.cap_tail">of the basic income</span>
        </label>
        <p class="aie__hint" i18n="@@additional_income.hint">
          Leave a row blank to count none of that source. Leave the limit blank if the bank states
          none — blank is not the same as 100%.
        </p>
      }
    </div>
  `,
  styles: [
    `
      .aie {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .aie__table {
        inline-size: 100%;
        border-collapse: collapse;
        max-inline-size: 32rem;
      }
      .aie__table th,
      .aie__table td {
        padding: var(--space-2) 0;
        text-align: start;
      }
      .aie__table thead th {
        font-size: var(--text-sm);
        font-weight: 600;
        color: var(--color-text-secondary);
        border-block-end: 1px solid var(--color-border-subtle);
      }
      .aie__label {
        font-weight: 500;
        color: var(--color-text-primary);
      }
      /* One control drawn as a field with its unit INSIDE it, matching the money and
         percentage inputs everywhere else in this form. */
      .aie__field {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding-inline: var(--space-2);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-field);
        background: var(--color-surface-default);
        block-size: var(--size-field);
        inline-size: 7rem;
      }
      .aie__field:focus-within {
        border-color: var(--color-accent-strong);
        outline: 2px solid var(--color-accent-strong);
        outline-offset: 1px;
      }
      .aie__input {
        inline-size: 100%;
        border: 0;
        background: transparent;
        color: var(--color-text-primary);
        text-align: end;
        font-variant-numeric: tabular-nums lining-nums;
      }
      .aie__input:focus {
        outline: none;
      }
      .aie__unit {
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }
      .aie__cap {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
      }
      .aie__cap-label,
      .aie__cap-tail {
        color: var(--color-text-primary);
      }
      .aie__hint,
      .aie__empty {
        margin: 0;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
        max-inline-size: 42rem;
      }
    `,
  ],
})
export class AdditionalIncomeEditorComponent {
  /** The sources the questionnaire actually asks about — registry facts bound to numbers. */
  readonly options = input<readonly AdditionalIncomeOption[]>([]);

  /** `null` = this program counts no other income, which is what most of them do. */
  readonly config = model<AdditionalIncomeConfig | null>(null);

  private readonly byKey = computed(
    () => new Map((this.config()?.sources ?? []).map((s) => [s.factKey, s.percent])),
  );

  protected percentFor(factKey: string): string {
    return this.byKey().get(factKey) ?? '';
  }

  protected setPercent(factKey: string, raw: string): void {
    const value = raw.trim();
    const sources = (this.config()?.sources ?? []).filter((s) => s.factKey !== factKey);
    if (value !== '') sources.push({ factKey, percent: value });
    this.emit(sources, this.config()?.capPercentOfBasic);
  }

  protected setCap(raw: string): void {
    const value = raw.trim();
    this.emit(this.config()?.sources ?? [], value === '' ? undefined : value);
  }

  /**
   * Write the policy, or `null` when nothing is weighted.
   *
   * A cap with no sources is dropped rather than stored: the server refuses it
   * (`no_sources`), and it would be an operator staring at a refusal for a field they typed
   * into an otherwise empty table. The ORDER of the rows follows `options`, so re-entering a
   * weight does not reshuffle the stored list and make an unchanged program read as edited.
   */
  private emit(sources: AdditionalIncomeSource[], cap: string | undefined): void {
    if (sources.length === 0) {
      this.config.set(null);
      return;
    }
    const order = this.options().map((o) => o.key);
    const ordered = [...sources].sort(
      (a, b) => order.indexOf(a.factKey) - order.indexOf(b.factKey),
    );
    this.config.set({ sources: ordered, ...(cap !== undefined ? { capPercentOfBasic: cap } : {}) });
  }
}
