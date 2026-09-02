import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { NzInputModule } from 'ng-zorro-antd/input';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode } from '@core/auth/auth.types';
import { incomeBasisLabel, type IncomeBasis } from '@core/income-basis';
import { FormPageComponent, IncomeBasisCardsComponent, WizardStepsComponent } from '@shared/ui';
import type { WizardStepItem } from '@shared/ui/wizard-steps.component';
import { LookupsApiService } from '@features/lookups/lookups.api.service';
import { slugify, uniqueSlug } from '@shared/lookups/slug';
import { BankProgramsApiService } from '@features/bank-programs/bank-programs.api.service';
import type { SurrogateProductSummary } from '@features/bank-programs/bank-programs.types';
import { ProductShapePickerComponent } from './product-shape-picker.component';
import { ENUM_TYPE } from './program-name-row';
import { CATALOG_BASE, PRODUCT_BASE, newNameLanding } from './program-catalog.paths';
import {
  LAST_STEP,
  RESERVED_NAME_KEYS,
  barBlock,
  blockReason,
  savePlan,
  stepStatuses,
  type NewNameBlock,
  type NewNameDraft,
  type ProductChoice,
} from './new-program-name';

/**
 * Add a catalog program name — ONE flow, whichever way the income is proved.
 *
 * WHY IT EXISTS. Adding a name used to be three experiences wearing one button. On the
 * payslip side of the board the button opened a side sheet that saved and dropped you back
 * on the list. On the surrogate side the SAME button position opened a different object
 * entirely (a product). And picking "Surrogate" inside the sheet needed a product to already
 * exist — with no product, the form refused to save and told you to go to another screen,
 * which had its own three-screen flow of its own. Three splits: a different entry, a
 * different container, a different ending.
 *
 * Now: one button on every chip, one screen, three steps, and both bases end on the thing
 * that was just made at the next unanswered question.
 *
 * THE BASIS IS STEP 1. Everything step 3 shows branches on it, so asking it second meant an
 * operator arriving from the board's `All` chip typed two labels and a sort order before
 * anything on screen said which KIND of program was being made. It also makes the chip a real
 * shortcut: it answers step 1, so the screen opens on step 2 with that answer behind it and
 * changeable, instead of opening on a settled question that reads as a step to skip.
 *
 * A SCREEN AND NOT A SHEET, by the shell's own rule: a form that branches on a type choice
 * needs the viewport and a URL to come back to. This one branches into a multi-pick shape
 * picker and a second object's name, which is well past what a 560px sheet holds, and an
 * operator interrupted halfway would have had nothing to return to.
 *
 * STEP 3 IS A REAL STEP ON THE PAYSLIP PATH. It is not hidden and not disabled: a hidden
 * step makes the two paths different LENGTHS, which is the inconsistency this screen exists
 * to remove. The payslip answer is "the bank reads the payslip, there is nothing to set up"
 * — an answer, stated, and the step is where what Save will create is read back.
 *
 * WHAT THIS SCREEN DELIBERATELY DOES NOT ASK: which loan types the name is offered under. A
 * new name is born parked, on purpose (`create()` assigns none), because an undecided
 * decision must read as undecided — and step 2 of the name's own page is where it is decided
 * and where an unset one is visible. That is also why every path lands there.
 *
 * THE RULES LIVE IN `new-program-name.ts`, not here: the write ORDER and what a RETRY does
 * after a half-applied attempt are the two things that fail silently, and neither is
 * exercisable through a form.
 */
const SURROGATE_PRODUCT_TYPE = 'surrogate_product';

@Component({
  selector: 'app-new-program-name-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    NzInputModule,
    FormPageComponent,
    WizardStepsComponent,
    IncomeBasisCardsComponent,
    ProductShapePickerComponent,
  ],
  template: `
    <app-form-page
      wide
      stepped
      [eyebrow]="eyebrow"
      [title]="title"
      [subtitle]="subtitle"
      [backLabel]="backLabel"
      [showPrev]="stepIndex() > 0"
      [submitLabel]="primaryLabel()"
      [submitting]="submitting()"
      [blockReason]="blockText()"
      [hint]="hint()"
      (cancelled)="leave()"
      (prev)="goToStep(stepIndex() - 1)"
      (submitted)="primary()"
    >
      <div class="body">
        <app-wizard-steps
          [steps]="steps()"
          [activeIndex]="stepIndex()"
          [ariaLabel]="stepsAria"
          [caption]="stepCaption()"
          (stepSelect)="goToStep($event)"
        />

        <form [formGroup]="form" class="stage" (ngSubmit)="primary()">
          <!-- ══ STEP 1 — HOW THE INCOME IS PROVED ══════════════════════════ -->
          <!-- FIRST, because everything step 3 shows branches on it and because the board's
               chip answers exactly this question — so arriving from a chip opens on step 2
               with this one behind, answered, rather than on a question already settled. -->
          @if (stepIndex() === 0) {
            <section class="step">
              <h2 class="step-h" i18n="@@pcn.basis_h">How does the bank prove the income?</h2>
              <app-income-basis-cards
                [value]="basis()"
                [ariaLabel]="basisAria"
                [effects]="basisEffects"
                groupName="pcn-income-basis"
                (picked)="pickBasis($event)"
              />
            </section>
          }

          <!-- ══ STEP 2 — WHAT IT IS CALLED ═════════════════════════════════ -->
          @if (stepIndex() === 1) {
            <section class="step">
              <h2 class="step-h" i18n="@@pcn.name_h">What is this program called?</h2>
              <!-- The step-1 answer, read back. It is the platform's own word for the type
                   ("Income proof" / "Surrogate") and not a description of the document, so
                   the chip here matches the board's chips and the wire value behind them.
                   Absent rather than guessed when nothing is picked: this step is reachable
                   with the basis unanswered (a deep link with no basis query param clamps to
                   it), and
                   a chip naming the default would report a decision nobody made. -->
              @if (basis(); as b) {
                <p class="basis-read">
                  <span class="basis-read-label" i18n="@@pcn.basis_read">Program type</span>
                  <span class="basis-tag" [class.is-surrogate]="b === 'no_payslip'">{{
                    basisLabel(b)
                  }}</span>
                </p>
              }
              <!-- One name in two locales is ONE decision, so the pair sits on one row.
                   Stacked, they read as two unrelated fields. -->
              <div class="pair">
                <label class="field">
                  <span class="field-label" i18n="@@lookups.field.labelEnglish">English label</span>
                  <input
                    nz-input
                    formControlName="labelEn"
                    dir="ltr"
                    [attr.maxlength]="nameMax"
                    [placeholder]="labelEnPlaceholder"
                  />
                </label>
                <label class="field">
                  <span class="field-label" i18n="@@lookups.field.labelAr">Arabic label</span>
                  <input
                    nz-input
                    formControlName="labelAr"
                    dir="rtl"
                    [attr.maxlength]="nameMax"
                    [placeholder]="labelArPlaceholder"
                  />
                </label>
              </div>
              <!-- The key is DERIVED and permanent, so it is previewed rather than typed:
                   staff curating this list had no way to judge what a key should read, and
                   a key typed by hand is immutable the moment it is saved. -->
              @if (keyPreview(); as key) {
                <p class="key">
                  <span i18n="@@pcn.key_preview">Filed under</span>
                  <code>{{ key }}</code>
                </p>
              }

              <label class="field sort">
                <span class="field-label" i18n="@@lookups.field.sortOrder">Sort order</span>
                <input nz-input type="number" formControlName="sortOrder" min="0" />
                <span class="field-hint" i18n="@@lookups.field.sortOrderHint"
                  >controls the order in dropdowns</span
                >
              </label>
            </section>
          }

          <!-- ══ STEP 3 — WHERE THE FIGURE COMES FROM ═══════════════════════ -->
          @if (stepIndex() === 2) {
            <section class="step">
              @if (basis() === 'payslip') {
                <!-- Answered, not absent. The payslip branch has one fewer DECISION; it does
                     not have one fewer fact, and a step that vanishes is what made the two
                     paths read as two different products. -->
                <h2 class="step-h" i18n="@@pcn.src_payslip_h">The payslip itself</h2>
                <p class="lede" i18n="@@pcn.src_payslip_body">
                  Every bank filing a program under this name reads the salary paid into the
                  account. There is nothing to set here.
                </p>
              } @else {
                <h2 class="step-h" i18n="@@pcn.src_h">Which calculation does it quote from?</h2>

                @if (madeProductKey(); as made) {
                  <!-- The retry state. The product landed on a previous attempt and the name
                       did not, so saying "make a new one" again would mint a second product
                       under the same words. -->
                  <p class="notice" role="status">
                    <span i18n="@@pcn.recovered"
                      >“{{ madeLabel() }}” was already created. Saving again finishes the name — it
                      will not be created twice.</span
                    >
                  </p>
                  <p class="key">
                    <code>{{ made }}</code>
                  </p>
                } @else {
                  <div class="modes" role="group" [attr.aria-label]="modesAria">
                    <button
                      type="button"
                      class="mode"
                      [class.on]="mode() === 'pick'"
                      [attr.aria-pressed]="mode() === 'pick'"
                      [disabled]="products().length === 0"
                      (click)="productMode.set('pick')"
                    >
                      <span i18n="@@pcn.src_mode_pick">Use one that exists</span>
                    </button>
                    <button
                      type="button"
                      class="mode"
                      [class.on]="mode() === 'make'"
                      [attr.aria-pressed]="mode() === 'make'"
                      (click)="productMode.set('make')"
                    >
                      <span i18n="@@pcn.src_mode_make">Start a new one</span>
                    </button>
                  </div>

                  @if (mode() === 'pick') {
                    <div class="picks" role="radiogroup" [attr.aria-label]="picksAria">
                      @for (p of products(); track p.key) {
                        <button
                          type="button"
                          class="pick"
                          role="radio"
                          [class.on]="pickedProductKey() === p.key"
                          [attr.aria-checked]="pickedProductKey() === p.key"
                          (click)="pickedProductKey.set(p.key)"
                        >
                          <span class="pick-name">{{ productLabel(p) }}</span>
                          <span class="pick-meta">{{ usedByLabel(p) }}</span>
                        </button>
                      }
                    </div>
                  } @else {
                    <!-- No dead end. This is the whole point of the merge: with no product on
                         the platform the old form refused to save and sent the operator to
                         another screen. The shapes are simply here. -->
                    @if (products().length === 0) {
                      <p class="lede" i18n="@@pcn.src_none">
                        No calculation exists yet — this is the first one.
                      </p>
                    }
                    <app-product-shape-picker
                      [value]="shapes()"
                      [ariaLabel]="shapesAria"
                      (toggled)="toggleShape($event)"
                    />

                    @if (shapes().length > 0) {
                      <div class="make-name">
                        <h3 class="step-h sub" i18n="@@pcn.make_name_h">
                          What is the calculation called?
                        </h3>
                        <p class="lede" i18n="@@pcn.make_name_sub">
                          Operators filing programs under this name will look for it by these words.
                          Its figures come next.
                        </p>
                        <div class="pair">
                          <label class="field">
                            <span class="field-label" i18n="@@lookups.field.labelEnglish"
                              >English label</span
                            >
                            <input
                              nz-input
                              formControlName="productLabelEn"
                              dir="ltr"
                              [attr.maxlength]="productMax"
                            />
                          </label>
                          <label class="field">
                            <span class="field-label" i18n="@@lookups.field.labelAr"
                              >Arabic label</span
                            >
                            <input
                              nz-input
                              formControlName="productLabelAr"
                              dir="rtl"
                              [attr.maxlength]="productMax"
                            />
                          </label>
                        </div>
                      </div>
                    }
                  }
                }
              }
            </section>
          }

          @if (errorMessage(); as message) {
            <p class="error" role="alert">{{ message }}</p>
          }
        </form>
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
        gap: var(--space-5);
      }
      .stage {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
      }
      .step {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        animation: step-in var(--motion-duration-base) var(--motion-easing-standard) both;
      }
      @keyframes step-in {
        from {
          opacity: 0;
          transform: translateY(4px);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }
      .step-h {
        margin: 0;
        font-size: var(--text-lg);
        font-weight: var(--font-weight-semibold);
        line-height: var(--line-height-tight);
        color: var(--color-text-primary);
      }
      .step-h.sub {
        font-size: var(--text-md);
      }
      /* SECONDARY, not tertiary: these sentences are read every time, and tertiary lands
         under 4.5:1 at this size. */
      .lede {
        margin: 0;
        max-inline-size: 62ch;
        font-size: var(--text-sm);
        line-height: var(--line-height-base);
        color: var(--color-text-secondary);
      }
      /* The step itself runs the full page — its two card grids are the whole point of
         the width. A ROW OF TEXT FIELDS is not: stretched across 1440px it puts a label
         and its value at opposite ends of the screen, so the measure cap lives here,
         on the fields, rather than on the step that holds the cards. */
      .pair {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: var(--space-4);
        align-items: start;
        max-inline-size: 62rem;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        min-inline-size: 0;
      }
      /* A sort order is one or two digits; a full-width box for it made the least
         important field on the form the widest thing on it. */
      .field.sort {
        max-inline-size: 240px;
      }
      .field-label {
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
      }
      .field-hint {
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
      }
      /* A read-back, not a control: the answer is changed on step 1, which the rail
         directly above this line already reaches. */
      .basis-read {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0;
      }
      .basis-read-label {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }
      .basis-tag {
        flex: none;
        padding-inline: var(--space-2);
        padding-block: 1px;
        border-radius: var(--radius-pill);
        background: var(--color-surface-muted);
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        white-space: nowrap;
      }
      /* Plum, the hue the no-payslip concept owns board-wide — the same distinction the
         catalog card draws with its leading edge, so the two screens agree on which of
         the two types is the one being looked at. */
      .basis-tag.is-surrogate {
        background: color-mix(in srgb, var(--color-income-surrogate) 14%, transparent);
        color: var(--color-income-surrogate);
      }
      .key {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0;
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
      }
      .key code {
        /* Browsers give <code> a smaller monospace default, which rendered the key at
           10.8px beside a 12px label. Hold it to the line it sits on. */
        font-size: 1em;
        padding: 2px var(--space-2);
        border-radius: var(--radius-sm);
        background: var(--bg-muted);
        font-family: var(--font-mono);
        color: var(--color-text-primary);
      }

      /* One control, two segments — an inset track with the live segment raised, so the
         pair reads as one question rather than as two unrelated buttons. The token pair
         is directional in BOTH themes, which --bg-subtle/--bg-muted are not. */
      .modes {
        display: inline-flex;
        gap: var(--space-1);
        padding: var(--space-1);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-pill);
        background: var(--color-surface-page);
      }
      .mode {
        min-block-size: 40px;
        padding-inline: var(--space-4);
        border: 1px solid transparent;
        border-radius: var(--radius-pill);
        background: transparent;
        color: var(--color-text-secondary);
        font: inherit;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        cursor: pointer;
        transition:
          background var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .mode:hover:not(.on):not(:disabled) {
        color: var(--color-text-primary);
      }
      .mode:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }
      .mode.on {
        background: var(--color-surface-default);
        border-color: color-mix(in srgb, var(--primary) 24%, var(--color-border-default));
        color: var(--color-text-primary);
      }
      .mode:focus-visible {
        outline: none;
        box-shadow: var(--focus-halo);
      }
      /* 44px on touch. The segment is the control that decides what the rest of the step
         asks, and 40px is under the floor. */
      @media (hover: none) {
        .mode {
          min-block-size: 44px;
        }
      }

      .picks {
        display: grid;
        gap: var(--space-3);
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
      }
      .pick {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        padding: var(--space-4);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        background: var(--bg-surface);
        color: inherit;
        font: inherit;
        text-align: start;
        cursor: pointer;
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .pick:hover:not(.on) {
        border-color: var(--color-border-strong);
      }
      .pick:focus-visible {
        outline: none;
        box-shadow: var(--focus-halo);
      }
      .pick.on {
        border-color: var(--color-income-surrogate);
        background: color-mix(in srgb, var(--color-income-surrogate) 5%, var(--bg-surface));
      }
      .pick-name {
        font-size: var(--text-md);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .pick-meta {
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
      }

      .make-name {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        padding-block-start: var(--space-4);
        border-block-start: 1px solid var(--color-border-default);
      }

      /* Sentences, not cards — they keep the reading measure the step gave up. */
      .notice,
      .error {
        max-inline-size: 62rem;
      }
      .notice {
        margin: 0;
        padding: var(--space-3) var(--space-4);
        border: 1px solid color-mix(in srgb, var(--color-warning) 32%, transparent);
        border-radius: var(--radius-md);
        background: color-mix(in srgb, var(--color-warning) 8%, transparent);
        font-size: var(--text-sm);
        line-height: var(--line-height-base);
        color: var(--color-text-primary);
      }
      .error {
        margin: 0;
        padding: var(--space-2) var(--space-3);
        border-radius: var(--radius-md);
        background: var(--color-error-bg);
        color: var(--color-error);
        font-size: var(--text-sm);
      }
      @media (prefers-reduced-motion: reduce) {
        .step,
        .mode,
        .pick {
          animation: none;
          transition: none;
        }
      }
    `,
  ],
})
export class NewProgramNamePage {
  private readonly lookups = inject(LookupsApiService);
  private readonly programs = inject(BankProgramsApiService);
  private readonly errors = inject(ErrorCodeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly isAr = inject(LOCALE_ID).startsWith('ar');

  /** Program names must fit `bank_program.friendlyName`; a product answers to nothing. */
  protected readonly nameMax = 120;
  protected readonly productMax = 160;

  protected readonly form = new FormGroup({
    labelEn: new FormControl<string>('', { nonNullable: true }),
    labelAr: new FormControl<string>('', { nonNullable: true }),
    sortOrder: new FormControl<number>(0, { nonNullable: true }),
    productLabelEn: new FormControl<string>('', { nonNullable: true }),
    productLabelAr: new FormControl<string>('', { nonNullable: true }),
  });

  /**
   * The form as a signal, so the rail, the block reason and the summary all recompute from
   * one source. No `Validators` anywhere on this form: what makes it savable is
   * `blockReason(draft)`, which is a pure recomputation on every change — the drawer this
   * replaces attached `Validators.required` from inside a click handler, so a state the
   * operator never clicked through stayed savable and was refused by the server instead.
   */
  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  /**
   * `null` is the UNANSWERED state, and it is reachable on purpose. Seeded from the chip the
   * operator was standing on, which is what lets ONE button serve both sides of the board;
   * `all`, absent or junk all read as "no opinion", never as payslip.
   */
  protected readonly basis = signal<IncomeBasis | null>(this.initialBasis());
  protected readonly productMode = signal<'pick' | 'make'>('pick');
  protected readonly pickedProductKey = signal<string | null>(null);
  /**
   * Every way the new calculation reaches its figure, in PICK order.
   *
   * A list rather than one value because a product several banks sell is normally reached
   * more than one way, and the order is what names the slots a bank's figures hang off
   * (`waySlot`: first is `primary`, second is `alt`) — so it is appended to, never sorted.
   */
  protected readonly shapes = signal<readonly string[]>([]);
  /**
   * A product this flow already wrote, on an attempt whose second write failed.
   *
   * Deliberately NOT cleared in the `finally`: it is what stops a retry minting a second
   * product under the same words. A compensating DELETE would be worse — fired on a timeout
   * that actually succeeded, it destroys a real object.
   */
  protected readonly madeProductKey = signal<string | null>(null);
  protected readonly products = signal<readonly SurrogateProductSummary[]>([]);

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly stepIndex = signal(this.initialStep());

  protected readonly eyebrow = $localize`:@@pcn.eyebrow:Program catalog`;
  protected readonly title = $localize`:@@program_catalog.dialog.add:Add program`;
  protected readonly subtitle = $localize`:@@pcn.subtitle:A catalog name banks file their programs under. It starts offered under no loan type — you pick those next, on its own page.`;
  protected readonly backLabel = $localize`:@@pcn.back:Back to the catalog`;
  protected readonly submitLabel = $localize`:@@program_catalog.dialog.add_cta:Add program`;
  protected readonly nextLabel = $localize`:@@pcn.next:Next`;
  protected readonly stepsAria = $localize`:@@pcn.steps_aria:Adding a program name`;
  protected readonly basisAria = $localize`:@@pcn.basis_aria:How the bank proves the income`;
  protected readonly modesAria = $localize`:@@pcn.modes_aria:Use an existing calculation or start a new one`;
  protected readonly picksAria = $localize`:@@pcn.picks_aria:Calculations already on the platform`;
  protected readonly shapesAria = $localize`:@@spt.title:How does the bank work the income out?`;
  protected readonly labelEnPlaceholder = $localize`:@@pcn.eg_en:e.g. Doctors — Practice`;
  protected readonly labelArPlaceholder = $localize`:@@pcn.eg_ar:مثال: أطباء — عيادة`;

  /**
   * What each answer commits the operator to, said on the card before it is picked.
   *
   * The host's, not the component's: the program wizard's version of this line names ITS
   * later steps, which is true there and meaningless here.
   */
  protected readonly basisEffects: Partial<Record<IncomeBasis, string>> = {
    payslip: $localize`:@@pcn.effect_payslip:Pick this and the name is sold against a salary the bank can see. Name it next, and the last step has nothing to set.`,
    no_payslip: $localize`:@@pcn.effect_no_payslip:Pick this and the last step asks which calculation the name quotes from — one that exists, or a new one you start here.`,
  };

  constructor() {
    void this.loadProducts();
  }

  // --- the draft -------------------------------------------------------------

  /** Which product a surrogate name takes its calculation from, as answered so far. */
  private readonly productChoice = computed<ProductChoice | null>(() => {
    if (this.basis() !== 'no_payslip') return null;
    if (this.mode() === 'pick') {
      const key = this.pickedProductKey();
      return key === null ? null : { kind: 'existing', key };
    }
    const shapes = this.shapes();
    if (shapes.length === 0) return null;
    const v = this.formValue();
    return {
      kind: 'new',
      shapes,
      labelEn: v.productLabelEn ?? '',
      labelAr: v.productLabelAr ?? '',
    };
  });

  protected readonly draft = computed<NewNameDraft>(() => {
    const v = this.formValue();
    return {
      labelEn: v.labelEn ?? '',
      labelAr: v.labelAr ?? '',
      basis: this.basis(),
      product: this.productChoice(),
      madeProductKey: this.madeProductKey(),
    };
  });

  /**
   * The mode actually in force.
   *
   * Derived rather than defaulted by an effect: with nothing on the platform "use one that
   * exists" is not a choice, and a mode the operator has to switch out of before the screen
   * shows them anything is the dead end this flow was built to remove.
   */
  protected readonly mode = computed<'pick' | 'make'>(() =>
    this.products().length === 0 ? 'make' : this.productMode(),
  );

  protected readonly keyPreview = computed<string | null>(() => {
    const key = slugify(this.formValue().labelEn ?? '');
    return key === '' ? null : key;
  });

  protected readonly steps = computed<WizardStepItem[]>(() => {
    const statuses = stepStatuses(this.draft());
    return [
      $localize`:@@pcn.step_basis:How the income is proved`,
      $localize`:@@pcn.step_name:What it is called`,
      $localize`:@@pcn.step_source:Where the figure comes from`,
    ].map((label, i) => ({
      id: `s${i}`,
      label,
      status: statuses[i]!.status,
      disabled: statuses[i]!.disabled,
    }));
  });

  protected stepCaption(): string {
    switch (this.stepIndex()) {
      case 0:
        return $localize`:@@pcn.cap_basis:It can be changed later, on the name's own page.`;
      case 1:
        return $localize`:@@pcn.cap_name:Both languages. The customer app shows the one they read.`;
      default:
        return this.basis() === 'payslip'
          ? $localize`:@@pcn.cap_source_payslip:Nothing to set — the bank reads the salary it is paid.`
          : $localize`:@@pcn.cap_source_surrogate:The calculation every bank filing under this name will quote from.`;
    }
  }

  protected readonly isLast = computed(() => this.stepIndex() >= LAST_STEP);

  /**
   * The bar's primary, which is the CURRENT STEP's action rather than a create button that
   * spends most of the flow greyed out.
   *
   * A create-only primary made step 1 a dead end: pick an income basis and the only enabled
   * control left in the footer was Cancel, so moving on meant knowing to click the rail. And
   * the reason beside it named the labels — a field two steps away and not on screen.
   *
   * Keyed on the STEP and not on whether the draft happens to be finished. Keyed on
   * completeness it flipped to Create under the operator's hand mid-flow — which skipped the
   * step whose whole job is to read back what will be written on the payslip branch, and left
   * a step you could leave backwards but not forwards once the Previous button existed.
   */
  protected readonly primaryLabel = computed(() =>
    this.isLast() ? this.submitLabel : this.nextLabel,
  );

  protected primary(): void {
    if (this.isLast()) {
      // Guarded by `doSave` itself: on this step the bar reports the WHOLE draft's refusal,
      // so an unfinished draft leaves the button disabled rather than saving.
      this.save();
      return;
    }
    this.goToStep(this.stepIndex() + 1);
  }

  /**
   * The refusal, in words: why THIS step cannot be left, or — once everything is answered —
   * nothing, so the hint takes over and says what Save will do.
   *
   * The rule is `barBlock`'s; the wording is this screen's. `blockReason` still guards the
   * write itself in `doSave`, so a step-scoped message can never widen what is savable.
   */
  protected blockText(): string | null {
    const reason: NewNameBlock = barBlock(this.draft(), this.stepIndex());
    switch (reason) {
      case 'labels':
        return $localize`:@@pcn.block_name:Give it a name in both languages.`;
      case 'labels_key':
        return $localize`:@@pcn.block_name_latin:The English name needs at least one letter or digit — it becomes the key.`;
      case 'basis':
        return $localize`:@@pcn.block_basis:Say how the income is proved.`;
      case 'product':
        return this.mode() === 'pick'
          ? $localize`:@@pcn.block_product:Pick the calculation this name quotes from.`
          : this.shapes().length === 0
            ? $localize`:@@pcn.block_shape:Pick at least one way the new calculation reaches its figure.`
            : $localize`:@@pcn.block_product_name:Name the new calculation in both languages.`;
      default:
        return null;
    }
  }

  /** What Save will do, said before it is clicked rather than discovered afterwards. */
  protected hint(): string | null {
    // Keyed on the step, like the button it sits beside: a step whose primary MOVES says where
    // it moves to, and the summary of what will be written belongs on the step that writes it.
    // On that step an unfinished draft is reported by `blockText` instead, so this line is
    // never a summary of a plan the operator cannot yet save.
    if (!this.isLast()) {
      const next = this.stepIndex() + 1;
      const label = this.steps()[next]?.label;
      return label === undefined ? null : $localize`:@@pcn.next_hint:Next: ${label}:STEP:`;
    }
    const name = this.formValue().labelEn ?? '';
    const plan = savePlan(this.draft());
    if (plan.product !== null) {
      // Says how many ways it will open with, because that is the half of the plan the
      // operator cannot re-read from the fields above: the ticks are a few hundred pixels up
      // and the count is what tells them the second one registered.
      return plan.shapes.length > 1
        ? $localize`:@@pcn.summary_make_ways:Creates “${plan.product.labelEn}:PRODUCT:” with ${plan.shapes.length}:COUNT: ways to reach its figure, then “${name}:NAME:” linked to it, and opens the calculation to fill in.`
        : $localize`:@@pcn.summary_make:Creates “${plan.product.labelEn}:PRODUCT:”, then “${name}:NAME:” linked to it, and opens the calculation to fill in.`;
    }
    if (plan.link.kind === 'existing') {
      return $localize`:@@pcn.summary_link:Creates “${name}:NAME:”, quoting from “${this.linkedLabel(plan.link.key)}:PRODUCT:”.`;
    }
    return $localize`:@@pcn.summary_payslip:Creates “${name}:NAME:”, sold against a payslip.`;
  }

  // --- rendering helpers -----------------------------------------------------

  /** Arabic primary — a picker that fell back to English keys would be the one place an
   * operator has to read a slug. */
  /** The platform's word for the income type picked on step 1. */
  protected basisLabel(basis: IncomeBasis): string {
    return incomeBasisLabel(basis);
  }

  protected productLabel(row: SurrogateProductSummary): string {
    return this.isAr ? row.labelAr : row.labelEn;
  }

  protected usedByLabel(row: SurrogateProductSummary): string {
    return row.usedBy.length === 0
      ? $localize`:@@pcn.product_unused:No name sells this yet`
      : $localize`:@@pcn.product_used_by:Used by ${row.usedBy.length}:COUNT: names`;
  }

  protected madeLabel(): string {
    const key = this.madeProductKey();
    const known = this.products().find((p) => p.key === key);
    return known ? this.productLabel(known) : (this.formValue().productLabelEn ?? key ?? '');
  }

  private linkedLabel(key: string): string {
    const known = this.products().find((p) => p.key === key);
    return known ? this.productLabel(known) : key;
  }

  // --- navigation ------------------------------------------------------------

  protected pickBasis(basis: IncomeBasis): void {
    this.basis.set(basis);
  }

  /**
   * Tick or untick one way of reaching the figure.
   *
   * Appended rather than inserted in the picker's own order: the first way picked becomes the
   * `primary` slot and the second `alt`, and those ids are what a bank's figures are keyed by.
   * Re-sorting the list would move a figure for a reason the operator cannot see.
   */
  protected toggleShape(key: string): void {
    this.shapes.update((keys) =>
      keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key],
    );
  }

  /**
   * Step index mirrors to `?step=`, the house convention: the signal is truth, the URL
   * follows with `replaceUrl` so flipping steps does not fill the back button, and the
   * initial value is read from the snapshot so a reload lands where the operator was.
   */
  protected goToStep(index: number): void {
    if (index === 2 && this.basis() === null) return;
    this.stepIndex.set(index);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { step: index + 1 },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected leave(): void {
    void this.router.navigate([CATALOG_BASE], {
      queryParams: this.basis() !== null ? { basis: this.basis() } : {},
    });
  }

  private initialBasis(): IncomeBasis | null {
    const raw = this.route.snapshot.queryParamMap.get('basis');
    return raw === 'payslip' || raw === 'no_payslip' ? raw : null;
  }

  /**
   * A pasted `?step=3` must not land on an empty form: clamp to the first step that still
   * owes an answer, so a deep link is a shortcut and never a skip.
   *
   * With no `?step=` at all the landing depends on whether the CHIP already answered step 1:
   * seeded, the screen opens on the name, because opening on a question that is already
   * answered is what makes a step read as skippable — and it is the chip's whole job to save
   * that click. Unseeded (the board's `All`), it opens on the basis radios, which is the one
   * thing that must be asked before the form branches.
   */
  private initialStep(): number {
    const raw = Number(this.route.snapshot.queryParamMap.get('step'));
    if (!Number.isFinite(raw) || raw === 0) return this.basis() === null ? 0 : 1;
    const wanted = Math.min(Math.max(raw - 1, 0), 2);
    return this.basis() === null ? Math.min(wanted, 1) : wanted;
  }

  // --- save ------------------------------------------------------------------

  /** Fire-and-forget for the template: Angular's parser has no `void` operator. */
  protected save(): void {
    void this.doSave();
  }

  private async doSave(): Promise<void> {
    // The shell disables the button, but the two-write path guards re-entry itself.
    if (this.submitting() || blockReason(this.draft()) !== null) return;
    this.submitting.set(true);
    this.errorMessage.set(null);
    try {
      const plan = savePlan(this.draft());
      const v = this.form.getRawValue();
      let link = plan.link.kind === 'existing' ? plan.link.key : null;

      // The product FIRST when one is being made. The order is the server's, not a
      // preference: a no-payslip name is refused while nothing says how its income is
      // worked out, and the link has to name a live product row.
      if (plan.product !== null) {
        const created = await this.lookups.create({
          type: SURROGATE_PRODUCT_TYPE,
          key: await this.uniqueKey(SURROGATE_PRODUCT_TYPE, plan.product.labelEn),
          labelEn: plan.product.labelEn,
          labelAr: plan.product.labelAr,
        });
        // Recorded BEFORE the next write can fail, which is the whole point of the signal.
        this.madeProductKey.set(created.key);
        link = created.key;
      }

      const name = await this.lookups.create({
        type: ENUM_TYPE,
        key: await this.uniqueKey(ENUM_TYPE, v.labelEn),
        labelEn: v.labelEn,
        labelAr: v.labelAr,
        sortOrder: v.sortOrder,
        // Sent on every path. A create that assigns no loan categories stores none of this,
        // but it is what SURROGATE_PRODUCT_REQUIRED reads on the way in — dropping it would
        // turn the server's one guard against a name that quotes nothing into a no-op.
        incomeBases: [...plan.incomeBases],
        // Absent, never '' or null: the DTO refuses both spellings.
        ...(link !== null ? { surrogateProductKey: link } : {}),
      });

      // A shape means a calculation is still owed, whether it was made on this attempt or a
      // previous one — so the operator is put in front of the form for it, and `then` brings
      // them back to the name they were making. Comma-joined in pick order: the calculation
      // screen seeds the first as the primary way and the rest as the others.
      if (plan.shapes.length > 0 && link !== null) {
        void this.router.navigate([PRODUCT_BASE, link, 'calculation'], {
          queryParams: { from: plan.shapes.join(','), then: name.key },
        });
        return;
      }
      const landing = newNameLanding(name.key);
      void this.router.navigate(landing.commands, { queryParams: landing.queryParams });
    } catch (err) {
      const envelope = (err as { error?: { code?: string; meta?: Record<string, unknown> } })
        ?.error;
      this.errorMessage.set(
        this.errors.toLocalizedMessage(
          (envelope?.code ?? 'INTERNAL_ERROR') as ErrorCode,
          envelope?.meta,
        ),
      );
      // The picked product may have been retired from under us between load and save. Re-read
      // rather than pre-check: the server is the rule, and a stale pick would repeat the same
      // refusal on every retry.
      await this.loadProducts();
      const picked = this.pickedProductKey();
      if (picked !== null && !this.products().some((p) => p.key === picked)) {
        this.pickedProductKey.set(null);
      }
    } finally {
      this.submitting.set(false);
    }
  }

  /**
   * Free key for a derived slug: `doctors`, else `doctors_2`, `doctors_3`…
   *
   * Two values may legitimately share an English label, and the key is not typeable — so a
   * raw ENUMERATION_KEY_DUPLICATE here would name a field the operator never saw. The server
   * still enforces the unique; this only keeps the ordinary case from surfacing as an
   * unactionable error.
   *
   * Program names are additionally held off the RESERVED keys: `/program-catalog/new` and
   * `/program-catalog/products` are literal segments declared before the single-segment
   * `:key`, so a name keyed `new` would be saved, listed, and impossible to open.
   */
  private async uniqueKey(type: string, label: string): Promise<string> {
    const reserved = type === ENUM_TYPE ? RESERVED_NAME_KEYS : new Set<string>();
    try {
      const rows = await this.lookups.list(type);
      return uniqueSlug(label, new Set([...rows.map((r) => r.key), ...reserved]));
    } catch {
      // The list read is a courtesy — the server enforces the unique either way, and refusing
      // to save because a GET failed would be the worse answer.
      return uniqueSlug(label, reserved);
    }
  }

  private async loadProducts(): Promise<void> {
    try {
      const res = await this.programs.listSurrogateProducts();
      // ACTIVE only: this is a point of CHOICE, and offering a retired product would be
      // offering a save the server refuses.
      this.products.set(res.data.filter((p) => p.active));
    } catch {
      this.products.set([]);
    }
  }
}
