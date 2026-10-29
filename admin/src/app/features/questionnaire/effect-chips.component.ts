import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import {
  ArrowDownOutline,
  ArrowUpOutline,
  ClockCircleOutline,
} from '@ant-design/icons-angular/icons';
import { effectChips, type AnswerEffectLevers } from './answer-effect';

/**
 * What an answer (or a number range) does to every offer, one figure per lever: "Max loan −5%",
 * "Interest rate +2.3 points", "Longest term 60 months". Coloured by what it means for the
 * applicant — amber when the offer gets worse, green when it gets better, plain for a term cap —
 * with the arrow and the sign saying the same thing for anyone who can't see the colour.
 */
@Component({
  selector: 'app-effect-chips',
  standalone: true,
  imports: [NzIconModule],
  providers: [provideNzIconsPatch([ArrowDownOutline, ArrowUpOutline, ClockCircleOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul
      class="fx"
      role="list"
      aria-label="Changes the offer"
      i18n-aria-label="@@qedit.effect_toggle"
    >
      @for (c of chips(); track c.key) {
        <li class="fx-cell" [attr.data-tone]="c.tone">
          <span class="fx-lbl">{{ c.label }}</span>
          <span class="fx-val">
            <span class="fx-badge" aria-hidden="true">
              <span nz-icon [nzType]="c.icon" nzTheme="outline"></span>
            </span>
            <bdi class="fx-fig" dir="ltr">{{ c.figure }}</bdi>
            @if (c.unit) {
              <span class="fx-unit">{{ c.unit }}</span>
            }
          </span>
        </li>
      }
    </ul>
  `,
  styles: [
    `
      :host {
        display: block;
        min-inline-size: 0;
      }
      /* A strip of small figures, the way a statement prints them: what moves on top, by how
         much underneath, a hairline between — not a row of tags competing with the answer. */
      .fx {
        display: flex;
        flex-wrap: wrap;
        row-gap: var(--space-2, 8px);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .fx-cell {
        --fx: var(--color-text-secondary);
        display: flex;
        flex-direction: column;
        gap: var(--space-0-5, 2px);
        padding-inline: var(--space-4, 16px);
        border-inline-start: 1px solid var(--border-subtle, var(--color-border-default));
        white-space: nowrap;
      }
      .fx-cell:first-child {
        padding-inline-start: 0;
        border-inline-start: 0;
      }
      .fx-cell[data-tone='worse'] {
        --fx: var(--color-warning);
      }
      .fx-cell[data-tone='better'] {
        --fx: var(--color-success);
      }
      .fx-lbl {
        font-size: var(--text-xs, 12px);
        line-height: var(--leading-normal, 1.5);
        color: var(--color-text-secondary);
      }
      .fx-val {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1-5, 6px);
        /* The tone darkened toward the text colour: raw amber and green fail contrast as text. */
        color: color-mix(in srgb, var(--fx) 62%, var(--color-text-primary));
        line-height: var(--leading-tight, 1.25);
      }
      .fx-badge {
        display: inline-grid;
        place-items: center;
        inline-size: 1.25rem;
        block-size: 1.25rem;
        border-radius: var(--radius-pill, 999px);
        background: color-mix(in srgb, var(--fx) 14%, transparent);
        color: var(--fx);
        font-size: var(--text-2xs, 10px);
        flex: none;
      }
      .fx-fig {
        font-size: var(--text-sm, 14px);
        font-weight: var(--font-semibold, 600);
        font-variant-numeric: tabular-nums;
      }
      .fx-unit {
        font-size: var(--text-xs, 12px);
      }
    `,
  ],
})
export class EffectChipsComponent {
  readonly levers = input.required<AnswerEffectLevers>();
  protected readonly chips = computed(() => effectChips(this.levers()));
}
