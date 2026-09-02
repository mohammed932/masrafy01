import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { SkeletonRowsComponent } from '@shared/ui';
import { BankProgramsApiService } from '@features/bank-programs/bank-programs.api.service';
import type { TemplateStarter } from '@features/bank-programs/bank-programs.types';

/**
 * "How does the bank work the income out?" — the shapes a no-payslip product follows.
 *
 * Extracted from `product-template-picker.page.ts` on the second use: the catalog's own
 * create flow can now make a product without leaving the name it is making, and two copies
 * of the cards is two places for a shape to go stale. It stays inside this FEATURE rather
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
 *   No colour per shape. Eight accents would imply a taxonomy of products, and there isn't
 *   one: a product's identity is the calculation it holds.
 *
 * ─── CHECKBOXES, not radios ───────────────────────────────────────────────────
 *
 * This was radios, on the reasoning that "a product is worked out ONE way" and a second way
 * is an add-on asked later. The first half is wrong about the real products: the compound
 * guarantee is sold by four banks off four different derivations of one ceiling, which is
 * exactly what `ProductTemplate.alternatives` and `combine` exist for, and the design spec
 * asks for the second way by pointing back at THIS list ("Another way to reach the figure →
 * pick a second shape from Q1"). Leaving it single meant every product was born one-way and
 * the operator had to know to go and find an add-on on the next screen.
 *
 * So the shapes list IS the vocabulary for ways 1..N. What is NOT here is the `combine`
 * control — which of two figures wins is asked once, on the calculation screen, where the
 * figures themselves are typed. Two controls for one field would be two authorities.
 *
 * ─── The groups are load-bearing, not decoration ──────────────────────────────
 *
 * A product carries ONE `outputKind`: it either works out a monthly income or it works out a
 * ceiling. Combining ways is legal only when both are in the same unit (spec §4 Q2), and by
 * construction that is what one `outputKind` guarantees. So the two groups are the two
 * answers to a question the operator has already implicitly given by their first pick, and
 * the other group goes UNCLICKABLE rather than being refused at save — a mixed pick has no
 * representation to save.
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
  kinds: 'M4 20h16M6 20V9l6-4 6 4v11M10 20v-5h4v5',
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
  ceiling_by_choice: () => ({
    title: $localize`:@@spt.shape.kind:A ceiling from the kind of thing they own`,
    detail: $localize`:@@spt.shape.kind.detail:The customer says what kind of unit it is, and the bank lends against that kind.`,
    example: $localize`:@@spt.shape.kind.eg:e.g. Villa → lend up to 4,000,000`,
    glyph: GLYPH.kinds,
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

/**
 * The server's `MAX_WAYS`, mirrored — see `atCap` on why it is guarded here as well.
 */
const MAX_WAYS = 6;

/** Income first: it is the answer for most products, and the ceiling shapes are the exception. */
const GROUP_ORDER: readonly TemplateStarter['outputKind'][] = ['monthlyIncome', 'maxAmount'];

/**
 * The words for the two groups. Thunks, for the same reason `SHAPE_COPY` uses them.
 *
 * Named by what the product PRODUCES, not by "income vs ceiling": "ceiling" is the platform's
 * word for it and the operator's word is the sentence.
 */
const GROUP_TITLE: Readonly<Record<TemplateStarter['outputKind'], () => string>> = {
  monthlyIncome: () => $localize`:@@spt.group.income:Works out a monthly income`,
  maxAmount: () => $localize`:@@spt.group.ceiling:Works out the most they can borrow`,
};

interface ShapeGroup {
  kind: TemplateStarter['outputKind'];
  title: string;
  /** Every card in it is unpickable, because a way of the other kind is already picked. */
  locked: boolean;
  shapes: readonly TemplateStarter[];
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
      <div class="groups" [attr.aria-label]="ariaLabel()">
        @for (group of groups(); track group.kind) {
          <section class="group">
            <h3 class="group-h" [id]="headingId(group.kind)">{{ group.title }}</h3>
            @if (group.locked) {
              <p class="group-note" [id]="lockedId(group.kind)">{{ lockedNote }}</p>
            }
            <div class="shapes" role="group" [attr.aria-labelledby]="headingId(group.kind)">
              @for (shape of group.shapes; track shape.key) {
                <button
                  type="button"
                  class="shape"
                  role="checkbox"
                  [class.is-on]="isOn(shape.key)"
                  [attr.aria-checked]="isOn(shape.key)"
                  [attr.aria-disabled]="isBlocked(shape) ? 'true' : null"
                  [attr.aria-describedby]="group.locked ? lockedId(group.kind) : null"
                  (click)="pick(shape)"
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
                  <span class="box" aria-hidden="true">
                    <svg class="glyph" viewBox="0 0 24 24"><path d="m5 13 4 4L19 7" /></svg>
                  </span>
                </button>
              }
            </div>
          </section>
        }

        <!-- Said once the pick makes it true, and it names the CONSEQUENCE rather than
             offering the choice: the combine question is asked on the calculation screen,
             beside the figures it decides between. -->
        @if (value().length > 1) {
          <p class="multi" role="status">
            @if (atCap()) {
              <span>{{ capNote }}</span>
            } @else {
              <span>{{ multiNote }}</span>
            }
          </p>
        }
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .groups {
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
      }
      .group {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      /* The house's uppercase micro-label, on the scale every other one uses
         (stat-strip, page-header): text-xs with real tracking. At text-sm it was a size
         nothing else on the page has, and it read as a heading competing with the cards. */
      .group-h {
        margin: 0;
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-text-secondary);
      }
      .group-note,
      .multi {
        margin: 0;
        max-inline-size: 62ch;
        font-size: var(--text-sm);
        line-height: var(--line-height-base);
        color: var(--color-text-secondary);
      }
      .multi {
        padding-inline-start: var(--space-3);
        border-inline-start: 2px solid var(--primary);
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
      .shape:hover:not([aria-disabled='true']) {
        border-color: var(--color-border-strong);
      }
      /* The fourth state. A card that does not move under the press reads as a dead control,
         and this grid is the only thing on the step to press. */
      .shape:active:not([aria-disabled='true']) {
        transform: translateY(1px);
      }
      /*
       * The AFFORDANCE dims, not the words.
       *
       * This started as one opacity on the whole card, and the comment beside it claimed the
       * unavailable shapes still tell the operator what the platform can do. Measured in the
       * browser, the detail line came out at 2.63:1 at 0.6 and worse at 0.45 — so the claim was
       * false, and a sentence nobody can read is not information. Reaching a readable 4.5:1
       * would have meant an opacity high enough to stop reading as unavailable at all.
       *
       * So what recedes is the medallion and the tick box — the parts that say "you can pick
       * this" — while every word keeps the ink it has on a live card. What says unavailable is
       * the flattened affordance, the cursor, the reason line above the group, and aria-disabled.
       *
       * aria-disabled, not the disabled attribute: a disabled button leaves the tab order, so
       * the reason bound to it by aria-describedby is announced to nobody. Focusable and inert
       * is the honest pairing, and pick() is what refuses the click.
       */
      .shape[aria-disabled='true'] {
        cursor: not-allowed;
        border-style: dashed;
      }
      .shape[aria-disabled='true'] .medallion {
        background: transparent;
        color: var(--color-text-tertiary);
        box-shadow: inset 0 0 0 1px var(--color-border-default);
      }
      .shape[aria-disabled='true'] .box {
        border-style: dashed;
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
      /* A BOX, not a bare tick. The control is multi-select now, and the affordance has to
         say so before the first click — an empty square is what teaches "as many as apply". */
      .box {
        flex: 0 0 auto;
        /* On the TITLE's line. Centred on the card it floated beside the third line of the
           detail text, which reads as a tick belonging to the sentence rather than the card. */
        align-self: flex-start;
        margin-block-start: var(--space-1);
        display: grid;
        place-items: center;
        inline-size: 1.25rem;
        block-size: 1.25rem;
        border: 1px solid var(--color-border-strong);
        border-radius: var(--radius-sm);
        color: transparent;
        transition:
          background var(--motion-duration-fast) var(--motion-easing-standard),
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .shape.is-on .box {
        background: var(--primary);
        border-color: var(--primary);
        color: var(--text-on-primary);
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
        .box {
          transition: none;
        }
      }
    `,
  ],
})
export class ProductShapePickerComponent {
  private readonly api = inject(BankProgramsApiService);

  /** The ways picked so far, in the order they were picked. The HOST owns the set. */
  readonly value = input.required<readonly string[]>();
  readonly ariaLabel = input.required<string>();

  /** One key, ticked or unticked. The host decides which, so the two screens cannot drift. */
  readonly toggled = output<string>();

  protected readonly loading = signal(true);
  protected readonly shapes = signal<readonly TemplateStarter[]>([]);
  protected readonly loadingLabel = $localize`:@@spt.loading:Loading the shapes`;
  protected readonly lockedNote = $localize`:@@spt.group.locked:A product either works out an income or works out a ceiling, never both. Untick the other ways to use these.`;
  protected readonly multiNote = $localize`:@@spt.multi_note:More than one way. When a bank fills in more than one of them, the lower figure is the one used — you can change that on the next screen.`;
  protected readonly capNote = $localize`:@@spt.cap_note:That is as many ways as one product can offer. When a bank fills in more than one, the lower figure is used.`;

  /**
   * The output kind of the ways picked so far, or `null` while nothing is picked.
   *
   * Read off the SERVER's starter list rather than inferred from the key's prefix: the keys
   * happen to read `income_*` / `ceiling_*` today, and a shape whose name stops matching its
   * output kind must not silently unlock the wrong half of the screen.
   */
  protected readonly lockedTo = computed<TemplateStarter['outputKind'] | null>(() => {
    const byKey = new Map(this.shapes().map((shape) => [shape.key, shape]));
    for (const key of this.value()) {
      const shape = byKey.get(key);
      if (shape !== undefined) return shape.outputKind;
    }
    return null;
  });

  /**
   * Mirrors the server's `MAX_WAYS`, and is unreachable with today's cards (four of each
   * kind). Kept so a ninth card cannot quietly let the operator build a template the save
   * refuses as `too_many_ways`.
   */
  protected readonly atCap = computed(() => this.value().length >= MAX_WAYS);

  protected readonly groups = computed<readonly ShapeGroup[]>(() => {
    const locked = this.lockedTo();
    return GROUP_ORDER.map((kind) => ({
      kind,
      title: GROUP_TITLE[kind](),
      locked: locked !== null && locked !== kind,
      shapes: this.shapes().filter((shape) => shape.outputKind === kind),
    })).filter((group) => group.shapes.length > 0);
  });

  constructor() {
    void this.load();
  }

  protected copy(shape: TemplateStarter): ShapeCopy {
    return SHAPE_COPY[shape.key]?.() ?? fallbackCopy(shape);
  }

  protected isOn(key: string): boolean {
    return this.value().includes(key);
  }

  /**
   * The click, refused where the pick has no representation.
   *
   * Refused HERE rather than by the `disabled` attribute, because a disabled button is not
   * focusable and the reason bound to it would be announced to nobody. The card stays in the
   * tab order, reads as dimmed, and says why.
   */
  protected pick(shape: TemplateStarter): void {
    if (this.isBlocked(shape)) return;
    this.toggled.emit(shape.key);
  }

  /**
   * Unclickable because the pick has no representation, never because it is "invalid".
   *
   * A ticked card is always clickable — unticking is how the operator gets out of both the
   * locked half and the cap.
   */
  protected isBlocked(shape: TemplateStarter): boolean {
    if (this.isOn(shape.key)) return false;
    const locked = this.lockedTo();
    return (locked !== null && locked !== shape.outputKind) || this.atCap();
  }

  protected headingId(kind: string): string {
    return `shape-group-${kind}`;
  }

  protected lockedId(kind: string): string {
    return `shape-locked-${kind}`;
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
