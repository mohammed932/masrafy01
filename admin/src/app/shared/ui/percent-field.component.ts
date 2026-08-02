import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

/**
 * Quiet inline percent entry — reads as a bold number, edits as a field.
 *
 * Paired with a slider it covers both intents without a second widget style:
 * drag for a rough value, type for an exact one. Chrome stays off until the
 * pointer or keyboard arrives (hover tint → focus ring), so a dense list of
 * scores still scans as numbers rather than as a wall of input boxes.
 *
 * Only digits survive input, the value is clamped as it is typed, and ↑/↓
 * step (±10 with Shift) so a keyboard user never reaches for the mouse.
 */
@Component({
  selector: 'app-percent-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- A <label> wrapper, so a click anywhere on the chip — number, % sign, or
         padding — lands the caret in the box. aria-label owns the name. -->
    <label class="pf" [class.pf--accent]="accent()">
      <input
        #box
        class="pf__input"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        spellcheck="false"
        [value]="display()"
        [attr.aria-label]="ariaLabel()"
        (input)="onInput(box)"
        (keydown)="onKeydown($event, box)"
        (focus)="box.select()"
        (blur)="draft.set(null)"
      />
      <span class="pf__unit" aria-hidden="true">%</span>
    </label>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }
      .pf {
        display: inline-flex;
        align-items: baseline;
        gap: var(--space-1);
        padding-block: var(--space-1);
        padding-inline: var(--space-2);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-sm);
        background: var(--bg-surface);
        cursor: text;
        transition:
          background var(--motion-duration-fast) var(--motion-easing-standard),
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          box-shadow var(--motion-duration-fast) var(--motion-easing-standard);
      }
      /* Reads as a field at rest — an editable number that looks like static text
         is a number nobody tries to click. Weight stays low: one hairline, no fill. */
      .pf:hover {
        border-color: var(--border-strong);
      }
      .pf:focus-within {
        border-color: var(--primary);
        box-shadow: var(--focus-halo);
      }
      .pf__input {
        inline-size: 3ch;
        padding: 0;
        border: 0;
        background: transparent;
        text-align: end;
        font-family: inherit;
        font-size: var(--text-base);
        font-weight: var(--font-bold);
        font-feature-settings:
          'tnum' 1,
          'lnum' 1;
        color: var(--text-primary);
        caret-color: var(--primary);
        transition: color var(--motion-duration-base) var(--motion-easing-standard);
      }
      /* Ring lives on the wrapper so it encircles the value AND the unit. */
      .pf__input:focus {
        outline: none;
      }
      .pf__unit {
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        color: var(--text-tertiary);
      }
      .pf--accent .pf__input {
        color: var(--primary);
      }
      .pf--accent .pf__unit {
        color: color-mix(in srgb, var(--primary) 60%, transparent);
      }
      /* Touch: the whole chip is the hit area, at the 44px floor. */
      @media (max-width: 720px) {
        .pf {
          align-items: center;
          min-block-size: 44px;
          padding-inline: var(--space-3);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .pf,
        .pf__input {
          transition: none;
        }
      }
    `,
  ],
})
export class PercentFieldComponent {
  readonly value = input.required<number>();
  readonly ariaLabel = input<string>('');
  /** Paints the number in brand colour — used to mark the top answer. */
  readonly accent = input<boolean>(false);
  readonly min = input<number>(0);
  readonly max = input<number>(100);
  readonly step = input<number>(1);

  readonly valueChange = output<number>();

  /** Raw text while the field owns the caret; `null` hands display back to the model. */
  protected readonly draft = signal<string | null>(null);
  protected readonly display = computed(() => this.draft() ?? String(this.value()));

  protected onInput(box: HTMLInputElement): void {
    const digits = box.value.replace(/\D/g, '').slice(0, 3);
    // An empty box is a legitimate mid-edit state (clear, then type) — it reads
    // as 0 for the model but must not refill the field under the caret.
    const next = digits === '' ? null : this.clamp(Number(digits));
    const text = next === null ? '' : String(next);
    if (box.value !== text) box.value = text;
    this.draft.set(text);
    this.valueChange.emit(next ?? this.min());
  }

  protected onKeydown(event: KeyboardEvent, box: HTMLInputElement): void {
    if (event.key === 'Enter') {
      box.blur();
      return;
    }
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const stride = event.shiftKey ? this.step() * 10 : this.step();
    const next = this.clamp(this.value() + (event.key === 'ArrowUp' ? stride : -stride));
    this.draft.set(String(next));
    this.valueChange.emit(next);
  }

  private clamp(n: number): number {
    return Math.min(this.max(), Math.max(this.min(), n));
  }
}
