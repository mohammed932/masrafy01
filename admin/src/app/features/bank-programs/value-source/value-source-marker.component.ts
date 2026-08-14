import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

/**
 * "Did the bank say this, or did we?" — the two-state source marker (FR-032).
 *
 * Sits beside a number and is readable WITHOUT opening anything: a menu, a tooltip or
 * a right-click would make the state invisible at a glance, and the whole point is
 * that an admin scanning a program can see which figures are still guesses.
 *
 * **Estimated is a WARNING, never an error.** Saving an estimate is explicitly legal
 * (FR-034) — only going live is blocked. Painting it red would tell the admin they
 * did something wrong at the exact moment they did the honest thing, and the one
 * behaviour this feature depends on is people marking their guesses.
 *
 * Two real buttons rather than a checkbox or a switch: both states are named, so
 * neither is the silent default, and "bank stated" is a claim someone made rather
 * than the absence of a claim. (The STORAGE is still sparse — absence means stated —
 * but that is a persistence decision, not something the admin should have to infer
 * from an unticked box.)
 *
 * All five states are distinct (FR-042): resting, hover, focus, active/selected and
 * disabled.
 */
@Component({
  selector: 'app-value-source-marker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="vsm"
      role="radiogroup"
      [attr.aria-label]="groupLabel()"
      [class.vsm--disabled]="disabled()"
    >
      <button
        type="button"
        class="vsm__opt"
        [class.vsm__opt--on]="!estimated()"
        role="radio"
        [attr.aria-checked]="!estimated()"
        [attr.aria-label]="statedLong"
        [attr.title]="statedLong"
        [disabled]="disabled()"
        (click)="set(false)"
      >
        <span class="vsm__dot vsm__dot--stated" aria-hidden="true"></span>
        <span class="vsm__text">{{ compact() ? statedShort : statedLong }}</span>
      </button>
      <button
        type="button"
        class="vsm__opt"
        [class.vsm__opt--on]="estimated()"
        [class.vsm__opt--warn]="estimated()"
        role="radio"
        [attr.aria-checked]="estimated()"
        [attr.aria-label]="estimatedLong"
        [attr.title]="estimatedLong"
        [disabled]="disabled()"
        (click)="set(true)"
      >
        <span class="vsm__dot vsm__dot--estimated" aria-hidden="true"></span>
        <span class="vsm__text">{{ compact() ? estimatedShort : estimatedLong }}</span>
      </button>
    </div>
  `,
  styles: [
    `
      :host {
        display: inline-block;
      }

      .vsm {
        display: inline-flex;
        align-items: stretch;
        gap: 0;
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-pill);
        overflow: hidden;
        background: var(--color-surface-default);
      }

      .vsm__opt {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-1);
        /* A real touch target. Matches the 2.75rem the row actions already use, so a
           marker and the delete button beside it are the same size to hit. */
        min-block-size: 2.75rem;
        padding: var(--space-1) var(--space-3);
        border: 0;
        background: transparent;
        font: inherit;
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
        cursor: pointer;
        transition:
          background var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
      }

      .vsm__opt + .vsm__opt {
        border-inline-start: 1px solid var(--color-border-default);
      }

      .vsm__opt:hover:not(:disabled) {
        background: var(--color-surface-row-hover);
        color: var(--color-text-primary);
      }

      /* Never outline: none — a keyboard user has to be able to see where they are. */
      .vsm__opt:focus-visible {
        outline: none;
        box-shadow: var(--focus-halo);
        z-index: 1;
      }

      .vsm__opt:active:not(:disabled) {
        background: var(--color-surface-muted);
      }

      /* Selected. The two selected looks differ by SEMANTIC colour, not by weight
         alone, so the state survives a glance and a greyscale screenshot. */
      .vsm__opt--on {
        background: var(--color-success-bg);
        color: var(--color-success);
        font-weight: var(--font-semibold);
      }

      .vsm__opt--on.vsm__opt--warn {
        background: var(--color-warning-bg);
        color: var(--color-warning);
      }

      .vsm--disabled,
      .vsm__opt:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }

      .vsm__dot {
        inline-size: 6px;
        block-size: 6px;
        border-radius: var(--radius-pill);
        flex-shrink: 0;
      }

      .vsm__dot--stated {
        background: var(--color-success-dot);
      }

      .vsm__dot--estimated {
        background: var(--color-warning-dot);
      }

      .vsm__text {
        white-space: nowrap;
      }

      @media (prefers-reduced-motion: reduce) {
        .vsm__opt {
          transition: none;
        }
      }
    `,
  ],
})
export class ValueSourceMarkerComponent {
  /**
   * Two-way bound. `true` = team-estimated, which is the only state that gets STORED
   * (the map is sparse — an absent path means the bank stated it).
   */
  readonly estimated = model.required<boolean>();

  /** Which number this marker describes, for the group's accessible name. */
  readonly fieldLabel = input<string>('');

  readonly disabled = input<boolean>(false);

  /**
   * Short visible labels, for a marker repeated down a table row.
   *
   * A grade table runs 10–15 rows, and "The bank stated this / We estimated this" on
   * every one of them is more words than numbers — the table stops reading as data.
   * The accessible name and the tooltip keep the FULL sentence, so nothing is lost
   * to a screen reader or to a hover; only the visual noise goes.
   */
  readonly compact = input<boolean>(false);

  readonly statedLong = $localize`:@@bank_programs.value_source.stated:The bank stated this`;
  readonly estimatedLong = $localize`:@@bank_programs.value_source.estimated:We estimated this`;
  readonly statedShort = $localize`:@@bank_programs.value_source.stated_short:Bank`;
  readonly estimatedShort = $localize`:@@bank_programs.value_source.estimated_short:Estimate`;

  readonly groupLabel = computed(() =>
    this.fieldLabel()
      ? $localize`:@@bank_programs.value_source.aria_for:Source of ${this.fieldLabel()}:field:`
      : $localize`:@@bank_programs.value_source.aria:Where this number came from`,
  );

  set(next: boolean): void {
    if (this.disabled() || next === this.estimated()) return;
    this.estimated.set(next);
  }
}
