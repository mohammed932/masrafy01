import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzDrawerRef, NZ_DRAWER_DATA } from 'ng-zorro-antd/drawer';
import {
  CloseCircleOutline,
  InfoCircleOutline,
  TagsOutline,
} from '@ant-design/icons-angular/icons';
import { FormDrawerComponent } from '@shared/ui';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode } from '@core/auth/auth.types';
import {
  INCOME_BASES,
  incomeBasisHint,
  incomeBasisLabel,
  type IncomeBasis,
} from '@core/income-basis';
import { categoryLabel, type LoanCategory } from '@core/loan-category';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { LookupsApiService, type EnumerationRow } from '@features/lookups/lookups.api.service';
import { EnumerationTypesService } from './enumeration-types.service';
import { slugify, uniqueSlug } from './slug';

/**
 * EVERY lookup type is edited by business name only: the machine key is derived
 * from the English label and never typed. Lookups are curated by non-technical
 * staff, who had no way to judge what a key should read, and a key typed by hand
 * is immutable the moment it is saved — a typo there outlived the value itself.
 *
 * Program names carry one extra, and this form EDITS them — it does not create them. The
 * INCOME BASIS is asked here so an operator who got it wrong can fix it from the screen
 * labelled "Edit". Creating a name moved to `/program-catalog/new`, because the basis decides
 * whether a second question follows (which calculation the name quotes from, possibly a new
 * one built from a shape), and a form that branches like that wants a screen and a URL rather
 * than a 560px sheet with an inner scrollbar and nothing to return to.
 *
 * It states intent and nothing else (v16.4.1). It filters no picker and refuses no
 * save: the bank chooses the basis on its own program (step 1 of the wizard →
 * `bank_program.programType`), and a stale tick here used to refuse a program that
 * bank was entitled to create. What banks actually did is counted separately and
 * shown on the catalog board, and the two are allowed to disagree.
 *
 * The basis is asked as ONE choice — radios, not ticks. The wire shape stays an
 * array (`IncomeBasis[]`, what the API takes and what legacy rows may hold two of),
 * but this screen writes exactly one: the operator is stating what the name IS,
 * and a control that let both be true asked them to describe the product twice.
 * "Two banks sell it two ways" is still fully expressible — it is expressed where
 * it happens, on each bank's own program, and counted back on the catalog board.
 */
const PROGRAM_NAME_TYPE = 'program_name';
/** The archetype list a no-payslip catalog name links to. */
const SURROGATE_PRODUCT_TYPE = 'surrogate_product';

export interface EnumerationEditDrawerData {
  mode: 'create' | 'edit';
  type: string;
  row?: EnumerationRow;
  /** Overrides the generic sheet title — a screen that edits ONE kind names it. */
  title?: string;
  subtitle?: string;
  /** Same reason: "Add value" under a program-name list names the mechanism, not the thing. */
  submitLabel?: string;
}

@Component({
  selector: 'app-enumeration-edit-drawer',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzInputModule,
    NzFormModule,
    NzIconModule,
    NzSelectModule,
    FormDrawerComponent,
  ],
  providers: [provideNzIconsPatch([CloseCircleOutline, InfoCircleOutline, TagsOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-form-drawer
      [title]="drawerTitle"
      [subtitle]="drawerSubtitle"
      [submitLabel]="submitLabel"
      [submitDisabled]="!form.valid"
      [submitting]="submitting()"
      (cancelled)="cancel()"
      (submitted)="save()"
    >
      <span drawerIcon nz-icon nzType="tags" nzTheme="outline"></span>
      <form nz-form nzLayout="vertical" [formGroup]="form" class="form">
        <!-- One name in two locales is ONE decision, so the pair sits on one row:
             stacked, they read as two unrelated fields and pushed the only real
             choice on this form (the basis) below the fold. -->
        <div class="field-pair">
          <nz-form-item>
            <nz-form-label nzFor="lk-label" nzRequired i18n="@@lookups.field.labelEnglish"
              >English label</nz-form-label
            >
            <nz-form-control [nzErrorTip]="labelErrTpl">
              <input
                nz-input
                id="lk-label"
                formControlName="labelEn"
                dir="ltr"
                [attr.maxlength]="labelMax"
                [placeholder]="labelEnPlaceholder"
              />
              <ng-template #labelErrTpl let-control>
                @if (control.errors?.['required']) {
                  <span i18n="@@lookups.field.label.required">Required</span>
                }
              </ng-template>
            </nz-form-control>
          </nz-form-item>

          <nz-form-item>
            <nz-form-label nzFor="lk-label-ar" nzRequired i18n="@@lookups.field.labelAr"
              >Arabic label</nz-form-label
            >
            <nz-form-control [nzErrorTip]="labelArErrTpl">
              <input
                nz-input
                id="lk-label-ar"
                formControlName="labelAr"
                dir="rtl"
                [attr.maxlength]="labelMax"
                [placeholder]="labelArPlaceholder"
              />
              <ng-template #labelArErrTpl let-control>
                @if (control.errors?.['required']) {
                  <span i18n="@@lookups.field.labelAr.required">Required</span>
                }
              </ng-template>
            </nz-form-control>
          </nz-form-item>
        </div>

        @if (parentType !== null) {
          <!-- The CLASS this row is priced in. REQUIRED, and that is a change: an unclassified
               compound is not a smaller offer, it is a compound the customer can pick and no
               bank can price: the derivation that reads it finds no matching row, which stops
               the rule. The server refuses it too, so leaving it optional here only moved the
               refusal from a field to a toast. -->
          <nz-form-item>
            <nz-form-label nzFor="lk-parent" nzRequired i18n="@@lookups.field.parentKey"
              >Filed under</nz-form-label
            >
            <nz-form-control [nzErrorTip]="parentRequiredTip">
              <nz-select
                id="lk-parent"
                formControlName="parentKey"
                [nzPlaceHolder]="parentPlaceholder"
              >
                @for (option of parentOptions(); track option.id) {
                  <nz-option
                    [nzValue]="option.key"
                    [nzLabel]="isAr ? option.labelAr : option.labelEn"
                  ></nz-option>
                }
              </nz-select>
              <p class="hint" i18n="@@lookups.field.parentKey.hint">
                Banks price this list by the class it is filed under. A value with no class gets no
                figures from those banks.
              </p>
            </nz-form-control>
          </nz-form-item>
        }

        @if (asksBasis) {
          <!-- ONE choice, so: radios. Native inputs sharing a name, not two
               checkboxes and not a select — the group gives arrow-key traversal and
               "one of these" for free, and a select would hide both hints behind a
               click on the only real decision this form makes.

               The SAME two rows on edit, over the stored per-loan-type map, and one of
               them is ALWAYS checked: this dialog is the only place the basis is set,
               so an unchecked group would be a question the operator cannot see the
               current answer to. A map that disagrees across loan types resolves to
               one on open (see resolveBasis) and is written flat on save. -->
          <section class="basis" role="radiogroup" aria-labelledby="lk-basis-heading">
            <h3 class="basis-heading" id="lk-basis-heading" i18n="@@lookups.field.incomeBasis">
              How do banks prove the income?
            </h3>
            <div class="basis-rows">
              @for (b of incomeBases; track b) {
                <!-- The accent is keyed off the basis itself, not the row's position:
                     the plum belongs to the no-payslip concept board-wide, and a
                     position-based rule would hand it to whatever lands there next. -->
                @let picked = basisPicked(b);
                <label class="basis-row" [attr.data-basis]="b" [class.is-on]="picked">
                  <input
                    type="radio"
                    class="sr-only"
                    name="lk-income-basis"
                    [checked]="picked"
                    (change)="pickBasis(b)"
                  />
                  <span class="basis-tick" aria-hidden="true"></span>
                  <span class="basis-text">
                    <span class="basis-title">{{ basisLabel(b) }}</span>
                    <span class="basis-hint">{{ basisHint(b) }}</span>
                  </span>
                </label>
              }
            </div>
            <!-- A no-payslip name has to say WHERE the income is worked out. Shown only
                 when that basis is picked, because on the payslip basis there is nothing
                 to choose: the bank reads the payslip. Required, so a name cannot be
                 created live, offerable, and quoting nothing — which is exactly what
                 happened before the products existed. -->
            @if (needsProduct()) {
              <div class="product">
                <label class="product-label" for="lk-surrogate-product">
                  <span i18n="@@lookups.field.product">Which surrogate product?</span>
                  <span class="req" aria-hidden="true">*</span>
                </label>
                <nz-select
                  id="lk-surrogate-product"
                  formControlName="surrogateProductKey"
                  nzShowSearch
                  [nzPlaceHolder]="productPlaceholder"
                >
                  @for (p of productOptions(); track p.key) {
                    <nz-option [nzValue]="p.key" [nzLabel]="productLabel(p)"></nz-option>
                  }
                </nz-select>
                <p class="product-hint">
                  @if (productOptions().length === 0) {
                    <span i18n="@@lookups.field.product.none"
                      >Every calculation is switched off, so this name cannot be sold without a
                      payslip yet. Switch one back on in the program catalog first.</span
                    >
                  } @else {
                    <span i18n="@@lookups.field.product.hint"
                      >The calculation every bank filing a program under this name will quote from.
                      It can be changed later.</span
                    >
                  }
                </p>
              </div>
            }

            @if (isEdit) {
              <p class="basis-note">
                <span nz-icon nzType="info-circle" nzTheme="outline" aria-hidden="true"></span>
                <span i18n="@@lookups.field.incomeBasis.noteEdit"
                  >Applies to every loan type this name is offered under ({{
                    assignedCategoryNames
                  }}).</span
                >
              </p>
            }
          </section>
        } @else if (isParkedName) {
          <!-- Not silence: the block is missing for a reason the operator can act on,
               and the basis is stored per loan type, so there is nowhere to put an
               answer until this name is offered somewhere. -->
          <p class="basis-note">
            <span nz-icon nzType="info-circle" nzTheme="outline" aria-hidden="true"></span>
            <span i18n="@@lookups.field.incomeBasis.parked"
              >This name isn’t offered under any loan type yet, so there’s nothing to sell it
              against. Pick its loan types on the name’s own page first.</span
            >
          </p>
        }

        <nz-form-item class="sort-item">
          <nz-form-label nzFor="lk-sort" i18n="@@lookups.field.sortOrder">Sort order</nz-form-label>
          <nz-form-control [nzExtra]="sortHintTpl">
            <input nz-input id="lk-sort" type="number" formControlName="sortOrder" min="0" />
            <ng-template #sortHintTpl>
              <span i18n="@@lookups.field.sortOrderHint">controls the order in dropdowns</span>
            </ng-template>
          </nz-form-control>
        </nz-form-item>

        @if (errorMessage(); as message) {
          <p class="error" role="alert">
            <span nz-icon nzType="close-circle" nzTheme="outline" aria-hidden="true"></span>
            <span>{{ message }}</span>
          </p>
        }
      </form>
    </app-form-drawer>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      /* ONE rhythm for the whole form. antd ships every nz-form-item with its own
         24px bottom margin, which stacked against the section margins and left a
         different gap above and below each block. Zero them, own the gap here. */
      .form {
        display: grid;
        gap: var(--space-5);
        margin: 0;
      }
      .form nz-form-item {
        margin-block-end: 0;
      }
      .field-pair {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: var(--space-4);
        align-items: start;
      }
      /* A sort order is one or two digits; a 560px-wide box for it made the least
         important field on the form the widest thing on it. */
      .sort-item {
        max-inline-size: 240px;
      }
      /* Visually hidden, still focusable + announced — the real control behind each
         tickable row. */
      .sr-only {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
        border: 0;
      }
      /* The income basis is the one product decision on this form — the two label
         fields above it are transcription. Weight comes from the tiles and the
         heading, not from rules: this was a fieldset, and a <legend> renders INSIDE
         the top border, so the border ran off to the right of the question like a
         stray hairline. No divider survives in the body. */
      .basis {
        display: grid;
        gap: var(--space-3);
        min-inline-size: 0;
      }
      .basis-heading {
        margin: 0;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        line-height: var(--line-height-tight);
        letter-spacing: var(--tracking-tight);
        color: var(--color-text-primary);
      }
      .basis-rows {
        display: grid;
        gap: var(--space-2);
      }
      .basis-row {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        /* Filled like the inputs above it — on the dialog's near-white body an
           unfilled tile reads as a caption block, not something you can tick. */
        background: var(--color-surface-elevated);
        cursor: pointer;
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          background-color var(--motion-duration-fast) var(--motion-easing-standard),
          box-shadow var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .basis-row:hover:not(.is-on) {
        border-color: var(--color-border-strong);
        background: var(--color-surface-default);
      }
      /* On the LABEL: the visible row is what the operator perceives as focused,
         the input inside it is 1px and hidden. */
      .basis-row:focus-within {
        outline: var(--focus-ring-width) solid var(--color-border-focus);
        outline-offset: var(--focus-ring-offset);
      }
      /* Selected: accent edge doubled by an inset ring rather than a 2px border —
         a thicker border would reflow the text by a pixel on every tick. */
      .basis-row.is-on {
        border-color: var(--basis-accent, var(--color-brand-primary));
        background: color-mix(
          in srgb,
          var(--basis-accent, var(--color-brand-primary)) 6%,
          var(--color-surface-default)
        );
        box-shadow: inset 0 0 0 1px
          color-mix(in srgb, var(--basis-accent, var(--color-brand-primary)) 45%, transparent);
      }
      /* The no-payslip row carries the colour this concept owns board-wide, so the
         choice made here matches the chip on the catalog and in the program wizard. */
      .basis-row[data-basis='no_payslip'] {
        --basis-accent: var(--color-income-surrogate);
      }
      /* Circle, not a rounded square: the shape IS the affordance. A square box says
         "tick as many as apply", and it said that here for as long as both could be
         true — now that exactly one can, the anatomy has to say so before the
         operator clicks the second row and watches the first go out. */
      .basis-tick {
        flex: none;
        display: grid;
        place-items: center;
        inline-size: 20px;
        block-size: 20px;
        /* Optical centring on the title's cap height, not on its line box. */
        margin-block-start: 1px;
        border: 1.5px solid var(--color-border-strong);
        border-radius: 50%;
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          background-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      /* The dot is always in the DOM and scales in, so selection animates from the
         centre of the ring the eye is already on rather than popping into place.
         --text-on-primary is the real token — the check glyph this replaces was
         inked with --text-inverse, which is defined nowhere, so it fell back to
         body ink: dark navy on a solid azure fill. */
      .basis-tick::after {
        content: '';
        inline-size: 8px;
        block-size: 8px;
        border-radius: 50%;
        background: var(--text-on-primary);
        transform: scale(0);
        transition: transform var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .basis-row.is-on .basis-tick {
        border-color: var(--basis-accent, var(--color-brand-primary));
        background: var(--basis-accent, var(--color-brand-primary));
      }
      .basis-row.is-on .basis-tick::after {
        transform: scale(1);
      }
      .basis-text {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .basis-title {
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        line-height: var(--line-height-tight);
        color: var(--color-text-primary);
      }
      .basis-hint {
        font-size: var(--text-xs);
        line-height: var(--line-height-base);
        color: var(--color-text-secondary);
        /* Measure cap: the no-payslip hint ran the full 560px dialog width, ~95
           characters a line, and read as a paragraph instead of a caption. */
        max-inline-size: 58ch;
      }
      .product {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        margin-block-start: var(--space-4);
        padding-block-start: var(--space-4);
        border-block-start: 1px solid var(--border-default);
      }

      .product-label {
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        color: var(--text-primary);
      }

      .product-label .req {
        color: var(--error);
        margin-inline-start: var(--space-1);
      }

      .product-hint {
        margin: 0;
        font-size: var(--text-xs);
        color: var(--text-secondary);
        line-height: 1.5;
      }

      .basis-note {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        margin: 0;
        font-size: var(--text-xs);
        line-height: var(--line-height-base);
        max-inline-size: 62ch;
        color: var(--color-text-tertiary);
      }
      .basis-note [nz-icon] {
        flex: none;
        margin-block-start: 2px;
      }
      @media (prefers-reduced-motion: reduce) {
        .basis-row,
        .basis-tick,
        .basis-tick::after {
          transition: none;
        }
      }
      .error {
        background: var(--color-error-bg);
        color: var(--color-error);
        border-radius: var(--radius-md);
        padding: var(--space-2) var(--space-3);
        margin: 0;
        display: inline-flex;
        gap: var(--space-2);
        align-items: center;
        font-size: var(--text-sm);
      }
      .hint {
        margin-block: var(--space-1) 0;
        font-size: var(--text-sm);
        color: var(--text-muted);
      }
    `,
  ],
})
export class EnumerationEditDrawerComponent {
  private readonly api = inject(LookupsApiService);
  // Declared BEFORE `parentType` and the form below: both read it in a field initialiser,
  // and field initialisers run in source order.
  private readonly enumTypes = inject(EnumerationTypesService);
  private readonly errorCodes = inject(ErrorCodeService);
  private readonly drawerRef = inject(NzDrawerRef<EnumerationEditDrawerComponent, boolean>);
  protected readonly data = inject<EnumerationEditDrawerData>(NZ_DRAWER_DATA);

  private readonly isProgramName = this.data.type === PROGRAM_NAME_TYPE;
  /**
   * Types whose rows are FILED UNDER another list — the registry's generic single-parent
   * scope, read by a rule's `factParentTable` step.
   *
   * `compound` is the only one today: a customer picks one of hundreds of compounds by name,
   * and the bank keys its cap table by the five CLASSES. Without a class a row is invisible
   * to that derivation — the rule reports `no_matching_row` and the program quotes nothing
   * for whoever picked it — and until now this dialog could not set one, so every compound
   * an operator added was born classless.
   */
  protected readonly parentType: string | null = this.enumTypes.parentTypeOf(this.data.type);
  protected readonly parentOptions = signal<readonly EnumerationRow[]>([]);

  /**
   * The surrogate products a no-payslip name may link to. ACTIVE only — this is a point of
   * CHOICE, and offering a retired product would be offering a save the server refuses.
   */
  protected readonly productOptions = signal<readonly EnumerationRow[]>([]);
  protected readonly productPlaceholder = $localize`:@@lookups.field.product.placeholder:Pick how the income is worked out`;
  protected readonly parentPlaceholder = $localize`:@@lookups.field.parentKey.pick:Pick a class`;
  protected readonly parentRequiredTip = $localize`:@@lookups.field.parentKey.required:Pick the class this value is priced in.`;
  /** Arabic primary (Principle IV) — the same document read every other registry surface does. */
  protected readonly isAr = document.documentElement.lang.startsWith('ar');
  protected readonly isEdit = this.data.mode === 'edit';
  /**
   * The loan types this name is currently offered under — the axis the basis is
   * actually stored on. `undefined` (a backend without the assignment endpoints)
   * is NOT the same as `[]` (parked, offered nowhere): the first means the screen
   * cannot know, the second that there is nothing to sell against.
   */
  private readonly categoriesKnown = this.data.row?.categories !== undefined;
  private readonly assignedCategories: LoanCategory[] = this.data.row?.categories ?? [];
  /**
   * Parked names still open this dialog — the operator gets a line saying why the
   * basis is missing rather than a block that silently is not there. Requires the
   * assignment to be KNOWN: against a backend without the endpoints every name
   * would otherwise be reported as parked.
   */
  protected readonly isParkedName =
    this.isProgramName &&
    this.isEdit &&
    this.categoriesKnown &&
    this.assignedCategories.length === 0;
  /**
   * EDIT only. The two rows read the stored per-loan-type map — which may disagree across
   * loan types — and resolve it to the ONE answer the group shows and writes.
   *
   * CREATING a program name is not this form's job any more: the basis decides whether a
   * SECOND question follows (which calculation it quotes from, possibly a new one), and a
   * form that branches like that belongs on a screen with a URL. See
   * `/program-catalog/new`. Both doors into create — the board's button and this drawer's
   * host panel — now point there, which is what makes the branch below unreachable rather
   * than merely unused.
   */
  protected readonly asksBasis =
    this.isProgramName && this.isEdit && this.categoriesKnown && !this.isParkedName;
  protected readonly incomeBases = INCOME_BASES;
  /** Names the loan types in the note, so "every loan type" is not an abstraction. */
  protected readonly assignedCategoryNames = this.assignedCategories
    .map((c) => categoryLabel(c))
    .join(this.listSeparator());

  /**
   * EDIT only — the working per-category map, seeded from the row and written back
   * one category at a time on save. Kept beside the form rather than inside it: the
   * form models one flat answer (what CREATE sends) and this models the real shape
   * of the stored data, and collapsing them would make the flat one authoritative.
   */
  private readonly initialBasisMap: Partial<Record<LoanCategory, IncomeBasis[]>> =
    Object.fromEntries(
      this.assignedCategories.map((c) => [
        c,
        // An assigned category always carries at least one basis server-side; the
        // fallback is for a row read from a backend that predates the column.
        [...(this.data.row?.incomeBasesByCategory?.[c] ?? ['payslip'])],
      ]),
    );
  /**
   * The ONE answer the radio group opens on.
   *
   * A stored map that disagrees across loan types (or a legacy row carrying both on
   * one loan type) used to leave both radios empty, which read as "nobody has
   * answered this" over a value that IS stored — and since this dialog is the only
   * place the basis is set, there was nowhere to go and look at the real split.
   * Resolved by loan-type count, ties going to `payslip` (the ordinary case, and the
   * default a name that predates the column carries).
   */
  private readonly resolvedBasis: IncomeBasis = this.resolveBasis();

  /**
   * The working map. Seeded FLAT from `resolvedBasis`, not from the stored map: what
   * the group shows is what a save writes, so a name opened on a disagreeing map and
   * saved is normalized to the answer the operator was looking at. `initialBasisMap`
   * stays the stored shape, so the PUTs still fire only where the value moved.
   */
  protected readonly basisMap = signal<Partial<Record<LoanCategory, IncomeBasis[]>>>(
    Object.fromEntries(this.assignedCategories.map((c) => [c, [this.resolvedBasis]])),
  );
  /** Label length cap — program names must fit the bank_program.friendlyName column (120). */
  protected readonly labelMax = this.isProgramName ? 120 : 160;

  /**
   * Placeholders are EXAMPLES OF THIS TYPE, not restated labels: one dialog serves
   * every enumeration, so "English label" alone never said whether the box wants a
   * governorate, a document type or a catalog product name. The examples live with
   * the type list, next to each type's own description.
   */
  // Stored on the KIND now, not in a per-type map here: a kind an operator invents can
  // carry its own example, and one that carries none falls back to a generic line rather
  // than to another type's example.
  protected readonly labelEnPlaceholder =
    this.enumTypes.example(this.data.type, false) ??
    $localize`:@@lookups.example.fallback.en:e.g. Salaried employee`;
  protected readonly labelArPlaceholder =
    this.enumTypes.example(this.data.type, true) ??
    $localize`:@@lookups.example.fallback.ar:مثال: موظف بمرتب`;

  /**
   * Sheet chrome. Defaults are generic because this form serves every registry list;
   * a screen that edits exactly one kind ("Add program name") passes its own words —
   * the title is the first thing read, and "Add new value" over a program-name list
   * names the mechanism instead of the thing.
   */
  protected readonly drawerTitle =
    this.data.title ??
    (this.isEdit
      ? $localize`:@@lookups.dialog.titleEdit:Edit value`
      : $localize`:@@lookups.dialog.titleCreate:Add new value`);
  protected readonly drawerSubtitle =
    this.data.subtitle ??
    (this.isEdit
      ? $localize`:@@lookups.drawer.subEdit:Renames it everywhere it is already used. Its key never changes.`
      : $localize`:@@lookups.drawer.subCreate:Adds one option to this list, ready to be picked wherever the list is used.`);
  protected readonly submitLabel =
    this.data.submitLabel ??
    (this.isEdit
      ? $localize`:@@lookups.dialog.save:Save`
      : $localize`:@@lookups.drawer.create:Add value`);

  protected readonly submitting = signal(false);
  /** Localized failure text — mapping goes through ErrorCodeService (Principle III, A22). */
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = new FormGroup({
    labelEn: new FormControl<string>(this.data.row?.labelEn ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(this.labelMax)],
    }),
    labelAr: new FormControl<string>(this.data.row?.labelAr ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(this.labelMax)],
    }),
    sortOrder: new FormControl<number>(this.data.row?.sortOrder ?? 0, {
      nonNullable: true,
      validators: [Validators.min(0)],
    }),
    /**
     * Which surrogate product a no-payslip name works its income out from.
     *
     * `''` = nothing picked, and the required-ness is applied dynamically in `pickBasis`
     * rather than declared here: it is only required while the no-payslip basis is
     * chosen, and a static validator would block every payslip name from saving.
     */
    surrogateProductKey: new FormControl<string>(this.data.row?.surrogateProductKey ?? '', {
      nonNullable: true,
    }),
    /**
     * The class this row is priced in. REQUIRED for a type that has the axis, and validated
     * conditionally rather than always: this same dialog creates catalog program names, which
     * are filed under nothing at all, and a blanket `Validators.required` would make every
     * one of those unsavable.
     */
    parentKey: new FormControl<string>(this.data.row?.parentKey ?? '', {
      nonNullable: true,
      validators: this.enumTypes.parentTypeOf(this.data.type) ? [Validators.required] : [],
    }),
  });

  constructor() {
    // The parent list, loaded once. Only the ACTIVE rows are offered: filing a compound under
    // a retired class would be a save that quotes nothing, which is the failure this control
    // exists to prevent.
    // Active only: this is a point of CHOICE, and offering a retired product would be
    // offering a save the server refuses.
    if (this.isProgramName) {
      this.api
        .list(SURROGATE_PRODUCT_TYPE)
        .then((rows) => this.productOptions.set(rows.filter((r) => r.active)))
        .catch(() => this.productOptions.set([]));
    }

    if (this.parentType !== null) {
      void this.api
        .list(this.parentType)
        .then((rows) => this.parentOptions.set(rows.filter((r) => r.active)))
        .catch(() => this.parentOptions.set([]));
    }

    // Once, HERE, and not only from `pickBasis`. A name opened on the no-payslip basis
    // renders the required product select immediately — but the validator was only ever
    // attached by a click, so an operator who edited the label and saved got a raw 422 from
    // the server for a field the form had reported as fine.
    this.syncProductValidator();
  }

  protected basisLabel(basis: IncomeBasis): string {
    return incomeBasisLabel(basis);
  }

  protected basisHint(basis: IncomeBasis): string {
    return incomeBasisHint(basis);
  }

  /** Exactly one row is checked, always — read from the working map, flat by construction. */
  protected basisPicked(basis: IncomeBasis): boolean {
    const map = this.basisMap();
    return (
      this.assignedCategories.length > 0 &&
      this.assignedCategories.every((c) => (map[c] ?? [])[0] === basis)
    );
  }

  /**
   * Collapse the stored per-loan-type map to one answer: the basis the most loan
   * types carry. A row holding BOTH on one loan type counts for each of them, so a
   * legacy row offered nowhere else resolves to the tie-break rather than to
   * whichever happened to be stored first.
   */
  private resolveBasis(): IncomeBasis {
    let noPayslip = 0;
    let payslip = 0;
    for (const category of this.assignedCategories) {
      const set = this.initialBasisMap[category] ?? [];
      if (set.includes('no_payslip')) noPayslip += 1;
      if (set.includes('payslip')) payslip += 1;
    }
    return noPayslip > payslip ? 'no_payslip' : 'payslip';
  }

  /**
   * Pick one basis — there is no unpick. A radio group has no empty state to fall
   * back to, which is the point: the old ticks could be cleared into "sold no way at
   * all", a state the API refuses, so the form carried an error line for a value the
   * operator could only reach by mistake. Now unreachable, so the line is gone.
   *
   * On EDIT the pick applies to EVERY offered loan type — this dialog writes the
   * basis flat, which is what the note under the rows says.
   */
  protected pickBasis(basis: IncomeBasis): void {
    this.basisMap.update((map) => {
      const next: Partial<Record<LoanCategory, IncomeBasis[]>> = { ...map };
      for (const category of this.assignedCategories) next[category] = [basis];
      return next;
    });
    this.syncProductValidator();
  }

  /**
   * Whether the operator must say where the income comes from.
   *
   * Read off the SAME source `basisPicked` uses, so the picker cannot appear while the
   * no-payslip row reads as unchecked. Gated on `asksBasis` too: the ten types that carry
   * no basis at all must not grow a product picker.
   */
  protected needsProduct(): boolean {
    return this.asksBasis && this.basisPicked('no_payslip');
  }

  /**
   * A localized product name for the picker.
   *
   * The Arabic label when the admin is Arabic, exactly as every other registry list renders
   * — a picker that fell back to English keys would be the one place the operator has to
   * read a slug.
   */
  protected productLabel(row: EnumerationRow): string {
    return this.isAr ? row.labelAr : row.labelEn;
  }

  /**
   * Keep the product control's required-ness in step with the basis.
   *
   * Applied dynamically rather than declared on the control: it is required only while the
   * no-payslip basis is chosen, and a static validator would block every payslip name from
   * saving. Cleared on the way back so switching to payslip does not leave a name unsavable
   * for a field it no longer shows.
   */
  private syncProductValidator(): void {
    const control = this.form.controls.surrogateProductKey;
    if (this.needsProduct()) {
      control.addValidators(Validators.required);
    } else {
      control.removeValidators(Validators.required);
      control.setValue('');
    }
    control.updateValueAndValidity();
  }

  /** Arabic separates a list with its own comma; a hardcoded ", " reads as Latin. */
  private listSeparator(): string {
    return $localize`:@@lookups.list.separator:, `;
  }

  /**
   * One PUT per loan type whose basis set moved. Sequential, not parallel: each is
   * a separate row the server validates on its own, and a rejected one should stop
   * the rest rather than race them into a partly-applied name.
   */
  private async saveBasisChanges(id: string): Promise<void> {
    if (!this.asksBasis || !this.isEdit) return;
    const map = this.basisMap();
    for (const category of this.assignedCategories) {
      const next = map[category] ?? [];
      // Both sides are held in INCOME_BASES order, so the join is a set compare.
      if (next.join('|') === (this.initialBasisMap[category] ?? []).join('|')) continue;
      await this.api.setIncomeBasis(id, category, next);
    }
  }

  cancel(): void {
    this.drawerRef.close(false);
  }

  async save(): Promise<void> {
    this.errorMessage.set(null);
    this.submitting.set(true);
    try {
      const v = this.form.getRawValue();
      if (this.data.mode === 'create') {
        if (!slugify(v.labelEn)) {
          this.fail('VALIDATION_FAILED');
          return;
        }
        const key = await this.uniqueKey(v.labelEn);
        await this.api.create({
          type: this.data.type,
          key,
          labelEn: v.labelEn,
          labelAr: v.labelAr,
          // No income basis and no product link: the only type this form still CREATES
          // that has either axis is `program_name`, and that moved to its own screen.
          // Sent only for a type that HAS a parent axis, and only when one was picked — an
          // empty string is "unfiled", not a key.
          ...(this.parentType !== null && v.parentKey !== '' ? { parentKey: v.parentKey } : {}),
          sortOrder: v.sortOrder,
        });
      } else if (this.data.row) {
        // The link and the basis are ONE decision written as two calls, and which goes
        // first depends on the DIRECTION — a single fixed order deadlocks one of them.
        //
        //   linking   (→ no-payslip): LINK first. The basis write is refused while nothing
        //                             says how the income is worked out.
        //   unlinking (→ payslip):    BASIS first. The unlink is refused while the STORED
        //                             basis is still no-payslip — and the server reads the
        //                             stored value, not the one in flight, so link-first
        //                             made switching a linked name back to payslip
        //                             impossible on every retry.
        //
        // Both stay before the labels: the middle write is the one the server can refuse,
        // and failing there must leave the row as it was rather than half-saved with a new
        // label.
        //
        // Sent only when it MOVED, so editing a label never touches the link.
        const nextLink = v.surrogateProductKey === '' ? null : v.surrogateProductKey;
        const linkMoved =
          this.asksBasis && nextLink !== (this.data.row.surrogateProductKey ?? null);
        // `''` reaches the server as an explicit `null` — the unlink spelling. `''` itself
        // is refused by the DTO, which is the point: "not linked" has one spelling.
        const writeLink = (): Promise<unknown> =>
          this.api.update(this.data.row!.id, { surrogateProductKey: nextLink });

        if (linkMoved && nextLink !== null) await writeLink();
        await this.saveBasisChanges(this.data.row.id);
        if (linkMoved && nextLink === null) await writeLink();
        await this.api.update(this.data.row.id, {
          labelEn: v.labelEn,
          labelAr: v.labelAr,
          ...(this.parentType !== null && v.parentKey !== '' ? { parentKey: v.parentKey } : {}),
          sortOrder: v.sortOrder,
        });
      }
      this.drawerRef.close(true);
    } catch (err) {
      const code = (err as { error?: { code?: string } }).error?.code;
      this.fail(code ?? 'INTERNAL_ERROR');
    } finally {
      this.submitting.set(false);
    }
  }

  private fail(code: string): void {
    this.errorMessage.set(this.errorCodes.toLocalizedMessage(code as ErrorCode));
  }

  /**
   * Free key for a derived slug: `salaried`, else `salaried_2`, `salaried_3`…
   *
   * Two values may legitimately share an English label (a renamed one, a
   * deprecated one), and the key is no longer typeable — so a raw
   * `ENUMERATION_KEY_DUPLICATE` here would name a field the operator never saw
   * and cannot edit. The server still enforces uniqueness; this only keeps the
   * ordinary case from surfacing as an unactionable error.
   */
  private async uniqueKey(label: string): Promise<string> {
    try {
      const taken = new Set((await this.api.list(this.data.type)).map((r) => r.key));
      return uniqueSlug(label, taken);
    } catch {
      // The list read is a courtesy — the server enforces the unique either way, and refusing
      // to save because a GET failed would be the worse answer.
      return slugify(label);
    }
  }
}
