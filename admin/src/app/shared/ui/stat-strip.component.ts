import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface StatStripItem {
  label: string;
  value: number | string;
  tone?: 'default' | 'muted' | 'success' | 'warning' | 'error';
}

@Component({
  selector: 'app-stat-strip',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dl class="strip" [attr.aria-label]="ariaLabel()">
      @for (s of items(); track s.label) {
        <div class="stat">
          <dt>{{ s.label }}</dt>
          <dd [attr.data-tone]="s.tone ?? 'default'" class="numeric">{{ s.value }}</dd>
        </div>
      }
    </dl>
  `,
  styles: [
    `
      :host {
        display: inline-block;
      }
      .strip {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-5) var(--space-6);
        margin: 0;
      }
      @media (max-width: 720px) {
        .strip {
          gap: var(--space-4);
        }
      }
      .stat {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-inline-size: 88px;
      }
      dt {
        margin: 0;
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-text-tertiary);
      }
      dd {
        margin: 0;
        font-size: var(--text-2xl);
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
        line-height: 1;
        font-variant-numeric: tabular-nums lining-nums;
      }
      dd[data-tone='muted'] {
        color: var(--color-text-tertiary);
      }
      dd[data-tone='success'] {
        color: var(--color-success);
      }
      dd[data-tone='warning'] {
        color: var(--color-warning);
      }
      dd[data-tone='error'] {
        color: var(--color-error);
      }
    `,
  ],
})
export class StatStripComponent {
  readonly items = input.required<readonly StatStripItem[]>();
  readonly ariaLabel = input<string>('Statistics');
}
