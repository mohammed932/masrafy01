import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { CheckOutline } from '@ant-design/icons-angular/icons';

/**
 * How a step reads when it is NOT the one on stage.
 * - `todo`    — number chip, muted.
 * - `done`    — green check + the "Done" word.
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
 * Extracted on the second use (scoring editor + bank-program form), which had
 * drifted into two rails with the same markup, the same class names and two
 * different sets of hardcoded sizes — so a fix to one silently skipped the other.
 *
 * What the component owns, and hosts therefore cannot get wrong:
 * - **State is a word, not only a colour** — "Done" / "Needs attention" ride
 *   beside the chip, so the rail is never a colour-only signal (Principle IV/A11
 *   accessibility floor). The word is hidden below 900px, where it would wrap the
 *   rail; assistive tech still reads it, and `aria-current="step"` marks the one
 *   on stage.
 * - **Reachability is a real `disabled` button**, not a click handler that
 *   silently no-ops — the cursor and the focus order both say so.
 * - **Overflow** — labels collapse to the active one below 720px before the rail
 *   is allowed to scroll sideways.
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
    <ol class="steps" [class.card]="variant() === 'card'" [attr.aria-label]="ariaLabel()">
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
            @if (statusOf(i) === 'done') {
              <span class="step-state">{{ doneLabel() }}</span>
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
        min-inline-size: 0;
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
        flex: 0 0 auto;
        /* 44px: the rail is the primary navigation on a touch screen. */
        min-block-size: 44px;
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
        outline: none;
        box-shadow: var(--focus-halo);
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
      .step-sep {
        flex: 1 1 auto;
        min-inline-size: var(--space-4);
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
      /* Labels compete for width on narrow screens; only the current step keeps
         its name, so the rail degrades to chips instead of scrolling sideways. */
      @media (max-width: 720px) {
        .step-label {
          display: none;
        }
        .step.active .step-label {
          display: inline;
        }
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

  /** Status as rendered: the active step is current, never done or failing. */
  protected statusOf(index: number): WizardStepStatus {
    if (index === this.activeIndex()) return 'todo';
    return this.steps()[index]?.status ?? 'todo';
  }
}
