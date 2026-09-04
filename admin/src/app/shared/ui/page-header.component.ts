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
      /* INK, not the plain accent. --color-tonal-accent is the 500-weight bronze, and at
         12px semibold uppercase on the page ground it measures 3.42:1 in LIGHT mode —
         under AA, on a label that sits at the top of every screen in the product. Dark
         passes at 12.46:1 because the bronze ramp inverts there (bronze-500 lifts to
         #E8D4B8), which is why the failure survived every dark-mode review. Measured in a
         browser after the swap: 4.53:1 light, 12.46:1 dark.

         The RULE below deliberately keeps the plain accent, and still measures 3.42:1 —
         which is both above the 3:1 a non-text graphic needs and a live reminder of what
         the ink used to be. */
      .eyebrow {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0;
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--color-tonal-accent-ink);
      }
      /* The block had no anchor: an uppercase line floating over a large title reads as
         a stray label rather than as the head of a section. A short accent rule gives the
         hero a start edge for the eye to return to, and costs no markup and no string. */
      .eyebrow::before {
        content: '';
        flex: none;
        inline-size: var(--rule-width-accent);
        block-size: 0.85em;
        border-radius: var(--radius-pill);
        background: var(--color-tonal-accent);
      }
      .title {
        margin: 0;
        font-size: var(--text-2xl);
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
        letter-spacing: -0.015em;
        line-height: var(--line-height-tight);
        /* Two-line titles break evenly instead of leaving one orphaned word; ignored
           where unsupported, so it degrades to what shipped. */
        text-wrap: balance;
      }
      .subtitle {
        margin: var(--space-2) 0 0;
        max-inline-size: 56ch;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
        line-height: var(--line-height-loose);
        text-wrap: pretty;
      }
      .aside:empty {
        display: none;
      }

      /* --- Entrance ---------------------------------------------------------
         section.page already rises as a whole (styles.scss). This is a short
         SECOND-order stagger inside it, so the header assembles top-down rather
         than arriving as one slab — the difference between a page that loaded and
         a page that came together.

         backwards, never forwards: the fill has to hold the FROM state during
         the delay, and holding a to frame would leave a computed transform on the
         element after the animation. That is the containing-block trap app-page-rise
         documents at length — a persisting non-none transform captures any
         position: fixed descendant (A34). Ending on backwards lets transform
         revert to none the moment the animation is done. */
      .eyebrow,
      .title,
      .subtitle,
      .aside {
        animation: ph-line-in var(--motion-duration-base) var(--motion-easing-standard) backwards;
      }
      .eyebrow {
        animation-delay: 0ms;
      }
      .title {
        animation-delay: var(--motion-stagger);
      }
      .subtitle {
        animation-delay: calc(var(--motion-stagger) * 2);
      }
      .aside {
        animation-delay: calc(var(--motion-stagger) * 3);
      }
      @keyframes ph-line-in {
        from {
          opacity: 0;
          transform: translateY(6px);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .eyebrow,
        .title,
        .subtitle,
        .aside {
          animation: none;
        }
      }
    `,
  ],
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly eyebrow = input<string>('');
}
