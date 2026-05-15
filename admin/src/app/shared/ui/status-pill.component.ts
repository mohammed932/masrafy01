import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type StatusTone = 'success' | 'info' | 'warning' | 'error' | 'neutral' | 'tonal';

@Component({
  selector: 'app-status-pill',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="pill" [attr.data-tone]="tone()" role="status">
    <span class="dot" aria-hidden="true"></span>
    <span class="label">{{ label() }}</span>
  </span>`,
  styles: [
    `
      :host {
        display: inline-flex;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 3px 10px;
        border-radius: var(--radius-pill);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .dot {
        inline-size: 6px;
        block-size: 6px;
        border-radius: var(--radius-pill);
        background: currentColor;
        flex-shrink: 0;
      }
      .pill[data-tone='success'] {
        background: var(--color-success-bg);
        color: var(--color-success);
      }
      .pill[data-tone='info'] {
        background: var(--color-info-bg);
        color: var(--color-info);
      }
      .pill[data-tone='warning'] {
        background: var(--color-warning-bg);
        color: var(--color-warning);
      }
      .pill[data-tone='error'] {
        background: var(--color-error-bg);
        color: var(--color-error);
      }
      .pill[data-tone='neutral'] {
        background: var(--color-surface-muted);
        color: var(--color-text-secondary);
      }
      .pill[data-tone='tonal'] {
        background: var(--color-tonal-accent-bg);
        color: var(--color-tonal-accent);
      }
    `,
  ],
})
export class StatusPillComponent {
  readonly label = input.required<string>();
  readonly tone = input<StatusTone>('neutral');
}
