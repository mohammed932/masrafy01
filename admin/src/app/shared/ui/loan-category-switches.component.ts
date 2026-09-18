import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LOAN_CATEGORIES, categoryLabel, type LoanCategory } from '@core/loan-category';

/**
 * Which loan types a catalog program name is offered under — all four at once.
 *
 * Extracted on the second use, when the create flow needed the same decision the name's own
 * page already carries. All four on one panel rather than one behind each tab of a rail is
 * the whole point: the assignment is ONE decision with four parts, and reading it a tab at a
 * time costs four clicks and a memory of what the other three said.
 *
 * The component owns the WORDS as well as the markup, which is what makes "the same
 * vocabulary later" literal rather than aspirational — the sentence an operator reads while
 * creating a name is the same string they read while editing it.
 */
@Component({
  selector: 'app-loan-category-switches',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="gates" role="list">
      @for (c of categories; track c) {
        <li>
          <div class="gate" [class.on]="isOn(c)">
            <button
              type="button"
              role="switch"
              class="switch"
              [attr.aria-checked]="isOn(c)"
              [attr.aria-label]="ariaFor(c)"
              [attr.aria-busy]="busy() ? 'true' : null"
              (click)="toggled.emit(c)"
            >
              <span class="track" aria-hidden="true"><span class="thumb"></span></span>
              <span class="switch-text">
                <!-- The LOAN TYPE, not the sentence. Four rows each opening with the program
                     name repeated it four times under a heading that already says it, and
                     pushed every title to two lines. The full sentence stays on the
                     aria-label, where a screen reader has no heading in view to lean on. -->
                <span class="switch-title">{{ nameOf(c) }}</span>
                <span class="switch-hint">
                  @if (isOn(c)) {
                    <!-- Says WHO sees the effect and WHERE. "Banks can sell it" described a
                         business fact the admin cannot see; the name appearing in a picker is
                         the thing they can go and check. "of this type" rather than the type's
                         name: the row IS the type, and interpolating it forced "a Auto Loan". -->
                    <span i18n="@@pnd.gate_on_hint"
                      >A bank adding a program of this type can pick this name.</span
                    >
                  } @else {
                    <span i18n="@@pnd.gate_off_hint">No bank program can pick this name here.</span>
                  }
                </span>
              </span>
            </button>
          </div>
        </li>
      }
    </ul>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .gates {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: var(--space-3);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .gate {
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        background: var(--bg-muted);
        transition: border-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      /* On = brand edge and the page surface: the gate stops being the thing you must deal
         with and becomes a heading for what it turns on. */
      .gate.on {
        border-color: color-mix(in srgb, var(--primary) 35%, var(--border-default));
        background: var(--bg-surface);
      }
      .switch {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        inline-size: 100%;
        min-block-size: 44px;
        padding: var(--space-4);
        border: none;
        border-radius: var(--radius-md);
        background: none;
        text-align: start;
        font: inherit;
        cursor: pointer;
      }
      /* The track darkens on hover; the panel behind it does not. Repainting the gate's
         background on hover made the whole strip look toggled. */
      .switch:hover .track {
        background: var(--text-tertiary);
      }
      .switch[aria-checked='true']:hover .track {
        background: color-mix(in srgb, var(--primary) 85%, black);
      }
      .switch:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .switch[aria-busy='true'] {
        opacity: 0.65;
      }
      .track {
        position: relative;
        flex: none;
        display: block;
        inline-size: 40px;
        block-size: 24px;
        margin-block-start: 1px;
        border-radius: var(--radius-pill);
        background: var(--border-strong);
        transition: background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .switch[aria-checked='true'] .track {
        background: var(--primary);
      }
      .thumb {
        position: absolute;
        inset-block-start: 3px;
        inset-inline-start: 3px;
        inline-size: 18px;
        block-size: 18px;
        border-radius: var(--radius-pill);
        background: var(--bg-surface);
        box-shadow: var(--shadow-sm);
        transition: transform var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .switch[aria-checked='true'] .thumb {
        transform: translateX(16px);
      }
      /* A logical inset plus a mirrored translate, so the thumb travels toward the trailing
         edge in both directions instead of always rightward. */
      :host-context([dir='rtl']) .switch[aria-checked='true'] .thumb {
        transform: translateX(-16px);
      }
      .switch-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-inline-size: 0;
      }
      .switch-title {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--text-primary);
      }
      .switch-hint {
        font-size: var(--text-xs);
        color: var(--text-secondary);
      }
      @media (prefers-reduced-motion: reduce) {
        .gate,
        .track,
        .thumb {
          transition: none;
        }
      }
    `,
  ],
})
export class LoanCategorySwitchesComponent {
  readonly value = input.required<readonly LoanCategory[]>();
  readonly busy = input<boolean>(false);
  /**
   * The program name, for the per-row accessible name. Empty while the name is being
   * created and has none yet — the sentence then names the loan type alone rather than
   * announcing a blank where a name should be.
   */
  readonly subject = input<string>('');

  readonly toggled = output<LoanCategory>();

  protected readonly categories = LOAN_CATEGORIES;

  protected isOn(category: LoanCategory): boolean {
    return this.value().includes(category);
  }

  protected nameOf(category: LoanCategory): string {
    return categoryLabel(category);
  }

  protected ariaFor(category: LoanCategory): string {
    const type = categoryLabel(category);
    const name = this.subject();
    if (name === '') {
      return this.isOn(category)
        ? $localize`:@@lcs.aria_on_unnamed:Offered under ${type}:TYPE:. Turn off.`
        : $localize`:@@lcs.aria_off_unnamed:Not offered under ${type}:TYPE:. Turn on.`;
    }
    return this.isOn(category)
      ? $localize`:@@lcs.aria_on:${name}:NAME: is offered under ${type}:TYPE:. Turn off.`
      : $localize`:@@lcs.aria_off:${name}:NAME: is not offered under ${type}:TYPE:. Turn on.`;
  }
}
