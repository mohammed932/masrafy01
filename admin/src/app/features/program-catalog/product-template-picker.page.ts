/**
 * "Start from a shape" — the first screen of creating a no-payslip product.
 *
 * WHY IT EXISTS. Until now a product was born empty and the only way to give it a
 * calculation was the raw step editor: pick an operation, wire inputs between steps, and
 * know that step 3 has to point back at steps 1 and 2. That is programming. Nine banks
 * across five products all fit one of the seven shapes below, so the question the operator
 * is actually answering is "how does this bank work the income out" — which is one pick.
 *
 * WHAT IS DELIBERATELY NOT ON A CARD:
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
 * on the next screen where it can say what happens when a bank fills in both.
 */
import { ChangeDetectionStrategy, Component, LOCALE_ID, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerService } from 'ng-zorro-antd/drawer';
import {
  EnumerationEditDrawerComponent,
  type EnumerationEditDrawerData,
} from '@shared/lookups/enumeration-edit.drawer';
import { PageHeaderComponent, SkeletonRowsComponent, openFormDrawer } from '@shared/ui';
import { BankProgramsApiService } from '@features/bank-programs/bank-programs.api.service';
import type { TemplateStarter } from '@features/bank-programs/bank-programs.types';
import { PRODUCT_BASE, surrogateBoardLink } from './program-catalog.paths';

/**
 * The words for each shape, keyed by the server's starter key.
 *
 * HERE and not on the response, because the server must not put English on the wire
 * (Principle III / A2) and because the example is a matter of explaining, not of data. The
 * key set is the contract between the two, and a key with no entry here renders its own key
 * rather than nothing — visibly wrong beats silently blank.
 */
interface ShapeCopy {
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

@Component({
  selector: 'app-product-template-picker-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NzButtonModule, PageHeaderComponent, SkeletonRowsComponent],
  template: `
    <section class="page">
      <a class="back" [routerLink]="backLink.commands" [queryParams]="backLink.queryParams">
        <svg class="glyph mirror" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M19 12H5M11 18l-6-6 6-6" />
        </svg>
        <span i18n="@@spt.back">Surrogate products</span>
      </a>

      <app-page-header [eyebrow]="eyebrow" [title]="title" [subtitle]="subtitle" />

      @if (loading()) {
        <app-skeleton-rows [rows]="4" [cols]="[2, 1]" [ariaLabel]="loadingLabel" />
      } @else {
        <div class="shapes" role="radiogroup" [attr.aria-label]="title">
          @for (shape of shapes(); track shape.key) {
            <button
              type="button"
              class="shape"
              role="radio"
              [class.is-on]="picked() === shape.key"
              [attr.aria-checked]="picked() === shape.key"
              (click)="pick(shape.key)"
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

        <footer class="bar">
          <p class="outcome">
            @if (picked() === null) {
              <span i18n="@@spt.pick_first">Pick how the income is worked out to carry on.</span>
            } @else {
              <span i18n="@@spt.pick_next"
                >Next you will name the product. You can change the shape afterwards.</span
              >
            }
          </p>
          <button
            nz-button
            nzType="primary"
            type="button"
            [disabled]="picked() === null || creating()"
            [nzLoading]="creating()"
            (click)="carryOn()"
          >
            <span i18n="@@spt.continue">Name this product</span>
          </button>
        </footer>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .page {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
      }
      .back {
        align-self: flex-start;
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-1) var(--space-2);
        margin-inline-start: calc(var(--space-2) * -1);
        border-radius: var(--radius-md);
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
        text-decoration: none;
      }
      .back:hover {
        background: var(--bg-subtle);
        color: var(--color-text-primary);
      }
      .back:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }

      .shapes {
        /* Room for the sticky bar, which floats over whatever is above it. */
        padding-block-end: var(--space-4);
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
      .example {
        margin-block-start: var(--space-1);
        font-size: var(--text-xs);
        font-family: var(--font-mono);
        color: var(--color-text-tertiary);
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
      :host-context([dir='rtl']) .mirror {
        transform: scaleX(-1);
      }

      .bar {
        position: sticky;
        inset-block-end: 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-4);
        flex-wrap: wrap;
        padding: var(--space-4);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        /* Opaque, and no shadow: every shadow token here casts downward, and a bar pinned
           to the bottom edge needs the lift above it. */
        background: var(--bg-surface);
      }
      .outcome {
        margin: 0;
        min-inline-size: 0;
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
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
export class ProductTemplatePickerPage {
  /** Back to the board, with the Surrogate side already showing. */
  protected readonly backLink = surrogateBoardLink();

  private readonly api = inject(BankProgramsApiService);
  private readonly drawer = inject(NzDrawerService);
  private readonly router = inject(Router);
  private readonly isAr = inject(LOCALE_ID).startsWith('ar');

  protected readonly loading = signal(true);
  protected readonly creating = signal(false);
  protected readonly shapes = signal<readonly TemplateStarter[]>([]);
  protected readonly picked = signal<string | null>(null);

  protected readonly eyebrow = $localize`:@@spt.eyebrow:New surrogate product`;
  protected readonly title = $localize`:@@spt.title:How does the bank work the income out?`;
  protected readonly subtitle = $localize`:@@spt.subtitle:Pick the shape this product follows. Every bank selling it fills in its own figures later — the shape is what they have in common.`;
  protected readonly loadingLabel = $localize`:@@spt.loading:Loading the shapes`;

  constructor() {
    void this.load();
  }

  protected pick(key: string): void {
    this.picked.set(key);
  }

  protected copy(shape: TemplateStarter): ShapeCopy {
    return SHAPE_COPY[shape.key]?.() ?? fallbackCopy(shape);
  }

  /**
   * Name it, then go straight to the form.
   *
   * Reuses the same drawer the product list uses, so "create a product" is one flow with one
   * set of rules about keys and labels. The shape travels on the URL rather than in a
   * service: a reload on the form screen has to land on the same shape, and a link somebody
   * pastes to a colleague has to as well.
   */
  protected carryOn(): void {
    void this.doCarryOn();
  }

  private async doCarryOn(): Promise<void> {
    const shape = this.picked();
    if (shape === null) return;

    // Read the list BEFORE the drawer opens. Taken afterwards it already contains the row
    // just created, and the diff is empty every time.
    const before = new Set((await this.api.listSurrogateProducts()).data.map((p) => p.key));

    const ref = openFormDrawer<EnumerationEditDrawerComponent, EnumerationEditDrawerData, boolean>(
      this.drawer,
      {
        content: EnumerationEditDrawerComponent,
        data: {
          mode: 'create',
          type: 'surrogate_product',
          title: $localize`:@@spt.create_title:Name this product`,
          submitLabel: $localize`:@@spt.create_cta:Create product`,
          subtitle: $localize`:@@spt.create_sub:What the operators filing programs under it will look for. The calculation comes next.`,
        },
      },
    );

    ref.afterClose.subscribe(async (saved: boolean | undefined) => {
      if (!saved) return;
      this.creating.set(true);
      try {
        // The drawer reports success, not which row it made — the key is derived from the
        // label rather than typed, so diffing the list is the only way to learn it. Same
        // approach the product list already uses.
        const after = (await this.api.listSurrogateProducts()).data;
        const created = after.find((p) => !before.has(p.key));
        if (!created) {
          // Saved, but not findable. Sending the operator to a guessed key would open the
          // wrong product's form, so land them on the list where the new row is visible.
          void this.router.navigate(this.backLink.commands, {
            queryParams: this.backLink.queryParams,
          });
          return;
        }
        void this.router.navigate([PRODUCT_BASE, created.key, 'calculation'], {
          queryParams: { from: shape },
        });
      } finally {
        this.creating.set(false);
      }
    });
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
