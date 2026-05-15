import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="header">
      <div class="hero">
        @if (eyebrow()) {
          <p class="eyebrow">{{ eyebrow() }}</p>
        }
        <h1 class="title">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="subtitle">{{ subtitle() }}</p>
        }
      </div>
      <div class="aside">
        <ng-content></ng-content>
      </div>
    </header>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .header {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: var(--space-5);
        align-items: end;
        padding-block-end: var(--space-4);
        border-block-end: 1px solid var(--color-border-default);
      }
      @media (max-width: 720px) {
        .header {
          grid-template-columns: 1fr;
          align-items: start;
        }
      }
      .hero {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-inline-size: 0;
      }
      .eyebrow {
        margin: 0;
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--color-tonal-accent);
      }
      .title {
        margin: 0;
        font-size: var(--text-3xl);
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
        letter-spacing: -0.015em;
        line-height: 1.1;
      }
      .subtitle {
        margin: var(--space-2) 0 0;
        max-inline-size: 56ch;
        color: var(--color-text-secondary);
        font-size: var(--text-md);
        line-height: var(--line-height-base);
      }
      .aside:empty {
        display: none;
      }
    `,
  ],
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly eyebrow = input<string>('');
}
