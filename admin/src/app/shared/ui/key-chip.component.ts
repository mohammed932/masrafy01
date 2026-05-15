import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-key-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<code class="chip">{{ value() }}</code>`,
  styles: [
    `
      :host {
        display: inline-flex;
      }
      .chip {
        font-family: ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, monospace;
        font-size: var(--text-xs);
        background: var(--color-surface-elevated);
        padding: 3px 10px;
        border-radius: var(--radius-sm);
        color: var(--color-text-primary);
        border: 1px solid var(--color-border-default);
        font-feature-settings: 'liga' 0;
        white-space: nowrap;
      }
    `,
  ],
})
export class KeyChipComponent {
  readonly value = input.required<string>();
}
