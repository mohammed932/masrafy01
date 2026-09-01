import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { SkeletonRowsComponent } from '@shared/ui';
import { BankProgramsApiService } from '@features/bank-programs/bank-programs.api.service';
import type { TemplateStarter } from '@features/bank-programs/bank-programs.types';

/**
 * "How does the bank work the income out?" — the seven shapes a no-payslip product follows.
 *
 * Extracted from `product-template-picker.page.ts` on the second use: the catalog's own
 * create flow can now make a product without leaving the name it is making, and two copies
 * of seven cards is two places for a shape to go stale. It stays inside this FEATURE rather
 * than moving to `@shared/`: both consumers are program-catalog screens, so there is no
 * cross-feature reach to fix.
 *
 * WHAT IS DELIBERATELY NOT ON A CARD, carried over verbatim from the screen this came from:
 *
 *   No bank name. One product is sold by many banks off the same mechanism with different
 *   numbers, so a bank in a shape's name would be a hardcoded bank (Principle II / A1).
 *
 *   No saved figure. The worked example beside each card is EXAMPLE TEXT — it is there so
 *   "a table by rank" means something before you have seen one, and it is never written
 *   anywhere. A default figure is how somebody's live table ends up holding a number nobody
 *   chose.
 *
 *   No colour per shape. Seven accents would imply a taxonomy of products, and there isn't
 *   one: a product's identity is the calculation it holds.
 *
 * RADIOS, not checkboxes: a product is worked out ONE way. A second way is an add-on, asked
 * on the calculation screen where it can say what happens when a bank fills in both.
 */

/**
 * The words for each shape, keyed by the server's starter key.
 *
 * HERE and not on the response, because the server must not put English on the wire
 * (Principle III / A2) and because the example is a matter of explaining, not of data. The
 * key set is the contract between the two, and a key with no entry here renders its own key
 * rather than nothing — visibly wrong beats silently blank.
 */
export interface ShapeCopy {
  title: string;
  detail: string;
  example: string;
  /** One 24px glyph path, drawn inline. See `FormDrawerComponent` on why not `nz-icon`. */
  glyph: string;
}

const GLYPH = {
  rows: 'M4 5h16v3H4zM4 10.5h16v3H4zM4 16h16v3H4z',
  layers: 'M12 3 3 8l9 5 9-5zM3 12l9 5 9-5M3 16l9 5 9-5',
  ranges: 'M3 6h7v4H3zM3 14h12v4H3zM14 6h7v4h-7z',
  percent:
    'M6.5 5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm11 9a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM19 5 5 19',
  grow: 'M4 19 10 13l4 4 6-8M15 8h5v5',
  bracket: 'M8 4H4v16h4M16 4h4v16h-4M9 12h6',
} as const;

/**
 * Thunks, not strings: `$localize` resolves at call time, so a map evaluated at module load
 * would freeze the first locale it saw for the life of the bundle.
 */
const SHAPE_COPY: Readonly<Record<string, () => ShapeCopy>> = {
  income_by_rank: () => ({
    title: $localize`:@@spt.shape.rank:A table by grade or rank`,
    detail: $localize`:@@spt.shape.rank.detail:The customer tells you their grade, and the bank assumes that grade earns a certain amount every month.`,
    example: $localize`:@@spt.shape.rank.eg:e.g. Colonel → 45,000 a month`,
    glyph: GLYPH.rows,
  }),
  income_by_years: () => ({
    title: $localize`:@@spt.shape.years:A table by years of experience`,
    detail: $localize`:@@spt.shape.years.detail:The customer states a number, and the bank has a row for the range it falls in.`,
    example: $localize`:@@spt.shape.years.eg:e.g. 8–12 years → 30,000 a month`,
    glyph: GLYPH.ranges,
  }),
  income_share_of_figure: () => ({
    title: $localize`:@@spt.shape.share:A share of a figure the customer tells you`,
    detail: $localize`:@@spt.shape.share.detail:The bank treats a percentage of something the customer states as their monthly income.`,
    example: $localize`:@@spt.shape.share.eg:e.g. 30% of what they spend on their card`,
    glyph: GLYPH.percent,
  }),
  income_multiple_of_figure: () => ({
    title: $localize`:@@spt.shape.multiple:A multiple of a figure the customer tells you`,
    detail: $localize`:@@spt.shape.multiple.detail:The same idea, but the bank multiplies rather than takes a share.`,
    example: $localize`:@@spt.shape.multiple.eg:e.g. 3× their existing car instalment`,
    glyph: GLYPH.grow,
  }),
  ceiling_by_class: () => ({
    title: $localize`:@@spt.shape.class:A ceiling from an asset's class`,
    detail: $localize`:@@spt.shape.class.detail:The customer picks what they own by name, and the bank lends against the class it is filed under.`,
    example: $localize`:@@spt.shape.class.eg:e.g. Class AA → lend up to 6,000,000`,
    glyph: GLYPH.layers,
  }),
  ceiling_by_bracket: () => ({
    title: $localize`:@@spt.shape.bracket:A ceiling from an amount bracket`,
    detail: $localize`:@@spt.shape.bracket.detail:The customer states an amount, and the bank has a lending ceiling for the bracket it falls in.`,
    example: $localize`:@@spt.shape.bracket.eg:e.g. paid 1–2M → lend up to 3,000,000`,
    glyph: GLYPH.bracket,
  }),
  ceiling_share_of_paid: () => ({
    title: $localize`:@@spt.shape.paid:A ceiling that is a share of what has been paid`,
    detail: $localize`:@@spt.shape.paid.detail:The bank lends a percentage of what the customer has already put into the asset.`,
    example: $localize`:@@spt.shape.paid.eg:e.g. 15% of everything paid so far`,
    glyph: GLYPH.percent,
  }),
};

/**
 * A shape the server offers and this bundle has no words for.
 *
 * Renders the raw key rather than an empty card: visibly wrong sends somebody to fix it,
 * whereas a blank card reads as a shape that does nothing.
 */
function fallbackCopy(shape: TemplateStarter): ShapeCopy {
  return { title: shape.key, detail: '', example: '', glyph: GLYPH.rows };
}

@Component({
  standalone: true,
  selector: 'app-product-shape-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonRowsComponent],
  template: `
    @if (loading()) {
      <app-skeleton-rows [rows]="4" [cols]="[2, 1]" [ariaLabel]="loadingLabel" />
    } @else {
      <div class="shapes" role="radiogroup" [attr.aria-label]="ariaLabel()">
        @for (shape of shapes(); track shape.key) {
          <button
            type="button"
            class="shape"
            role="radio"
            [class.is-on]="value() === shape.key"
            [attr.aria-checked]="value() === shape.key"
            (click)="picked.emit(shape.key)"
          >
            <span class="medallion" aria-hidden="true">
              <svg class="glyph" viewBox="0 0 24 24">
                <path [attr.d]="copy(shape).glyph" />
              </svg>
            </span>
            <span class="body">
              <span class="name">{{ copy(shape).title }}</span>
              <span class="detail">{{ copy(shape).detail }}</span>
              <!-- Example text. Never saved — see the note at the top of this file. -->
              <span class="example">{{ copy(shape).example }}</span>
            </span>
            <span class="tick" aria-hidden="true">
              <svg class="glyph" viewBox="0 0 24 24"><path d="m5 13 4 4L19 7" /></svg>
            </span>
          </button>
        }
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .shapes {
        display: grid;
        gap: var(--space-4);
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
      }
      .shape {
        display: flex;
        align-items: flex-start;
        gap: var(--space-4);
        padding: var(--space-5);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        background: var(--bg-surface);
        color: inherit;
        font: inherit;
        text-align: start;
        cursor: pointer;
        block-size: 100%;
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .shape:hover {
        border-color: var(--color-border-strong);
      }
      .shape:focus-visible {
        outline: none;
        box-shadow: var(--focus-halo);
        border-color: var(--primary);
      }
      /* No lift on select. A card that moves under the cursor at the moment of the tap
         reads as a drag, and this is the one gesture on the screen. */
      .shape.is-on {
        border-color: var(--primary);
        background: var(--primary-subtle);
      }
      .medallion {
        flex: 0 0 auto;
        inline-size: var(--icon-tile-sm);
        block-size: var(--icon-tile-sm);
        display: grid;
        place-items: center;
        border-radius: var(--radius-md);
        background: var(--bg-muted);
        color: var(--primary-visible);
      }
      .shape.is-on .medallion {
        background: var(--primary);
        color: var(--text-on-primary);
      }
      .body {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-inline-size: 0;
        flex: 1 1 auto;
      }
      .name {
        font-size: var(--text-lg);
        font-weight: var(--font-semibold);
        color: var(--color-text-primary);
      }
      /* SECONDARY, not tertiary: this sentence is the whole explanation of the shape and is
         read every time, and tertiary lands under 4.5:1 at this size. */
      .detail {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        line-height: var(--line-height-base);
      }
      /* SECONDARY, not tertiary. Measured at 3.19:1 light / 3.71:1 dark on tertiary — and
         this is the line that makes "a table by rank" mean something to somebody who has
         never seen one, so it is read every time, not glanced at. */
      .example {
        margin-block-start: var(--space-1);
        font-size: var(--text-xs);
        font-family: var(--font-mono);
        color: var(--color-text-secondary);
      }
      .tick {
        flex: 0 0 auto;
        align-self: center;
        color: var(--primary);
        opacity: 0;
        transition: opacity var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .shape.is-on .tick {
        opacity: 1;
      }
      .glyph {
        inline-size: 1.125em;
        block-size: 1.125em;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .medallion .glyph {
        inline-size: 1em;
        block-size: 1em;
      }
      @media (prefers-reduced-motion: reduce) {
        .shape,
        .tick {
          transition: none;
        }
      }
    `,
  ],
})
export class ProductShapePickerComponent {
  private readonly api = inject(BankProgramsApiService);

  readonly value = input.required<string | null>();
  readonly ariaLabel = input.required<string>();

  readonly picked = output<string>();

  protected readonly loading = signal(true);
  protected readonly shapes = signal<readonly TemplateStarter[]>([]);
  protected readonly loadingLabel = $localize`:@@spt.loading:Loading the shapes`;

  constructor() {
    void this.load();
  }

  protected copy(shape: TemplateStarter): ShapeCopy {
    return SHAPE_COPY[shape.key]?.() ?? fallbackCopy(shape);
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.api.listSurrogateProductTemplates();
      this.shapes.set(res.data);
    } finally {
      this.loading.set(false);
    }
  }
}
