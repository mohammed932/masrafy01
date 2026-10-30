import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { AnswerEffectLevers } from '../answer-effect';
import { EffectChipsComponent } from '../effect-chips.component';
import { meaningText } from './engine-rules.labels';
import type { AnswerMeaning } from './engine-rules.types';

/**
 * What one answer means to the engine, as a row of quiet chips — read-only, so they carry no
 * hover and no pointer. Shared by the rules list and the wording sheet, where the admin reads
 * them beside the label they are about to reword. The admin's offer effect on the answer is
 * drawn as the Questions tab draws it (the effect chips: what moves, by how much, which way),
 * not as one more grey line.
 */
@Component({
  selector: 'app-answer-meanings',
  standalone: true,
  imports: [EffectChipsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (levers of effects(); track $index) {
      <app-effect-chips [levers]="levers" />
    }
    @if (lines().length > 0) {
      <ul class="meanings">
        @for (line of lines(); track $index) {
          <li class="meaning">{{ line }}</li>
        }
      </ul>
    }
  `,
  styles: [
    `
      :host {
        display: grid;
        gap: var(--space-2);
      }
      .meanings {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1) var(--space-2);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .meaning {
        max-inline-size: 100%;
        padding: var(--space-0-5) var(--space-2);
        border-radius: var(--radius-sm);
        background: var(--bg-muted);
        color: var(--text-secondary);
        font-size: var(--text-xs);
        line-height: var(--leading-normal);
        overflow-wrap: anywhere;
      }
    `,
  ],
})
export class AnswerMeaningsComponent {
  readonly meanings = input.required<readonly AnswerMeaning[]>();
  readonly isAr = input.required<boolean>();

  protected readonly effects = computed<AnswerEffectLevers[]>(() =>
    this.meanings().flatMap((m) => (m.kind === 'offer_effect' ? [m] : [])),
  );
  protected readonly lines = computed(() =>
    this.meanings()
      .filter((m) => m.kind !== 'offer_effect')
      .map((m) => meaningText(m, this.isAr())),
  );
}
