import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LOAN_CATEGORIES, categoryLabel, type LoanCategory } from '@core/loan-category';

/**
 * The loan type a no-payslip product is FOR (v36.5.0): Personal, Auto, Mortgage, Business.
 *
 * A label, never a restriction — any loan type may still sell the product. It decides what
 * the product page shows (an Auto product's Bank defaults) and where the catalog files it.
 * Native radios in a segmented row, so arrow keys move between them for free.
 */
@Component({
  selector: 'app-loan-type-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lt" role="radiogroup" [attr.aria-labelledby]="labelledBy()">
      @for (c of categories; track c) {
        <label class="lt-opt" [class.is-on]="value() === c">
          <input
            type="radio"
            class="lt-input"
            [name]="name()"
            [value]="c"
            [checked]="value() === c"
            (change)="valueChange.emit(c)"
          />
          <span>{{ label(c) }}</span>
        </label>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .lt {
        display: inline-flex;
        flex-wrap: wrap;
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        overflow: hidden;
        background: var(--color-surface-default);
      }
      .lt-opt {
        position: relative;
        display: inline-flex;
        align-items: center;
        padding: var(--space-2) var(--space-4);
        font-size: var(--text-sm);
        color: var(--color-text-primary);
        cursor: pointer;
        transition: background-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .lt-opt + .lt-opt {
        border-inline-start: 1px solid var(--color-border-default);
      }
      .lt-opt:hover {
        background: var(--color-surface-row-hover);
      }
      .lt-opt.is-on {
        background: var(--color-brand-primary);
        color: var(--color-text-on-brand);
        font-weight: var(--font-weight-semibold);
      }
      .lt-input {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        opacity: 0;
        pointer-events: none;
      }
      .lt-opt:has(.lt-input:focus-visible) {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: calc(-1 * var(--focus-ring-width));
      }
      @media (prefers-reduced-motion: reduce) {
        .lt-opt {
          transition: none;
        }
      }
    `,
  ],
})
export class LoanTypePickerComponent {
  readonly value = input<LoanCategory | null>(null);
  /** The radios' shared name — unique per form on the page. */
  readonly name = input.required<string>();
  readonly labelledBy = input.required<string>();
  readonly valueChange = output<LoanCategory>();

  protected readonly categories = LOAN_CATEGORIES;
  protected readonly label = categoryLabel;
}
