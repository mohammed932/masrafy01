import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { meaningText } from './engine-rules.labels';
import type { AnswerMeaning } from './engine-rules.types';

/**
 * What one answer means to the engine, as a row of quiet chips — read-only, so they carry no
 * hover and no pointer. Shared by the rules list and the wording sheet, where the admin reads
 * them beside the label they are about to reword.
 */
@Component({
  selector: 'app-answer-meanings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
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
        display: block;
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

  protected readonly lines = computed(() =>
    this.meanings().map((m) => meaningText(m, this.isAr())),
  );
}
