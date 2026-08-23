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
            }
          </span>
          @if (item.count !== undefined) {
            <span class="tab-count">{{ item.count }}</span>
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
         #F8F6F4 → #FDFCFB, dark #0A0710 → #15101C) — --bg-subtle / --bg-muted invert
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
      .tab-note {
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-regular);
        color: var(--color-text-tertiary);
      }
      .tab-count {
        flex: none;
        font-family: var(--font-family-numeric);
        font-feature-settings: var(--font-feature-tabular);
        font-size: var(--text-xxs);
        color: var(--color-text-tertiary);
      }
      .tab.on .tab-count {
        color: var(--color-text-secondary);
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

  readonly select = output<string>();

  private readonly isAr = inject(LOCALE_ID).startsWith('ar');
  private readonly ids = computed(() => this.items().map((i) => i.id));

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
