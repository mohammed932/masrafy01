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
 * that a source exists at all. A blank row is not sent: emit() drops it, so a program that
 * counts nothing carries no policy rather than an object full of blanks.
 *
 * ── TWO PAIRS PER LINE, AND NO TABLE ──────────────────────────────────────────
 * This was a one-input-per-row table: four sources cost ~800px of a step that already
 * scrolls, with the label at one edge of a 34rem line and its figure at the other — far
 * enough apart that a hover tint had to be added to pair them, which is a spatial problem
 * answered with colour. Nothing here is tabular data either: it is four labelled fields,
 * and the table was carrying two naming mechanisms at once (aria-label on the sources, a
 * real label element on the ceiling).
 *
 * So: a fluid grid of name-over-box pairs, two to a line at this card's width and one on a
 * narrow viewport, each name in the house field-label treatment directly above the figure
 * it names — the same shape as every other field on the step. The column headings go with
 * the table: with two pairs to a line "Source / Counted at" has to be drawn twice, and the
 * unit lives inside every box while the hint below says the rest, so it was the third
 * statement of one fact set directly under the band's own micro-label.
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
        <div class="aie__grid">
          @for (option of options(); track option.key) {
            <div class="aie__pair">
              <label class="aie__label" [for]="'aie-' + option.key">
                <span>{{ option.label }}</span>
                @if (option.retired) {
                  <span class="aie__retired" i18n="@@additional_income.retired"
                    >no longer asked</span
                  >
                }
              </label>
              <!-- The house field, not a local one: this is the same kind of figure as
                   every other percentage on the step, and the local copy reached for
                   --color-accent-strong, which no palette defines -- so its focus ring
                   was invalid at computed-value time and keyboard focus showed nothing.
                   No ariaLabel: the label element beside it is the accessible name now,
                   which is also what makes the whole name clickable. -->
              <app-figure-field
                [fieldId]="'aie-' + option.key"
                [value]="percentFor(option.key)"
                unit="%"
                (valueChange)="setPercent(option.key, $event)"
              ></app-figure-field>
            </div>
          }
        </div>
        <!-- The ceiling reads as the sentence it is, with the figure inside it: it is stated
             over the total of the pairs above, so it sits below a heavier rule than anything
             separating them, at the same width. The label WRAPS the field, so its accessible
             name is the whole sentence and a click anywhere on either half lands the caret.
             The two &ngsp; are load-bearing and were measured, not assumed: Angular drops
             whitespace-only text nodes, and the name is a concatenation of what is left --
             without them a screen reader heard "may not exceedof the basic income", which the
             version before this had too. They add no flex item: a whitespace-only anonymous
             item is not rendered. -->
        <label class="aie__cap" for="aie-cap">
          <span class="aie__cap-head" i18n="@@additional_income.cap"
            >All of it together may not exceed</span
          >&ngsp;
          <app-figure-field
            fieldId="aie-cap"
            [value]="config()?.capPercentOfBasic ?? ''"
            unit="%"
            (valueChange)="setCap($event)"
          ></app-figure-field
          >&ngsp;
          <span class="aie__cap-tail" i18n="@@additional_income.cap_tail">of the basic income</span>
        </label>
        <p class="aie__hint" i18n="@@additional_income.hint">
          Leave a source blank to count none of it. Leave the limit blank if the bank states none —
          blank is not the same as 100%.
        </p>
      }
    </div>
  `,
  styles: [
    `
      .aie {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }

      /* Fluid, not two hardcoded columns: the same editor renders four sources on this
         card and one on a 720px viewport, and auto-fit answers both without a breakpoint
         of its own. min(100%, ...) is what stops the track being wider than the card
         itself at the narrow end. Capped at the width two names and two narrow figures
         need -- stretched across the whole control column, the pairs drift apart and the
         grid stops reading as one list. */
      .aie__grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr));
        column-gap: var(--space-5);
        /* A step wider than the gap INSIDE a pair, which is what keeps the name attached to
           the box under it rather than to the box above it. Uniform spacing here would draw
           eight items in one column with no telling which name belongs to which figure. */
        row-gap: var(--space-5);
        max-inline-size: 48rem;
      }

      /* The name sits ABOVE its box, which is what every other field on this step does --
         label on top, four pixels of air, control under it. Beside the box it had to share
         the line with a figure that is only three characters wide, so the longest name was
         either crowding the field or pushing it out of line with the one below it.
         The pair is CAPPED rather than filling its track, and that is measured: at 720px the
         grid drops to one column, and an uncapped pair stretched the name across a 526px
         line above a 144px box. Every pair is the same width, so the boxes line up in a
         column the eye can run down. */
      .aie__pair {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-1);
        max-inline-size: 22rem;
      }

      /* The house field label, verbatim: 12px semibold at secondary ink with the same
         tracking every nz-form-label on this form carries. A name set here at content size
         and primary ink would be the only field on the step drawn that way. The pointer is
         the affordance -- the label is tied to its input, so clicking the name focuses the
         figure. */
      .aie__label {
        margin: 0;
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        letter-spacing: var(--tracking-wide);
        line-height: 1.4;
        cursor: pointer;
      }

      .aie__retired {
        display: inline-block;
        margin-inline-start: var(--space-2);
        padding: var(--space-0-5) var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--bg-muted);
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        font-weight: var(--font-normal);
        white-space: nowrap;
      }

      /* The total rule: heavier than anything between the pairs above it, which is what says
         the figure below is stated OVER them rather than beside them. Wraps at a narrow
         width instead of squeezing the field, so the sentence breaks between clauses. */
      .aie__cap {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-3);
        max-inline-size: 48rem;
        padding-block-start: var(--space-4);
        border-block-start: 1px solid var(--color-border-strong);
        cursor: pointer;
      }

      .aie__cap-head {
        color: var(--color-text-primary);
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
      }

      /* The qualifier, at the same size as the head so the two read as one sentence, and a
         step back in ink because the head is the half that names the setting. */
      .aie__cap-tail {
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
        font-weight: var(--font-normal);
      }

      /* Aligned with the grid, not with the card: a hint set wider than the thing it is
         about reads as a note on the whole step. */
      .aie__hint {
        margin: 0;
        max-inline-size: 48rem;
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
