import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { InboxOutline } from '@ant-design/icons-angular/icons';

/**
 * Type-driven empty state. No illustrations (banking restraint).
 * Use inside table-bearing pages when `rows.length === 0 && !loading`.
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, NzIconModule],
  providers: [provideNzIconsPatch([InboxOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty" role="status" aria-live="polite">
      <span nz-icon [nzType]="icon" nzTheme="outline" class="empty-icon" aria-hidden="true"></span>
      <h2 class="empty-title">{{ title }}</h2>
      @if (subtitle) {
        <p class="empty-subtitle">{{ subtitle }}</p>
      }
      <ng-content></ng-content>
    </div>
  `,
  styles: [
    `
      .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--space-2);
        padding: var(--space-7) var(--space-5);
        background: var(--color-surface-default);
        border: 1px dashed var(--color-border-default);
        border-radius: var(--radius-md);
        text-align: center;
      }
      .empty-icon {
        font-size: 40px;
        color: var(--color-text-tertiary);
      }
      .empty-title {
        margin: 0;
        color: var(--color-text-primary);
        font-size: var(--text-lg);
        font-weight: var(--font-weight-semibold);
      }
      .empty-subtitle {
        margin: 0;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
        max-width: 480px;
      }
    `,
  ],
})
export class EmptyStateComponent {
  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
  @Input() icon: string = 'inbox';
}
