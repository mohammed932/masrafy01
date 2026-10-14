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
import { NzModalService } from 'ng-zorro-antd/modal';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode } from '@core/auth/auth.types';
import { incomeBasisLabel, type IncomeBasis } from '@core/income-basis';
import { categoryLabel, type LoanCategory } from '@core/loan-category';
import {
  FormPageComponent,
  IncomeBasisCardsComponent,
  LoanCategorySwitchesComponent,
  WizardStepsComponent,
} from '@shared/ui';
import type { WizardStepItem } from '@shared/ui/wizard-steps.component';
import { toAskablePool } from '@shared/questions/to-askable';
import { CompactAskedQuestionsComponent } from '@shared/questions/compact-asked-questions.component';
import {
  coreProblems,
  pendingAdds,
  type AskableQuestion,
  type AskedPicks,
  type AskedRow,
} from '@shared/questions/asked-questions.rules';
import { LookupsApiService } from '@features/lookups/lookups.api.service';
import { slugify, uniqueSlug } from '@shared/lookups/slug';
import { BankProgramsApiService } from '@features/bank-programs/bank-programs.api.service';
import type { SurrogateProductSummary } from '@features/bank-programs/bank-programs.types';
import {
  QuestionnaireApiService,
} from '@features/questionnaire/questionnaire.api.service';
import { ENUM_TYPE } from './program-name-row';
import { CATALOG_BASE, newNameLanding, surrogateBoardLink } from './program-catalog.paths';
import {
  RESERVED_NAME_KEYS,
  barBlock,
  blockReason,
  isLastStep,
  newNameStepIds,
  savePlan,
  stepIdAt,
  stepIndexOf,
  stepStatuses,
  type NewNameBlock,
  type NewNameDraft,
  type NewNameStepId,
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
    LoanCategorySwitchesComponent,
    CompactAskedQuestionsComponent,
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
          <!-- ══ STEP ① — WHAT IT IS ════════════════════════════════════════
               The income basis and the two labels on ONE step. They were two, and each
               held one question: the basis was two cards and nothing else, the name two
               fields and nothing else — and the board's chip had usually answered the
               first before the operator arrived. The basis still leads, inside the step,
               because it decides whether there is a calculation step at all. -->
          @if (step() === 'program') {
            <section class="step">
              <h2 class="step-h" i18n="@@pcn.basis_h">How does the bank prove the income?</h2>
              <app-income-basis-cards
                [value]="basis()"
                [ariaLabel]="basisAria"
                [effects]="basisEffects"
                groupName="pcn-income-basis"
                (picked)="pickBasis($event)"
              />

              <h2 class="step-h sub" i18n="@@pcn.name_h">What is this program called?</h2>
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
                <label class="field sort">
                  <span class="field-label" i18n="@@lookups.field.sortOrder">Sort order</span>
                  <input nz-input type="number" formControlName="sortOrder" min="0" />
                  <span class="field-hint" i18n="@@lookups.field.sortOrderHint"
                    >controls the order in dropdowns</span
                  >
                </label>
              </div>

              <!-- DERIVED, never typed: staff curating this list had no way to judge what
                   a key should read, and a key typed by hand is immutable the moment it is
                   saved. -->
              @if (keyPreview(); as key) {
                <p class="key">
                  <span i18n="@@pcn.key_preview">Filed under</span>
                  <code dir="ltr">{{ key }}</code>
                </p>
              }
            </section>
          }

          <!-- ══ STEP ② — WHERE THE FIGURE COMES FROM (surrogate only) ═══════
               A step only a no-payslip name walks. The payslip branch used to render a
               sentence here and no control — a step that could not be answered, could not
               be wrong, and could not be skipped. The sentence it stated now sits on the
               income card above, which is what it was about. -->
          @if (step() === 'calculation') {
            <section class="step">
              <h2 class="step-h" i18n="@@pcn.src_h">Which calculation does it quote from?</h2>

              @if (products().length === 0) {
                <!-- Not a dead end and not a hidden control: every calculation on the
                     platform is switched off, so there is genuinely nothing to quote from,
                     and the operator is told where the switch is. -->
                <p class="notice" role="status">
                  <span i18n="@@pcn.src_all_off"
                    >Every calculation is switched off, so there is nothing for a no-payslip name to
                    quote from. Turn one back on in the catalog, then come back.</span
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
            </section>
          }

          <!-- ══ STEP ③ — WHERE IT IS OFFERED ═══════════════════════════════
               Moved in from the name's own page, which is where a freshly created name
               used to be dropped to answer it. All four loan types at once: the
               assignment is ONE decision with four parts. -->
          @if (step() === 'offered') {
            <section class="step">
              <h2 class="step-h" i18n="@@pcn.offered_h">
                Which loan types is this name offered under?
              </h2>
              <p class="lede" i18n="@@pcn.offered_lede">
                A bank building a program can only pick this name under a loan type that is on here.
                The next step asks what each of those loan types' applicants answer.
              </p>
              <app-loan-category-switches [value]="offered()" (toggled)="toggleOffered($event)" />
            </section>
          }

          <!-- ══ STEP ④ — WHAT APPLICANTS ARE ASKED ═════════════════════════
               One tab per loan type the name is offered under, which is the operator's
               "some loan types are not in this program" made literal. ADD-ONLY: a tick
               widens the question's loan types, which is global — see the editor. -->
          @if (step() === 'asks') {
            <section class="step">
              <h2 class="step-h" i18n="@@pcn.asks_h">What are these applicants asked?</h2>
              @if (poolError()) {
                <p class="notice" role="status" i18n="@@pcn.asks_unavailable">
                  The question pool could not be read, so this step cannot be shown. The name will
                  still be created — set what its applicants are asked on its own page afterwards.
                </p>
              } @else {
                <!-- BLANK START. The name does not exist yet, so nothing on this board is
                     a statement about it: it opens with nothing ticked and every tick is the
                     operator's own. The questions this loan type already asks are listed in
                     the second group wearing a tag that says so — they stay asked whether or
                     not they are ticked here, because the question-to-loan-type table is
                     global and this board is add-only. -->
                <app-compact-asked-questions
                  [pool]="pool()"
                  [offered]="offered()"
                  [category]="askCategory()"
                  [picks]="picks()"
                  [search]="askSearch()"
                  [isAr]="isAr"
                  [busy]="submitting()"
                  (categorySelect)="setAskCategory($event)"
                  (searchChange)="askSearch.set($event)"
                  (add)="askToAdd($event)"
                  (remove)="askToRemove($event)"
                />
              }
            </section>
          }

          @if (errorMessage(); as message) {
            <div class="error" role="alert">
              <p class="error-text">{{ message }}</p>
              <!-- TWO exits, because the name already exists and only the additive half
                   failed. Trapping an operator on a create screen over a write they can
                   redo in two clicks on another one is the worse answer, and the button
                   beside this one is already a retry. -->
              @if (createdName() !== null) {
                <button
                  type="button"
                  class="error-out"
                  (click)="openCreated()"
                  i18n="@@pcn.skip_open"
                >
                  Skip — open the program
                </button>
              }
            </div>
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
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-3);
        margin: 0;
        padding: var(--space-2) var(--space-3);
        border-radius: var(--radius-md);
        background: var(--color-error-bg);
        color: var(--color-error);
        font-size: var(--text-sm);
      }
      .error-text {
        margin: 0;
      }
      .error-out {
        min-block-size: 44px;
        padding: 0;
        border: 0;
        background: none;
        color: inherit;
        font: inherit;
        font-weight: var(--font-weight-semibold);
        text-decoration: underline;
        cursor: pointer;
      }
      .error-out:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
        border-radius: var(--radius-sm);
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
  private readonly questionnaire = inject(QuestionnaireApiService);
  private readonly errors = inject(ErrorCodeService);
  private readonly modal = inject(NzModalService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly isAr = inject(LOCALE_ID).startsWith('ar');

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
   * absent or junk reads as "no opinion", never as payslip.
   */
  protected readonly basis = signal<IncomeBasis | null>(this.initialBasis());
  protected readonly pickedProductKey = signal<string | null>(null);
  /** The loan types the name will be offered under, written in the same insert as the row. */
  protected readonly offered = signal<readonly LoanCategory[]>([]);
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

  /** The global question pool, read on first arrival at the offer step and not before. */
  protected readonly pool = signal<readonly AskableQuestion[]>([]);
  protected readonly poolError = signal(false);
  private poolRequested = false;
  /** What the operator has ticked, per loan type, before anything is written. */
  protected readonly picks = signal<AskedPicks>(new Map<LoanCategory, ReadonlySet<string>>());
  protected readonly askSearch = signal('');
  private readonly askTab = signal<LoanCategory | null>(null);

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  /**
   * The name, once the FIRST write has landed.
   *
   * The recovery signal for a two-write finish, and it is the whole reason a retry is safe:
   * the key is minted with a collision suffix, so re-running write 1 after it succeeded would
   * create `doctors_2` rather than retrying. This flow carried the same guard once before,
   * for a product-then-name pair, and lost it when the second write went away.
   */
  protected readonly createdName = signal<{ id: string; key: string } | null>(null);

  protected readonly stepId = signal<NewNameStepId>('program');

  protected readonly eyebrow = $localize`:@@pcn.eyebrow:Program catalog`;
  protected readonly title = $localize`:@@program_catalog.dialog.add:Add program`;
  protected readonly subtitle = $localize`:@@pcn.subtitle2:A catalog name banks file their programs under. Four answers: what it is, where its figure comes from, which loan types sell it, and what those applicants are asked.`;
  protected readonly backLabel = $localize`:@@pcn.back:Back to the catalog`;
  protected readonly submitLabel = $localize`:@@program_catalog.dialog.add_cta:Add program`;
  protected readonly retryLabel = $localize`:@@pcn.retry_questions:Try the questions again`;
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
   * later steps, which is true there and meaningless here. Reworded when the payslip branch
   * stopped having a step of its own — it used to promise "the last step has nothing to set",
   * and the payslip answer now REMOVES a step rather than emptying one.
   */
  protected readonly basisEffects: Partial<Record<IncomeBasis, string>> = {
    payslip: $localize`:@@pcn.effect_payslip2:The bank reads the salary paid into the account, so there is nothing to work out — this name walks three steps.`,
    no_payslip: $localize`:@@pcn.effect_no_payslip2:The figure is worked out from something else, so one more step asks which of the platform's calculations it quotes from.`,
  };

  constructor() {
    void this.loadProducts();
    this.stepId.set(this.initialStep());
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
      offered: this.offered(),
      coreMissing: coreProblems(this.pool(), this.offered(), this.picks(), this.isAr).reduce(
        (n, p) => n + p.missing.length,
        0,
      ),
    };
  });

  protected readonly keyPreview = computed<string | null>(() => {
    const key = slugify(this.formValue().labelEn ?? '');
    return key === '' ? null : key;
  });

  /** The steps THIS name walks — three on a payslip basis, four on a surrogate one. */
  protected readonly stepIds = computed(() => newNameStepIds(this.basis()));

  /**
   * The id the operator is standing on, kept valid when the list reshapes under them.
   *
   * It can only reshape while they are on `program` — the one id both lists carry — so this
   * never moves anybody; it exists so that a pasted `?step=` or a basis flipped from a
   * deep link cannot leave the page pointing at a step that is not on the rail.
   */
  protected readonly step = computed<NewNameStepId>(() => {
    const ids = this.stepIds();
    const at = this.stepId();
    return ids.includes(at) ? at : 'program';
  });

  protected readonly stepIndex = computed(() => stepIndexOf(this.stepIds(), this.step()));

  private readonly stepLabels: Readonly<Record<NewNameStepId, string>> = {
    program: $localize`:@@pcn.step_program:What it is`,
    calculation: $localize`:@@pcn.step_source:Where the figure comes from`,
    offered: $localize`:@@pcn.step_offered:Where it is offered`,
    asks: $localize`:@@pcn.step_asks:What applicants are asked`,
  };

  protected readonly steps = computed<WizardStepItem[]>(() => {
    const statuses = stepStatuses(this.draft());
    return this.stepIds().map((id) => ({
      id,
      label: this.stepLabels[id],
      status: statuses[id].status,
      disabled: statuses[id].disabled,
    }));
  });

  protected stepCaption(): string {
    switch (this.step()) {
      case 'program':
        return $localize`:@@pcn.cap_program:Both can be changed later, on the name's own page.`;
      case 'calculation':
        return $localize`:@@pcn.cap_source_surrogate:The calculation every bank filing under this name will quote from.`;
      case 'offered':
        return $localize`:@@pcn.cap_offered:${this.offered().length}:ON: of 4 loan types are on. This is what a bank's program picker filters on.`;
      case 'asks':
        return $localize`:@@pcn.cap_asks:Ticking one asks it of every applicant of that loan type. Nothing here can stop a question being asked.`;
    }
  }

  protected readonly isLast = computed(() => isLastStep(this.stepIds(), this.step()));

  /**
   * The bar's primary, which is the CURRENT STEP's action rather than a create button that
   * spends most of the flow greyed out.
   *
   * A create-only primary made step ① a dead end: answer it and the only enabled control left
   * in the footer was Cancel, so moving on meant knowing to click the rail.
   *
   * Once the name EXISTS the button stops being a create at all — the only thing left is the
   * question write, which is what failed. Saying "Add program" there would offer to make a
   * second one.
   */
  protected readonly primaryLabel = computed(() => {
    if (this.createdName() !== null) return this.retryLabel;
    return this.isLast() ? this.submitLabel : this.nextLabel;
  });

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
   *
   * SILENT once the name exists. `barBlock` on the last step reports the whole draft, which
   * would keep naming form refusals for a name that has already been created — and would
   * re-block the retry the moment the operator touched a field between attempts.
   */
  protected blockText(): string | null {
    if (this.createdName() !== null) return null;
    const reason: NewNameBlock = barBlock(this.draft(), this.step(), this.stepIds());
    switch (reason) {
      case 'labels':
        return $localize`:@@pcn.block_name:Give it a name in both languages.`;
      case 'labels_key':
        return $localize`:@@pcn.block_name_latin:The English name needs at least one letter or digit — it becomes the key.`;
      case 'basis':
        return $localize`:@@pcn.block_basis:Say how the income is proved.`;
      case 'core':
        return $localize`:@@pcn.block_core:A loan type cannot be priced yet — ask the missing questions listed on the last step.`;
      case 'offered':
        return $localize`:@@pcn.block_offered:Turn on at least one loan type — a name offered under none can be picked by no bank.`;
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
    if (!this.isLast()) {
      const next = this.stepIds()[this.stepIndex() + 1];
      return next === undefined
        ? null
        : $localize`:@@pcn.next_hint:Next: ${this.stepLabels[next]}:STEP:`;
    }
    if (this.createdName() !== null) {
      return $localize`:@@pcn.made_not_asked:The name is created and offered. Only the questions are left — retry, or open the program and finish there.`;
    }
    const name = this.formValue().labelEn ?? '';
    const adds = this.pendingCount();
    // One string per count rather than "question(s)". The parenthesised plural is the one
    // form that is wrong in BOTH languages at once — and in Arabic it is not even a form,
    // since the noun changes rather than taking a suffix.
    if (adds === 0) {
      return $localize`:@@pcn.summary_plain:Creates “${name}:NAME:”, offered under ${this.offered().length}:COUNT: of 4 loan types. Nothing else changes.`;
    }
    if (adds === 1) {
      return $localize`:@@pcn.summary_asks_one:Creates “${name}:NAME:” and asks one more question of the loan types you picked.`;
    }
    return $localize`:@@pcn.summary_asks:Creates “${name}:NAME:” and asks ${adds}:COUNT: more questions of the loan types you picked.`;
  }

  // --- the questions step ----------------------------------------------------

  /**
   * Which tab is on stage, CLAMPED to a loan type the name is actually offered under.
   *
   * Derived rather than stored, because the offer set can move under it: un-tick the loan
   * type whose tab is open on the step before, and a stored value would point the board at a
   * category the name is no longer sold under — which the rail does not draw, so the panel
   * would render a list belonging to no visible tab.
   */
  protected readonly askCategory = computed<LoanCategory>(() => {
    const on = this.offered();
    const picked = this.askTab();
    if (picked !== null && on.includes(picked)) return picked;
    return on[0] ?? 'personal';
  });

  protected setAskCategory(category: LoanCategory): void {
    this.askTab.set(category);
  }

  protected readonly pendingCount = computed(
    () => pendingAdds(this.pool(), this.offered(), this.picks()).length,
  );

  protected toggleOffered(category: LoanCategory): void {
    const on = this.offered();
    this.offered.set(on.includes(category) ? on.filter((c) => c !== category) : [...on, category]);
    // The pool backs the NEXT step, and reading it here rather than on arrival means the
    // step is already populated when the operator gets to it. Once only — a second visit
    // must not discard ticks by re-reading over them.
    void this.loadPool();
  }

  /**
   * A tick. Add-only, and confirmed when it is a REQUIRED question.
   *
   * Requiredness is enforced from the live assignment table while customers are served a
   * frozen snapshot, so widening a required question refuses every application already in
   * flight in that loan type until it is answered. Naming that consequence is the difference
   * between a decision and an accident; "are you sure" would be neither.
   */
  protected askToAdd(row: AskedRow): void {
    // A question the loan type ALREADY asks is confirmed by nobody: the tick writes nothing
    // (`pendingAdds` drops it), so every application in flight has already had to answer it
    // and the sentence below would be describing a consequence this click cannot have. Only
    // reachable on the blank-start board, which is the one place such a row is tickable.
    if (!row.isRequired || row.alreadyAsked) {
      this.commitAdd(row.id);
      return;
    }
    const type = categoryLabel(this.askCategory());
    this.modal.confirm({
      nzTitle: $localize`:@@pcn.req_title:Ask “${row.label}:QUESTION:” of every ${type}:TYPE: applicant?`,
      nzContent: $localize`:@@pcn.req_body:It must be answered, so every ${type}:TYPE: application already in progress has to answer it before it can be submitted.`,
      nzOkText: $localize`:@@pcn.req_ok:Ask it`,
      nzCancelText: $localize`:@@pcn.req_cancel:Leave it`,
      nzOnOk: () => {
        this.commitAdd(row.id);
        return true;
      },
    });
  }

  /**
   * Take one of this session's own ticks back.
   *
   * No confirmation and no consequence to name: nothing has been written, and what is being
   * undone is a pick made on this screen minutes ago. The required-question warning belongs
   * to the tick, which is the direction that can break an application in flight.
   *
   * A gate SOURCE dragged in by another tick is not protected here either — `pendingAdds`
   * closes the chain again at Finish, so un-ticking a source while its dependent is still
   * ticked cannot ship a gate with nothing behind it.
   */
  protected askToRemove(row: AskedRow): void {
    const category = this.askCategory();
    const set = new Set(this.picks().get(category) ?? []);
    if (!set.delete(row.id)) return;
    const next = new Map(this.picks());
    next.set(category, set);
    this.picks.set(next);
  }

  private commitAdd(questionId: string): void {
    const category = this.askCategory();
    const next = new Map(this.picks());
    const set = new Set(next.get(category) ?? []);
    set.add(questionId);
    next.set(category, set);
    this.picks.set(next);
  }

  // --- rendering helpers -----------------------------------------------------

  /** The platform's word for the income type picked on step ①. */
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

  // --- navigation ------------------------------------------------------------

  protected pickBasis(basis: IncomeBasis): void {
    this.basis.set(basis);
    // Mirrored to the URL, not just held in a signal. The step LIST depends on it now, so a
    // reload with `?step=` and no `?basis=` would resolve the number against the wrong list.
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { basis },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /**
   * Step index mirrors to `?step=`, the house convention: the signal is truth, the URL
   * follows with `replaceUrl` so flipping steps does not fill the back button, and the
   * initial value is read from the snapshot so a reload lands where the operator was.
   */
  protected goToStep(index: number): void {
    const ids = this.stepIds();
    const id = stepIdAt(ids, index);
    if (id !== 'program' && this.basis() === null) return;
    this.stepId.set(id);
    if (id === 'offered' || id === 'asks') void this.loadPool();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { step: stepIndexOf(ids, id) + 1 },
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
   * A pasted `?step=4` must not land on an empty form: clamp to the first step that still
   * owes an answer, so a deep link is a shortcut and never a skip.
   *
   * With no `?step=` at all the screen opens on `program` either way — it now holds the
   * basis AND the labels, so there is nothing left for the chip to skip past.
   */
  private initialStep(): NewNameStepId {
    const ids = newNameStepIds(this.initialBasis());
    const raw = Number(this.route.snapshot.queryParamMap.get('step'));
    if (!Number.isFinite(raw) || raw <= 0) return 'program';
    if (this.initialBasis() === null) return 'program';
    return stepIdAt(ids, raw - 1);
  }

  // --- save ------------------------------------------------------------------

  /** Fire-and-forget for the template: Angular's parser has no `void` operator. */
  protected save(): void {
    void this.doSave();
  }

  /**
   * TWO writes, name first, and the order is not arbitrary.
   *
   * A name created without its question widening is a state the operator lands in and can
   * finish in two clicks; a question widening written for a name that was never created is a
   * silent, irreversible change to every program of that loan type — and every questionnaire
   * write publishes, so there is nothing to roll back to.
   *
   * The second write is idempotent by construction: it is recomputed from the same picks and
   * cannot narrow anything, so a retry re-sends the same set and the server answers "nothing
   * moved" without cutting a version.
   */
  private async doSave(): Promise<void> {
    if (this.submitting()) return;
    if (this.createdName() === null && blockReason(this.draft()) !== null) return;
    this.submitting.set(true);
    this.errorMessage.set(null);
    try {
      if (this.createdName() === null) {
        const plan = savePlan(this.draft());
        const v = this.form.getRawValue();
        const link = plan.link.kind === 'existing' ? plan.link.key : null;

        const name = await this.lookups.create({
          type: ENUM_TYPE,
          key: await this.uniqueKey(v.labelEn),
          labelEn: v.labelEn,
          labelAr: v.labelAr,
          sortOrder: v.sortOrder,
          // Sent on every path: it is what SURROGATE_PRODUCT_REQUIRED reads on the way in,
          // AND what the server writes as each category row's own basis flags.
          incomeBases: [...plan.incomeBases],
          // In the SAME atomic insert as the row. The name is born offered rather than
          // parked, which is what the whole third step is for.
          categories: [...plan.categories],
          // Absent, never '' or null: the DTO refuses both spellings.
          ...(link !== null ? { surrogateProductKey: link } : {}),
        });
        this.createdName.set({ id: name.id, key: name.key });
      }

      const adds = pendingAdds(this.pool(), this.offered(), this.picks());
      // Never an empty body: the endpoint refuses one, and a request that changes nothing
      // would still be a round trip nobody asked for.
      if (adds.length > 0) {
        await this.questionnaire.addQuestionCategoriesBulk(
          adds.map((a) => ({ questionId: a.questionId, categories: [...a.categories] })),
        );
      }

      const landing = newNameLanding(this.createdName()?.key ?? '');
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
      if (this.createdName() === null) {
        // The picked product may have been retired from under us between load and save.
        // Re-read rather than pre-check: the server is the rule, and a stale pick would
        // repeat the same refusal on every retry.
        await this.loadProducts();
        const picked = this.pickedProductKey();
        if (picked !== null && !this.products().some((p) => p.key === picked)) {
          this.pickedProductKey.set(null);
        }
      }
    } finally {
      this.submitting.set(false);
    }
  }

  /** Leave the half-finished flow for the name that DOES exist, rather than being trapped. */
  protected openCreated(): void {
    const made = this.createdName();
    if (made === null) return;
    const landing = newNameLanding(made.key);
    void this.router.navigate(landing.commands, { queryParams: landing.queryParams });
  }

  /**
   * The key for the NAME, avoiding both the taken ones and the two the router would eat.
   *
   * Two values may legitimately share an English label, and the key is not typeable — so a
   * raw ENUMERATION_KEY_DUPLICATE here would name a field the operator never saw. The server
   * still enforces the unique; this only keeps the ordinary case from surfacing as an
   * unactionable error.
   *
   * `/program-catalog/new` and `/program-catalog/products` are literal segments declared
   * before the single-segment `:key`, so a name keyed `new` would be saved, listed, and
   * impossible to open.
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

  /**
   * The global question pool, read ONCE and only once the operator is heading for it.
   *
   * Not in the constructor beside the products: it is the whole pool with every answer, and
   * the first two steps neither show nor need it. Not re-read on a second visit either —
   * the ticks made in between live in this page's own signals, and a re-read would draw the
   * board again as though they had not happened.
   */
  private async loadPool(): Promise<void> {
    if (this.poolRequested) return;
    this.poolRequested = true;
    try {
      const tree = await this.questionnaire.tree();
      this.pool.set(toAskablePool(tree));
      this.poolError.set(false);
    } catch {
      this.poolError.set(true);
      this.pool.set([]);
    }
  }
}

