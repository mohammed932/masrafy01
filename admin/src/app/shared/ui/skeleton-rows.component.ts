import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skeleton-rows',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap" role="status" [attr.aria-label]="ariaLabel()">
      @for (i of repeat(); track i) {
        <div class="row">
          @for (c of cols(); track c) {
            <span class="cell" [style.flex]="c"></span>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .wrap {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding: var(--space-2) 0;
      }
      .row {
        display: flex;
        gap: var(--space-4);
        padding: var(--space-3) var(--space-4);
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
      }
      .cell {
        block-size: 14px;
        border-radius: var(--radius-sm);
        background: linear-gradient(
          90deg,
          var(--color-surface-elevated) 0%,
          var(--color-surface-muted) 50%,
          var(--color-surface-elevated) 100%
        );
        background-size: 200% 100%;
        animation: skeleton-shimmer 1.2s ease-in-out infinite;
      }
      @keyframes skeleton-shimmer {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .cell {
          animation: none;
          background: var(--color-surface-muted);
        }
      }
    `,
  ],
})
export class SkeletonRowsComponent {
  readonly rows = input<number>(5);
  readonly cols = input<readonly number[]>([2, 3, 2, 1, 1]);
  readonly ariaLabel = input<string>('Loading');

  repeat(): number[] {
    return Array.from({ length: this.rows() }, (_, i) => i);
  }
}
