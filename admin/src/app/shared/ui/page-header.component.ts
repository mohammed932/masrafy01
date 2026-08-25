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
      /* WRAPPING FLEX, NOT GRID. The aside used to be an 'auto' track, which grid
         sizes to max-content and satisfies BEFORE the minmax(0, 1fr) hero gets a
         pixel. A three-card stat strip is ~630px of max-content, so everywhere
         between the 720px stacking query and ~1300px the title column was starved
         instead: 315px at 1280, 135px at 1100, and 51px at 768 — a one-word-per-line
         lede 31 lines tall, with the strip pushed a full screen down.
         Flex-wrap makes the aside DROP to its own line at the width where the two
         no longer fit, which is the behaviour the grid was reaching for and could
         not express with a single hand-picked breakpoint. */
      .header {
        display: flex;
        flex-wrap: wrap;
        align-items: end;
        justify-content: space-between;
        gap: var(--space-5);
        padding-block-end: var(--space-4);
        border-block-end: 1px solid var(--color-border-default);
      }
      .hero {
        /* The basis is the width the lede wants to be read at; below it the aside
           wraps away rather than taking the difference out of the title.
           The lopsided grow factor is what lets ONE rule serve both lines: sharing
           a line the hero takes essentially all the slack, and once the aside has
           wrapped it is the only item on its line and takes all of it — so the
           strip fills the width instead of sitting content-sized against a ragged
           right edge, with no second breakpoint to keep in step. */
        flex: 999 1 30rem;
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-inline-size: 0;
      }
      /* Shrinkable, so a strip wider than the whole page compresses rather than
         overflowing once it is alone on its line. */
      .aside {
        flex: 1 1 auto;
        min-inline-size: 0;
        max-inline-size: 100%;
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
        font-size: var(--text-2xl);
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
        letter-spacing: -0.015em;
        line-height: var(--line-height-tight);
      }
      .subtitle {
        margin: var(--space-2) 0 0;
        max-inline-size: 56ch;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
        line-height: var(--line-height-loose);
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
