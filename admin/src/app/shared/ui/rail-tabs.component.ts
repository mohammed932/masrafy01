import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
  output,
} from '@angular/core';

export interface RailTabItem {
  /** Stable id — also the URL value and the DOM id suffix. */
  readonly id: string;
  readonly label: string;
  /** Rendered on the trailing edge; omit for none. */
  readonly count?: number;
  /**
   * What the count COUNTS, for screen readers. Optional, but pass it: on its own
   * the number is announced as part of the tab's name with no unit — "Personal
   * Loan 8" — which is the same ambiguity the segmented rail solved by deleting
   * its count outright.
   */
  readonly countLabel?: string;
  /** Short muted note under the label (e.g. "Not set up"). */
  readonly note?: string;
  /** Draws the warn marker — something on this item needs attention. */
  readonly warn?: boolean;
  /**
   * What the warn marker MEANS, for screen readers. Optional, but pass it: the
   * marker is otherwise a colour with no text, which is invisible to a screen
   * reader and ambiguous to everyone else on a tab that also shows a count.
   */
  readonly warnLabel?: string;
  /**
   * Per-item accent, exposed to CSS as `--rail-item-accent`. Pass a token
   * reference (`var(--color-cat-car)`), not a raw colour.
   */
  readonly accent?: string;
}

/**
 * The tab rail shared by every assignment board: pick one thing on the rail,
 * assign to it in the panel beside it.
 *
 * Extracted on the third use. The part that justifies a component rather than a
 * copy is the keyboard contract — roving tabindex plus arrow semantics that
 * differ by axis, which is exactly what gets copied wrong:
 *
 * - **Horizontal** rails mirror in RTL: in Arabic, ArrowLeft moves *forward*.
 * - **Vertical** rails do NOT mirror. Up is up in every writing direction, so
 *   applying the RTL swap there would invert the arrows for Arabic readers only.
 *
 * Selection follows focus (WAI-ARIA automatic activation) because every consumer
 * keeps its panels in memory — there is nothing to load on arrow-through.
 */
@Component({
  standalone: true,
  selector: 'app-rail-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="rail"
      [class.vertical]="orientation() === 'vertical'"
      [class.segmented]="appearance() === 'segmented'"
      [class.uniform]="uniform()"
      [class.has-notes]="hasNotes()"
      role="tablist"
      [attr.aria-orientation]="orientation()"
      [attr.aria-label]="ariaLabel()"
    >
      @for (item of items(); track item.id) {
        <button
          type="button"
          role="tab"
          class="tab"
          [class.on]="item.id === activeId()"
          [class.warn]="item.warn"
          [id]="idPrefix() + '-tab-' + item.id"
          [style.--rail-item-accent]="item.accent ?? null"
          [attr.aria-selected]="item.id === activeId()"
          [attr.aria-controls]="idPrefix() + '-panel-' + item.id"
          [attr.tabindex]="item.id === activeId() ? 0 : -1"
          (click)="select.emit(item.id)"
          (keydown)="onKey($event, item.id)"
        >
          <span class="tab-main">
            <span class="tab-label">{{ item.label }}</span>
            @if (item.note) {
              <span class="tab-note">{{ item.note }}</span>
            } @else if (hasNotes()) {
              <!-- Reserves the second line for every item in a rail where ANY item
                   has one. Without it the items that carry a note push their label
                   up while the rest stay centred, so a rail of four equals renders
                   its four labels on two baselines — which is what makes a closed
                   axis read as four unrelated chips rather than one control. -->
              <span class="tab-note" aria-hidden="true">&nbsp;</span>
            }
          </span>
          @if (item.count !== undefined) {
            <span class="tab-count" aria-hidden="true">{{ item.count }}</span>
            @if (item.countLabel) {
              <span class="sr-only">{{ item.countLabel }}</span>
            }
          }
          <!-- AFTER the count, and shaped rather than round. A 6px amber circle sat
               immediately before a number read as a bullet separator ("Personal Loan
               • 10") rather than as a warning, which is the one thing it exists to
               say. -->
          @if (item.warn) {
            <span class="warn-mark" aria-hidden="true">!</span>
            @if (item.warnLabel) {
              <span class="sr-only">{{ item.warnLabel }}</span>
            }
          }
        </button>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        --rail-accent: var(--color-brand-primary, #0869c3);
        --rail-surface: var(--color-surface-default, #fdfcfb);
        --rail-line: var(--border-subtle, #efeae5);
        --rail-line-strong: var(--border-default, #ddd8d3);
      }
      .rail {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }
      /* Vertical: a scrollable column. 16+ items as wrapping pills is four rows
         deep and eats the viewport before the panel starts. */
      .rail.vertical {
        flex-direction: column;
        flex-wrap: nowrap;
        gap: var(--space-1);
        max-block-size: 60vh;
        overflow-y: auto;
        padding-inline-end: var(--space-1);
      }
      /* UNIFORM — a CLOSED axis of a few peers (the four loan types), laid out as
         equal cells instead of content-sized pills. Content sizing gives four
         labels of four different lengths four different widths, which lands each
         item's trailing count at its own x: the figures read as four stray
         numbers rather than as one column you can compare down. Equal cells put
         them in a column and give every chip the same silhouette.

         Capped rather than 1fr: four chips stretched across a 1800px page is a
         control pretending to be a layout. auto-fit wraps below ~46rem instead
         of overflowing, which is the responsive behaviour flex-wrap gave.
         Horizontal pills only — a vertical rail is already full-width, and a
         segmented track sizes to its own content by design. */
      .rail.uniform:not(.vertical):not(.segmented) {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(10rem, 14rem));
      }
      .rail.uniform:not(.vertical):not(.segmented) .tab {
        inline-size: 100%;
      }
      .tab {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        min-block-size: 44px;
        padding-inline: var(--space-4);
        border: 1px solid var(--rail-line);
        border-radius: var(--radius-pill);
        background: var(--rail-surface);
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        text-align: start;
        cursor: pointer;
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          background var(--motion-duration-fast) var(--motion-easing-standard),
          box-shadow var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .rail.vertical .tab {
        justify-content: flex-start;
        inline-size: 100%;
        padding-inline: var(--space-3);
        border-radius: var(--radius-md);
      }
      .tab:hover {
        color: var(--color-text-primary);
        border-color: var(--rail-line-strong);
      }
      .tab:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      /* Edge + wash, mixed from the item's own accent where it has one, so a
         rail of categories keeps four identities. The LABEL stays text-primary:
         four brand colours as running text is four contrast ratios to defend,
         and the border already says which item is live. */
      .tab.on {
        color: var(--color-text-primary);
        border-color: var(--rail-item-accent, var(--rail-accent));
        background: color-mix(
          in srgb,
          var(--rail-item-accent, var(--rail-accent)) 8%,
          var(--rail-surface)
        );
      }
      /* SEGMENTED — one inset track, one raised segment.
         For a rail of a few PEER groups inside a card: as free-standing pills they read as
         three unrelated buttons with a stray number each, rather than as one control with
         one thing on stage. The track is --color-surface-page and the live segment
         --color-surface-default because that pair is directional in BOTH themes (light
         page → default in both themes) — --bg-subtle / --bg-muted invert
         in dark and would sink the segment that is supposed to be lifted. The accent-mixed
         hairline is load-bearing for the same reason: --shadow-sm is a black rgba, i.e.
         invisible on a near-black surface, so the lift has to be DRAWN as well as cast. */
      .rail.segmented {
        display: inline-flex;
        max-inline-size: 100%;
        gap: var(--space-1);
        padding: var(--space-1);
        border: 1px solid var(--rail-line);
        border-radius: var(--radius-lg);
        background: var(--color-surface-page);
      }
      .rail.segmented .tab {
        padding-inline: var(--space-3);
        padding-block: var(--space-2);
        border-color: transparent;
        border-radius: calc(var(--radius-lg) - var(--space-1));
        background: transparent;
      }
      .rail.segmented .tab:hover {
        border-color: transparent;
        background: color-mix(in srgb, var(--rail-item-accent, var(--rail-accent)) 8%, transparent);
      }
      .rail.segmented .tab.on {
        background: var(--rail-surface);
        border-color: color-mix(
          in srgb,
          var(--rail-item-accent, var(--rail-accent)) 32%,
          var(--rail-line-strong)
        );
        box-shadow: var(--shadow-sm);
      }
      .rail.segmented .tab.on .tab-note {
        color: var(--color-text-secondary);
      }

      .tab-main {
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-inline-size: 0;
        flex: 1;
      }
      .tab-label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .rail.vertical .tab-label {
        white-space: normal;
      }
      /* Secondary, not tertiary. Both of these run at --text-xxs (11px), and
         tertiary on the light surface (#8C7E75 on #FDFCFB) is 3.83:1 — under AA
         for text this size. Secondary is 6.1:1 and still plainly subordinate:
         the label above is primary ink at semibold, these are regular at 11px. */
      .tab-note {
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-regular);
        color: var(--color-text-secondary);
      }
      .tab-count {
        flex: none;
        font-family: var(--font-family-numeric);
        font-feature-settings: var(--font-feature-tabular);
        font-size: var(--text-xxs);
        color: var(--color-text-secondary);
      }
      /* The live item takes the label's own ink, so the count follows the label
         rather than staying a step behind it on the one chip that is on stage. */
      .tab.on .tab-count {
        color: var(--color-text-primary);
      }
      .warn-mark {
        flex: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 16px;
        block-size: 16px;
        border-radius: var(--radius-pill);
        background: var(--color-warning-bg);
        color: var(--color-warning);
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        line-height: 1;
      }
      .sr-only {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        margin: -1px;
        padding: 0;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      @media (prefers-reduced-motion: reduce) {
        .tab {
          transition: none;
        }
      }
    `,
  ],
})
export class RailTabsComponent {
  readonly items = input.required<readonly RailTabItem[]>();
  readonly activeId = input.required<string>();
  readonly ariaLabel = input.required<string>();
  /** DOM id prefix, so a page with two rails keeps `aria-controls` unique. */
  readonly idPrefix = input.required<string>();
  readonly orientation = input<'horizontal' | 'vertical'>('horizontal');
  /**
   * `pill` (default) — free-standing chips. Right for a rail whose items carry their own
   * accents: four category colours want air around them, and a wash reads as an identity.
   * `segmented` — one inset track with a raised live segment, for a handful of peer groups
   * inside a card, where the rail IS the control rather than a board's navigation.
   */
  readonly appearance = input<'pill' | 'segmented'>('pill');
  /**
   * Equal-width cells instead of content-sized pills. For a CLOSED axis whose
   * items all always render (the four loan categories) — not for a rail whose
   * length is data (compounds, question groups), where equal cells would leave
   * a ragged last row and cap a long label for no gain.
   */
  readonly uniform = input(false);

  readonly select = output<string>();

  private readonly isAr = inject(LOCALE_ID).startsWith('ar');
  private readonly ids = computed(() => this.items().map((i) => i.id));
  /**
   * True when ANY item carries a note — which is what makes the note line a
   * property of the rail rather than of the item, and lets every item reserve
   * it. See the placeholder in the template for why.
   */
  protected readonly hasNotes = computed(() => this.items().some((i) => i.note !== undefined));

  /**
   * Arrow / Home / End over the rail. See the class docblock for why the RTL
   * swap applies to the horizontal axis only.
   */
  protected onKey(event: KeyboardEvent, current: string): void {
    const ids = this.ids();
    const last = ids.length - 1;
    const at = ids.indexOf(current);
    if (at < 0) return;

    const vertical = this.orientation() === 'vertical';
    const forward = vertical ? 'ArrowDown' : this.isAr ? 'ArrowLeft' : 'ArrowRight';
    const back = vertical ? 'ArrowUp' : this.isAr ? 'ArrowRight' : 'ArrowLeft';

    let next: number | null = null;
    if (event.key === forward) next = at === last ? 0 : at + 1;
    else if (event.key === back) next = at === 0 ? last : at - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    if (next === null) return;

    const target = ids[next];
    if (!target) return;
    event.preventDefault();
    this.select.emit(target);
    document.getElementById(`${this.idPrefix()}-tab-${target}`)?.focus();
  }
}
