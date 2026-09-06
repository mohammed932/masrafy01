import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { CheckOutline } from '@ant-design/icons-angular/icons';

/**
 * How a step reads when it is NOT the one on stage.
 * - `todo`    — number chip, muted.
 * - `done`    — green check glyph (the word is read by assistive tech only).
 * - `invalid` — tinted red chip + the "Needs attention" word.
 */
export type WizardStepStatus = 'todo' | 'done' | 'invalid';

export interface WizardStepItem {
  /** Stable id — used only as the `@for` track key. */
  readonly id: string;
  readonly label: string;
  /**
   * Defaults to `todo`. Suppressed while the step is active: a step you are
   * standing on is neither "done" nor "needs attention", it is simply current,
   * and every host was writing the same `index !== activeIndex` guard by hand.
   */
  readonly status?: WizardStepStatus;
  /** Not reachable yet — the host's own gate (visited / earlier steps satisfied). */
  readonly disabled?: boolean;
}

/**
 * The wizard step rail shared by every multi-step admin screen.
 *
 * Extracted on the second use, when two screens had drifted into two rails with the
 * same markup, the same class names and two different sets of hardcoded sizes — so a
 * fix to one silently skipped the other.
 *
 * What the component owns, and hosts therefore cannot get wrong:
 * - **State is never colour alone** (Principle IV/A11 accessibility floor).
 *   `done` is carried by the check GLYPH, which is a shape, so it prints no word;
 *   `invalid` keeps "Needs attention" in print, because a red tint on a numeral is
 *   colour and nothing else. Both words reach assistive tech either way, and
 *   `aria-current="step"` marks the one on stage.
 * - **Reachability is a real `disabled` button**, not a click handler that
 *   silently no-ops — the cursor and the focus order both say so.
 * - **Overflow, in the order a reader can afford to lose it** — the connectors
 *   give way first (they claim no width of their own), and when the names still
 *   do not fit, every step except the one on stage drops to a bare numbered chip.
 *   The step on stage keeps its full name at every width, and nothing is ever
 *   ellipsed. The threshold is MEASURED per rail, not a viewport breakpoint —
 *   see `measure()`.
 *
 * Navigation is the host's: the rail emits an index and refuses nothing on its
 * own beyond `disabled`, because "can I leave this step" is a form question
 * (`commitStep()`, `stepDone()`), not a presentation one.
 */
@Component({
  standalone: true,
  selector: 'app-wizard-steps',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NzIconModule],
  providers: [provideNzIconsPatch([CheckOutline])],
  template: `
    <ol
      #rail
      class="steps"
      [class.card]="variant() === 'card'"
      [class.is-compact]="compact()"
      [attr.aria-label]="ariaLabel()"
    >
      @for (s of steps(); track s.id; let i = $index, last = $last) {
        <li class="steps-item" [class.is-last]="last">
          <button
            type="button"
            class="step"
            [class.active]="activeIndex() === i"
            [class.done]="statusOf(i) === 'done'"
            [class.invalid]="statusOf(i) === 'invalid'"
            [attr.aria-current]="activeIndex() === i ? 'step' : null"
            [disabled]="s.disabled ?? false"
            (click)="stepSelect.emit(i)"
          >
            <span class="step-num" aria-hidden="true">
              @if (statusOf(i) === 'done') {
                <span nz-icon nzType="check" nzTheme="outline"></span>
              } @else {
                {{ i + 1 }}
              }
            </span>
            <span class="step-label">{{ s.label }}</span>
            <!-- 'Done' is a SHAPE (the check glyph), so it is not a colour-only
                 signal and needs no word beside it. The word stays for assistive
                 tech only: printed, it was two extra runs of text per rail and it
                 is what pushed the step ON STAGE into an ellipsis. 'Needs
                 attention' keeps its word — a red tint on a numeral IS colour
                 alone, and it is rare enough to cost nothing. -->
            @if (statusOf(i) === 'done') {
              <span class="sr-only">{{ doneLabel() }}</span>
            } @else if (statusOf(i) === 'invalid') {
              <span class="step-state">{{ attentionLabel() }}</span>
            }
          </button>
          @if (!last) {
            <span class="step-sep" aria-hidden="true"></span>
          }
        </li>
      }
    </ol>
    @if (caption(); as text) {
      <p class="step-caption" [class.sr-only]="captionSrOnly()">{{ text }}</p>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .steps {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0;
        padding: 0;
        list-style: none;
        overflow-x: auto;
      }
      /* Card variant: the rail is the only chrome on the screen above the stage,
         so it carries the surface. Plain variant sits inside a host that already
         draws one (a form shell) and would otherwise nest two panels. */
      .steps.card {
        padding: var(--space-3) var(--space-4);
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-sm);
      }
      .steps-item {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex: 1 1 auto;
        /* Every item may give its label up under pressure... */
        min-inline-size: 0;
      }
      /* ...except the one on stage, which is floored at its own min-content and
         therefore never truncates. This used to be the other way round, which
         put an ellipsis on the ONE label the operator needs — the rail read
         "Amoun…" for the step they were standing on while six steps they were
         not on sat there in full. A step you cannot name is not navigation.
         Losing :has() costs nothing but a sideways scroll. */
      .steps-item:has(.step.active) {
        min-inline-size: auto;
        flex-shrink: 0;
      }
      /* The last item owns no connector, so it must not claim connector width. */
      .steps-item.is-last {
        flex: 0 0 auto;
      }
      .step {
        appearance: none;
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        /* Shrinkable. The item above carries 'min-inline-size: 0' so the rail can
           give the separators up, but with a rigid 'flex: 0 0 auto' step and a
           nowrap label nothing could actually yield: the item's box shrank under
           its own content, the next item started early, and the chips drew ON TOP
           of the active label — at 390px step 2 overlapped step 1 by 60px, with
           scrollWidth still equal to clientWidth so the scroller never appeared. */
        flex: 0 1 auto;
        /* 44px both ways: the rail is the primary navigation on a touch screen,
           and the floor is also what stops the shrink above from eating the
           numeral chip's own box once the label has run out of room to give. */
        min-block-size: 44px;
        min-inline-size: 44px;
        padding-block: var(--space-1);
        padding-inline: var(--space-2-5);
        background: transparent;
        border: 0;
        border-radius: var(--radius-pill);
        cursor: pointer;
        transition: background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .step:hover:not(:disabled) {
        background: var(--bg-subtle);
      }
      .step:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }
      .step:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .step-num {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: none;
        inline-size: 24px;
        block-size: 24px;
        border-radius: var(--radius-pill);
        background: var(--bg-muted);
        color: var(--text-tertiary);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-bold);
        line-height: 1;
      }
      .step.active .step-num {
        background: var(--primary);
        color: var(--text-on-primary);
      }
      .step.done .step-num {
        background: var(--success);
        color: var(--text-on-primary);
      }
      .step.done .step-num .anticon {
        font-size: var(--text-xs);
      }
      /* Error state is a tinted chip + the error hue on TEXT, not white on
         mid-red — that pairing fails contrast at this type size in both themes. */
      .step.invalid .step-num {
        background: color-mix(in oklab, var(--color-error) 18%, var(--bg-surface));
        box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--color-error) 45%, transparent);
        color: var(--error-500);
      }
      .step-label {
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--text-secondary);
        white-space: nowrap;
        /* Kept as a backstop only. measure() drops the other labels before any
           of them reaches this, and the step on stage is floored at min-content,
           so in practice nothing ellipses. The button's accessible name is the
           untruncated text either way. */
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .step.active .step-label {
        color: var(--text-primary);
      }
      .step.invalid .step-label {
        color: var(--error-500);
      }
      .step-state {
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--text-tertiary);
      }
      .step.done .step-state {
        color: var(--success);
      }
      .step.invalid .step-state {
        color: var(--error-500);
      }
      /* The connector claims NO width of its own — it is drawn out of whatever
         slack the row has left, and it is the first thing to disappear when the
         row has none. It used to hold a 16px floor, which across six connectors
         reserved 96px of an 894px rail: the row then read as over-full and every
         label that was not on stage was truncated with 35px of real slack still
         in the row. A hairline is decoration; a step's name is not. */
      .step-sep {
        flex: 1 1 auto;
        min-inline-size: 0;
        block-size: 1px;
        background: var(--border-default);
      }
      .step-caption {
        margin: 0;
        padding-inline: var(--space-1);
        max-inline-size: 72ch;
        font-size: var(--text-sm);
        line-height: var(--leading-normal);
        color: var(--text-secondary);
      }
      /* The state word is the first thing to go: it is redundant next to the
         chip for a sighted reader, and assistive tech keeps it either way. */
      @media (max-width: 900px) {
        .step-state {
          position: absolute;
          inline-size: 1px;
          block-size: 1px;
          overflow: hidden;
          clip-path: inset(50%);
          white-space: nowrap;
        }
      }
      /* Compact: only the step on stage keeps its name, the rest are numbered
         chips. Driven by a MEASUREMENT (see measure() on the class), not by a
         viewport
         breakpoint - the width a rail needs is a function of how many steps it
         has and how long their names are, and this component does not know
         either. A breakpoint guessed for a seven-step rail truncates a
         three-step one for no reason, and vice versa. */
      .steps.is-compact .step:not(.active) .step-label {
        display: none;
      }
      .sr-only {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        margin: -1px;
        padding: 0;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      @media (prefers-reduced-motion: reduce) {
        .step {
          transition: none;
        }
      }
    `,
  ],
})
export class WizardStepsComponent {
  readonly steps = input.required<readonly WizardStepItem[]>();
  readonly activeIndex = input.required<number>();
  readonly ariaLabel = input.required<string>();
  /** `card` draws its own surface; `plain` sits inside a shell that already has one. */
  readonly variant = input<'card' | 'plain'>('card');
  /** One sentence under the rail. Omit for none. */
  readonly caption = input<string | null>(null);
  /**
   * Keep the caption for screen readers only — for hosts whose rail already reads
   * unambiguously in print and would only repeat itself.
   */
  readonly captionSrOnly = input(false);
  readonly doneLabel = input($localize`:@@ui.wizard.step_done:Done`);
  readonly attentionLabel = input($localize`:@@ui.wizard.step_attention:Needs attention`);

  /** Index of the step the host wants on stage. Gating stays with the host. */
  readonly stepSelect = output<number>();

  private readonly rail = viewChild.required<ElementRef<HTMLOListElement>>('rail');
  /** True while only the active step prints its name. Measured, never guessed. */
  protected readonly compact = signal(false);
  /** Rail width, in px, at which every label fits. 0 until measured once. */
  private naturalWidth = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.measure();
      const ro = new ResizeObserver(() => this.measure());
      ro.observe(this.rail().nativeElement);
      destroyRef.onDestroy(() => ro.disconnect());
    });
    // A status change can widen a step ("Needs attention" appears), which the
    // observer never sees: the rail's own box does not move.
    effect(() => {
      this.steps();
      queueMicrotask(() => this.measure());
    });
  }

  /**
   * Decide whether the rail can print every name.
   *
   * Expanded, a label that does not fit reports `scrollWidth > clientWidth`, and
   * the sum of those deficits is exactly the width the rail is short by — so the
   * width at which everything WOULD fit is knowable, and is remembered. Compact,
   * the hidden labels measure nothing, which is why it has to be remembered
   * rather than re-derived.
   *
   * The 4px hysteresis is what stops a flip-flop: coming back out at exactly the
   * recorded width can land 1px short on a fractional layout, compact again, and
   * record a width 1px higher each pass.
   */
  private measure(): void {
    const ol = this.rail().nativeElement;
    if (!ol.isConnected) return;
    if (this.compact()) {
      if (this.naturalWidth > 0 && ol.clientWidth >= this.naturalWidth + 4) this.compact.set(false);
      return;
    }
    let deficit = 0;
    ol.querySelectorAll<HTMLElement>('.step-label').forEach((label) => {
      deficit += label.scrollWidth - label.clientWidth;
    });
    if (deficit > 1) {
      this.naturalWidth = ol.clientWidth + deficit;
      this.compact.set(true);
    }
  }

  /** Status as rendered: the active step is current, never done or failing. */
  protected statusOf(index: number): WizardStepStatus {
    if (index === this.activeIndex()) return 'todo';
    return this.steps()[index]?.status ?? 'todo';
  }
}
