import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NzInputModule } from 'ng-zorro-antd/input';
import {
  betterThanBank,
  hasAnyLever,
  leversFromForm,
  type EffectLeverControls,
} from './answer-effect';

/**
 * The three boxes that say what an answer does to every offer (v31.2.0) — max loan %, interest
 * rate points, longest term — with their ranges and the one line that matters most: the figures
 * are wrong, they beat the bank's own, or nothing is typed yet.
 *
 * Shared by a choice question's answer editor and a number question's range editor (v31.3.0),
 * so the two cannot word, bound or warn about the same figure differently. The form is the
 * caller's (`effectLeversGroup()`); this only renders it.
 */
@Component({
  selector: 'app-effect-levers',
  standalone: true,
  imports: [ReactiveFormsModule, NzInputModule],
  // Default, not OnPush: the caller resets the group in place (opening another answer, adding the
  // next range), and the lines below must follow the form, not only this view's own events.
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <div class="lv-grid">
      <label class="field">
        <span class="lbl" i18n="@@qedit.effect_loan">Max loan</span>
        <nz-input-group nzSuffix="%">
          <input
            nz-input
            inputmode="decimal"
            placeholder="-10"
            [formControl]="group().controls.loan"
            (keydown.enter)="enter.emit()"
          />
        </nz-input-group>
        <span class="hint" i18n="@@qedit.effect_loan_range">
          -10 means 10% less, 20 means 20% more. Allowed: -90 to 100.
        </span>
      </label>
      <label class="field">
        <span class="lbl" i18n="@@qedit.effect_rate">Interest rate</span>
        <nz-input-group [nzSuffix]="unitPoints">
          <input
            nz-input
            inputmode="decimal"
            placeholder="1.5"
            [formControl]="group().controls.rate"
            (keydown.enter)="enter.emit()"
          />
        </nz-input-group>
        <span class="hint" i18n="@@qedit.effect_rate_range">
          Added to the bank's rate: 1.5 turns 20% into 21.5%. Allowed: -20 to 20.
        </span>
      </label>
      <label class="field">
        <span class="lbl" i18n="@@qedit.effect_term">Longest term</span>
        <nz-input-group [nzSuffix]="unitMonths">
          <input
            nz-input
            inputmode="numeric"
            placeholder="60"
            [formControl]="group().controls.term"
            (keydown.enter)="enter.emit()"
          />
        </nz-input-group>
        <span class="hint" i18n="@@qedit.effect_term_range">
          The loan can't run longer than this. Allowed: 1 to 480 months.
        </span>
      </label>
    </div>
    @if (group().invalid) {
      <p class="hint error" i18n="@@qedit.effect_invalid">
        Check the figures: each box takes a number in its range, and not 0.
      </p>
    } @else if (better()) {
      <p class="hint warn" i18n="@@qedit.effect_better">
        This makes the offer better than the bank's own figures. The bank may not agree to it.
      </p>
    } @else if (empty() && emptyHint() !== null) {
      <p class="hint">{{ emptyHint() }}</p>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-2, 8px);
      }
      .lv-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: var(--space-3, 12px);
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1, 4px);
        min-inline-size: 0;
      }
      .lbl {
        font-size: var(--text-xs, 12px);
        font-weight: var(--font-semibold, 600);
        color: var(--qe-text-2, var(--color-text-secondary));
      }
      .hint {
        margin: 0;
        font-size: var(--text-xs, 12px);
        line-height: var(--leading-normal, 1.5);
        color: var(--qe-text-2, var(--color-text-secondary));
      }
      .hint.warn,
      .hint.error {
        display: flex;
        align-items: baseline;
        gap: var(--space-2, 8px);
        color: var(--qe-text, var(--color-text));
      }
      .hint.warn::before,
      .hint.error::before {
        content: '';
        flex: 0 0 auto;
        inline-size: 6px;
        block-size: 6px;
        margin-block-start: 0.4em;
        border-radius: 50%;
      }
      .hint.warn::before {
        background: var(--color-warning-dot, var(--color-warning));
      }
      .hint.error::before {
        background: var(--color-error-dot, var(--color-error));
      }
      @media (max-width: 640px) {
        .lv-grid {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `,
  ],
})
export class EffectLeversComponent {
  readonly group = input.required<FormGroup<EffectLeverControls>>();
  /** Said under the boxes while all three are empty; null says nothing. */
  readonly emptyHint = input<string | null>(null);
  /** Enter in any box — the caller's Save. */
  readonly enter = output<void>();

  readonly unitPoints = $localize`:@@qedit.effect_unit_points:points`;
  readonly unitMonths = $localize`:@@qedit.effect_unit_months:months`;

  better(): boolean {
    return betterThanBank(leversFromForm(this.group().getRawValue()));
  }

  empty(): boolean {
    return !hasAnyLever(leversFromForm(this.group().getRawValue()));
  }
}
