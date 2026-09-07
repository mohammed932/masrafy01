import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { FigureFieldComponent } from '@shared/income-rule/figure-field.component';

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
  /**
   * This bank weighs the source, but the questionnaire no longer asks about it.
   *
   * Shown rather than dropped: the weight is stored and still in effect, so hiding the row
   * would leave a figure working with no control able to see it. The tag says why it is
   * here so the operator can clear it deliberately.
   */
  retired?: boolean;
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
  imports: [FigureFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="aie">
      @if (options().length === 0) {
        <p class="aie__empty" i18n="@@additional_income.no_sources">
          The questionnaire is not asking about any other income yet, so there is nothing to weigh
          here.
        </p>
      } @else {
        <!-- One table, and the ceiling is its LAST ROW rather than a sentence adrift below it:
             the limit is stated over the total of the rows above, so it belongs to them, and a
             rule across the full width is the invoice idiom every reader already knows. -->
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
                <th scope="row" class="aie__label">
                  <span>{{ option.label }}</span>
                  @if (option.retired) {
                    <span class="aie__retired" i18n="@@additional_income.retired"
                      >no longer asked</span
                    >
                  }
                </th>
                <td class="aie__cell">
                  <!-- The house field, not a local one: this is the same kind of figure as
                       every other percentage on the step, and the local copy reached for
                       --color-accent-strong, which no palette defines -- so its focus ring
                       was invalid at computed-value time and keyboard focus showed nothing. -->
                  <app-figure-field
                    [fieldId]="'aie-' + option.key"
                    [value]="percentFor(option.key)"
                    unit="%"
                    [ariaLabel]="option.label"
                    (valueChange)="setPercent(option.key, $event)"
                  ></app-figure-field>
                </td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr>
              <!-- The ceiling keeps the SAME two columns as the rows above it, so its figure
                   lines up with the ones it caps. The sentence still reads as one sentence --
                   its tail sits under the head as a caption rather than beside the field,
                   because at this width "of the basic income" wrapped to its own line anyway
                   and, set at the same size and ink as the head, that read as an accident. -->
              <th scope="row" class="aie__label aie__cap-cell">
                <label for="aie-cap">
                  <span i18n="@@additional_income.cap">All of it together may not exceed</span>
                  <span class="aie__cap-tail" i18n="@@additional_income.cap_tail"
                    >of the basic income</span
                  >
                </label>
              </th>
              <td class="aie__cell aie__cap-cell">
                <app-figure-field
                  fieldId="aie-cap"
                  [value]="config()?.capPercentOfBasic ?? ''"
                  unit="%"
                  (valueChange)="setCap($event)"
                ></app-figure-field>
              </td>
            </tr>
          </tfoot>
        </table>
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
      /* Capped at the width the longest source label and one narrow figure need. Left to
         fill the control column, the label and the number it belongs to end up a third of a
         screen apart and the eye has to travel to pair them. */
      .aie__table {
        inline-size: 100%;
        max-inline-size: 34rem;
        border-collapse: collapse;
      }
      .aie__table th,
      .aie__table td {
        text-align: start;
      }
      /* The figure column is exactly as wide as the field; everything left over goes to the
         name. 1% is the CSS idiom for "shrink to content" in an auto-layout table. */
      .aie__table thead th:last-child,
      .aie__cell {
        inline-size: 1%;
        white-space: nowrap;
      }
      /* One step BELOW the band heading, and deliberately not uppercase: the band above
         already sets an uppercase micro-label, and a second tracked-out row directly under
         it reads as two headings competing rather than a heading and its columns. */
      .aie__table thead th {
        padding-block: 0 var(--space-2);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        color: var(--color-text-secondary);
        /* --color-border-subtle is not a token in this theme, which is why this rule was
           invalid at computed-value time and the header sat over nothing. */
        border-block-end: 1px solid var(--border-subtle);
      }
      .aie__table tbody th,
      .aie__table tbody td {
        padding-block: var(--space-2);
        border-block-end: 1px solid var(--border-subtle);
      }
      /* Pairs the name with its figure under the pointer. The rows are unfilled and their
         separators are hairlines, so at four rows the only thing joining the two ends of a
         line is the line itself. */
      .aie__table tbody tr:hover th,
      .aie__table tbody tr:hover td {
        background: var(--color-surface-row-hover);
      }
      .aie__label {
        font-weight: var(--font-medium);
        color: var(--color-text-primary);
        padding-inline-end: var(--space-4);
      }
      .aie__retired {
        margin-inline-start: var(--space-2);
        padding: var(--space-0-5) var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--bg-muted);
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        font-weight: var(--font-normal);
        white-space: nowrap;
      }
      /* The total rule: heavier than the hairlines above it, which is what says the figure
         below is stated OVER the rows rather than beside them. */
      .aie__cap-cell {
        padding-block: var(--space-3);
        border-block-start: 1px solid var(--color-border-strong);
      }
      .aie__table tbody tr:last-child th,
      .aie__table tbody tr:last-child td {
        border-block-end: 0;
      }
      .aie__cap-tail {
        display: block;
        margin-block-start: var(--space-0-5);
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        font-weight: var(--font-normal);
      }
      /* Aligned with the table, not with the card: a hint set wider than the thing it is
         about reads as a note on the whole step. */
      .aie__hint {
        margin: 0;
        max-inline-size: 34rem;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }
      .aie__empty {
        margin: 0;
        max-inline-size: 42rem;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
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
