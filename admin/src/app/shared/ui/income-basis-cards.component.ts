import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { CalculatorOutline, FileTextOutline } from '@ant-design/icons-angular/icons';
import {
  INCOME_BASES,
  incomeBasisHint,
  incomeBasisLabel,
  type IncomeBasis,
} from '@core/income-basis';

/**
 * "How does the bank prove the income?" — asked as two full cards, wherever it is asked.
 *
 * Extracted on the SECOND use, which is the repo's rule for promotion: the bank-program
 * wizard's step 1 owned this markup, and the catalog's own create flow needed the same
 * question. Two copies of a question the whole platform turns on is how the two screens
 * come to describe one decision in different words.
 *
 * `@shared/ui/` and not the feature, because the two consumers live in different features
 * (bank-programs and program-catalog) and this is the only place both may import from.
 *
 * WHAT THE COMPONENT OWNS, so no host can get it wrong:
 *
 *  - Real radios. A visually hidden native input inside each label, one shared `name`, so
 *    arrow-key group traversal and "one of these" come from the platform rather than from
 *    a handler. A card is not a button here.
 *  - The accent pairing. Plum belongs to the no-payslip concept board-wide, keyed off
 *    `data-basis` rather than off the card's POSITION — a position rule hands the colour to
 *    whatever lands there next.
 *  - The unanswered state, as a state. Both dots are drawn from the start, because an empty
 *    circle is the only thing on the card that says an answer is still owed: the fill, the
 *    glyph and the title all describe the option, none of them report that it was chosen.
 *
 * WHAT IT DOES NOT OWN: what the answer COMMITS the host to. The wizard's line ("the next
 * step shows the program names sold on a surrogate basis…") is true of the wizard and false
 * everywhere else, so it arrives as `effects` and the band is simply absent without it.
 */
@Component({
  standalone: true,
  selector: 'app-income-basis-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NzIconModule],
  providers: [provideNzIconsPatch([CalculatorOutline, FileTextOutline])],
  template: `
    <div
      class="basis-cards"
      [class.is-unanswered]="value() === null"
      role="radiogroup"
      [attr.aria-label]="ariaLabel()"
    >
      @for (b of bases; track b) {
        <label class="basis-card" [class.is-on]="value() === b" [attr.data-basis]="b">
          <input
            type="radio"
            class="sr-only"
            [name]="groupName()"
            [checked]="value() === b"
            (change)="picked.emit(b)"
          />
          <span class="basis-card-top">
            <span class="basis-card-medallion" aria-hidden="true">
              <span class="basis-card-icon" nz-icon [nzType]="iconFor(b)" nzTheme="outline"></span>
            </span>
            <span class="basis-card-dot" aria-hidden="true"></span>
          </span>
          <span class="basis-card-title">{{ labelFor(b) }}</span>
          <span class="basis-card-hint">{{ hintFor(b) }}</span>
          @if (effectFor(b); as effect) {
            <span class="basis-card-effect">{{ effect }}</span>
          }
        </label>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .sr-only {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
        border: 0;
      }
      .basis-cards {
        display: grid;
        gap: var(--space-4);
        grid-template-columns: 1fr;
      }
      @media (min-width: 48rem) {
        .basis-cards {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      .basis-card {
        --basis-accent: var(--color-brand-primary);
        position: relative;
        /* The bloom below paints at z-index -1: without a stacking context of its
           own it would slide behind the card's own background and never be seen. */
        isolation: isolate;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        margin: 0;
        padding: var(--space-5);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        background: var(--color-surface-default);
        cursor: pointer;
        animation: basis-enter var(--motion-duration-base) var(--motion-easing-standard) both;
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          background-color var(--motion-duration-fast) var(--motion-easing-standard),
          box-shadow var(--motion-duration-base) var(--motion-easing-standard),
          transform var(--motion-duration-base) var(--motion-easing-standard);
      }
      /* The two answers settle in reading order, under whatever entry the host plays. */
      .basis-card:nth-child(1) {
        animation-delay: var(--motion-stagger);
      }
      .basis-card:nth-child(2) {
        animation-delay: calc(var(--motion-stagger) * 2);
      }
      @keyframes basis-enter {
        from {
          opacity: 0;
          transform: translateY(6px);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }
      .basis-card[data-basis='no_payslip'] {
        --basis-accent: var(--color-income-surrogate);
      }
      /* The card lights from behind its own glyph when it is the answer — the accent
         arriving as light rather than as another border. Off-card by a third so what
         lands inside is the falloff, not the disc. */
      .basis-card::before {
        content: '';
        position: absolute;
        z-index: -1;
        inset-block-start: -35%;
        inset-inline-end: -15%;
        inline-size: 15rem;
        block-size: 15rem;
        border-radius: 50%;
        background: radial-gradient(
          circle at center,
          color-mix(in srgb, var(--basis-accent) 20%, transparent),
          transparent 70%
        );
        opacity: 0;
        transform: scale(0.7);
        pointer-events: none;
        transition:
          opacity var(--motion-duration-base) var(--motion-easing-standard),
          transform var(--motion-duration-slow) var(--motion-easing-emphasized);
      }
      /* The commit mark: a spine on the leading edge that grows from the centre out
         when the answer is taken. Inline-start, so it flips with the writing mode. */
      .basis-card::after {
        content: '';
        position: absolute;
        inset-block: 0;
        inset-inline-start: 0;
        inline-size: 3px;
        background: var(--basis-accent);
        transform: scaleY(0);
        transition: transform var(--motion-duration-base) var(--motion-easing-emphasized);
      }
      .basis-card.is-on::after {
        transform: scaleY(1);
      }
      /* Hover previews the card's OWN accent rather than a neutral darkening, so the
         plum of the no-payslip answer is visible before it is committed to. */
      .basis-card:hover:not(.is-on) {
        border-color: color-mix(in srgb, var(--basis-accent) 45%, var(--color-border-default));
        background: color-mix(in srgb, var(--basis-accent) 4%, var(--color-surface-default));
        transform: translateY(-1px);
      }
      .basis-card:hover:not(.is-on)::before {
        opacity: 0.5;
        transform: scale(0.88);
      }
      .basis-card:active:not(.is-on) {
        transform: none;
      }
      /* Same split the pills use: an always-on ring for engines without :has(), and
         focus-visible only where it is available — otherwise clicking a card leaves a
         ring on it for the session and selection and focus become one picture. */
      .basis-card:focus-within {
        outline: 2px solid var(--basis-accent);
        outline-offset: 3px;
      }
      @supports selector(:has(*)) {
        .basis-card:focus-within {
          outline: none;
        }
        .basis-card:has(:focus-visible) {
          outline: 2px solid var(--basis-accent);
          outline-offset: 3px;
        }
      }
      .basis-cards.is-unanswered .basis-card {
        border-color: color-mix(in srgb, var(--basis-accent) 28%, var(--color-border-default));
      }
      .basis-card.is-on {
        border-color: color-mix(in srgb, var(--basis-accent) 60%, var(--color-border-default));
        background: color-mix(in srgb, var(--basis-accent) 5%, var(--color-surface-default));
        box-shadow: 0 6px 22px color-mix(in srgb, var(--basis-accent) 18%, transparent);
        transform: translateY(-2px);
      }
      .basis-card.is-on::before {
        opacity: 1;
        transform: none;
      }
      .basis-card-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
      }
      /* The glyph gets a tile of its own instead of floating grey in a corner: at rest
         it is the only colour on the card, which is what tells the two answers apart
         before either label is read. */
      .basis-card-medallion {
        flex: none;
        display: grid;
        place-items: center;
        inline-size: 2.5rem;
        block-size: 2.5rem;
        border-radius: var(--radius-md);
        border: 1px solid color-mix(in srgb, var(--basis-accent) 18%, transparent);
        background: color-mix(in srgb, var(--basis-accent) 9%, var(--color-surface-default));
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          background-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .basis-card.is-on .basis-card-medallion {
        border-color: color-mix(in srgb, var(--basis-accent) 40%, transparent);
        background: color-mix(in srgb, var(--basis-accent) 16%, var(--color-surface-default));
      }
      .basis-card-icon {
        font-size: 20px;
        line-height: 1;
        color: color-mix(in srgb, var(--basis-accent) 70%, var(--color-text-secondary));
        transition: color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .basis-card.is-on .basis-card-icon {
        color: var(--basis-accent);
      }
      .basis-card-title {
        font-size: var(--text-md);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .basis-card.is-on .basis-card-title {
        color: color-mix(in srgb, var(--basis-accent) 82%, var(--color-text-primary));
      }
      .basis-card-hint {
        font-size: var(--text-sm);
        line-height: var(--line-height-base);
        color: var(--color-text-secondary);
      }
      /* The dependency, said before it is committed to rather than discovered two
         steps later. A tinted band across the foot of the card, not an indented
         paragraph: it is a different KIND of sentence from the description above it.
         margin-block-start:auto pins it to the bottom edge, so the two cards' bands
         line up however unequal the two descriptions are. Negative inline margins
         bleed it to the card's edges; they are logical, so it still reaches both
         edges in Arabic. */
      .basis-card-effect {
        margin-block-start: auto;
        margin-inline: calc(var(--space-5) * -1);
        margin-block-end: calc(var(--space-5) * -1);
        padding: var(--space-3) var(--space-5);
        border-block-start: 1px solid
          color-mix(in srgb, var(--basis-accent) 18%, var(--color-border-default));
        background: color-mix(in srgb, var(--basis-accent) 4%, transparent);
        font-size: var(--text-xs);
        line-height: var(--line-height-base);
        font-weight: var(--font-weight-medium);
        /* Accent-tinted ink on the accent-tinted band, kept as the wizard has always drawn
           it. Measured rather than assumed, because a first reading called this a contrast
           failure: the band's fill is a color-mix against transparent, i.e. a SEMI-TRANSPARENT
           colour, so it has to be composited over what is behind it before the ratio means
           anything. Composited, it is 5.52:1 unselected / 6.4:1 selected in light and
           6.77 / 6.84 in dark — all clear of 4.5:1, so the tint stays. */
        color: color-mix(in srgb, var(--basis-accent) 72%, var(--color-text-secondary));
        transition:
          background-color var(--motion-duration-fast) var(--motion-easing-standard),
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .basis-card.is-on .basis-card-effect {
        border-block-start-color: color-mix(in srgb, var(--basis-accent) 30%, transparent);
        background: color-mix(in srgb, var(--basis-accent) 9%, transparent);
        color: color-mix(in srgb, var(--basis-accent) 82%, var(--color-text-primary));
      }
      /* The radio mark. Drawn on both cards at rest, because an empty circle is the
         only thing here that says an answer is still owed. */
      .basis-card-dot {
        flex: none;
        display: grid;
        place-items: center;
        inline-size: 18px;
        block-size: 18px;
        border: 2px solid var(--color-border-strong);
        border-radius: 50%;
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          box-shadow var(--motion-duration-base) var(--motion-easing-standard);
      }
      /* Scale-in rather than a swapped background — the dot is the smallest mark on
         the step, and appearing instantly at 9px reads as a rendering glitch. */
      .basis-card-dot::after {
        content: '';
        inline-size: 9px;
        block-size: 9px;
        border-radius: 50%;
        background: var(--basis-accent);
        transform: scale(0);
        transition: transform 140ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .basis-card:hover:not(.is-on) .basis-card-dot {
        border-color: color-mix(in srgb, var(--basis-accent) 60%, var(--color-border-strong));
      }
      /* Unanswered, both cards: the ring picks up the accent so the pair reads as one
         live question rather than two grey outlines. */
      .basis-cards.is-unanswered .basis-card-dot {
        border-color: color-mix(in srgb, var(--basis-accent) 45%, var(--color-border-strong));
      }
      /* A halo, not a bigger dot: the ring spreads outward on the commit and the
         mark itself keeps its size, so nothing on the row shifts. */
      .basis-card.is-on .basis-card-dot {
        border-color: var(--basis-accent);
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--basis-accent) 14%, transparent);
      }
      .basis-card.is-on .basis-card-dot::after {
        transform: scale(1);
      }
      @media (prefers-reduced-motion: reduce) {
        .basis-card,
        .basis-card::before,
        .basis-card::after,
        .basis-card-dot,
        .basis-card-dot::after,
        .basis-card-medallion,
        .basis-card-icon,
        .basis-card-effect {
          animation: none;
          transition: none;
        }
      }
    `,
  ],
})
export class IncomeBasisCardsComponent {
  /** `null` is the UNANSWERED state, and it is a state — not a missing value to default away. */
  readonly value = input.required<IncomeBasis | null>();
  readonly ariaLabel = input.required<string>();
  /**
   * The radios' shared `name`. An input rather than a constant so two of these can never
   * end up on one document sharing a group — the browser would then let one card unpick
   * the other screen's answer.
   */
  readonly groupName = input('income-basis');
  /** What the answer commits the HOST to. Absent = no band, which is the honest default. */
  readonly effects = input<Partial<Record<IncomeBasis, string>> | null>(null);

  readonly picked = output<IncomeBasis>();

  protected readonly bases = INCOME_BASES;

  protected labelFor(basis: IncomeBasis): string {
    return incomeBasisLabel(basis);
  }

  protected hintFor(basis: IncomeBasis): string {
    return incomeBasisHint(basis);
  }

  protected effectFor(basis: IncomeBasis): string | null {
    return this.effects()?.[basis] ?? null;
  }

  /**
   * The glyph for a named basis: a payslip page for the ordinary case, a calculator for
   * the worked-out one. The same pair the wizard's header chip carries, so the mark chosen
   * here is the mark the operator keeps seeing afterwards.
   */
  protected iconFor(basis: IncomeBasis): string {
    return basis === 'no_payslip' ? 'calculator' : 'file-text';
  }
}
