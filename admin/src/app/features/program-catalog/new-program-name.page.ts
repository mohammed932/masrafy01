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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
import { ENUM_TYPE } from './program-name-row';
import { CATALOG_BASE, newNameLanding, surrogateBoardLink } from './program-catalog.paths';
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

@Component({
  selector: 'app-new-program-name-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NzInputModule,
    FormPageComponent,
    WizardStepsComponent,
    IncomeBasisCardsComponent,
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

                @if (products().length === 0) {
                  <!-- Not a dead end and not a hidden control: every calculation on the
                       platform is switched off, so there is genuinely nothing to quote from,
                       and the operator is told where the switch is. -->
                  <p class="notice" role="status">
                    <span i18n="@@pcn.src_all_off"
                      >Every calculation is switched off, so there is nothing for a no-payslip name
                      to quote from. Turn one back on in the catalog, then come back.</span
                    >
                  </p>
                  <p class="key">
                    <a
                      [routerLink]="surrogateBoard.commands"
                      [queryParams]="surrogateBoard.queryParams"
                      i18n="@@pcn.src_all_off_link"
                      >Open the calculations</a
                    >
                  </p>
                } @else {
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
                        <span class="pick-meta">{{ productReads(p) }}</span>
                      </button>
                    }
                  </div>
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
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
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
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
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

  /** Program names must fit `bank_program.friendlyName`. */
  protected readonly nameMax = 120;

  protected readonly form = new FormGroup({
    labelEn: new FormControl<string>('', { nonNullable: true }),
    labelAr: new FormControl<string>('', { nonNullable: true }),
    sortOrder: new FormControl<number>(0, { nonNullable: true }),
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
  protected readonly pickedProductKey = signal<string | null>(null);
  /**
   * The calculations this name could quote from — LIVE ones only, and cap-only products
   * excluded.
   *
   * Both filters mirror a server refusal, so the picker never offers something the save
   * would reject: `resolveSurrogateProductKey` refuses a link to a switched-off product
   * (`reason: 'inactive'`), and a cap-only product works out no income at all
   * (`SURROGATE_PRODUCT_CAP_ONLY`).
   */
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
  protected readonly picksAria = $localize`:@@pcn.picks_aria:Calculations already on the platform`;
  /** Where a name whose product is switched off gets un-blocked. */
  protected readonly surrogateBoard = surrogateBoardLink();
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
    no_payslip: $localize`:@@pcn.effect_no_payslip:Pick this and the last step asks which of the platform's calculations the name quotes from.`,
  };

  constructor() {
    void this.loadProducts();
  }

  // --- the draft -------------------------------------------------------------

  /** Which product a surrogate name takes its calculation from, as answered so far. */
  private readonly productChoice = computed<ProductChoice | null>(() => {
    if (this.basis() !== 'no_payslip') return null;
    const key = this.pickedProductKey();
    return key === null ? null : { kind: 'existing', key };
  });

  protected readonly draft = computed<NewNameDraft>(() => {
    const v = this.formValue();
    return {
      labelEn: v.labelEn ?? '',
      labelAr: v.labelAr ?? '',
      basis: this.basis(),
      product: this.productChoice(),
    };
  });

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
        // Two different sentences, because they are two different problems and only one of
        // them is the operator's to fix here: nothing PICKED, versus nothing to pick.
        return this.products().length === 0
          ? $localize`:@@pcn.block_no_products:No calculation is switched on, so this name cannot quote from one yet.`
          : $localize`:@@pcn.block_product:Pick the calculation this name quotes from.`;
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

  /**
   * What this calculation works the income out from, at the point of choosing it.
   *
   * The count of names that already sell it — which is what this line used to say — answers a
   * question nobody has while picking: two products called "Doctors" and "Professionals" are
   * told apart by what they READ, not by how popular they are.
   */
  protected productReads(row: SurrogateProductSummary): string {
    const ways =
      (row.wayCount ?? 1) > 1
        ? $localize`:@@pcn.product_ways:${row.wayCount ?? 1}:COUNT: ways`
        : $localize`:@@pcn.product_one_way:one way`;
    return row.outputKind === 'maxAmount'
      ? $localize`:@@pcn.product_reads_ceiling:A borrowing ceiling, ${ways}:WAYS:`
      : $localize`:@@pcn.product_reads_income:An assumed income, ${ways}:WAYS:`;
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
    if (this.submitting() || blockReason(this.draft()) !== null) return;
    this.submitting.set(true);
    this.errorMessage.set(null);
    try {
      const plan = savePlan(this.draft());
      const v = this.form.getRawValue();
      // ONE write. This flow used to be able to create a PRODUCT first and then the name
      // linked to it, which needed a recorded key so a retry could not mint a second
      // product. A product is not created here any more, so the two-write ordering, the
      // recovery signal and the reason both existed are gone with it.
      const link = plan.link.kind === 'existing' ? plan.link.key : null;

      const name = await this.lookups.create({
        type: ENUM_TYPE,
        key: await this.uniqueKey(v.labelEn),
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
  /**
   * The key for the NAME, avoiding both the taken ones and the two the router would eat.
   *
   * One type now, where it took a `type` parameter and served two: this flow no longer
   * creates a product, so the only key it mints is a catalog name's — and the reserved set
   * applied to that one alone.
   */
  private async uniqueKey(label: string): Promise<string> {
    try {
      const rows = await this.lookups.list(ENUM_TYPE);
      return uniqueSlug(label, new Set([...rows.map((r) => r.key), ...RESERVED_NAME_KEYS]));
    } catch {
      // The list read is a courtesy — the server enforces the unique either way, and refusing
      // to save because a GET failed would be the worse answer.
      return uniqueSlug(label, RESERVED_NAME_KEYS);
    }
  }

  private async loadProducts(): Promise<void> {
    try {
      const res = await this.programs.listSurrogateProducts();
      // TWO filters, and each mirrors a refusal the server would raise AFTER the click:
      // a switched-off product cannot be linked to (`reason: 'inactive'`), and a cap-only
      // product works out no income at all (`SURROGATE_PRODUCT_CAP_ONLY`) — it asks its
      // question and each bank states the maximum for the answer on its own program. A
      // cap-only product states no `outputKind`, which is how it is known here without the
      // admin carrying its own copy of the blueprint library.
      this.products.set(res.data.filter((p) => p.active && p.outputKind !== null));
    } catch {
      this.products.set([]);
    }
  }
}
