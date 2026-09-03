/**
 * The predefined products — pick one, name it, and the platform builds everything it asks.
 *
 * ─── What this replaced, and why ──────────────────────────────────────────────
 *
 * This screen used to offer eight SHAPES: "a table by a choice answer", "a ceiling from an
 * amount bracket". Correct, and anonymous. An operator picking one still had to know that the
 * doctors' product bands years in practice, that the brackets are 3–5 / 5–8 / 8–11, that the
 * second column is a city tier and not a bank relationship, and that the tier is read through
 * the class a governorate is filed under. Then they authored the question, the list and the
 * fact by hand, in the only order the foreign keys allow, on two more screens.
 *
 * A card here is a PRODUCT: the mechanism, everything it asks, and — in grey, never saved —
 * what a published sheet puts in each box. Picking one writes the lists, the values, the
 * questions, the facts, the loan-category assignments and the calculation in one call.
 *
 * ─── Three shelves, one accent ────────────────────────────────────────────────
 *
 * The groups are named in words and separated by a hairline. They are NOT colour-coded: four
 * accents would imply a taxonomy that does not exist, and a row of colour says nothing — the
 * same finding that took the per-product tag off the catalog board. The one saturated thing on
 * the page is the card the operator has chosen.
 *
 * ─── "Already set up" versus "will be created" ────────────────────────────────
 *
 * Never by colour alone. A chip for something the platform already asks is filled and carries
 * a tick; one for something this create will write is DASHED and carries a plus. Both keep
 * full-strength ink — an unavailable-looking sentence is a sentence nobody reads, which is the
 * measurement that redrew the shape cards — and each chip names its state in words for a
 * screen reader.
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NzInputModule } from 'ng-zorro-antd/input';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode } from '@core/auth/auth.types';
import { categoryLabel } from '@core/loan-category';
import { FormPageComponent, SkeletonRowsComponent } from '@shared/ui';
import { BankProgramsApiService } from '@features/bank-programs/bank-programs.api.service';
import type {
  BlueprintGroup,
  ProductBlueprint,
  ProductBlueprintAsk,
} from '@features/bank-programs/bank-programs.types';
import { blueprintCopy } from './blueprint-copy';
import {
  LIBRARY_GROUPS,
  askState,
  createLines,
  groupOf,
  libraryBlock,
  readyCount,
  searchLibrary,
  widenedCategories,
  type AskState,
  type CreateLine,
} from './product-library';
import { CATALOG_BASE, PRODUCT_BASE, surrogateBoardLink } from './program-catalog.paths';

const LABEL_MAX = 200;

@Component({
  selector: 'app-product-library-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, NzInputModule, FormPageComponent, SkeletonRowsComponent],
  template: `
    <app-form-page
      wide
      [eyebrow]="eyebrow"
      [title]="title"
      [subtitle]="subtitle"
      [backLabel]="backLabel"
      [submitLabel]="submitLabel()"
      [submitting]="saving()"
      [blockReason]="blockText()"
      [hint]="hint()"
      (cancelled)="leave()"
      (submitted)="create()"
    >
      <div class="body">
        <label class="search">
          <span class="sr-only" i18n="@@bpl.search_label">Search the products</span>
          <svg class="search-glyph" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6" />
            <path d="m16 16 4 4" />
          </svg>
          <input
            nz-input
            type="search"
            [formControl]="query"
            [attr.placeholder]="searchPlaceholder"
            [attr.aria-label]="searchPlaceholder"
          />
        </label>

        @if (loading()) {
          <!-- Shape-matched, not a spinner: this page IS a grid of cards, and a centred
               spinner tells the operator nothing about what is arriving. -->
          <div class="shelves" aria-busy="true">
            @for (shelf of [1, 2]; track shelf) {
              <section class="shelf">
                <div class="skeleton-label"></div>
                <div class="grid">
                  @for (card of [1, 2, 3]; track card) {
                    <div class="card is-skeleton" aria-hidden="true">
                      <app-skeleton-rows [rows]="4" />
                    </div>
                  }
                </div>
              </section>
            }
          </div>
        } @else if (loadError()) {
          <p class="notice is-error" role="alert">{{ loadError() }}</p>
        } @else {
          <div class="shelves">
            @for (shelf of shelves(); track shelf.group) {
              <section class="shelf">
                <h2 class="shelf-label">{{ shelf.label }}</h2>
                <p class="shelf-note">{{ shelf.note }}</p>
                <div class="grid" role="radiogroup" [attr.aria-label]="shelf.label">
                  @for (card of shelf.cards; track card.key) {
                    <button
                      type="button"
                      role="radio"
                      class="card"
                      [class.is-on]="picked() === card.key"
                      [attr.aria-checked]="picked() === card.key"
                      [style.--stagger]="card.index"
                      (click)="pick(card.key)"
                    >
                      <span class="head">
                        <span class="medallion" aria-hidden="true">
                          <svg viewBox="0 0 24 24"><path [attr.d]="card.glyph" /></svg>
                        </span>
                        <span class="name">{{ card.title }}</span>
                        <span class="dot" aria-hidden="true"></span>
                      </span>

                      <span class="mech">{{ card.mechanism }}</span>

                      <span class="asks">
                        @for (ask of card.asks; track ask.factKey) {
                          <span class="ask" [attr.data-state]="ask.state" [title]="ask.hint">
                            <svg class="ask-glyph" viewBox="0 0 24 24" aria-hidden="true">
                              <path [attr.d]="ask.state === 'creates' ? plusGlyph : tickGlyph" />
                            </svg>
                            <span>{{ ask.label }}</span>
                            <span class="sr-only">{{ ask.hint }}</span>
                          </span>
                        }
                        @if (card.moreAsks > 0) {
                          <span class="ask is-more">{{ card.moreLabel }}</span>
                        }
                      </span>

                      <span class="foot">
                        <span class="tags">
                          @for (tag of card.tags; track tag) {
                            <span class="tag">{{ tag }}</span>
                          }
                          @if (card.openQuestion) {
                            <span class="tag is-warn">{{ card.openQuestion }}</span>
                          }
                        </span>
                        <span class="ready">{{ card.readyLabel }}</span>
                        @if (card.example) {
                          <span class="eg">{{ card.example }}</span>
                        }
                      </span>
                    </button>
                  }
                </div>
              </section>
            }
            @if (shelves().length === 0) {
              <p class="notice" i18n="@@bpl.no_match">
                Nothing in the library matches that. Clear the search to see all of them.
              </p>
            }
          </div>

          @if (chosen(); as choice) {
            <section class="chosen">
              @if (choice.group !== 'cap') {
                <h2 class="h" i18n="@@bpl.name_title">Name this product</h2>
                <p class="lede" i18n="@@bpl.name_sub">
                  What the operators filing bank programs under it will look for. You can change it
                  later; the key it is stored under cannot change.
                </p>
                <form [formGroup]="form" class="pair" (ngSubmit)="create()">
                  <label class="field">
                    <span class="field-label" i18n="@@lookups.field.labelEnglish"
                      >English label</span
                    >
                    <input
                      nz-input
                      formControlName="labelEn"
                      dir="ltr"
                      [attr.maxlength]="labelMax"
                    />
                  </label>
                  <label class="field">
                    <span class="field-label" i18n="@@lookups.field.labelAr">Arabic label</span>
                    <input
                      nz-input
                      formControlName="labelAr"
                      dir="rtl"
                      [attr.maxlength]="labelMax"
                    />
                  </label>
                </form>
              } @else {
                <h2 class="h" i18n="@@bpl.cap_title">This one sets no income</h2>
                <p class="lede" i18n="@@bpl.cap_sub">
                  It needs no name, because it creates no product. It builds the question and the
                  list it reads, then takes you to the bank program where you type the ceilings.
                </p>
              }

              <div class="writes">
                <h3 class="writes-h" i18n="@@bpl.writes_h">What this will set up</h3>
                @if (writeLines().length === 0) {
                  <p class="writes-none" i18n="@@bpl.writes_none">
                    Nothing — the platform already asks everything this product reads.
                  </p>
                } @else {
                  <ul class="writes-list">
                    @for (line of writeLines(); track line.kind) {
                      <li>{{ line.text }}</li>
                    }
                  </ul>
                }
                @if (widenNote(); as note) {
                  <p class="writes-widen">{{ note }}</p>
                }
              </div>
            </section>
          }
        }

        @if (errorMessage(); as message) {
          <p class="notice is-error" role="alert">{{ message }}</p>
        }

        <p class="escape">
          <span i18n="@@bpl.escape_lede">Not in the list?</span>
          <button type="button" class="link" (click)="toShapes()" i18n="@@bpl.escape_link">
            Start from a shape instead
          </button>
        </p>
      </div>
    </app-form-page>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .body {
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
      }

      /* ---- search ---------------------------------------------------------- */
      .search {
        position: relative;
        display: block;
        max-inline-size: 26rem;
      }
      .search input {
        padding-inline-start: var(--space-8);
      }
      .search-glyph {
        position: absolute;
        inset-inline-start: var(--space-3);
        inset-block-start: 50%;
        transform: translateY(-50%);
        inline-size: 16px;
        block-size: 16px;
        fill: none;
        stroke: var(--text-tertiary);
        stroke-width: 2;
        stroke-linecap: round;
        pointer-events: none;
      }

      /* ---- shelves --------------------------------------------------------- */
      .shelves {
        display: flex;
        flex-direction: column;
        gap: var(--space-7);
      }
      .shelf {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      /* The house micro-label: the shelves are told apart by WORDS, not by an accent each. */
      .shelf-label {
        margin: 0;
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--text-secondary);
      }
      .shelf-note {
        margin: 0;
        margin-block-start: calc(-1 * var(--space-2));
        font-size: var(--text-sm);
        color: var(--text-secondary);
        max-inline-size: 58rem;
      }
      .skeleton-label {
        inline-size: 12rem;
        block-size: 0.75rem;
        border-radius: var(--radius-pill);
        background: var(--bg-muted);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(21rem, 1fr));
        gap: var(--space-4);
      }

      /* ---- card ------------------------------------------------------------ */
      .card {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        padding: var(--space-4);
        text-align: start;
        font: inherit;
        color: inherit;
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        cursor: pointer;
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          background-color var(--motion-duration-fast) var(--motion-easing-standard),
          transform var(--motion-duration-fast) var(--motion-easing-standard);
        animation: bpl-in var(--motion-duration-base) var(--motion-easing-standard) both;
        animation-delay: calc(var(--stagger, 0) * var(--motion-stagger));
      }
      .card:hover {
        border-color: var(--border-strong);
      }
      .card:active {
        transform: translateY(1px);
      }
      .card:focus-visible {
        outline: none;
        box-shadow: var(--focus-halo);
        border-color: var(--color-border-focus);
      }
      .card.is-on {
        border-color: var(--primary);
        background: var(--primary-subtle);
      }
      .card.is-skeleton {
        cursor: default;
        animation: none;
      }
      @keyframes bpl-in {
        from {
          opacity: 0;
          transform: translateY(6px);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }

      .head {
        display: grid;
        grid-template-columns: var(--icon-tile-sm) 1fr auto;
        align-items: center;
        gap: var(--space-3);
      }
      .medallion {
        display: grid;
        place-items: center;
        inline-size: var(--icon-tile-sm);
        block-size: var(--icon-tile-sm);
        border-radius: var(--radius-md);
        background: var(--bg-muted);
        transition: background-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .card.is-on .medallion {
        background: var(--primary);
      }
      .medallion svg {
        inline-size: 16px;
        block-size: 16px;
        fill: none;
        stroke: var(--primary-visible);
        stroke-width: 1.75;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .card.is-on .medallion svg {
        stroke: var(--text-on-primary);
      }
      .name {
        font-size: var(--text-lg);
        font-weight: var(--font-semibold);
        line-height: var(--leading-snug);
        color: var(--text-primary);
      }
      /* On the TITLE's line, never the card's centre: centred, a tick sits beside the third
         line of the detail text and reads as a tick on that sentence. */
      .dot {
        inline-size: 18px;
        block-size: 18px;
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-pill);
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          box-shadow var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .card.is-on .dot {
        border-color: var(--primary);
        box-shadow: inset 0 0 0 4px var(--primary);
      }

      .mech {
        font-size: var(--text-sm);
        line-height: var(--leading-normal);
        color: var(--text-secondary);
      }

      /* ---- asks ------------------------------------------------------------ */
      .asks {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }
      .ask {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding: 2px var(--space-2);
        font-size: var(--text-xs);
        /* Secondary, never tertiary: a chip darkens the ground under its own text, and this
           is a word the operator reads rather than decoration. */
        color: var(--text-secondary);
        border-radius: var(--radius-pill);
        white-space: nowrap;
      }
      .ask[data-state='ready'] {
        background: var(--bg-muted);
        border: 1px solid transparent;
      }
      /* Dashed says "not there yet" on its own, so the state survives a greyscale print and
         a colour-blind reader. */
      .ask[data-state='creates'],
      .ask[data-state='widens'] {
        background: transparent;
        border: 1px dashed var(--border-strong);
      }
      .ask.is-more {
        background: transparent;
        border: 1px solid transparent;
      }
      .ask-glyph {
        inline-size: 11px;
        block-size: 11px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2.5;
        stroke-linecap: round;
        flex: none;
      }

      /* ---- foot ------------------------------------------------------------ */
      .foot {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        margin-block-start: auto;
        padding-block-start: var(--space-3);
        border-block-start: 1px solid var(--border-subtle);
      }
      /* Separated by a middot rather than by a gap: three phrases with only whitespace
         between them read as one run-on sentence, which is how the first draft rendered. */
      .tags {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
      }
      .tag {
        font-size: var(--text-xs);
        color: var(--text-secondary);
        font-variant-numeric: tabular-nums lining-nums;
      }
      .tag + .tag::before,
      .tag + .tag.is-warn::before {
        content: '·';
        margin-inline-end: var(--space-2);
        color: var(--text-tertiary);
      }
      .tag.is-warn + .tag::before {
        content: '';
        margin-inline-end: 0;
      }
      /* A STATUS, not a feature of the mechanism — so it gets its own line rather than
         trailing the list of what the product has. */
      .ready {
        font-size: var(--text-xs);
        font-weight: var(--font-medium);
        color: var(--text-secondary);
        font-variant-numeric: tabular-nums lining-nums;
      }
      /* Inked --text-primary on the wash, not --warning on it: measured, warn-on-warn is
         2.80:1 in light mode, and this tag carries a SENTENCE somebody has to act on. The dot
         and the wash carry the warning; the words stay legible (13.19:1 light, 13.49:1 dark).
         The board's own warn tag has the same 2.80:1 problem and predates this screen. */
      .tag.is-warn {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding: 1px var(--space-2);
        color: var(--text-primary);
        background: color-mix(in srgb, var(--color-warning) 14%, transparent);
        border-radius: var(--radius-sm);
      }
      .tag.is-warn::after {
        content: '';
        order: -1;
        inline-size: 6px;
        block-size: 6px;
        border-radius: var(--radius-pill);
        background: var(--color-warning);
      }
      /* Secondary, not tertiary. Measured at 3.83:1 on this surface in light mode, which is
         under 4.5 — and this is a sentence the operator reads to check a figure against a
         sheet, not decoration. (Tertiary passes in DARK at 5.24:1, which is exactly why a
         light-mode-only failure like this survives a dark-mode review.) */
      .eg {
        font-size: var(--text-xs);
        line-height: var(--leading-normal);
        color: var(--text-secondary);
      }

      /* ---- chosen ---------------------------------------------------------- */
      .chosen {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        max-inline-size: 62rem;
        padding-block-start: var(--space-5);
        border-block-start: 1px solid var(--border-default);
        animation: bpl-in var(--motion-duration-base) var(--motion-easing-standard) both;
      }
      .h {
        margin: 0;
        font-size: var(--text-xl);
        font-weight: var(--font-semibold);
        color: var(--text-primary);
      }
      .lede {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }
      .pair {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
        gap: var(--space-4);
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .field-label {
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        color: var(--text-secondary);
      }

      .writes {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding: var(--space-4);
        background: var(--bg-subtle);
        border-radius: var(--radius-md);
      }
      .writes-h {
        margin: 0;
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--text-secondary);
      }
      .writes-list {
        margin: 0;
        padding-inline-start: var(--space-5);
        font-size: var(--text-sm);
        color: var(--text-primary);
      }
      .writes-none,
      .writes-widen {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }

      .notice {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }
      .notice.is-error {
        color: var(--error);
      }
      .escape {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }
      /* A button, not a link: it navigates, but it is the SECONDARY errand on the page and
         an anchor here would compete with the primary action for the eye. */
      .escape .link {
        padding: 0;
        font: inherit;
        color: var(--color-text-link);
        background: none;
        border: 0;
        cursor: pointer;
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .escape .link:hover {
        color: var(--color-text-link-hover);
      }
      .escape .link:focus-visible {
        outline: none;
        box-shadow: var(--focus-halo);
        border-radius: var(--radius-sm);
      }
      .sr-only {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }

      @media (prefers-reduced-motion: reduce) {
        .card,
        .chosen {
          animation: none;
        }
        .card,
        .medallion,
        .dot {
          transition: none;
        }
      }

      /* A chip is a touch target on a device with no hover. */
      @media (hover: none) {
        .card {
          padding: var(--space-5);
        }
      }
    `,
  ],
})
export class ProductLibraryPage {
  private readonly api = inject(BankProgramsApiService);
  private readonly router = inject(Router);
  private readonly errors = inject(ErrorCodeService);

  readonly eyebrow = $localize`:@@bpl.eyebrow:No-payslip products`;
  readonly title = $localize`:@@bpl.title:Add a product`;
  readonly subtitle = $localize`:@@bpl.subtitle:Pick how the bank works the figure out. Everything the product asks the customer is set up with it.`;
  readonly backLabel = $localize`:@@bpl.back:Back to the catalog`;
  readonly searchPlaceholder = $localize`:@@bpl.search:Search by product or by what it reads…`;
  readonly labelMax = LABEL_MAX;

  /** 24×24, drawn to the same weight as the medallion glyphs. */
  readonly tickGlyph = 'm5 13 4 4 10-10';
  readonly plusGlyph = 'M12 5v14M5 12h14';

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly picked = signal<string | null>(null);

  private readonly blueprints = signal<readonly ProductBlueprint[]>([]);

  readonly query = new FormControl('', { nonNullable: true });
  private readonly queryValue = signal('');

  readonly form = new FormGroup({
    labelEn: new FormControl('', { nonNullable: true }),
    labelAr: new FormControl('', { nonNullable: true }),
  });
  private readonly names = signal({ labelEn: '', labelAr: '' });

  constructor() {
    this.query.valueChanges.subscribe((value) => this.queryValue.set(value));
    this.form.valueChanges.subscribe((value) =>
      this.names.set({ labelEn: value.labelEn ?? '', labelAr: value.labelAr ?? '' }),
    );
    void this.load();
  }

  readonly chosen = computed(
    () => this.blueprints().find((blueprint) => blueprint.key === this.picked()) ?? null,
  );

  readonly shelves = computed(() => {
    const matching = searchLibrary(this.blueprints(), this.queryValue());
    return LIBRARY_GROUPS.map((group) => ({
      group,
      label: this.shelfLabel(group),
      note: this.shelfNote(group),
      cards: groupOf(matching, group).map((blueprint, index) => this.card(blueprint, index)),
    })).filter((shelf) => shelf.cards.length > 0);
  });

  readonly submitLabel = computed(() => {
    const choice = this.chosen();
    return choice?.group === 'cap'
      ? $localize`:@@bpl.submit_cap:Set up what it asks`
      : $localize`:@@bpl.submit:Create the product`;
  });

  readonly blockText = computed(() => {
    switch (libraryBlock({ picked: this.chosen(), ...this.names() })) {
      case 'no_pick':
        return $localize`:@@bpl.block.pick:Pick a product first.`;
      case 'no_name_en':
        return $localize`:@@bpl.block.en:Give the product an English name.`;
      case 'no_name_ar':
        return $localize`:@@bpl.block.ar:Give the product an Arabic name — it is the primary locale.`;
      default:
        return null;
    }
  });

  readonly hint = computed(() => {
    const choice = this.chosen();
    if (choice === null) return null;
    if (choice.group === 'cap') {
      return $localize`:@@bpl.hint_cap:Builds the question and the list, then opens the bank program's ceiling table.`;
    }
    return $localize`:@@bpl.hint:Builds everything it asks, then opens the figures for it.`;
  });

  readonly writeLines = computed<Array<CreateLine & { text: string }>>(() => {
    const choice = this.chosen();
    if (choice === null) return [];
    return createLines(choice).map((line) => ({ ...line, text: this.writeText(line) }));
  });

  readonly widenNote = computed(() => {
    const choice = this.chosen();
    if (choice === null) return null;
    const categories = widenedCategories(choice);
    if (categories.length === 0) return null;
    const names = categories.map((category) => categoryLabel(category)).join(', ');
    return $localize`:@@bpl.widen_note:Questions it reuses will also be asked for: ${names}:CATEGORIES:. Nothing is taken away from where they are asked today.`;
  });

  pick(key: string): void {
    this.picked.set(key);
    this.errorMessage.set(null);
    const choice = this.blueprints().find((blueprint) => blueprint.key === key) ?? null;
    // Seeded from the product's own default name, in both locales, and only when the operator
    // has not typed one: overwriting what they typed because they changed their mind about
    // the shape would throw away the only part of this screen that is theirs.
    if (choice !== null && choice.group !== 'cap' && this.form.pristine) {
      this.form.setValue({ labelEn: choice.labelEn, labelAr: choice.labelAr });
      this.names.set({ labelEn: choice.labelEn, labelAr: choice.labelAr });
    }
  }

  async create(): Promise<void> {
    const choice = this.chosen();
    if (choice === null || this.blockText() !== null || this.saving()) return;
    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      const isCap = choice.group === 'cap';
      const res = await this.api.createFromBlueprint({
        blueprintKey: choice.key,
        ...(isCap ? {} : { labelEn: this.names().labelEn, labelAr: this.names().labelAr }),
      });
      const { productKey, capFactKey } = res.data;
      if (productKey !== null) {
        // Straight to the figures: the shape is already decided, so the only thing left is
        // what each bank pays — which is the whole point of a predefined product.
        await this.router.navigate([PRODUCT_BASE, productKey, 'calculation']);
        return;
      }
      // A cap-only product creates nothing to open. The board is where its question and its
      // list are reachable from, and the fact key travels so the wizard can preselect the axis.
      await this.router.navigate([CATALOG_BASE], {
        queryParams: { basis: 'no_payslip', ...(capFactKey ? { cap: capFactKey } : {}) },
      });
    } catch (error) {
      this.errorMessage.set(this.messageOf(error));
    } finally {
      this.saving.set(false);
    }
  }

  leave(): void {
    void this.router.navigate(surrogateBoardLink().commands, {
      queryParams: surrogateBoardLink().queryParams,
    });
  }

  toShapes(): void {
    void this.router.navigate([PRODUCT_BASE, 'shapes']);
  }

  private async load(): Promise<void> {
    try {
      const res = await this.api.listProductBlueprints();
      this.blueprints.set(res.data);
    } catch (error) {
      // Named, not blank: the library is a fixed list in code, so an empty grid can only mean
      // the read failed, and "there are no products" would send somebody looking for the wrong
      // thing entirely.
      this.loadError.set(this.messageOf(error));
    } finally {
      this.loading.set(false);
    }
  }

  private card(blueprint: ProductBlueprint, index: number) {
    const copy = blueprintCopy(blueprint.key, blueprint.labelEn);
    const asks = blueprint.asks.slice(0, 4).map((ask) => this.askChip(ask));
    return {
      key: blueprint.key,
      index,
      title: copy.title,
      mechanism: copy.mechanism,
      example: copy.example,
      glyph: copy.glyph,
      asks,
      moreAsks: Math.max(0, blueprint.asks.length - asks.length),
      moreLabel: $localize`:@@bpl.more_asks:+${blueprint.asks.length - asks.length}:COUNT: more`,
      tags: this.cardTags(blueprint),
      readyLabel: $localize`:@@bpl.tag.ready:${readyCount(blueprint)}:READY: of ${blueprint.asks.length}:TOTAL: already set up`,
      openQuestion: blueprint.openQuestion
        ? $localize`:@@bpl.open_q:A bank still owes an answer`
        : null,
    };
  }

  private askChip(ask: ProductBlueprintAsk): {
    factKey: string;
    label: string;
    state: AskState;
    hint: string;
  } {
    const state = askState(ask);
    return {
      factKey: ask.factKey,
      // The fact key, deliberately: it is the word the operator sees on the product screen,
      // in the bank's figures editor and in the rule, so it is the one that joins those
      // screens up in their head. A prettier name here would be a fourth name for one thing.
      label: ask.factKey.replace(/_/g, ' '),
      state,
      hint:
        state === 'ready'
          ? $localize`:@@bpl.ask.ready:Already asked — this product reuses it.`
          : state === 'widens'
            ? $localize`:@@bpl.ask.widens:Asked already, but not for the loan types this product needs. It will be widened.`
            : $localize`:@@bpl.ask.creates:Will be created, with the list behind it.`,
    };
  }

  private cardTags(blueprint: ProductBlueprint): string[] {
    const tags: string[] = [];
    if (blueprint.wayCount > 1) {
      tags.push($localize`:@@bpl.tag.ways:${blueprint.wayCount}:COUNT: ways, lower wins`);
    }
    if (blueprint.hasSecondColumn) tags.push($localize`:@@bpl.tag.column:a second column`);
    if (blueprint.conditionCount > 0) {
      tags.push($localize`:@@bpl.tag.conds:${blueprint.conditionCount}:COUNT: conditions`);
    }
    if (blueprint.hasCap) tags.push($localize`:@@bpl.tag.cap:a ceiling table`);
    return tags;
  }

  private shelfLabel(group: BlueprintGroup): string {
    switch (group) {
      case 'income':
        return $localize`:@@bpl.shelf.income:Works out a monthly income`;
      case 'ceiling':
        return $localize`:@@bpl.shelf.ceiling:Works out a borrowing ceiling`;
      case 'cap':
        return $localize`:@@bpl.shelf.cap:Only caps the loan`;
    }
  }

  private shelfNote(group: BlueprintGroup): string {
    switch (group) {
      case 'income':
        return $localize`:@@bpl.shelf.income.note:The bank guesses what the customer earns, and the usual debt-burden check follows from it.`;
      case 'ceiling':
        return $localize`:@@bpl.shelf.ceiling.note:The bank works out a loan amount directly from something the customer owns.`;
      case 'cap':
        return $localize`:@@bpl.shelf.cap.note:The customer has a payslip. These only put a ceiling on top of it, so they build a question and a list — not a product.`;
    }
  }

  private writeText(line: CreateLine): string {
    switch (line.kind) {
      case 'lists':
        return $localize`:@@bpl.writes.lists:${line.count}:COUNT: new list(s) of answers`;
      case 'values':
        return $localize`:@@bpl.writes.values:${line.count}:COUNT: answer(s) in those lists`;
      case 'questions':
        return $localize`:@@bpl.writes.questions:${line.count}:COUNT: new question(s) for the customer`;
      case 'facts':
        return $localize`:@@bpl.writes.facts:${line.count}:COUNT: figure(s) the bank can work from`;
      case 'widens':
        return $localize`:@@bpl.writes.widens:${line.count}:COUNT: question(s) asked for more loan types`;
    }
  }

  private messageOf(error: unknown): string {
    const code = (error as { error?: { code?: ErrorCode } })?.error?.code;
    const meta = (error as { error?: { meta?: Record<string, unknown> } })?.error?.meta;
    return code
      ? this.errors.toLocalizedMessage(code, meta)
      : $localize`:@@bpl.unknown_error:That did not go through. Try again.`;
  }
}
