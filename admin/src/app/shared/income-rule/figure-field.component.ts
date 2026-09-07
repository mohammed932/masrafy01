import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MoneyInputDirective } from '@core/directives/money-input.directive';

/**
 * One typed figure: a number and what it is measured in, as a single control.
 *
 * The unit lives INSIDE the field rather than beside it. A gate that renders
 * "At least [        ]" is the same box whether the bank means twenty per cent of the
 * price or twenty pounds, and the operator has no way to tell which the engine will
 * read — while the unit as a separate word left the box itself an unlabelled slab.
 *
 * Local styles rather than `nz-input`, because the global `.ant-input` rules are
 * `!important` throughout and an affix cannot be joined to one. Every value here is the
 * design system's field token (`--size-field`, `--radius-field`, `--bg-subtle`, `--border-default`,
 * `--focus-halo`), so this reads as the same field as the table cell in the row below.
 */
@Component({
  selector: 'app-figure-field',
  standalone: true,
  imports: [FormsModule, MoneyInputDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (label()) {
      <label class="ff__label" [for]="fieldId()">{{ label() }}</label>
    }
    <span class="ff__field" [class.is-narrow]="!money()" [class.has-default]="!!placeholder()">
      <!-- Money groups its thousands (A27); a percentage or a multiplier does not, and a
           kind this screen cannot prove groups anyway — it changes nothing on a two-digit
           month count and saves a misread on a seven-digit floor. -->
      <!-- ONE input, not one per kind. The two branches differed only by the directive and
           repeated nine bindings, so an a11y or id fix landed on one of them; and the
           non-money branch read its value through an $any cast (A15/XXI) where the other one
           bound ngModel properly. Grouping is now the directive's own flag. -->
      <input
        class="ff__input"
        appMoneyInput
        [appMoneyInput]="money()"
        type="text"
        [attr.inputmode]="money() ? null : 'decimal'"
        [id]="fieldId()"
        [attr.placeholder]="hint()"
        [attr.aria-label]="label() ? null : ariaLabel()"
        [attr.aria-describedby]="describedBy()"
        [ngModel]="value()"
        (ngModelChange)="valueChange.emit($event)"
        [ngModelOptions]="{ standalone: true }"
      />
      @if (unit()) {
        <span class="ff__unit" [id]="fieldId() + '-unit'">{{ unit() }}</span>
      }
    </span>
    <!-- A placeholder is not reliably announced, and this one carries a figure the operator
         may be about to adopt. It is said out loud here, off-screen, rather than left to the
         grey text alone. -->
    @if (placeholder()) {
      <span class="ff__sr" [id]="fieldId() + '-default'">{{ placeholderNote() }}</span>
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
      }

      .ff__label {
        flex: none;
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        white-space: nowrap;
      }

      /* The shell owns the border, the hover and the focus ring; the input inside it is
         bare. That is what makes the number and its unit read as one control. */
      .ff__field {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        inline-size: 13rem;
        max-inline-size: 100%;
        min-block-size: var(--size-field);
        padding-inline: var(--space-4);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-field);
        background: var(--color-surface-elevated);
        /* The shell is the visible control, so the whole of it has to claim the caret --
           a text cursor over the padding and a pointer over the number is one box
           telling the operator two different things about itself. */
        cursor: text;
        transition:
          border-color var(--motion-duration-base) var(--motion-easing-standard),
          box-shadow var(--motion-duration-base) var(--motion-easing-standard);
      }

      /* A percentage or a multiplier is a handful of characters. A 13rem box around "20"
         reads as a money field somebody gave up on. */
      .ff__field.is-narrow {
        inline-size: 9rem;
      }

      /* Hover firms the edge; the BRAND colour is held back for focus. Ten condition rows
         each lighting up azure under the pointer says "this one" about whichever the mouse
         happens to be crossing, and the field the operator is actually typing in loses the
         only signal that singles it out. */
      .ff__field:hover {
        border-color: var(--color-border-strong);
      }

      .ff__field:focus-within {
        border-color: var(--color-brand-primary);
        box-shadow: var(--focus-halo);
      }

      .ff__input {
        flex: 1;
        min-inline-size: 0;
        margin: 0;
        padding: 0;
        border: 0;
        background: none;
        color: var(--color-text-primary);
        font: inherit;
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        font-variant-numeric: tabular-nums;
        /* Start-aligned: the figure reads from the edge the operator's language starts at
           (left in English, right in Arabic), with the unit pinned as a trailing affix. */
        text-align: start;
        caret-color: var(--color-brand-primary);
        /* Replaced, not removed: the ring is on the shell, which is the control a sighted
           keyboard user actually sees. */
        outline: none;
      }

      /* A hint, never a label: the visible label or the aria-label carries the name, and
         this only says what SHAPE of number goes in -- two decimal places for money, a
         bare integer for a percentage or a count. Regular weight and tertiary ink so an
         empty field cannot be misread as a figure the bank has already stated. */
      .ff__input::placeholder {
        color: var(--color-text-tertiary);
        font-weight: var(--font-normal);
        /* Firefox dims placeholders by default; the token above already sets the level. */
        opacity: 1;
      }

      /* A placeholder that carries the PRODUCT'S OWN FIGURE is content, not a shape hint, and
         the operator is meant to read it and decide. Tertiary measures 3.54:1 on this ground
         in light mode — under AA — so it lifts to secondary here and only here. The weight
         stays regular, which is what still tells it apart from a figure this bank has typed
         (those are semibold), and the button beside it says what it is. */
      .ff__field.has-default .ff__input::placeholder {
        color: var(--color-text-secondary);
      }

      /* Visually hidden, still announced. The house has no utility class for this. */
      .ff__sr {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        padding: 0;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }

      /* Secondary, not tertiary. The unit is what separates twenty per cent of a price from
         twenty pounds, so it is read, not decoration -- and on this field's ground tertiary
         measures 3.54:1 in light mode (it passes at 5.04:1 in dark, which is why a light-only
         failure survives a dark-mode review). The value beside it stays dominant: it is a
         step larger and inked primary. */
      .ff__unit {
        flex: none;
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        white-space: nowrap;
      }

      @media (prefers-reduced-motion: reduce) {
        .ff__field {
          transition: none;
        }
      }
    `,
  ],
})
export class FigureFieldComponent {
  /** DOM id for the input — the label's `for` and the unit's `aria-describedby` hang off it. */
  readonly fieldId = input.required<string>();
  readonly value = input<string>('');
  /** The trailing affix. `null` when the kind cannot be proved — a confidently wrong unit
   * is worse than a blank one. */
  readonly unit = input<string | null>(null);
  readonly money = input<boolean>(false);
  /** Visible label before the field ("At least"). `null` → the field stands alone. */
  readonly label = input<string | null>(null);
  /** Accessible name, used only when there is no visible label. */
  readonly ariaLabel = input<string | null>(null);

  /**
   * A figure to show in grey when the field is empty — the surrogate product's own amount.
   *
   * A PLACEHOLDER, never a value: it must not reach `stepIsConfigured`, `filledWayIds` or
   * `productRuleHasError`, all of which read the model. Writing it as a value would turn a
   * blank the bank meant ("this bank does not apply this condition") into a stated figure
   * the moment the form was saved from any other step.
   */
  readonly placeholder = input<string | null>(null);
  /** What the placeholder is, said in words for a screen reader. */
  readonly placeholderNote = input<string>('');

  readonly valueChange = output<string>();

  /** The shape hint, or — when the product states one — the figure it states. */
  protected readonly hint = computed(() => this.placeholder() ?? (this.money() ? '0.00' : '0'));

  /**
   * Both descriptions when both exist. `aria-describedby` takes a list, and dropping the unit
   * to make room for the default would stop saying whether the number is pounds or per cent.
   */
  protected readonly describedBy = computed<string | null>(() => {
    const ids: string[] = [];
    if (this.unit()) ids.push(`${this.fieldId()}-unit`);
    if (this.placeholder()) ids.push(`${this.fieldId()}-default`);
    return ids.length === 0 ? null : ids.join(' ');
  });
}
