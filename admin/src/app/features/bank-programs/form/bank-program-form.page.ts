import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  LOCALE_ID,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import {
  ArrowLeftOutline,
  ArrowRightOutline,
  ExclamationCircleOutline,
  PlusOutline,
  SaveOutline,
  ReloadOutline,
  CloudOutline,
  DownOutline,
  UpOutline,
  DeleteOutline,
  CompassOutline,
  UserOutline,
  CarOutline,
  HomeOutline,
  ShopOutline,
  AppstoreOutline,
  CalculatorOutline,
  DatabaseOutline,
  EditOutline,
  FileTextOutline,
  QuestionCircleOutline,
  WarningOutline,
} from '@ant-design/icons-angular/icons';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MoneyInputDirective } from '../../../core/directives/money-input.directive';
import { ErrorCodeService } from '../../../core/errors/error-code.service';
import { PlatformEnumerationsService } from '../../../core/platform-enumerations/platform-enumerations.service';
import { categoryLabel, isLoanCategory, type LoanCategory } from '@core/loan-category';
import { basisOf, incomeBasisLabel, programTypeOf, type IncomeBasis } from '@core/income-basis';
import { SURROGATE_FACT_BY_METHOD } from '@core/surrogate-facts';
import { BankProgramsApiService } from '../bank-programs.api.service';
import type {
  BankProgramCreatePayload,
  BankProgramResponse,
  BankProgramUpdatePayload,
  DbrBand,
  IncomeAssumptionStrategy,
  IncomeAssumptionConfig,
  IncomeRuleDraftProgram,
  IncomeBand,
  IncomeKeyTableRow,
  ProgramNameIncomeRule,
  ProgramType,
  RateBandMap,
  RateBasis,
} from '../bank-programs.types';
import {
  factKeyOf,
  PRODUCT_RULE_STRATEGY,
  incomeMethodLabel,
  incomeMethodShape,
  type ProductRuleOutput,
  type RuleGate,
  type RuleStep,
  type StepFigures,
  registryFacts,
} from '../bank-programs.types';
import { IncomeAssumptionSectionComponent } from '@shared/income-rule/income-assumption-section.component';
import { IncomeRuleCheckComponent } from '@shared/income-rule/income-rule-check.component';
import { incomeRuleHasError, productRuleHasError } from '@shared/income-rule/income-rule.rules';
import { catalogRuleIsProductBacked, catalogRuleOf } from '@shared/income-rule/catalog-rule';
import { nameChangeLoss, type NameChangeLoss } from './name-change-losses';
import {
  slotShapes,
  slotsMissingDefault,
  withAllDefaults,
  type SlotDefault,
} from '@shared/income-rule/catalog-defaults';
import { gateTitleFor } from '@shared/income-rule/gate-labels';
import {
  mustPickWayFirst,
  picksBetweenWays,
  wayOwnedSlots,
  waysOfRule,
  type WaysAre,
} from '@shared/income-rule/product-rule-ways';
import {
  indexOfOrPreceding,
  indexOfStep,
  isLaterStep,
  stepIdsFor,
  type StepId,
} from './wizard-step-plan';
import { BanksApiService } from '../../banks/banks.api.service';
import { additionalIncomeSources } from '../additional-income-sources';
import { followsCatalogName, type PickedNameLabels } from './friendly-name-seed';
import type { BankWithProgramCount } from '../../banks/banks.types';
import {
  AdditionalIncomeEditorComponent,
  DbrBandsEditorComponent,
  MaxLoanByFactEditorComponent,
  WizardStepsComponent,
  capConfigFrom,
  capGridFrom,
  dbrBandsErrorFor,
  maxLoanByFactErrorFor,
  IncomeBasisCardsComponent,
  type AdditionalIncomeConfig,
  type AdditionalIncomeOption,
  type DbrBandsError,
  type MaxLoanByFactConfig,
  type MaxLoanByFactRow,
  type ProductCapShape,
  type WizardStepItem,
} from '@shared/ui';

/** The one remaining genuine opt-in — see `BankProgramFormPage.toggles`. */
type ToggleKey = 'tieredRates';

/**
 * Wizard steps, in order.
 *
 * `income` and `review` own no CONTROL groups: the first writes `identity.programType`
 * through a signal, the last only reads the form back. Both therefore need their
 * validity and their "done" marker answered explicitly rather than by walking a group
 * — see `isStepValid` / `isStepComplete`.
 */
// `StepId` — and which steps a given program walks — lives in `wizard-step-plan.ts`.

interface WizardStep {
  readonly id: StepId;
  /** The step's full name. Used by the review step's section headings. */
  readonly label: string;
  /**
   * What the RAIL prints. Optional — falls back to `label`.
   *
   * Two names because the two surfaces are read differently: a rail is scanned
   * sideways, where seven names compete for one row and a long one is truncated
   * into an ellipsis, while a review heading sits alone above the rows it names
   * and can afford to say "Amount & duration" in full.
   */
  readonly railLabel?: string;
  /** Top-level form-group names validated when this step is left. */
  readonly groups: readonly string[];
}

/** One label/value line on the review step. */
interface ReviewRow {
  readonly label: string;
  readonly value: string;
}

interface ReviewGroup {
  /** Step index the "Edit" affordance jumps to. */
  readonly step: number;
  readonly title: string;
  readonly rows: readonly ReviewRow[];
}

/**
 * Cross-field guard for the tenor group: maximum duration must be ≥ minimum.
 * Surfaced inline in the Loan-duration section (error key `minGtMax`) so the
 * dual-handle range + precise inputs can't be saved in an inverted state.
 */
function tenorRangeValidator(group: AbstractControl): ValidationErrors | null {
  const min = group.get('minMonths')?.value;
  const max = group.get('maxMonths')?.value;
  if (typeof min === 'number' && typeof max === 'number' && max < min) {
    return { minGtMax: true };
  }
  return null;
}

/**
 * Cross-row guard for the tiered-rate table. Band floors become OBJECT KEYS on
 * the wire, so two rows sharing a floor silently collapse into one on save —
 * the admin watches a row they configured disappear with no message. Descending
 * floors are just as bad: the engine picks the highest floor ≤ the applicant's
 * amount, so a table read top-to-bottom would not mean what it appears to.
 *
 * Blank rows are the leaf `required`'s job, so they are skipped here rather than
 * counted twice in the step's issue banner.
 */
function rateBandsOrder(control: AbstractControl): ValidationErrors | null {
  if (!(control instanceof FormArray)) return null;
  let previous: number | null = null;
  for (const row of control.controls) {
    const raw = String(row.get('minAmountEGP')?.value ?? '').trim();
    if (raw === '') continue;
    const edge = Number(raw);
    if (!Number.isFinite(edge)) continue;
    if (previous !== null && edge === previous) return { bandDuplicate: true };
    if (previous !== null && edge < previous) return { bandOrder: true };
    previous = edge;
  }
  return null;
}

@Component({
  selector: 'app-bank-program-form-page',
  standalone: true,
  imports: [
    // FormsModule is here for ONE control: the rate-band table's mirrored upper
    // edge, a standalone `ngModel` view of the next band's reactive control. The
    // form itself stays fully reactive and typed (Principle XXII).
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    NzButtonModule,
    NzCheckboxModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzSwitchModule,
    DbrBandsEditorComponent,
    AdditionalIncomeEditorComponent,
    MaxLoanByFactEditorComponent,
    IncomeBasisCardsComponent,
    IncomeAssumptionSectionComponent,
    IncomeRuleCheckComponent,
    MoneyInputDirective,
    WizardStepsComponent,
  ],
  providers: [
    provideNzIconsPatch([
      ArrowLeftOutline,
      ArrowRightOutline,
      ExclamationCircleOutline,
      PlusOutline,
      SaveOutline,
      ReloadOutline,
      CloudOutline,
      DownOutline,
      UpOutline,
      DeleteOutline,
      CompassOutline,
      UserOutline,
      CarOutline,
      HomeOutline,
      ShopOutline,
      AppstoreOutline,
      CalculatorOutline,
      DatabaseOutline,
      EditOutline,
      FileTextOutline,
      QuestionCircleOutline,
      WarningOutline,
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <a [routerLink]="backLink()" class="back-link">
          <span nz-icon nzType="arrow-left" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@bank_programs.form.back">Back</span>
        </a>
        <div class="header-row">
          <div class="title-block">
            <h1 class="page-title">{{ isEditMode() ? editTitle() : createTitle() }}</h1>
            <p class="page-subtitle">{{ subtitle() }}</p>
          </div>
          <!-- What was already decided BEFORE this form opened — the bank and
               the loan type. They belong to the whole program, not to a step,
               so they sit with the title rather than inside step 1's body.
               Both read-only. The bank chip carried a "Change" action; it is gone,
               because re-picking either of these mid-form silently re-classifies the
               program — a different bank is a different program entirely, and a
               different loan type invalidates the program-name list. The wizard is
               entered from a bank, so the way to change it is to leave and re-enter
               from the right one. -->
          <!-- Always rendered: the income basis is always decided, even when the bank and
               loan type arrived from the URL and have no chip of their own. -->
          <div class="context-row">
            @if (!isEditMode() && preselectedBank; as b) {
              <div class="bank-chip">
                <span class="bank-chip-avatar" aria-hidden="true">{{
                  initialsOf(b.nameEnglish)
                }}</span>
                <span class="bank-chip-body">
                  <span class="bank-chip-eyebrow" i18n="@@bank_programs.form.for_bank"
                    >For bank</span
                  >
                  <span class="bank-chip-name">{{ b.nameEnglish }}</span>
                </span>
              </div>
            }
            @if (lockedCategory(); as cat) {
              <div class="bank-chip" [style.--cat]="catColor(cat)">
                <span class="bank-chip-avatar cat-chip-avatar" aria-hidden="true">
                  <span nz-icon [nzType]="catIcon(cat)" nzTheme="outline"></span>
                </span>
                <span class="bank-chip-body">
                  <span class="bank-chip-eyebrow" i18n="@@bank_programs.form.loan_type"
                    >Loan type</span
                  >
                  <span class="bank-chip-name">{{ categoryLabelOf(cat) }}</span>
                </span>
              </div>
            }
            <!-- The income basis joins the two things that were already decided, because
                   after step 1 it behaves like them: it is not re-asked, and it changes
                   what steps 1 and 4 mean. Without it here, an operator four steps deep
                   typing a grade table has nothing on screen saying why. -->
            <div class="bank-chip" [style.--cat]="basisAccent()">
              <span class="bank-chip-avatar cat-chip-avatar" aria-hidden="true">
                <span nz-icon [nzType]="basisIcon()" nzTheme="outline"></span>
              </span>
              <span class="bank-chip-body">
                <span class="bank-chip-eyebrow" i18n="@@bank_programs.form.income">Income</span>
                <span class="bank-chip-name">{{ basisChipLabel() }}</span>
              </span>
            </div>
          </div>
        </div>
      </header>

      @if (enums.unavailable()) {
        <div class="unavailable">
          <span
            class="unavailable-icon"
            nz-icon
            nzType="cloud"
            nzTheme="outline"
            aria-hidden="true"
          ></span>
          <p class="unavailable-text" i18n="@@bank_programs.form.enums_unavailable">
            Enumerations unavailable, retry shortly.
          </p>
          <button nz-button type="button" (click)="retryEnums()">
            <span nz-icon nzType="reload" nzTheme="outline" aria-hidden="true"></span>
            <span i18n="@@bank_programs.form.retry">Retry</span>
          </button>
        </div>
      } @else {
        <!-- Shared validation-error template, applied via [nzErrorTip] to every
             nz-form-control with typed validators. Declared inside readyTpl so
             the reference is in scope for the form controls below. -->
        <ng-template #fieldErrorTpl let-control>
          @if (control.hasError('required')) {
            <span i18n="@@bank_programs.err.required">This field is required.</span>
          } @else if (control.hasError('min')) {
            <span i18n="@@bank_programs.err.min">Value is below the minimum.</span>
          } @else if (control.hasError('max')) {
            <span i18n="@@bank_programs.err.max">Value is above the maximum.</span>
          } @else if (control.hasError('minlength')) {
            <span i18n="@@bank_programs.err.minlength">Too short.</span>
          } @else if (control.hasError('maxlength')) {
            <span i18n="@@bank_programs.err.maxlength">Too long.</span>
          } @else if (control.hasError('pattern')) {
            <span i18n="@@bank_programs.err.pattern">Format is invalid.</span>
          } @else if (control.hasError('email')) {
            <span i18n="@@bank_programs.err.email">Email format is invalid.</span>
          }
        </ng-template>

        <form [formGroup]="form" (ngSubmit)="submit()" class="form-body">
          <!-- ═══ STEP RAIL ═══════════════════════════════════════════════════
               Navigation, not decoration: every step is reachable the moment it
               has been visited, and a step that failed validation keeps a red
               marker so the admin can always see WHERE the blocker is. -->
          <div class="wizard-rail">
            <!-- Shared rail (app-wizard-steps): done / needs-attention markers,
               the disabled gate and the responsive collapse all live there. The
               caption is screen-reader-only here — the rail already names the
               step in print and the sentence only repeated it. -->
            <app-wizard-steps
              [steps]="railSteps()"
              [activeIndex]="stepIndex()"
              [ariaLabel]="stepsAria"
              [caption]="stepCaption()"
              [captionSrOnly]="true"
              (stepSelect)="goTo($event)"
            />

            @if (showStepIssues() && stepIssueCount() > 0) {
              <div class="step-alert" role="alert">
                <span
                  nz-icon
                  nzType="exclamation-circle"
                  nzTheme="outline"
                  aria-hidden="true"
                ></span>
                <span>{{ stepIssueLabel() }}</span>
              </div>
            }
          </div>

          <!-- ═══ STEP BODY ═══════════════════════════════════════════════════
               A plain stack. It owns no scrollport: the shell scrolls the whole
               page, so a long step never squeezes itself into a short box with
               its own scrollbar. The action bar below scrolls with it. -->
          <div class="step-stack">
            <!-- ═══ STEP 1 — INCOME ═════════════════════════════════════════════
                 A step of its own, and the first one, because everything after it is
                 downstream: it narrows the program names step 2 may offer, and it
                 decides whether Eligibility carries a whole rate-table editor. Asked
                 as two full cards rather than the pills it used to be — a step with
                 one question on it can afford to say what each answer commits to,
                 and the line at the foot of each card is the dependency said out
                 loud instead of discovered two steps later. -->
            @if (currentStepId() === 'income') {
              <!-- is-bare: this step's body IS two tiles, so the panel behind them
                   was a card holding cards — three nested surfaces for one question.
                   Dropping its fill and border leaves the rail and the two answers,
                   which is all the step ever had. -->
              <section class="card is-bare">
                <header class="card-head">
                  <div>
                    <h2 class="card-title" i18n="@@bank_programs.form.income_step.title">Income</h2>
                    <p class="card-sub" i18n="@@bank_programs.form.income_step.sub">
                      How does this bank check what the customer earns? Your answer decides which
                      program names you can pick next.
                    </p>
                  </div>
                </header>

                <!-- Shared with the catalog's own create screen: two copies of the one
                     question the whole platform turns on is how two screens come to
                     describe one decision in different words. What the answer COMMITS the
                     operator to is still this wizard's own — it names THIS wizard's later
                     steps — so it arrives as the effects input. -->
                <app-income-basis-cards
                  [value]="basisAnswered()"
                  [ariaLabel]="incomeStepAria"
                  [effects]="basisEffects()"
                  groupName="incomeBasis"
                  (picked)="pickBasis($event)"
                />
              </section>
            }

            <!-- ═══ STEP 2 — PROGRAM ════════════════════════════════════════════ -->
            @if (currentStepId() === 'program') {
              <!-- Create reached without a loan type (direct URL): the value is not
               guessable, and defaulting it would file the program under the
               wrong product. Say where the choice is made instead. -->
              @if (!isEditMode() && !lockedCategory()) {
                <div class="ctx-missing" role="alert">
                  <span nz-icon nzType="compass" nzTheme="outline" aria-hidden="true"></span>
                  <span i18n="@@bank_programs.form.category_missing"
                    >Start from a bank’s loan type so this program is filed under the right
                    product.</span
                  >
                  <a routerLink="/banks" i18n="@@bank_programs.form.category_missing_cta"
                    >Go to banks</a
                  >
                </div>
              }

              <section class="card" formGroupName="identity">
                <header class="card-head">
                  <div>
                    <h2 class="card-title" i18n="@@bank_programs.form.core.title">Program</h2>
                    <p class="card-sub" i18n="@@bank_programs.form.core.sub">
                      The name customers see. The catalog fills in how the bank reads an income —
                      change it if this bank differs.
                    </p>
                  </div>
                </header>

                <div class="grid">
                  <!-- Shown whenever the bank did NOT arrive in the URL — including
                   after one has been picked here, so the pick stays changeable. It
                   used to disappear the moment a bank was chosen, and the chip's
                   "Change" action was the only way back to it; with that action gone
                   the field has to stay. A URL-borne bank has no picker at all: the
                   wizard was entered FROM that bank. -->
                  @if (!bankFromUrl() && !isEditMode()) {
                    <nz-form-item>
                      <nz-form-label [nzFor]="'bankId'" nzRequired i18n="@@bank_programs.field.bank"
                        >Bank</nz-form-label
                      >
                      <nz-form-control [nzErrorTip]="fieldErrorTpl">
                        <nz-select
                          id="bankId"
                          [formControl]="bankIdControl"
                          [nzDropdownStyle]="dropdownStyle"
                          nzShowSearch
                          nzAllowClear
                          nzPlaceHolder="Pick a bank"
                          i18n-nzPlaceHolder="@@bank_programs.field.bank.placeholder"
                        >
                          @for (b of activeBanks(); track b.id) {
                            <nz-option [nzValue]="b.id" [nzLabel]="b.nameEnglish"></nz-option>
                          }
                        </nz-select>
                        @if (identityGroup.controls['bankName']?.touched && !selectedBankId()) {
                          <div class="manual-error" i18n="@@bank_programs.err.bank_required">
                            Bank is required.
                          </div>
                        }
                      </nz-form-control>
                    </nz-form-item>
                  }
                  @if (isEditMode()) {
                    <nz-form-item class="span-2">
                      <nz-form-label
                        [nzFor]="'programCode'"
                        i18n="@@bank_programs.field.program_code"
                        >Program code</nz-form-label
                      >
                      <nz-form-control>
                        <input nz-input id="programCode" formControlName="programCode" />
                      </nz-form-control>
                    </nz-form-item>
                  }
                  <!-- Filtered by the answer given on the Income step, so the list is
                   already narrowed by the time it is opened. Full width whenever it is
                   not sharing the row with the bank picker. -->
                  <nz-form-item [class.span-2]="bankFromUrl() || isEditMode()">
                    <nz-form-label
                      [nzFor]="'programNameKey'"
                      nzRequired
                      i18n="@@bank_programs.field.friendly_name"
                      >Program name</nz-form-label
                    >
                    <nz-form-control [nzErrorTip]="friendlyNameErrorTpl">
                      <nz-select
                        id="programNameKey"
                        formControlName="programNameKey"
                        nzShowSearch
                        [nzDisabled]="!basisAnswered()"
                        [nzDropdownStyle]="dropdownStyle"
                        [nzNotFoundContent]="emptyPickerLabel()"
                        [nzPlaceHolder]="namePlaceholder()"
                      >
                        @for (opt of programNameOptions(); track opt.value) {
                          <nz-option [nzValue]="opt.value" [nzLabel]="opt.label"></nz-option>
                        }
                      </nz-select>
                      <!-- Required is the only CONTROL error reachable: the value
                       comes from a fixed option list, so it cannot overflow the
                       key length. The name-vs-category mismatch is not a control
                       error — it is rendered as a warning below. -->
                      <ng-template #friendlyNameErrorTpl let-control>
                        @if (control.hasError('required')) {
                          <span i18n="@@bank_programs.err.friendly_name_required"
                            >Program name is required.</span
                          >
                        }
                      </ng-template>
                      <!-- The catalog's basis is INTENT, and a bank may legitimately sell
                       a name the other way — the API refuses nothing on it. So the filter
                       above is a default view, never a wall: whatever it hides stays one
                       click away, with the count said out loud rather than left as a
                       shorter list nobody can explain. -->
                      @if (namesHiddenByBasis() > 0) {
                        <button type="button" class="link-btn" (click)="toggleAllNames()">
                          @if (showAllNames()) {
                            <span i18n="@@bank_programs.field.friendly_name.show_matching"
                              >Show only names filed under this income</span
                            >
                          } @else {
                            <span i18n="@@bank_programs.field.friendly_name.show_all"
                              >Show {{ namesHiddenByBasis() }} more names filed under the other
                              income</span
                            >
                          }
                        </button>
                      }
                      @if (programNameMismatch(); as mismatch) {
                        <p class="field-warn" role="alert">
                          <span i18n="@@bank_programs.warn.name_not_in_category"
                            >“{{ mismatch.name }}” isn’t offered for {{ mismatch.category }}. Pick
                            another name, or add it to this loan type in the program catalog.</span
                          >
                        </p>
                      }
                    </nz-form-control>
                  </nz-form-item>

                  <!-- Loan type is NOT a field here: it arrives decided (query param on
                   create, the saved row on edit) and is shown in the context chip beside
                   the page title, alongside the income basis above. -->
                  <!-- Locked until the income question is answered, like the name picker
                   above it: step 1 is read top to bottom, and a tickable row sitting under
                   two dead controls invited the operator to start at the bottom. The value
                   is never disabled on the CONTROL — an edit-mode program keeps submitting
                   its saved flag; only the pointer is refused. -->
                  <label
                    class="option-row span-2"
                    [class.is-on]="isSharia"
                    [class.is-locked]="!basisAnswered()"
                    nz-checkbox
                    [nzDisabled]="!basisAnswered()"
                    formControlName="isShariaCompliant"
                  >
                    <span class="option-text">
                      <span class="option-title" i18n="@@bank_programs.field.sharia"
                        >Sharia-compliant program</span
                      >
                      @if (basisAnswered()) {
                        <span class="option-hint" i18n="@@bank_programs.field.sharia.hint">
                          Shown to customers who filter for Islamic finance.
                        </span>
                      } @else {
                        <span class="option-hint" i18n="@@bank_programs.field.sharia.locked">
                          Answer the income question first.
                        </span>
                      }
                    </span>
                  </label>
                </div>
              </section>
            }

            <!-- ═══ STEP — CALCULATION (surrogate programs only) ═══════════════════════
                 The one step the payslip wizard does not have. It sits BEFORE Amount on
                 purpose: the operator states how the bank works the figure out — which of
                 the product's ways, its numbers, the I-Score table, the rule's own DBR cap —
                 before typing the amounts that live downstream of it. The whole income block
                 moved here from the Eligibility step verbatim; only the wrapper changed.
                 Exists iff incomeSurrogateActive() is true; see wizard-step-plan.ts. -->
            @if (currentStepId() === 'calculation') {
              <!-- ONE CARD, THREE BANDS.
                   This block used to be bare on the reasoning that its body already drew
                   its own surfaces — and that was true of the body, but it made this
                   section the only thing on the step that was not a card while the two
                   below it (Eligibility, Debt burden) are. What the body actually held was
                   a bordered section, a bare hairline block and a bordered elevated card:
                   three peers, three treatments, inside a container that claimed to be
                   avoiding exactly that. The frames are gone from all three (see
                   section.styles.scss and .chk), each is a hairline-separated BAND with
                   one micro-label, and this becomes a plain peer of its two neighbours. -->
              <section class="card income-block">
                <!-- card-head, and it is load-bearing: from 1024up this page lays a card out
                     as a label rail plus a column of controls, and card > :not(.card-head)
                     puts everything else in column 2. Named anything else, this header sat in
                     the control column and left a 353px rail empty beside it — which is what
                     made the step look like it had a margin nobody could explain. -->
                <header class="card-head">
                  <div>
                    <!-- The STEP's own name, not a second one: a card headed "Income
                         assumption" inside a step called "Calculation" is two names for one
                         thing on one screen. -->
                    <h2 class="card-title" i18n="@@bank_programs.step.calculation">Calculation</h2>
                    @if (catalogProof(); as proof) {
                      <p class="income-lede" i18n="@@bank_programs.income.reads">
                        {{ programNameLabel() }} works the income out from
                        <strong>{{ proof }}</strong
                        >.
                      </p>
                    }
                    <!-- Inside the rail, under the sentence it belongs to. It used to sit on
                         the opposite end of a space-between row, which the 17rem rail has no
                         room for. -->
                    @if (programNameKeyValue()) {
                      <a
                        class="income-catalog-link"
                        [routerLink]="['/program-catalog', programNameKeyValue()]"
                        i18n="@@bank_programs.income.set_on_catalog"
                        >Set on the catalog</a
                      >
                    }
                  </div>
                </header>

                @if (catalogRuleLoading()) {
                  <p class="income-loading" i18n="@@bank_programs.income.loading">
                    Reading what this program name says…
                  </p>
                } @else if (!programNameKeyValue()) {
                  <!-- Reachable only by going back to step 2 and clearing the name, so
                       it states the missing input rather than scolding about a proof
                       nobody could have set. -->
                  <p class="income-loading" i18n="@@bank_programs.income.no_name">
                    Pick a program name on the Program step first — the name decides what the income
                    is worked out from.
                  </p>
                } @else if (!catalogProof()) {
                  <!-- Fails on screen before it fails on save. The server would answer
                       PROGRAM_NAME_INCOME_PROOF_MISSING; saying it here, next to the
                       link that fixes it, costs the operator nothing. -->
                  <p class="income-blocked" role="status">
                    <span nz-icon nzType="warning" nzTheme="outline" aria-hidden="true"></span>
                    <span i18n="@@bank_programs.income.no_proof"
                      >Nobody has said what {{ programNameLabel() }} reads its income from. Set it
                      once on the program catalog and every bank starts from the same table.</span
                    >
                  </p>
                } @else {
                  <!-- NOT a choice any more. The operator does not pick "whose amounts"
                       up front and then go looking for an editor: the catalog's figures
                       are already in the grid below, and touching one is what makes them
                       this bank's. So this is a LABEL on that grid — where the numbers
                       came from, and the way back — not a third container around it.
                       A spine on the editor's own inset surface, the same idiom the
                       blocked-notice above uses to state a condition.

                       One slot, two states, so the strip never moves under the pointer
                       while the operator is typing in the row beneath it. -->
                  <p
                    class="income-source"
                    [class.is-own]="amountsValue() === 'own'"
                    [class.is-empty]="catalogStatesNothing()"
                    [class.just-detached]="justDetached()"
                    role="status"
                  >
                    <span class="income-source-medallion" aria-hidden="true">
                      <span nz-icon [nzType]="sourceIcon()" nzTheme="outline"></span>
                    </span>
                    <span class="income-source-body">
                      @if (amountsValue() === 'own') {
                        <span class="income-source-line" i18n="@@bank_programs.income.src_own"
                          >This bank uses its own numbers. Changes on the catalog no longer reach
                          it.</span
                        >
                      } @else if (catalogStatesNothing()) {
                        <!-- The state the two-branch strip could not say, and the one every
                             product starts in: the name states a proof and the catalog
                             states no amounts, so the grid below is empty, the save
                             succeeds, and every applicant is quoted nothing. Advisory, not
                             a gate — the fix is on a screen this operator may not own. -->
                        <span
                          class="income-source-line"
                          i18n="@@bank_programs.income.src_catalog_empty"
                          >{{ programNameLabel() }} states no amounts on the catalog yet, so this
                          program would quote nobody. Type them below to make them this bank's, or
                          set them once on the product so every bank starts from the same
                          table.</span
                        >
                      } @else {
                        <span class="income-source-line" i18n="@@bank_programs.income.src_catalog"
                          >These are {{ programNameLabel() }}'s numbers from the catalog. Change any
                          of them and this bank keeps its own copy.</span
                        >
                      }
                    </span>
                    @if (amountsValue() === 'own' && catalogHasFigures()) {
                      <button
                        type="button"
                        class="income-source-reset"
                        (click)="resetToCatalog()"
                        i18n="@@bank_programs.income.src_reset"
                      >
                        Back to the catalog's
                      </button>
                    }
                  </p>

                  <!-- WHAT THE FILL DID, named.
                       A blank gate reads as "this bank does not apply this condition", so
                       filling one switches a refusal ON. The count alone would not say
                       which, and the operator has no other record of what was blank when
                       they opened the program — so every filled figure is listed, and
                       undoing is one click. Nothing has been sent: the form is merely
                       dirty. -->
                  @if (filledFromProduct().length > 0) {
                    <p class="income-filled" role="status">
                      <span>{{ filledNotice() }}</span>
                      <button
                        type="button"
                        class="income-filled-undo"
                        (click)="undoFillFromProduct()"
                        i18n="@@bank_programs.income.filled_undo"
                      >
                        Undo the fill
                      </button>
                    </p>
                  }
                }

                <!-- Both of these used to be projected INSIDE the editor, which now
                     renders only for a bank on its own amounts. They belong to the
                     whole block: a program on CATALOG amounts is quoted off a table
                     too, so an unasked fact silences it just as completely, and the
                     check panel is the only way to see what either table pays. -->
                @if (catalogProof()) {
                  <div class="income-band">
                    <h3 class="band-label" i18n="@@bank_programs.income.band_calculation">
                      The calculation
                    </h3>

                    <!-- The one thing the operator could not learn before saving: whether
                       the figure this name reads is even asked of this loan type's
                       applicants. It arrived as a toast after a failed save, or never —
                       and an unasked figure means no income for anyone, quietly. -->
                    @if (factBinding(); as fb) {
                      <p class="binding" [class.warn]="!fb.asked" role="status">
                        @if (fb.asked) {
                          <span
                            nz-icon
                            nzType="check-circle"
                            nzTheme="outline"
                            aria-hidden="true"
                          ></span>
                          <span i18n="@@bank_programs.income.binding_ok"
                            >{{ fb.category }} applicants are asked {{ fb.label }}.</span
                          >
                        } @else {
                          <span
                            nz-icon
                            nzType="warning"
                            nzTheme="outline"
                            aria-hidden="true"
                          ></span>
                          <span i18n="@@bank_programs.income.binding_missing"
                            >{{ fb.category }} applicants are never asked {{ fb.label }}, so this
                            rule will produce no income.</span
                          >
                          <a
                            routerLink="/questionnaire/categories"
                            i18n="@@bank_programs.income.binding_fix"
                            >Ask it</a
                          >
                        }
                      </p>
                    }

                    <!-- ALWAYS rendered, pre-filled from the catalog when this program is
                       inheriting. It used to appear only once the operator had committed
                       to "own amounts", which put the numbers a bank is about to sell
                       behind a decision they could not yet see the consequence of.
                       Editing any cell is what commits — the onKeyTableEdit /
                       onBandsEdit / onStepFiguresEdit trio below is where that flip
                       happens. So nothing here is read-only, and the pre-filled copy is
                       never persisted: the payload omits figures while the program is
                       still on the catalog's amounts. -->
                    <app-income-assumption-section
                      [group]="incomeAssumptionGroup"
                      [keyTable]="incomeKeyTable()"
                      (keyTableChange)="onKeyTableEdit($event)"
                      [bands]="incomeBands()"
                      (bandsChange)="onBandsEdit($event)"
                      [ruleSteps]="ruleSteps()"
                      [ruleGates]="ruleGates()"
                      [ruleOutput]="ruleOutput()"
                      [stepFigures]="stepFigures()"
                      (stepFiguresChange)="onStepFiguresEdit($event)"
                      (stepFiguresTouched)="markIncomeRuleDirty()"
                      [waysAre]="ruleWaysAre()"
                      [wayId]="wayIdValue()"
                      (wayIdChange)="onWayPicked($event)"
                      (wayTitleChange)="currentWayTitle.set($event)"
                      [figuresAreOwn]="amountsValue() === 'own'"
                      [catalogFigures]="ruleCatalogFigures()"
                      [showsCatalogDefaults]="amountsValue() === 'own'"
                      [programCapPercent]="dbrFlatCap()"
                    ></app-income-assumption-section>
                  </div>

                  <!-- Money the applicant earns BESIDE whatever the rule or the payslip
                       says — rent, certificate returns, allowances — each counted at this
                       bank's own weight. Here rather than under Eligibility because it is
                       part of what income this bank recognises, and the operator is already
                       looking at the rest of that answer. -->
                  @if (additionalIncomeOptions().length > 0) {
                    <div class="income-band">
                      <h3 class="band-label" i18n="@@bank_programs.income.additional">
                        Other money the bank counts
                      </h3>
                      <app-additional-income-editor
                        [options]="additionalIncomeOptions()"
                        [(config)]="additionalIncome"
                      />
                    </div>
                  }

                  <!-- The third band heads ITSELF, in the same ramp: it is a component with
                       one host, and a label supplied from out here would be a second
                       heading over the one it already draws. -->
                  <div class="income-band">
                    <app-income-rule-check
                      [programCode]="editingProgramCode()"
                      [draftProgram]="draftProgramForCheck()"
                      [draft]="liveIncomeRuleDraft()"
                      [ruleSteps]="ruleSteps()"
                      [ruleGates]="ruleGates()"
                    ></app-income-rule-check>
                  </div>
                }
              </section>
            }

            <!-- ═══ STEP 2 — AMOUNT & DURATION ══════════════════════════════════ -->
            @if (currentStepId() === 'terms') {
              <section class="card" formGroupName="loanLimits">
                <header class="card-head">
                  <div>
                    <h2 class="card-title" i18n="@@bank_programs.form.amount.title">Loan amount</h2>
                    <p class="card-sub" i18n="@@bank_programs.form.amount.sub">
                      Minimum and maximum loan size in EGP.
                    </p>
                  </div>
                </header>
                <!-- SAID ONCE, at the top of the card, never per field: the same sentence on
                     three controls is read at the first and skipped at the rest, and a disabled
                     input announces nothing — so the notice carries the role and the action. -->
                @if (amountsLocked()) {
                  <p class="amount-locked" role="status">
                    <span i18n="@@bank_programs.form.amount.locked"
                      >This program has not said how it works the figure out yet. Pick the way on
                      the Calculation step, then set the amounts.</span
                    >
                    <button
                      type="button"
                      class="amount-locked-cta"
                      (click)="goTo(indexOf('calculation'))"
                      i18n="@@bank_programs.form.amount.locked_cta"
                    >
                      Go to Calculation
                    </button>
                  </p>
                }
                <div class="grid">
                  <nz-form-item [class.is-locked]="amountsLocked()">
                    <nz-form-label
                      [nzFor]="'minAmountEGP'"
                      nzRequired
                      i18n="@@bank_programs.field.min_amount"
                      >Minimum amount</nz-form-label
                    >
                    <nz-form-control [nzErrorTip]="fieldErrorTpl">
                      <nz-input-group nzAddOnAfter="EGP" class="money-group">
                        <input
                          nz-input
                          appMoneyInput
                          id="minAmountEGP"
                          formControlName="minAmountEGP"
                          inputmode="numeric"
                          placeholder="50,000"
                          [attr.disabled]="amountsLocked() ? '' : null"
                          [attr.aria-disabled]="amountsLocked()"
                        />
                      </nz-input-group>
                    </nz-form-control>
                  </nz-form-item>
                  <nz-form-item [class.is-locked]="amountsLocked()">
                    <nz-form-label
                      [nzFor]="'maxAmountEGP'"
                      nzRequired
                      i18n="@@bank_programs.field.max_amount"
                      >Maximum amount</nz-form-label
                    >
                    <nz-form-control [nzErrorTip]="fieldErrorTpl">
                      <nz-input-group nzAddOnAfter="EGP" class="money-group">
                        <input
                          nz-input
                          appMoneyInput
                          id="maxAmountEGP"
                          formControlName="maxAmountEGP"
                          inputmode="numeric"
                          placeholder="1,500,000"
                          [attr.disabled]="amountsLocked() ? '' : null"
                          [attr.aria-disabled]="amountsLocked()"
                        />
                      </nz-input-group>
                    </nz-form-control>
                  </nz-form-item>
                </div>

                <!-- The maximum above is this program's flat ceiling; the table below
                 states it per ANSWER, which is how nine of the source sheets print it.
                 Beside the flat field and not in an "advanced" panel, because on those
                 programs the table IS the maximum and the flat one is only its backstop. -->
                <div class="cap-table">
                  <h3 class="cap-table-title" i18n="@@bank_programs.form.max_by_answer">
                    Maximum by answer
                  </h3>
                  <app-max-loan-by-fact-editor
                    [facts]="incomeFacts()"
                    [config]="maxLoanByFact()"
                    (configChange)="onMaxLoanByFact($event)"
                    [productCap]="productCap()"
                    [productDefaults]="productCapDefaults()"
                    [productLabel]="programNameLabel()"
                    [locked]="amountsLocked()"
                  ></app-max-loan-by-fact-editor>
                </div>
              </section>

              <!-- Tenor -->
              <section class="card" formGroupName="tenor">
                <header class="card-head">
                  <div>
                    <h2 class="card-title" i18n="@@bank_programs.form.tenor.title">
                      Loan duration
                    </h2>
                    <p class="card-sub" i18n="@@bank_programs.form.tenor.sub">
                      Minimum and maximum months a customer can borrow over.
                    </p>
                  </div>
                </header>
                <div class="grid">
                  <nz-form-item>
                    <nz-form-label
                      [nzFor]="'minMonths'"
                      nzRequired
                      i18n="@@bank_programs.field.min_months"
                      >Minimum months</nz-form-label
                    >
                    <nz-form-control [nzErrorTip]="fieldErrorTpl">
                      <nz-input-number
                        id="minMonths"
                        class="num-field"
                        formControlName="minMonths"
                        [nzMin]="1"
                        [nzMax]="600"
                        [nzStep]="1"
                        [nzPrecision]="0"
                      ></nz-input-number>
                      <span class="field-hint">≈ {{ minMonthsHint() }}</span>
                    </nz-form-control>
                  </nz-form-item>
                  <nz-form-item>
                    <nz-form-label
                      [nzFor]="'maxMonths'"
                      nzRequired
                      i18n="@@bank_programs.field.max_months"
                      >Maximum months</nz-form-label
                    >
                    <nz-form-control [nzErrorTip]="fieldErrorTpl">
                      <nz-input-number
                        id="maxMonths"
                        class="num-field"
                        formControlName="maxMonths"
                        [nzMin]="1"
                        [nzMax]="600"
                        [nzStep]="1"
                        [nzPrecision]="0"
                      ></nz-input-number>
                      <span class="field-hint">≈ {{ maxMonthsHint() }}</span>
                      @if (
                        tenorGroup.hasError('minGtMax') && tenorGroup.controls['maxMonths']?.touched
                      ) {
                        <span
                          class="field-error"
                          role="alert"
                          i18n="@@bank_programs.tenor.min_gt_max"
                          >Maximum must be greater than or equal to minimum.</span
                        >
                      }
                    </nz-form-control>
                  </nz-form-item>
                </div>
              </section>
            }

            <!-- ═══ STEP 3 — PRICING & FEES ═════════════════════════════════════ -->
            @if (currentStepId() === 'pricing') {
              <section class="card" formGroupName="pricing">
                <header class="card-head">
                  <div>
                    <h2 class="card-title" i18n="@@bank_programs.form.rate.title">Interest rate</h2>
                    <p class="card-sub" i18n="@@bank_programs.form.rate.sub">
                      One annual rate. Switch to a band table below if the rate depends on loan
                      size.
                    </p>
                  </div>
                </header>
                <div class="grid">
                  @if (!isVariableRateSignal()) {
                    <nz-form-item>
                      <nz-form-label
                        [nzFor]="'baseRatePercent'"
                        nzRequired
                        i18n="@@bank_programs.field.base_rate"
                        >Base rate</nz-form-label
                      >
                      <nz-form-control [nzErrorTip]="fieldErrorTpl">
                        <nz-input-group nzAddOnAfter="%" class="rate-group">
                          <input
                            nz-input
                            id="baseRatePercent"
                            formControlName="baseRatePercent"
                            inputmode="decimal"
                            placeholder="24.0000"
                          />
                        </nz-input-group>
                      </nz-form-control>
                    </nz-form-item>
                  }
                  <!-- The basis, beside the rate it qualifies. A percentage on its own does
                   not say what the customer pays: the same rate over the same tenor buys
                   22-29% more loan on a declining balance than flat, so this is a radio
                   pair with the consequence written out, not a checkbox someone can leave
                   half-read. -->
                  <nz-form-item class="span-2">
                    <nz-form-label i18n="@@bank_programs.field.rate_basis"
                      >How the interest is charged</nz-form-label
                    >
                    <nz-form-control>
                      <div class="rate-basis" role="radiogroup" [attr.aria-label]="rateBasisAria">
                        <label class="rate-basis-opt">
                          <input type="radio" formControlName="rateBasis" value="reducing" />
                          <span class="rate-basis-body">
                            <span
                              class="rate-basis-title"
                              i18n="@@bank_programs.rate_basis.reducing"
                              >On what is still owed</span
                            >
                            <span
                              class="rate-basis-note"
                              i18n="@@bank_programs.rate_basis.reducing_note"
                              >Declining balance. The interest falls as the loan is paid down.</span
                            >
                          </span>
                        </label>
                        <label class="rate-basis-opt">
                          <input type="radio" formControlName="rateBasis" value="flat" />
                          <span class="rate-basis-body">
                            <span class="rate-basis-title" i18n="@@bank_programs.rate_basis.flat"
                              >On the full amount</span
                            >
                            <span
                              class="rate-basis-note"
                              i18n="@@bank_programs.rate_basis.flat_note"
                              >Flat. The same interest every month, so this rate buys the customer a
                              smaller loan.</span
                            >
                          </span>
                        </label>
                      </div>
                    </nz-form-control>
                  </nz-form-item>
                  <nz-form-item class="span-2">
                    <label
                      nz-checkbox
                      formControlName="isVariableRate"
                      i18n="@@bank_programs.field.is_variable_rate"
                      >Variable rate (CBE-linked, quarterly reset)</label
                    >
                  </nz-form-item>
                  @if (isVariableRateSignal()) {
                    <nz-form-item>
                      <nz-form-label i18n="@@bank_programs.field.current_effective_rate"
                        >Current effective rate</nz-form-label
                      >
                      <nz-form-control [nzErrorTip]="fieldErrorTpl">
                        <nz-input-group nzAddOnAfter="%" class="rate-group">
                          <input
                            nz-input
                            formControlName="currentEffectiveRatePercent"
                            inputmode="decimal"
                            placeholder="26.5500"
                          />
                        </nz-input-group>
                      </nz-form-control>
                    </nz-form-item>
                    <nz-form-item class="span-2">
                      <nz-form-label i18n="@@bank_programs.field.variable_rate_note"
                        >Disclosure note</nz-form-label
                      >
                      <nz-form-control [nzErrorTip]="fieldErrorTpl">
                        <textarea
                          nz-input
                          formControlName="variableRateNote"
                          rows="2"
                          placeholder="CBE policy rate + 3%, reviewed quarterly"
                        ></textarea>
                      </nz-form-control>
                    </nz-form-item>
                  }
                </div>
              </section>

              <!-- Tiered rates: a real shape change (single rate → band table), so it
               stays an opt-in rather than a hidden field. -->
              <section class="card" formGroupName="pricing">
                <header class="card-head">
                  <div>
                    <h2 class="card-title" i18n="@@bank_programs.section.tiered_rates">
                      Tiered interest rates
                    </h2>
                    <p class="card-sub" i18n="@@bank_programs.section.tiered_rates_sub">
                      Bigger loans often price differently. Each band covers a range of loan amounts
                      and carries its own rate.
                    </p>
                  </div>
                </header>
                <div class="card-body">
                  <label
                    nz-checkbox
                    [nzChecked]="toggles.tieredRates()"
                    (nzCheckedChange)="setToggle('tieredRates', $event)"
                    i18n="@@bank_programs.toggle.tiered_rates"
                    >Charge a different rate per loan-amount band</label
                  >

                  @if (toggles.tieredRates()) {
                    <div class="bands">
                      @if (rateBandsArray.length === 0) {
                        <div class="bands-empty">
                          <p class="bands-empty-text" i18n="@@bank_programs.bands.empty">
                            No bands — every loan uses the single rate above.
                          </p>
                          <button type="button" nz-button nzType="default" (click)="addRateBand()">
                            <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
                            <span i18n="@@bank_programs.bands.seed">Add the first band</span>
                          </button>
                        </div>
                      } @else {
                        <div class="bands-head" aria-hidden="true">
                          <span class="bands-head-range">
                            <span i18n="@@bank_programs.bands.col_min">Loan amount from</span>
                            <span class="band-arrow">→</span>
                            <span i18n="@@bank_programs.bands.col_max">to</span>
                          </span>
                          <span i18n="@@bank_programs.bands.col_rate">Rate</span>
                          <span></span>
                        </div>
                        @for (band of rateBandsArray.controls; track band; let i = $index) {
                          <div class="band-row">
                            <!-- The row reads as one sentence: 0 → 250,000 → and above. A
                           band's upper box IS the next band's lower control (see
                           setBandUpperEdge), so a gap or an overlap between bands
                           cannot be typed — the boundary has one owner, not two. -->
                            <div class="band-range">
                              <nz-form-item class="band-cell">
                                <nz-form-control [nzErrorTip]="fieldErrorTpl">
                                  <input
                                    nz-input
                                    appMoneyInput
                                    class="band-edge"
                                    inputmode="numeric"
                                    [formControl]="bandEdgeControl(i)"
                                    [attr.aria-label]="bandAriaMin"
                                    placeholder="0"
                                  />
                                </nz-form-control>
                              </nz-form-item>
                              <span class="band-arrow" aria-hidden="true">→</span>
                              @if (i < rateBandsArray.length - 1) {
                                <!-- Mirror view of the NEXT band's lower edge. Standalone
                               ngModel, not a second formControl binding: two views
                               of one control do not repaint each other on typing. -->
                                <input
                                  nz-input
                                  appMoneyInput
                                  class="band-edge"
                                  inputmode="numeric"
                                  [ngModel]="bandEdgeValue(i + 1)"
                                  (ngModelChange)="setBandUpperEdge(i, $event)"
                                  [ngModelOptions]="{ standalone: true }"
                                  [attr.aria-label]="bandAriaMax"
                                />
                              } @else {
                                <span class="band-open" i18n="@@bank_programs.bands.and_above"
                                  >and above</span
                                >
                              }
                              <!-- Unit per row, not only in the column head: the head is
                             hidden on narrow screens, and a loan-amount box with no
                             visible unit is the ambiguity this pass exists to kill. -->
                              <span class="band-unit">EGP</span>
                            </div>
                            <nz-form-item class="band-cell">
                              <nz-form-control [nzErrorTip]="fieldErrorTpl">
                                <nz-input-group nzAddOnAfter="%" class="rate-group">
                                  <input
                                    nz-input
                                    inputmode="decimal"
                                    [formControl]="bandRateControl(i)"
                                    [attr.aria-label]="bandAriaRate"
                                    placeholder="28.0000"
                                  />
                                </nz-input-group>
                              </nz-form-control>
                            </nz-form-item>
                            <button
                              type="button"
                              class="band-remove"
                              (click)="removeRateBand(i)"
                              [attr.aria-label]="bandAriaRemove"
                            >
                              <span
                                nz-icon
                                nzType="delete"
                                nzTheme="outline"
                                aria-hidden="true"
                              ></span>
                            </button>
                          </div>
                        }

                        @if (rateBandsError(); as err) {
                          <p class="bands-error" role="alert">
                            @switch (err) {
                              @case ('DUPLICATE') {
                                <span i18n="@@bank_programs.bands.error_duplicate"
                                  >Two bands start at the same amount — one would overwrite the
                                  other on save. Give each band its own starting amount.</span
                                >
                              }
                              @case ('ORDER') {
                                <span i18n="@@bank_programs.bands.error_ascending"
                                  >Each band must start higher than the one before it.</span
                                >
                              }
                            }
                          </p>
                        }
                        @if (bandsBelowFloorNote(); as note) {
                          <p class="bands-note">
                            <span
                              nz-icon
                              nzType="exclamation-circle"
                              nzTheme="outline"
                              aria-hidden="true"
                            ></span>
                            <span>{{ note }}</span>
                          </p>
                        }
                        <p class="bands-hint" i18n="@@bank_programs.bands.link_hint">
                          A band's end is the next band's start — edit either box and the other
                          follows.
                        </p>

                        <button
                          type="button"
                          nz-button
                          nzType="dashed"
                          class="bands-add"
                          (click)="addRateBand()"
                        >
                          <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
                          <span i18n="@@bank_programs.bands.add">Add band</span>
                        </button>
                      }
                    </div>
                  }
                </div>
              </section>

              <!-- Every fee the backend requires is on this step, in the open. -->
              <section class="card" formGroupName="fees">
                <header class="card-head">
                  <div>
                    <h2 class="card-title" i18n="@@bank_programs.form.fees_core.title">Fees</h2>
                    <p class="card-sub" i18n="@@bank_programs.form.fees_core.sub">
                      Pre-filled with platform defaults — change only what this program charges
                      differently.
                    </p>
                  </div>
                </header>
                <div class="grid">
                  <nz-form-item>
                    <nz-form-label
                      [nzFor]="'adminFeePercent2'"
                      nzRequired
                      i18n="@@bank_programs.field.admin_fee"
                      >Admin fee</nz-form-label
                    >
                    <nz-form-control [nzErrorTip]="fieldErrorTpl">
                      <nz-input-group nzAddOnAfter="%" class="rate-group">
                        <input
                          nz-input
                          id="adminFeePercent2"
                          formControlName="adminFeePercent"
                          inputmode="decimal"
                          placeholder="1.0000"
                        />
                      </nz-input-group>
                    </nz-form-control>
                  </nz-form-item>
                  <nz-form-item>
                    <nz-form-label nzRequired i18n="@@bank_programs.field.stamp_duty"
                      >Stamp duty</nz-form-label
                    >
                    <nz-form-control [nzErrorTip]="fieldErrorTpl">
                      <nz-input-group nzAddOnAfter="%" class="rate-group">
                        <input
                          nz-input
                          formControlName="stampDutyPercent"
                          inputmode="decimal"
                          placeholder="0.5000"
                        />
                      </nz-input-group>
                    </nz-form-control>
                  </nz-form-item>
                  <nz-form-item>
                    <nz-form-label nzRequired i18n="@@bank_programs.field.life_insurance"
                      >Life insurance</nz-form-label
                    >
                    <nz-form-control [nzErrorTip]="fieldErrorTpl">
                      <nz-input-group nzAddOnAfter="%" class="rate-group">
                        <input
                          nz-input
                          formControlName="lifeInsurancePercent"
                          inputmode="decimal"
                          placeholder="0.5000"
                        />
                      </nz-input-group>
                    </nz-form-control>
                  </nz-form-item>
                  <nz-form-item>
                    <nz-form-label nzRequired i18n="@@bank_programs.field.late_fee"
                      >Late payment fee</nz-form-label
                    >
                    <nz-form-control [nzErrorTip]="fieldErrorTpl">
                      <nz-input-group nzAddOnAfter="%" class="rate-group">
                        <input
                          nz-input
                          formControlName="latePaymentFeePercent"
                          inputmode="decimal"
                          placeholder="4.0000"
                        />
                      </nz-input-group>
                    </nz-form-control>
                  </nz-form-item>
                  <nz-form-item>
                    <nz-form-label nzRequired i18n="@@bank_programs.field.payoff_cash"
                      >Payoff (cash)</nz-form-label
                    >
                    <nz-form-control [nzErrorTip]="fieldErrorTpl">
                      <nz-input-group nzAddOnAfter="%" class="rate-group">
                        <input
                          nz-input
                          formControlName="payoffCashPercent"
                          inputmode="decimal"
                          placeholder="12.0000"
                        />
                      </nz-input-group>
                    </nz-form-control>
                  </nz-form-item>
                  <nz-form-item>
                    <nz-form-label nzRequired i18n="@@bank_programs.field.payoff_buyout"
                      >Payoff (buyout)</nz-form-label
                    >
                    <nz-form-control [nzErrorTip]="fieldErrorTpl">
                      <nz-input-group nzAddOnAfter="%" class="rate-group">
                        <input
                          nz-input
                          formControlName="payoffBuyoutPercent"
                          inputmode="decimal"
                          placeholder="15.0000"
                        />
                      </nz-input-group>
                    </nz-form-control>
                  </nz-form-item>
                  <nz-form-item class="span-2">
                    <label
                      nz-checkbox
                      formControlName="lifeInsuranceMandatory"
                      i18n="@@bank_programs.field.life_insurance_mandatory"
                      >Life insurance mandatory</label
                    >
                  </nz-form-item>
                </div>
              </section>
            }

            <!-- ═══ STEP 4 — ELIGIBILITY ════════════════════════════════════════ -->
            @if (currentStepId() === 'eligibility') {
              <section class="card" formGroupName="eligibility">
                <header class="card-head">
                  <div>
                    <h2 class="card-title" i18n="@@bank_programs.form.eligibility_core.title">
                      Eligibility
                    </h2>
                    <p class="card-sub" i18n="@@bank_programs.form.eligibility_core.sub">
                      Who qualifies — age, income, employment.
                    </p>
                  </div>
                </header>
                <div class="grid">
                  <nz-form-item>
                    <nz-form-label
                      [nzFor]="'ageMin'"
                      nzRequired
                      i18n="@@bank_programs.field.age_min"
                      >Minimum age</nz-form-label
                    >
                    <nz-form-control [nzErrorTip]="fieldErrorTpl">
                      <nz-input-number
                        id="ageMin"
                        class="num-field"
                        formControlName="ageMin"
                        [nzMin]="18"
                        [nzMax]="80"
                        [nzStep]="1"
                        [nzPrecision]="0"
                      ></nz-input-number>
                    </nz-form-control>
                  </nz-form-item>
                  <nz-form-item>
                    <nz-form-label
                      [nzFor]="'ageMax'"
                      nzRequired
                      i18n="@@bank_programs.field.age_max"
                      >Maximum age</nz-form-label
                    >
                    <nz-form-control [nzErrorTip]="fieldErrorTpl">
                      <nz-input-number
                        id="ageMax"
                        class="num-field"
                        formControlName="ageMax"
                        [nzMin]="18"
                        [nzMax]="80"
                        [nzStep]="1"
                        [nzPrecision]="0"
                      ></nz-input-number>
                    </nz-form-control>
                  </nz-form-item>
                  <nz-form-item>
                    <nz-form-label
                      [nzFor]="'minMonthlyIncomeEGP'"
                      nzRequired
                      i18n="@@bank_programs.field.min_income"
                      >Minimum monthly income</nz-form-label
                    >
                    <nz-form-control [nzErrorTip]="fieldErrorTpl">
                      <nz-input-group nzAddOnAfter="EGP" class="money-group">
                        <input
                          nz-input
                          appMoneyInput
                          id="minMonthlyIncomeEGP"
                          formControlName="minMonthlyIncomeEGP"
                          inputmode="numeric"
                          placeholder="5,000"
                        />
                      </nz-input-group>
                      <!-- Re-framed, never hidden: both fields still feed matching on a
                       no-payslip program, so removing them would be a lie. What changes
                       is which figure they are compared against. -->
                      @if (incomeSurrogateActive()) {
                        <p
                          class="field-hint"
                          i18n="@@bank_programs.field.min_income.no_payslip_hint_v2"
                        >
                          Checked against the figure the Calculation step produces, not income
                          proof.
                        </p>
                      }
                    </nz-form-control>
                  </nz-form-item>
                  <nz-form-item>
                    <nz-form-label
                      [nzFor]="'minMonthsInJob'"
                      nzRequired
                      i18n="@@bank_programs.field.min_months_job"
                      >Minimum months in job</nz-form-label
                    >
                    <nz-form-control [nzErrorTip]="fieldErrorTpl">
                      <nz-input-number
                        id="minMonthsInJob"
                        class="num-field"
                        formControlName="minMonthsInJob"
                        [nzMin]="0"
                        [nzMax]="240"
                        [nzStep]="1"
                        [nzPrecision]="0"
                      ></nz-input-number>
                      @if (incomeSurrogateActive()) {
                        <p
                          class="field-hint"
                          i18n="@@bank_programs.field.min_months_job.no_payslip_hint"
                        >
                          Still asked — tenure is not the same thing as income proof.
                        </p>
                      }
                    </nz-form-control>
                  </nz-form-item>
                  <nz-form-item class="span-2">
                    <nz-form-label nzRequired i18n="@@bank_programs.field.accepted_employment"
                      >Accepted employment types</nz-form-label
                    >
                    <nz-form-control [nzErrorTip]="fieldErrorTpl">
                      <nz-select
                        formControlName="acceptedEmploymentTypes"
                        nzMode="multiple"
                        nzPlaceHolder="Pick one or more"
                        [nzDropdownStyle]="dropdownStyle"
                      >
                        @for (o of employmentOptions(); track o.value) {
                          <nz-option [nzValue]="o.value" [nzLabel]="o.label"></nz-option>
                        }
                      </nz-select>
                    </nz-form-control>
                  </nz-form-item>
                  <nz-form-item class="span-2">
                    <nz-form-label nzRequired i18n="@@bank_programs.field.accepted_transfer"
                      >Accepted transfer types</nz-form-label
                    >
                    <nz-form-control [nzErrorTip]="fieldErrorTpl">
                      <nz-select
                        formControlName="acceptedTransferTypes"
                        nzMode="multiple"
                        nzPlaceHolder="Pick one or more"
                        [nzDropdownStyle]="dropdownStyle"
                      >
                        @for (o of transferOptions(); track o.value) {
                          <nz-option [nzValue]="o.value" [nzLabel]="o.label"></nz-option>
                        }
                      </nz-select>
                    </nz-form-control>
                  </nz-form-item>
                </div>
              </section>

              <!-- Debt burden: cap is REQUIRED, so it is visible on the step that
               owns eligibility rather than buried in an "advanced" panel. -->
              <section class="card" formGroupName="eligibility">
                <header class="card-head">
                  <div>
                    <h2 class="card-title" i18n="@@bank_programs.form.dbr.title">Debt burden</h2>
                    <p class="card-sub" i18n="@@bank_programs.form.dbr.sub">
                      Share of monthly income that may go to instalments.
                    </p>
                  </div>
                </header>
                <!-- The rule's own cap wins over everything on this card whenever the income came
                     from the calculation (resolveDbrCap: rule override, then by employment, then
                     bands, then flat). Said here so the two screens do not read as duplicates of
                     one setting — they are two settings, and this is which one is in force. -->
                @if (incomeSurrogateActive() && dbrOverrideValue(); as override) {
                  <p
                    class="dbr-rule-note"
                    role="status"
                    i18n="@@bank_programs.eligibility.dbr_rule_override_note"
                  >
                    The calculation on this program states its own debt-burden cap of
                    {{ override }}% — that one wins whenever the income came from the calculation.
                  </p>
                }
                <div class="card-body">
                  <!-- One number, one switch: stacked rather than side-by-side, so the
                 cap keeps a hand-sized field instead of stretching half the card,
                 and the toggle that overrides it reads as the wider decision. -->
                  <div class="dbr-grid">
                    <nz-form-item class="dbr-cap" [class.is-muted]="skipDbr">
                      <nz-form-label [nzFor]="'dbrCapPercent'" nzRequired>
                        <span i18n="@@bank_programs.field.dbr_cap">DBR cap</span>
                      </nz-form-label>
                      <nz-form-control [nzErrorTip]="fieldErrorTpl">
                        <nz-input-group nzAddOnAfter="%" class="rate-group">
                          <input
                            nz-input
                            id="dbrCapPercent"
                            formControlName="dbrCapPercent"
                            inputmode="decimal"
                            placeholder="50.0000"
                          />
                        </nz-input-group>
                        <p class="field-hint" i18n="@@bank_programs.field.dbr_cap.hint">
                          Counts every instalment the customer already carries.
                        </p>
                      </nz-form-control>
                    </nz-form-item>

                    <label
                      class="option-row"
                      [class.is-on]="skipDbr"
                      nz-checkbox
                      formControlName="skipDbrCheck"
                    >
                      <span class="option-text">
                        <span class="option-title" i18n="@@bank_programs.field.skip_dbr"
                          >Skip DBR check</span
                        >
                        <span class="option-hint" i18n="@@bank_programs.field.skip_dbr.hint">
                          Secured loans only. The cap above is ignored while matching.
                        </span>
                      </span>
                    </label>
                  </div>

                  <!-- The cap above is this program's floor for every income; the table
                 below refines it per income band. Dimmed — never disabled — while
                 the DBR check is skipped, exactly like the cap field. -->
                  <div class="dbr-bands" [class.is-muted]="skipDbr">
                    <h3 class="dbr-bands-title" i18n="@@bank_programs.eligibility.dbr_bands">
                      Caps by income band
                    </h3>
                    <app-dbr-bands-editor
                      [bands]="dbrBands()"
                      (bandsChange)="dbrBands.set($event)"
                      [flatCapPercent]="dbrFlatCap()"
                    ></app-dbr-bands-editor>
                  </div>

                  <!-- A cap that depends on WHO the applicant is rather than on what they
                       earn — the "50% salaried / 40% self-employed" half the sheets state.
                       It beats the band table when set, which is what the sheet means. -->
                  <div class="dbr-bands" [class.is-muted]="skipDbr">
                    <h3
                      class="dbr-bands-title"
                      i18n="@@bank_programs.eligibility.dbr_by_employment"
                    >
                      Caps by kind of applicant
                    </h3>
                    <p
                      class="dbr-emp-note"
                      i18n="@@bank_programs.eligibility.dbr_by_employment.note"
                    >
                      Leave a row blank to fall through to the bands above. A figure here wins for
                      that kind of applicant whatever they earn.
                    </p>
                    <div class="dbr-emp">
                      @for (bucket of employmentBuckets; track bucket) {
                        <label class="dbr-emp-row">
                          <span class="dbr-emp-label">{{ employmentBucketLabel(bucket) }}</span>
                          <span class="dbr-emp-field">
                            <input
                              class="dbr-emp-input"
                              type="text"
                              inputmode="decimal"
                              [value]="dbrByEmployment()[bucket] ?? ''"
                              (input)="setDbrForEmployment(bucket, $any($event.target).value)"
                              [attr.aria-label]="employmentBucketLabel(bucket)"
                            />
                            <span class="dbr-emp-unit" aria-hidden="true">%</span>
                          </span>
                        </label>
                      }
                    </div>
                  </div>
                </div>
              </section>
            }

            <!-- ═══ STEP 5 — DOCUMENTS & NOTES ══════════════════════════════════ -->
            @if (currentStepId() === 'documents') {
              <section class="card" formGroupName="documents">
                <header class="card-head">
                  <div>
                    <h2 class="card-title" i18n="@@bank_programs.form.documents.title">
                      Documents &amp; notes
                    </h2>
                    <p class="card-sub" i18n="@@bank_programs.form.documents.sub">
                      Required uploads and free-form operator notes.
                    </p>
                  </div>
                </header>
                <div class="grid">
                  <nz-form-item class="span-2">
                    <nz-form-label i18n="@@bank_programs.field.required_documents"
                      >Required documents</nz-form-label
                    >
                    <nz-form-control [nzErrorTip]="fieldErrorTpl">
                      <nz-select
                        formControlName="requiredDocuments"
                        nzMode="multiple"
                        nzPlaceHolder="Pick required documents"
                      >
                        @for (o of documentOptions(); track o.value) {
                          <nz-option [nzValue]="o.value" [nzLabel]="o.label"></nz-option>
                        }
                      </nz-select>
                    </nz-form-control>
                  </nz-form-item>
                  <nz-form-item class="span-2">
                    <nz-form-label [nzFor]="'operatorNotes'" i18n="@@bank_programs.field.notes"
                      >Notes</nz-form-label
                    >
                    <nz-form-control [nzErrorTip]="fieldErrorTpl">
                      <textarea
                        nz-input
                        id="operatorNotes"
                        formControlName="operatorNotes"
                        rows="3"
                        placeholder="Operator-facing notes (optional)"
                      ></textarea>
                    </nz-form-control>
                  </nz-form-item>
                </div>
              </section>
            }

            <!-- ═══ STEP 6 — REVIEW ═════════════════════════════════════════════
               A read-back, not a form: every row is a value the admin typed, and
               every group jumps straight back to the step that owns it. -->
            @if (currentStepId() === 'review') {
              <section class="card review">
                <header class="card-head">
                  <div>
                    <h2 class="card-title" i18n="@@bank_programs.form.review.title">Review</h2>
                    <p class="card-sub" i18n="@@bank_programs.form.review.sub">
                      Last look before this program starts producing offers. Any row can be
                      corrected in place.
                    </p>
                  </div>
                </header>

                <div class="card-body">
                  @for (g of reviewGroups(); track g.step) {
                    <div class="review-group">
                      <div class="review-group-head">
                        <h3 class="review-group-title">{{ g.title }}</h3>
                        <button type="button" class="review-edit" (click)="goTo(g.step)">
                          <span i18n="@@bank_programs.form.review.edit">Edit</span>
                        </button>
                      </div>
                      <dl class="review-list">
                        @for (r of g.rows; track r.label) {
                          <div class="review-row">
                            <dt>{{ r.label }}</dt>
                            <dd [class.is-empty]="!r.value">{{ r.value || emptyValueLabel }}</dd>
                          </div>
                        }
                      </dl>
                    </div>
                  }
                </div>
              </section>
            }
          </div>

          <!-- Pinned below the scrolling body, so the next action is always one
               glance away whatever the step's height. Submit stays enabled and
               REPORTS what is missing instead of going dead with no explanation. -->
          <footer class="form-footer">
            <button nz-button type="button" (click)="cancel()" [disabled]="busy()">
              <span i18n="@@bank_programs.form.cancel">Cancel</span>
            </button>
            <span class="footer-spacer"></span>
            @if (stepIndex() > 0) {
              <button nz-button type="button" (click)="prev()" [disabled]="busy()">
                <span nz-icon nzType="arrow-left" nzTheme="outline" aria-hidden="true"></span>
                <!-- "Previous", not "Back": the header link already means
                     "leave this form", and two Backs is one too many. -->
                <span i18n="@@bank_programs.form.back_step">Previous</span>
              </button>
            }
            @if (!isLastStep()) {
              <button nz-button nzType="primary" type="button" (click)="next()" [disabled]="busy()">
                <span i18n="@@bank_programs.form.next_step">Continue</span>
                <span nz-icon nzType="arrow-right" nzTheme="outline" aria-hidden="true"></span>
              </button>
            } @else {
              <button
                nz-button
                nzType="primary"
                type="button"
                (click)="submit()"
                [disabled]="busy() || enums.unavailable()"
                [nzLoading]="busy()"
              >
                @if (!busy()) {
                  <span
                    nz-icon
                    [nzType]="isEditMode() ? 'save' : 'plus'"
                    nzTheme="outline"
                    aria-hidden="true"
                  ></span>
                }
                <span>{{ isEditMode() ? saveLabel() : createLabel() }}</span>
              </button>
            }
          </footer>
        </form>
      }
    </section>
  `,
  styles: [
    `
      /* ── Debt burden card ─────────────────────────────────────────────────
         A percentage never needs half a card's width, and the toggle that
         overrides it is a decision, not a stray tick-box — so it gets a row of
         its own with the consequence spelled out under the label. */
      .dbr-grid {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .dbr-cap {
        max-inline-size: 16rem;
        transition: opacity 160ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      /* Dimmed, never disabled: the value still submits and still validates —
         the fade only says "this is not what decides the match right now". */
      .dbr-cap.is-muted {
        opacity: 0.55;
      }
      label.option-row {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        margin: 0;
        padding: var(--space-3) var(--space-4);
        border: 1px solid var(--border-default, var(--color-border-default));
        border-radius: var(--radius-lg);
        background: var(--bg-subtle, var(--color-surface-row-hover));
        transition:
          border-color 160ms cubic-bezier(0.4, 0, 0.2, 1),
          background-color 160ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      label.option-row:hover:not(.is-locked) {
        border-color: color-mix(
          in oklab,
          var(--primary, var(--color-brand-primary)) 38%,
          var(--border-default, var(--color-border-default))
        );
      }
      /* Muted, not hidden: the row still says what it is and what unlocks it.
         The pointer is refused on the whole label because the hit area IS the
         label — a not-allowed cursor over the text and a live one over the box
         would read as two different controls. */
      label.option-row.is-locked {
        opacity: 0.55;
        cursor: not-allowed;
      }
      label.option-row:focus-within {
        border-color: var(--primary, var(--color-brand-primary));
        box-shadow: var(--focus-halo);
      }
      label.option-row.is-on {
        border-color: color-mix(
          in oklab,
          var(--primary, var(--color-brand-primary)) 55%,
          transparent
        );
        background: var(--accent-subtle, var(--color-tonal-accent-bg));
      }
      .option-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        max-inline-size: 64ch;
        white-space: normal;
      }
      .option-title {
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--text-primary, var(--color-text-primary));
      }
      .option-hint {
        font-size: var(--text-xs);
        line-height: var(--line-height-base);
        color: var(--text-secondary, var(--color-text-secondary));
      }
      /* The band table is a second act inside the same card, so it gets a rule
         and an eyebrow rather than a card of its own — the cap and the bands are
         one decision read top to bottom. */
      .dbr-bands {
        margin-block-start: var(--space-4);
        padding-block-start: var(--space-4);
        border-block-start: 1px solid var(--border-default, var(--color-border-default));
        transition: opacity var(--motion-duration-base) var(--motion-easing-standard);
      }
      .dbr-bands.is-muted {
        opacity: 0.55;
      }
      .dbr-emp {
        display: grid;
        gap: var(--space-3);
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
        max-inline-size: 44rem;
      }
      .dbr-emp-row {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .dbr-emp-label {
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        color: var(--color-text-secondary);
      }
      .dbr-emp-field {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
      }
      .dbr-emp-input {
        inline-size: 6rem;
        min-block-size: var(--size-field);
        padding-inline: var(--space-3);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-field);
        background: var(--bg-subtle);
        color: var(--color-text-primary);
        font: inherit;
        font-size: var(--text-sm);
      }
      .dbr-emp-input:focus-visible {
        outline: none;
        border-color: var(--primary);
        box-shadow: var(--focus-halo);
      }
      .dbr-emp-unit {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }
      .dbr-emp-note {
        margin: 0 0 var(--space-3);
        max-inline-size: 44rem;
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        line-height: var(--line-height-base);
      }
      /* Same ramp and the same ink as .band-label. It was tertiary, which measures
         3.83:1 against the filled card it sits on — under AA at 12px, and this is the
         only thing naming the two tables under it. */
      .dbr-bands-title {
        margin: 0 0 var(--space-3);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        letter-spacing: var(--tracking-wide);
        text-transform: uppercase;
        color: var(--color-text-secondary);
      }
      @media (prefers-reduced-motion: reduce) {
        .dbr-cap,
        .dbr-bands,
        label.option-row {
          transition: none;
        }
      }

      .field-hint {
        margin: var(--space-1) 0 0;
        font-size: var(--text-xs);
        line-height: var(--line-height-base);
        color: var(--color-text-tertiary);
      }

      /* Not an nz-form error: the verdict comes from a signal, so nzErrorTip
         never fires for it. Styled to read at the same weight as one. */
      .field-warn {
        margin: var(--space-1) 0 0;
        font-size: var(--text-xs);
        line-height: var(--line-height-base);
        color: var(--color-warning);
      }

      /* Visually hidden but still focusable and still a real form control. Declared
         here because this component had none: the choice cards this block replaced
         set class="sr-only" on their radio and nothing defined it, so the native
         input rendered VISIBLE beside the faux dot — two radio affordances per
         card. The pills below use the same pattern and would inherit that. */
      .sr-only {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        margin: -1px;
        padding: 0;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
        border: 0;
      }

      /* Lifts the basis filter on the name picker. Quiet: the filtered view is the
         right one nearly always, and this is the exception. */
      .link-btn {
        align-self: flex-start;
        margin-block-start: var(--space-1);
        padding: 0;
        border: 0;
        background: transparent;
        font: inherit;
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--color-brand-primary);
        cursor: pointer;
        text-align: start;
      }
      .link-btn:hover {
        text-decoration: underline;
      }
      .link-btn:focus-visible {
        outline: 2px solid var(--color-brand-primary);
        outline-offset: 2px;
        border-radius: var(--radius-sm);
      }

      /* --- Step 5: the income answer, as one card of three bands ------------- */
      /* No rule of its own any more, and that is the point: this section is a plain
         .card now, laid out by the same label rail as Eligibility and Debt burden, and
         every declaration it used to carry either restated .card verbatim or lost to it
         in the cascade. What went with them: a hairline under the head, which never
         rendered anyway (it named --color-border-subtle, which this theme does not
         define, so the shorthand was invalid at computed-value time), and the head's
         two-up row, which the 17rem rail has no room for. */
      .income-lede {
        margin: var(--space-1) 0 0;
        max-inline-size: 68ch;
        font-size: var(--text-sm);
        line-height: 1.55;
        color: var(--color-text-secondary);
      }

      /*
       * ONE BAND PER DECISION, one label each, separated by a hairline.
       *
       * The three used to be a bordered section, a bare block and a bordered elevated
       * card — three treatments for three peers, which is why the step read as a list of
       * unrelated things rather than as one answer in three parts.
       */
      .income-band + .income-band {
        margin-block-start: var(--space-2);
        padding-block-start: var(--space-4);
        border-block-start: 1px solid var(--color-border-default);
      }
      /* SECONDARY, never tertiary: tertiary is #8C7E75, which measures 3.54:1 on this
         card and 3.83:1 on the filled one below — both under AA, and these labels are
         what the operator navigates the step by. */
      .band-label {
        margin: 0 0 var(--space-3);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        letter-spacing: var(--tracking-wide);
        text-transform: uppercase;
        color: var(--color-text-secondary);
      }
      .income-lede strong {
        font-weight: 650;
        color: var(--color-text-primary);
      }
      .income-catalog-link {
        display: inline-block;
        margin-block-start: var(--space-2);
        font-size: var(--text-sm);
      }
      .income-loading,
      .income-blocked {
        margin: 0;
        font-size: 0.8125rem;
        line-height: 1.55;
        color: var(--color-text-secondary);
      }
      /* The one state that stops the step. Warning ink and an accent spine, not an error
         card: nothing is broken, a decision is simply missing one screen away. */
      .income-blocked {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        padding: var(--space-3);
        border-radius: var(--radius-md);
        border-inline-start: var(--rule-width-accent) solid var(--ant-warning-color);
        background: var(--color-surface-elevated);
        color: var(--color-text-primary);
      }
      .income-blocked [nz-icon] {
        flex: none;
        margin-block-start: 0.15em;
        color: var(--ant-warning-color);
      }
      /* The amount fields wait for the method — same construction as the blocked notice
         (accent spine, inset surface), with the action inline. Ink at primary; the state is
         carried by the spine, because warning ink on its own wash measures 2.53:1. */
      .amount-locked {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: var(--space-2);
        margin: 0 0 var(--space-4);
        padding: var(--space-3);
        border-radius: var(--radius-md);
        border-inline-start: var(--rule-width-accent) solid var(--ant-warning-color);
        background: var(--color-surface-elevated);
        color: var(--color-text-primary);
        font-size: 0.8125rem;
        line-height: 1.55;
      }
      .amount-locked-cta {
        padding: 0;
        border: 0;
        background: none;
        color: var(--primary);
        font: inherit;
        font-weight: var(--font-semibold);
        text-decoration: underline;
        text-underline-offset: 0.15em;
        cursor: pointer;
      }
      .amount-locked-cta:hover {
        color: var(--primary-visible);
      }
      .amount-locked-cta:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
        border-radius: var(--radius-sm);
      }
      .dbr-rule-note {
        margin: 0 0 var(--space-3);
        font-size: 0.8125rem;
        line-height: 1.55;
        color: var(--color-text-secondary);
      }
      /* ── Where the numbers came from ─────────────────────────────────────
         A LABEL on the grid below, not a container around it. The editor draws its own
         borders and the header above draws a rule, so a third box here would be the
         hierarchy failure the block comment at the top of this step warns about.

         Same construction as the blocked notice above — inset surface, accent spine,
         medallion — because it does the same job: state a condition about what follows.
         The spine hue is the whole signal, so it is the only thing that moves between the
         two states: azure while the figures are the catalog's, bronze once they are this
         bank's. Bronze rather than a warning amber, because owning your own numbers is
         not a problem — it is the second brand hue doing what it is for. */
      .income-source {
        --source-accent: var(--color-brand-primary);
        position: relative;
        display: flex;
        align-items: flex-start;
        gap: var(--space-2-5);
        margin: 0 0 var(--space-4);
        padding: var(--space-3);
        overflow: hidden;
        border-radius: var(--radius-md);
        border-inline-start: var(--rule-width-accent) solid var(--source-accent);
        background: var(--color-surface-elevated);
        transition: border-color var(--motion-duration-base) var(--motion-easing-standard);
      }
      .income-source.is-own {
        --source-accent: var(--color-tonal-accent);
      }
      /* The catalog has nothing to inherit — a state to act on, not a fault in this form,
         so it is a warning accent and a wash rather than an error. */
      .income-source.is-empty {
        --source-accent: var(--color-warning);
        background: color-mix(in srgb, var(--color-warning) 12%, var(--color-surface-elevated));
      }
      /* Sized off the type, not a fixed pixel box, so it stays centred on the first line
         at every text scale. */
      .income-source-medallion {
        flex: none;
        display: grid;
        place-items: center;
        inline-size: 1.75em;
        block-size: 1.75em;
        border-radius: var(--radius-sm);
        background: color-mix(in srgb, var(--source-accent) 12%, transparent);
        color: var(--source-accent);
        font-size: 0.8125rem;
        transition:
          background-color var(--motion-duration-base) var(--motion-easing-standard),
          color var(--motion-duration-base) var(--motion-easing-standard);
      }
      .income-source-body {
        flex: 1 1 auto;
        min-inline-size: 0;
      }
      .income-source-line {
        display: block;
        max-inline-size: 68ch;
        font-size: 0.8125rem;
        line-height: 1.55;
        color: var(--color-text-secondary);
      }
      /* Quiet by construction: it undoes work, so it must not compete with the grid it
         sits above. Underline on hover rather than a filled button — the same treatment
         the name-picker's escape hatch uses two steps back. */
      /* WHAT THE FILL DID. Below the source strip and separate from it: the strip says
         whose numbers these are, which is a standing fact; this says what changed just now,
         which is a one-off. Secondary ink, because it is a sentence that has to be read and
         tertiary measures 3.83:1 on this ground in light mode. */
      .income-filled {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: var(--space-2);
        margin: var(--space-2) 0 0;
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
        animation: income-filled-in var(--motion-duration-base) var(--motion-easing-standard);
      }
      .income-filled-undo {
        padding: 0;
        border: 0;
        background: none;
        font: inherit;
        font-size: var(--text-xs);
        color: var(--color-brand-primary);
        text-decoration: underline;
        text-underline-offset: 2px;
        cursor: pointer;
      }
      .income-filled-undo:hover {
        color: var(--color-tonal-accent);
      }
      .income-filled-undo:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: 2px;
        border-radius: var(--radius-sm);
      }
      @media (hover: none) {
        .income-filled-undo {
          min-block-size: 44px;
          display: inline-flex;
          align-items: center;
        }
      }
      /* Entry only, ease-out, no bounce. */
      @keyframes income-filled-in {
        from {
          opacity: 0;
          transform: translateY(-2px);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .income-filled {
          animation: none;
        }
      }

      .income-source-reset {
        flex: none;
        align-self: center;
        padding: 0;
        border: 0;
        background: transparent;
        font: inherit;
        font-size: 0.75rem;
        font-weight: var(--font-weight-semibold);
        color: var(--color-tonal-accent);
        cursor: pointer;
        white-space: nowrap;
      }
      .income-source-reset:hover {
        text-decoration: underline;
      }
      .income-source-reset:focus-visible {
        outline: var(--focus-ring-width) solid var(--source-accent);
        outline-offset: var(--focus-ring-offset);
        border-radius: var(--radius-sm);
      }
      /* The detach beat. One sweep along the spine, once, the moment a program stops
         following the catalog — because that is a consequential and quiet change, and a
         toast for something the operator is mid-typing would be worse than nothing.
         Transform and opacity only; the element itself never moves. */
      .income-source.just-detached::after {
        content: '';
        position: absolute;
        inset-block: 0;
        inset-inline-start: 0;
        inline-size: 40%;
        pointer-events: none;
        background: linear-gradient(
          to inline-end,
          transparent,
          color-mix(in srgb, var(--source-accent) 14%, transparent),
          transparent
        );
        animation: source-sweep 620ms var(--motion-easing-standard) 1;
      }
      /* The sweep is the one piece of motion here that MOVES. Killed outright rather
         than shortened: its whole job is to draw the eye across, and a 0.01ms version is
         a flash, which is worse for exactly the users this query is for. The colour
         transitions stay — they carry the state, not the movement. */
      @media (prefers-reduced-motion: reduce) {
        .income-source {
          transition: none;
        }
        .income-source-medallion {
          transition: none;
        }
        .income-source.just-detached::after {
          animation: none;
          content: none;
        }
      }
      @keyframes source-sweep {
        from {
          transform: translateX(-100%);
          opacity: 0;
        }
        40% {
          opacity: 1;
        }
        to {
          transform: translateX(350%);
          opacity: 0;
        }
      }
      @supports selector(:has(*)) {
      }

      /* ── Fact-binding line (step 4) ───────────────────────────────
         The answer to "is the fact this method reads even set up?", shown while the
         method is being picked rather than as a toast after a failed save. */
      .binding {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: var(--space-2);
        margin: var(--space-2) 0 0;
        font-size: var(--text-xs);
        color: var(--color-success);
      }
      .binding.warn {
        color: var(--color-warning);
      }
      .binding a {
        font-weight: var(--font-weight-semibold);
        color: inherit;
        text-decoration: underline;
      }

      /* ── App-frame layout ────────────────────────────────────────
         The page grows to its content and lets the SHELL scroll it
         (<main class="content"> in app.component owns overflow-y). It used to
         pin itself to the scrollport and hand its overflow to an inner band,
         which squeezed the step body into whatever height the rail and the
         action bar left over — about 400px on a laptop — so a six-field step
         grew a scrollbar inside the white card while the window itself had
         none. One scrollbar, on the window, is the honest one.
         padding-block is 0 because .content already spends --space-6 top and
         bottom; the page was paying it twice, for 128px of dead vertical room.
         box-sizing is set here because this app has no global border-box
         reset — without it the inline padding would push the host past the
         scrollport and hand the shell a horizontal scrollbar. */
      :host {
        box-sizing: border-box;
        display: block;
        padding-block: 0;
        padding-inline: var(--space-6);
        max-width: var(--content-max-width);
        margin-inline: auto;
      }
      .page {
        display: flex;
        flex-direction: column;
      }
      .page-header {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        margin-block-end: var(--space-4);
      }
      .header-row {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-3) var(--space-5);
      }
      .title-block {
        flex: 1 1 340px;
      }
      .back-link {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        color: var(--text-secondary, var(--color-text-secondary));
        text-decoration: none;
        font-size: var(--text-sm);
        width: max-content;
      }
      .back-link:hover {
        color: var(--primary, var(--color-brand-primary));
      }
      .title-block {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .page-title {
        font-size: var(--text-2xl);
        font-weight: 700;
        margin: 0;
        color: var(--text-primary, var(--color-text-primary));
        letter-spacing: -0.01em;
      }
      .page-subtitle {
        margin: 0;
        font-size: var(--text-md);
        max-width: 72ch;
        color: var(--text-secondary, var(--color-text-secondary));
      }
      .form-body {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      /* The step body. Named for what it is — a stack of step cards — since it
         stopped owning a scrollport: the window scrolls it now. The inline
         padding + matching negative margin let focus halos and card shadows
         breathe instead of being clipped at the column edge. */
      .step-stack {
        display: flex;
        flex-direction: column;
        /* Sections are distinct decisions, fields inside one are not — so the
           gap BETWEEN cards has to beat the gap between the rows inside them,
           or the step reads as one undifferentiated wall. */
        gap: var(--space-5);
        padding-block: var(--space-2);
        padding-inline: var(--space-2);
        margin-inline: calc(var(--space-2) * -1);
      }

      /* ── Given chips (bank + loan type) ─────────────────────────────
         One shell for both so the row reads as a single band of decisions
         already made, not two unrelated badges. Colour lives in the avatar
         only — tinting the whole pill made the bank look like the selected
         item in a set of two, which it is not. */
      .bank-chip {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding: 4px var(--space-3) 4px 4px;
        background: var(--bg-surface, var(--color-surface-default));
        border: 1px solid var(--border-default, var(--color-border-default));
        border-radius: var(--radius-pill);
        align-self: flex-start;
      }
      .bank-chip-avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 28px;
        block-size: 28px;
        border-radius: 50%;
        background: var(--primary, var(--color-brand-primary));
        color: var(--text-on-primary, var(--color-text-on-brand));
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.02em;
      }
      .bank-chip-body {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .bank-chip-eyebrow {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: var(--text-tertiary, var(--color-text-tertiary));
        line-height: 1;
      }
      .bank-chip-name {
        font-size: 13px;
        font-weight: 700;
        line-height: 1.25;
        color: var(--text-primary, var(--color-text-primary));
      }
      /* ── Context row: decisions made BEFORE this form (bank + loan type) ──
         Same chip shell so they read as one band of givens. The loan-type chip
         carries no action: it is a fact, and the only affordance would be a
         picker this step deliberately does not offer. */
      .context-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        padding-block-start: var(--space-1);
      }
      .cat-chip-avatar {
        background: color-mix(in srgb, var(--cat) 13%, transparent);
        color: var(--cat);
        font-size: 14px;
      }

      /* Create with no loan type: a dead end unless we say where the choice is
         made, so the notice names the destination instead of just refusing. */
      .ctx-missing {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-4);
        border-radius: var(--radius-lg);
        background: var(--color-warning-bg, var(--accent-subtle, var(--color-tonal-accent-bg)));
        border: 1px solid
          color-mix(in srgb, var(--color-warning, var(--color-brand-primary)) 28%, transparent);
        color: var(--text-primary, var(--color-text-primary));
        font-size: var(--text-sm);
      }
      .ctx-missing a {
        font-weight: 600;
        color: var(--primary, var(--color-brand-primary));
        text-decoration: underline;
        text-underline-offset: 3px;
        border-radius: var(--radius-sm);
      }
      .ctx-missing a:focus-visible {
        outline: 2px solid var(--primary, var(--color-brand-primary));
        outline-offset: 2px;
      }
      .footer-spacer {
        flex: 1 1 auto;
      }

      .card {
        background: var(--bg-surface, var(--color-surface-default));
        border: 1px solid var(--border-default, var(--color-border-default));
        border-radius: var(--radius-lg);
        padding: var(--space-6);
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      /* A step whose whole body is already a set of surfaces does not need a surface
         behind it — that is a card holding cards, and the middle one carries no
         information. The rail and the grid geometry stay; only the fill, the border
         and the inline padding go, so the tiles sit on the page and the step reads
         as one question with two answers. */
      .card.is-bare {
        background: transparent;
        border-color: transparent;
        padding-inline: 0;
        padding-block: var(--space-1);
      }
      .card-head {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        margin-block-end: var(--space-1);
      }
      .card-icon {
        font-size: 22px;
        color: var(--accent, var(--color-tonal-accent));
        flex-shrink: 0;
      }
      .card-title {
        font-size: var(--text-lg);
        font-weight: 700;
        margin: 0 0 var(--space-1);
        color: var(--text-primary, var(--color-text-primary));
        letter-spacing: -0.005em;
      }
      .card-sub {
        font-size: var(--text-sm);
        margin: 0;
        max-width: 72ch;
        color: var(--text-secondary, var(--color-text-secondary));
      }

      /* ── Section shape: label rail + controls ─────────────────────────────
         What the extra page width buys is a scannable left edge of section
         names — NOT a 900px-wide box for a 7-digit number. From 1024 up, the
         section's title and the sentence explaining it move into a fixed rail
         and every control sits in the column beside it, so each step reads as
         a labelled list instead of a stack of near-empty panels. Below that,
         the rail has nowhere to go and it collapses back to head-over-fields.
         Children are placed by exclusion (:not(.card-head)) because the cards
         hold different things — a grid, a checkbox, a band table, review
         groups — and each of them belongs in the same right-hand column. */
      @media (min-width: 1024px) {
        .card {
          display: grid;
          grid-template-columns: minmax(0, 17rem) minmax(0, 1fr);
          column-gap: var(--space-7);
          row-gap: var(--space-4);
          align-items: start;
        }
        .card-head {
          grid-column: 1;
          grid-row: 1;
          margin-block-end: 0;
        }
        .card > :not(.card-head) {
          grid-column: 2;
        }
      }
      /* A card whose controls are more than one block wraps them here, so the
         rail and the controls stay two grid items. Without it each block claims
         its own row, and a tall rail (the tiered-rate explanation runs five
         lines) sets row 1's height — leaving the second block stranded a
         paragraph below the control it belongs to. */
      .card-body {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }

      /* Columns are bounded, not fractional: a min/max pair split across two
         1fr columns of a 900px card strands the second label half a screen
         from the first field. Capped columns keep the pair readable as a pair
         at every width the card can take. */
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 20rem));
        justify-content: start;
        column-gap: var(--space-5);
        row-gap: var(--space-4);
        align-items: start;
      }
      .grid > * {
        align-self: start;
        min-block-size: 0;
      }
      .grid .span-2 {
        grid-column: span 2;
      }
      @media (max-width: 720px) {
        .grid {
          grid-template-columns: minmax(0, 1fr);
        }
        .grid .span-2 {
          grid-column: span 1;
        }
      }

      /* ── Numeric fields ───────────────────────────────────────────────────
         Field width is a claim about the value. A rate is never longer than
         "26.5500" and a term never longer than "600", so boxes sized for a
         program name read as a different kind of question than they are.
         Tabular figures keep a column of amounts comparable digit-by-digit,
         which is the whole reason these numbers are here. */
      .money-group {
        max-inline-size: 20rem;
      }
      .rate-group {
        max-inline-size: 11rem;
      }
      /* Two peers, side by side: the choice is between two descriptions of one rate, and
         stacking them puts the second under the fold of a long form. Each carries its own
         consequence line, because "flat" and "declining" are the two words an operator is
         most likely to read past. */
      .rate-basis {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
        gap: var(--space-3);
        max-inline-size: 42rem;
      }
      .rate-basis-opt {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        padding: var(--space-3);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-field);
        background: var(--color-surface-default);
        cursor: pointer;
        transition:
          border-color var(--motion-fast) var(--ease-standard),
          background var(--motion-fast) var(--ease-standard);
      }
      .rate-basis-opt:hover {
        border-color: var(--color-accent-strong);
      }
      .rate-basis-opt:has(input:checked) {
        border-color: var(--color-accent-strong);
        background: var(--color-accent-subtle);
      }
      /* The ring goes on the label, not the 13px dot: the label IS the target. */
      .rate-basis-opt:has(input:focus-visible) {
        outline: 2px solid var(--color-accent-strong);
        outline-offset: 2px;
      }
      .rate-basis-opt input {
        margin-block-start: 0.15rem;
        accent-color: var(--color-accent-strong);
      }
      .rate-basis-body {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
      }
      .rate-basis-title {
        font-weight: 600;
        color: var(--color-text-primary);
      }
      /* Secondary, not tertiary: this is a sentence somebody has to read to choose. */
      .rate-basis-note {
        font-size: 0.8125rem;
        line-height: 1.45;
        color: var(--color-text-secondary);
      }
      @media (prefers-reduced-motion: reduce) {
        .rate-basis-opt {
          transition: none;
        }
      }
      nz-input-number.num-field {
        inline-size: 9rem;
      }
      :host ::ng-deep .money-group input.ant-input,
      :host ::ng-deep .rate-group input.ant-input {
        font-variant-numeric: tabular-nums lining-nums;
        font-feature-settings: var(--font-feature-tabular);
        letter-spacing: 0.01em;
      }
      /* The unit trails the number it belongs to — "50,000 EGP", the order it
         is read and spoken. Logical start, never left: in Arabic the addon
         flips to the other edge and the digits have to follow it. */
      :host ::ng-deep .money-group input.ant-input,
      :host ::ng-deep .rate-group input.ant-input {
        text-align: start;
      }
      :host ::ng-deep .num-field .ant-input-number-input {
        font-variant-numeric: tabular-nums lining-nums;
        font-feature-settings: var(--font-feature-tabular);
      }
      /* The addon is a unit, not a value: muted chip, never competing with the
         number it labels. */
      :host ::ng-deep .money-group .ant-input-group-addon,
      :host ::ng-deep .rate-group .ant-input-group-addon {
        background: var(--bg-muted, var(--color-surface-muted));
        color: var(--text-secondary, var(--color-text-secondary));
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        border-color: var(--border-default, var(--color-border-default));
        min-inline-size: 56px;
        text-align: center;
      }
      :host ::ng-deep .rate-group .ant-input-group-addon {
        min-inline-size: 44px;
      }

      /* Cross-field tenor error (max < min), shown under the Maximum input. */
      .field-error {
        display: block;
        margin-block-start: var(--space-1);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-medium);
        color: var(--color-error);
      }

      .form-footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: var(--space-3);
        border: none;
        border-block-start: 1px solid var(--border-default, var(--color-border-default));
      }
      .manual-error {
        margin-block-start: 4px;
        font-size: 12px;
        color: var(--error, var(--color-error));
        line-height: 1.4;
      }
      .unavailable {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--space-10);
        gap: var(--space-3);
        text-align: center;
        background: var(--bg-surface, var(--color-surface-default));
        border: 1px solid var(--border-default, var(--color-border-default));
        border-radius: var(--radius-lg);
      }
      .unavailable-icon {
        font-size: 56px;
        width: 56px;
        height: 56px;
        color: var(--text-tertiary, var(--color-text-tertiary));
      }
      .unavailable-text {
        margin: 0;
        font-size: var(--text-md);
        color: var(--text-primary, var(--color-text-primary));
      }

      /* Tiered-rate band editor */
      .bands {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .bands-empty {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-4);
        margin: 0;
        padding: var(--space-4);
        border: 1px dashed var(--border-default, var(--color-border-default));
        border-radius: var(--radius-lg);
        background: var(--bg-subtle, var(--color-surface-row-hover));
      }
      .bands-empty-text {
        margin: 0;
        max-inline-size: 46ch;
        font-size: var(--text-sm);
        color: var(--text-secondary, var(--color-text-secondary));
      }
      .bands-head {
        display: grid;
        grid-template-columns: minmax(0, 26rem) minmax(0, 11rem) 44px;
        justify-content: start;
        gap: var(--space-3);
        padding-inline: var(--space-1);
        font-size: var(--text-xs);
        font-weight: 600;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        color: var(--text-tertiary, var(--color-text-tertiary));
      }
      /* Mirrors .band-range so "From"/"To" sit over the boxes they name. */
      .bands-head-range {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
      }
      .bands-head-range > span:first-child,
      .bands-head-range > span:last-child {
        inline-size: 10.5rem;
      }
      .band-row {
        display: grid;
        grid-template-columns: minmax(0, 26rem) minmax(0, 11rem) 44px;
        justify-content: start;
        gap: var(--space-3);
        align-items: start;
      }
      /* from → to reads as one range, so the boundary being typed is the boundary
         whose effect is visible. */
      .band-range {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        min-inline-size: 0;
      }
      /* The two edge boxes hold their width so the arrow, the open end and the
         unit stay on one vertical line all the way down the table. */
      .band-range > .band-cell,
      .band-range > .band-edge {
        flex: 0 0 auto;
      }
      .band-edge {
        inline-size: 10.5rem;
        font-variant-numeric: tabular-nums;
      }
      .band-arrow {
        display: inline-flex;
        align-items: center;
        block-size: 44px;
        color: var(--text-tertiary, var(--color-text-tertiary));
      }
      /* The arrow points from the lower edge to the upper one, which is the
         reading direction — it must flip in Arabic, and no logical property can
         do that to a glyph. */
      :host-context([dir='rtl']) .band-arrow {
        transform: scaleX(-1);
      }
      .band-unit {
        display: inline-flex;
        align-items: center;
        block-size: 44px;
        font-size: var(--text-xs);
        color: var(--text-tertiary, var(--color-text-tertiary));
      }
      /* The open end. Sized like an edge box so the arrow stays on one vertical
         line down the table instead of stepping in and out. */
      .band-open {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 10.5rem;
        block-size: 44px;
        font-size: var(--text-sm);
        color: var(--text-tertiary, var(--color-text-tertiary));
      }
      .bands-hint {
        margin: 0;
        font-size: var(--text-xs);
        color: var(--text-tertiary, var(--color-text-tertiary));
      }
      .bands-error {
        margin: 0;
        font-size: var(--text-xs);
        color: var(--danger, #b42318);
      }
      /* Bands below the first floor fall through to the flat rate above — a
         legal configuration, so this informs rather than blocks. */
      .bands-note {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        margin: 0;
        padding: var(--space-2) var(--space-3);
        border-radius: var(--radius-md, 8px);
        font-size: var(--text-xs);
        color: var(--text-secondary, var(--color-text-secondary));
        background: var(--color-warning-bg, var(--bg-subtle));
      }
      .bands-note [nz-icon] {
        color: var(--color-warning);
      }
      .band-cell {
        margin: 0;
      }
      .band-remove {
        inline-size: 44px;
        block-size: 44px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--border-default, var(--color-border-default));
        border-radius: var(--radius-md, 8px);
        background: var(--bg-surface, var(--color-surface-default));
        color: var(--text-tertiary, var(--color-text-tertiary));
        cursor: pointer;
        transition:
          color 160ms cubic-bezier(0.4, 0, 0.2, 1),
          border-color 160ms cubic-bezier(0.4, 0, 0.2, 1),
          background-color 160ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .band-remove:hover {
        color: var(--danger, #b42318);
        border-color: color-mix(in oklab, var(--danger, #b42318) 50%, var(--border-default));
        background: color-mix(in oklab, var(--danger, #b42318) 7%, var(--bg-surface));
      }
      .band-remove:focus-visible {
        outline: none;
        border-color: var(--danger, #b42318);
        box-shadow: var(--focus-halo);
      }
      .bands-add {
        align-self: flex-start;
      }
      @media (max-width: 720px) {
        .bands-head {
          display: none;
        }
        /* Range on its own line: two money boxes and a rate do not fit one row.
           A band now spans two lines, so a hairline says where one band ends —
           otherwise it is guesswork which rate belongs to which range. */
        .band-row {
          grid-template-columns: minmax(0, 1fr) 44px;
          row-gap: var(--space-2);
          padding-block-end: var(--space-3);
          border-block-end: 1px dashed var(--border-default, var(--color-border-default));
        }
        .band-row:last-of-type {
          padding-block-end: 0;
          border-block-end: 0;
        }
        /* Wrap rather than squeeze: a clipped "350,0" is worse than a second line. */
        .band-range {
          grid-column: 1 / -1;
          flex-wrap: wrap;
        }
        .band-range > .band-cell,
        .band-range > .band-edge,
        .band-open {
          flex: 1 1 8rem;
          min-inline-size: 0;
          inline-size: auto;
        }
        .band-cell .band-edge {
          inline-size: 100%;
        }
      }

      /* ── Wizard: rail block + issue banner ──────────────────────── */
      /* The rail and the issue banner sit together as ONE block above the step
         body. It scrolls away with the page — the action bar is what has to stay
         reachable, and two pinned bars on a 800px viewport is most of the screen
         spent on chrome. */
      .wizard-rail {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        padding-block-end: var(--space-3);
      }
      /* The rail itself is app-wizard-steps — chip, marker words, disabled
         gate and both responsive collapses are the component's, not this
         page's. Only the banner that reports THIS form's validation is local. */
      .step-alert {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-4);
        border-radius: var(--radius-lg);
        border: 1px solid color-mix(in oklab, var(--color-error) 32%, transparent);
        background: var(--color-error-bg);
        color: var(--error-500);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
      }

      /* Cards are re-created on every step change, so the entry animation plays
         once per step — a directional cue, not decoration. */
      .step-stack > .card,
      .step-stack > app-income-assumption-section,
      .step-stack > .ctx-missing {
        animation: step-enter var(--motion-duration-base) var(--motion-easing-standard) both;
      }
      .step-stack > section.card:nth-of-type(2) {
        animation-delay: 30ms;
      }
      .step-stack > section.card:nth-of-type(3) {
        animation-delay: 60ms;
      }
      @keyframes step-enter {
        from {
          opacity: 0;
          transform: translateY(6px);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .step-stack > .card,
        .step-stack > app-income-assumption-section,
        .step-stack > .ctx-missing {
          animation: none;
        }
      }

      /* ── Review step ────────────────────────────────────────────── */
      .review-group + .review-group {
        border-block-start: 1px solid var(--border-default, var(--color-border-default));
        padding-block-start: var(--space-4);
      }
      .review-group-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--space-3);
        margin-block-end: var(--space-2);
      }
      .review-group-title {
        margin: 0;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-bold);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--text-tertiary, var(--color-text-tertiary));
      }
      .review-edit {
        appearance: none;
        background: transparent;
        border: none;
        cursor: pointer;
        padding: var(--space-1) var(--space-2);
        border-radius: var(--radius-pill);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--primary, var(--color-brand-primary));
        transition: background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .review-edit:hover {
        background: var(--accent-subtle, var(--color-tonal-accent-bg));
      }
      .review-edit:focus-visible {
        outline: var(--focus-ring-width) solid var(--primary, var(--color-brand-primary));
        outline-offset: var(--focus-ring-offset);
      }
      .review-list {
        margin: 0;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-2) var(--space-5);
      }
      .review-row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--space-3);
        padding-block: var(--space-1);
        border-block-end: 1px dotted var(--border-default, var(--color-border-default));
      }
      .review-row dt {
        font-size: var(--text-sm);
        color: var(--text-secondary, var(--color-text-secondary));
      }
      .review-row dd {
        margin: 0;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--text-primary, var(--color-text-primary));
        text-align: end;
        font-variant-numeric: tabular-nums;
      }
      .review-row dd.is-empty {
        font-weight: var(--font-weight-regular);
        color: var(--text-tertiary, var(--color-text-tertiary));
      }
      @media (max-width: 720px) {
        .review-list {
          grid-template-columns: minmax(0, 1fr);
        }
      }

      /* In-flow action bar, at the END of the step — not pinned. It used to be
         position: sticky / inset-block-end: 0 against the shell scrollport, so
         on a short step it floated in the middle of empty page and on a long one
         it hovered over the cards it belongs after. The step body is the thing
         being read; the bar is what you reach when it is done.
         Inline padding + matching negative margin are kept so the top rule spans
         the full width of .step-stack rather than stopping inside it. */
      .form-footer {
        padding-block: var(--space-4);
        padding-inline: var(--space-2);
        margin-inline: calc(var(--space-2) * -1);
      }
      /* Direction arrows are glyphs, not logical properties — flip them in RTL
         so "Back" and "Continue" keep pointing the way the reader travels. */
      :host-context([dir='rtl']) .form-footer .anticon-arrow-left,
      :host-context([dir='rtl']) .form-footer .anticon-arrow-right {
        transform: scaleX(-1);
      }
    `,
  ],
})
export class BankProgramFormPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(BankProgramsApiService);
  private readonly message = inject(NzMessageService);
  /** Via NzModalService so the scrim covers the whole viewport, never the panel (A34). */
  private readonly modal = inject(NzModalService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notification = inject(NzNotificationService);
  private readonly errorsService = inject(ErrorCodeService);
  readonly enums = inject(PlatformEnumerationsService);

  /**
   * The operator-defined income FACTS, from the same signal cache every picker reads.
   *
   * Held here as well as in the section because two things outside it need the list:
   * the review read-back (a fact's NAME, not its key) and the payload builder (which
   * shape the rule is, which for a fact follows its bound question).
   */
  protected readonly incomeFacts = computed(() =>
    registryFacts(
      this.enums.membersFor('surrogate_fact')(),
      document.documentElement.lang.startsWith('ar'),
    ),
  );
  /**
   * This program's additional-income policy. `null` = it counts none, which is every program
   * written before the field existed.
   */
  readonly additionalIncome = signal<AdditionalIncomeConfig | null>(null);

  /**
   * The sources of money the applicant also receives — and ONLY those.
   *
   * Every rule of the derivation, and the seventeen-row table it replaces, is written out
   * once in `additional-income-sources.ts`. Restated here it would be the second copy.
   */
  protected readonly additionalIncomeOptions = computed<AdditionalIncomeOption[]>(() =>
    additionalIncomeSources(
      this.incomeFacts(),
      (this.additionalIncome()?.sources ?? []).map((source) => source.factKey),
    ),
  );

  private readonly banksApi = inject(BanksApiService);
  private readonly localeIsAr = inject(LOCALE_ID).toLowerCase().startsWith('ar');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly busy = signal(false);
  readonly dropdownStyle: Record<string, string> = { 'max-height': '360px', 'min-height': '120px' };
  readonly activeBanks = signal<BankWithProgramCount[]>([]);
  /** Typed Reactive Form control backing the bank picker (UI-side; not part of the
   *  main form group — its value drives bankId in the create/update payload and
   *  mirrors into identity.bankName via valueChanges). */
  readonly bankIdControl = new FormControl<string | null>(null);
  /** Mirror of bankIdControl.value as a signal for template + payload reads. */
  readonly selectedBankId = toSignal(this.bankIdControl.valueChanges, {
    initialValue: this.bankIdControl.value,
  });

  /** Back / cancel target: the selected bank's detail page (registry fallback). */
  readonly backLink = computed<unknown[]>(() => {
    const id = this.selectedBankId();
    return id ? ['/banks', id] : ['/banks'];
  });

  // ── Wizard (FR-011 revisited) ────────────────────────────────────────────
  /**
   * A 7-step wizard, with the defect that killed the previous one designed out:
   * **no control hides behind a disclosure.** Every fee, the DBR cap and the rate
   * all render in the open on the step that owns them, so an admin can never be
   * blocked by a field they were never shown, and the rail marks the exact step
   * that still needs attention.
   *
   * `income` is a step of its own rather than the first field of `program`, because
   * the rest of the wizard is downstream of it: it narrows the program names step 2
   * may offer, and it decides whether `eligibility` carries a whole rate-table
   * editor. A question that reshapes two later steps is not a field.
   */
  private readonly stepDefs: Readonly<Record<StepId, WizardStep>> = {
    income: { id: 'income', label: $localize`:@@bank_programs.step.income:Income`, groups: [] },
    program: {
      id: 'program',
      label: $localize`:@@bank_programs.step.program:Program`,
      groups: ['identity'],
    },
    // Surrogate programs only. The income block — the ways, their figures, the I-Score
    // table, the rule's own DBR cap, the check panel — moved here from Eligibility so the
    // method is stated BEFORE the amounts it governs. See `wizard-step-plan.ts`.
    calculation: {
      id: 'calculation',
      label: $localize`:@@bank_programs.step.calculation:Calculation`,
      groups: ['incomeAssumption'],
    },
    terms: {
      id: 'terms',
      label: $localize`:@@bank_programs.step.terms:Amount & duration`,
      railLabel: $localize`:@@bank_programs.step.terms_short:Amount`,
      groups: ['loanLimits', 'tenor'],
    },
    pricing: {
      id: 'pricing',
      label: $localize`:@@bank_programs.step.pricing:Pricing & fees`,
      railLabel: $localize`:@@bank_programs.step.pricing_short:Pricing`,
      groups: ['pricing', 'fees'],
    },
    eligibility: {
      id: 'eligibility',
      label: $localize`:@@bank_programs.step.eligibility:Eligibility`,
      groups: ['eligibility'],
    },
    documents: {
      id: 'documents',
      label: $localize`:@@bank_programs.step.documents:Documents`,
      groups: ['documents'],
    },
    review: { id: 'review', label: $localize`:@@bank_programs.step.review:Review`, groups: [] },
  };
  /**
   * The steps THIS program walks. Eight for a surrogate program, seven for a payslip one —
   * keyed off the same synchronous boolean the income block was always gated on, so the list
   * can only change shape while the operator stands on the Income step.
   */
  readonly steps = computed<readonly WizardStep[]>(() =>
    stepIdsFor(this.incomeSurrogateActive()).map((id) => this.stepDefs[id]),
  );
  readonly stepsAria = $localize`:@@bank_programs.steps.aria:Program setup steps`;
  /**
   * The step on stage, held as an ID. Indices are DERIVED from it against the current list,
   * so a list that changes shape moves nobody: `indexOfOrPreceding` answers the nearest
   * earlier step still present rather than `-1`.
   */
  readonly currentStepId = signal<StepId>('income');
  readonly stepIndex = computed(() => indexOfOrPreceding(this.steps(), this.currentStepId()));
  /** Highest step reached — the rail only lets an admin jump to what they've seen. */
  readonly furthestStepId = signal<StepId>('income');
  readonly furthestStep = computed(() => indexOfOrPreceding(this.steps(), this.furthestStepId()));
  /** Set when Continue / Create is refused, cleared on every step change. */
  readonly showStepIssues = signal(false);

  readonly isLastStep = computed(() => this.stepIndex() === this.steps().length - 1);
  readonly stepCaption = computed(() => {
    const current = this.stepIndex() + 1;
    const total = this.steps().length;
    const label = this.steps()[this.stepIndex()]?.label ?? '';
    return $localize`:@@bank_programs.step.caption:Step ${current}:current: of ${total}:total: · ${label}:label:`;
  });
  /** "Seven short steps" was a literal; the count is the list's, so 7 and 8 both read true. */
  readonly subtitle = computed(() => {
    const count = this.steps().length;
    return $localize`:@@bank_programs.form.subtitle_counted:${count}:COUNT: short steps. Every number belongs to this program alone, and nothing is saved until you confirm on the last step.`;
  });

  /** A step's position on THIS program's rail — `-1` when the program does not walk it. */
  indexOf(id: StepId): number {
    return indexOfStep(this.steps(), id);
  }
  labelOf(id: StepId): string {
    return this.stepDefs[id].label;
  }

  /**
   * The shared rail's model.
   *
   * Deliberately a method, not a `computed`: a step's marker turns on `touched`
   * + `invalid`, and `touched` flips on blur without emitting through any of
   * this page's `toSignal(valueChanges)` streams — a computed would show a stale
   * rail until the next keystroke. Change detection already re-reads it; the
   * cache keeps the child's input identity stable so re-reading is not a
   * re-render.
   */
  railSteps(): readonly WizardStepItem[] {
    const next = this.steps().map((s, i) => ({
      id: s.id,
      label: s.railLabel ?? s.label,
      status: this.isStepInvalidTouched(i)
        ? ('invalid' as const)
        : this.isStepComplete(i)
          ? ('done' as const)
          : ('todo' as const),
      disabled: !this.canJumpTo(i),
    }));
    const key = next.map((s) => `${s.id}:${s.status}${s.disabled ? '!' : ''}`).join('|');
    if (key !== this.railKey) {
      this.railKey = key;
      this.railCache = next;
    }
    return this.railCache;
  }
  private railKey = '';
  private railCache: readonly WizardStepItem[] = [];

  private stepControls(index: number): AbstractControl[] {
    const step = this.steps()[index];
    if (!step) return [];
    return step.groups
      .map((name) => this.form.get(name))
      .filter((c): c is AbstractControl => c !== null);
  }

  isStepValid(index: number): boolean {
    if (!this.stepControls(index).every((c) => c.valid)) return false;
    // The income step owns no control — `programType` has a default, so the group it
    // lives in is valid before anybody has answered. Its answer is a signal, and this
    // is what stops Continue walking past an unanswered question into a name picker
    // that would then have nothing to filter on.
    if (this.steps()[index]?.id === 'income' && this.basisAnswered() === null) return false;
    // The DBR band table lives in a signal, not a control, so step validity has
    // to ask it directly — otherwise a broken table would sail past Continue and
    // only fail on the server (`DBR_BANDS_INVALID`).
    if (this.steps()[index]?.id === 'eligibility' && this.dbrBandsError() !== null) return false;
    // Same reason for the maximum-by-answer table, which is a signal on the `terms` step:
    // a broken table would sail past Continue and only fail on the server
    // (`MAX_LOAN_BY_FACT_INVALID`).
    if (this.steps()[index]?.id === 'terms' && this.maxLoanByFactError() !== null) return false;
    // Same reason: the name↔category verdict lives in a signal, so Continue
    // would sail past it and the save would fail on the server
    // (`PROGRAM_NAME_KEY_NOT_IN_CATEGORY`).
    if (this.steps()[index]?.id === 'program' && this.programNameMismatch() !== null) return false;
    // Same reason again for the income rule — its way, its tables — which are signals too.
    // Without this the wizard's "which step is blocked" search could not find the one
    // holding a broken rule, and `submit()` would return having moved nowhere.
    if (this.steps()[index]?.id === 'calculation' && this.incomeRuleError()) return false;
    return true;
  }

  /**
   * Green check: a step already visited, left behind, and holding valid values.
   *
   * Keyed off the review step by NAME, not by "owns no groups" — `income` owns none
   * either, and it is the one step that most deserves a tick: the rest of the wizard
   * is filtered by its answer. Only `review` is never complete, because reading the
   * form back is not a thing that can be finished.
   */
  isStepComplete(index: number): boolean {
    const step = this.steps()[index];
    if (!step || step.id === 'review') return false;
    return index !== this.stepIndex() && index <= this.furthestStep() && this.isStepValid(index);
  }

  /** Red marker: a visited step the admin still has to come back to. */
  isStepInvalidTouched(index: number): boolean {
    if (index === this.stepIndex()) return false;
    return this.stepControls(index).some((c) => c.touched && c.invalid);
  }

  canJumpTo(index: number): boolean {
    return index <= this.furthestStep();
  }

  goTo(index: number): void {
    if (index === this.stepIndex() || !this.canJumpTo(index)) return;
    // Jumping forward through the rail passes the same gate as Continue.
    if (index > this.stepIndex() && !this.commitStep()) return;
    this.showStepIssues.set(false);
    this.currentStepId.set(this.steps()[index]?.id ?? 'income');
    this.revealStepStart();
  }

  next(): void {
    if (this.isLastStep() || !this.commitStep()) return;
    const target = this.steps()[this.stepIndex() + 1];
    if (target === undefined) return;
    this.currentStepId.set(target.id);
    this.reach(target.id);
    this.showStepIssues.set(false);
    this.revealStepStart();
  }

  prev(): void {
    if (this.stepIndex() === 0) return;
    this.showStepIssues.set(false);
    this.currentStepId.set(this.steps()[this.stepIndex() - 1]?.id ?? 'income');
    this.revealStepStart();
  }

  /** Advance the furthest-reached marker, in canonical order, never backwards. */
  private reach(id: StepId): void {
    this.furthestStepId.update((reached) => (isLaterStep(id, reached) ? id : reached));
  }

  /**
   * Validates the step being left. On failure it marks the step's controls so the
   * inline errors appear, surfaces the count, and focuses the first bad field —
   * the admin never has to hunt for what blocked them.
   */
  private commitStep(): boolean {
    const controls = this.stepControls(this.stepIndex());
    if (!this.isStepValid(this.stepIndex())) {
      // A step whose verdict is a SIGNAL rather than a control has nothing for the control
      // walk to reveal — `income` (no groups at all), but also `calculation` (an unpicked
      // way beside a valid group), `terms` (a broken cap table) and `program` (the name↔
      // category verdict). The old escape keyed on "owns no groups", so the last three
      // fell through to the control walk, found every control valid, and Continue advanced
      // past a broken cap table with nothing said.
      if (controls.every((c) => c.valid)) {
        this.showStepIssues.set(true);
        return false;
      }
      for (const c of controls) revealErrors(c);
      this.showStepIssues.set(true);
      this.focusFirstInvalid();
      return false;
    }
    this.showStepIssues.set(false);
    return true;
  }

  /**
   * Number of fields on the current step that still fail validation.
   *
   * The income step has no field, so its unanswered question counts as one — the
   * rail's alert is gated on this being above zero, and a step that blocks Continue
   * while reporting nothing is the worst of both.
   */
  stepIssueCount(): number {
    const id = this.steps()[this.stepIndex()]?.id;
    if (id === 'income') return this.basisAnswered() === null ? 1 : 0;
    // The rule's verdict and the cap table's are signals, so the leaf count reads 0 for
    // them — and the rail's alert is gated on this being above zero. A step that refuses
    // Continue while reporting nothing is the worst of both.
    if (id === 'calculation' && this.incomeRuleError()) return 1;
    if (id === 'terms' && this.maxLoanByFactError() !== null) return 1;
    return this.stepControls(this.stepIndex()).reduce((sum, c) => sum + countInvalidLeaves(c), 0);
  }

  stepIssueLabel(): string {
    const id = this.steps()[this.stepIndex()]?.id;
    if (id === 'income') {
      return $localize`:@@bank_programs.step.issue_income:Choose how the bank reads the income before you continue.`;
    }
    if (id === 'calculation' && this.incomeRuleError()) {
      return $localize`:@@bank_programs.step.issue_calculation:Say how this bank works the figure out — pick a way and fill its numbers — before you continue.`;
    }
    if (id === 'terms' && this.maxLoanByFactError() !== null) {
      return $localize`:@@bank_programs.step.issue_fix:Something on this step needs fixing before you continue — see the message in red.`;
    }
    const count = this.stepIssueCount();
    // A cross-field verdict (tenor min > max, rate bands out of order) leaves
    // every field filled, so "needs a value" would send the admin hunting for an
    // empty box that does not exist.
    const empties = this.stepControls(this.stepIndex()).reduce(
      (sum, c) => sum + countInvalidFields(c),
      0,
    );
    if (empties === 0 && count > 0) {
      return $localize`:@@bank_programs.step.issue_fix:Something on this step needs fixing before you continue — see the message in red.`;
    }
    return count === 1
      ? $localize`:@@bank_programs.step.issue_one:1 field on this step needs a value before you continue.`
      : $localize`:@@bank_programs.step.issue_many:${count}:count: fields on this step need a value before you continue.`;
  }

  private get prefersReducedMotion(): boolean {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  }

  /**
   * A new step starts at its own top.
   *
   * The scroller is the SHELL's (`<main class="content">`), not a band inside this
   * page — so the reset has to reach up to it. Landing halfway down step 4 because
   * step 3 was scrolled that far is the same disorientation the old inner scroller
   * was reset to avoid; only the element that holds the offset changed.
   * Falls back to the window in case the page is ever hosted outside the shell.
   */
  private revealStepStart(): void {
    const behavior = this.prefersReducedMotion ? 'auto' : 'smooth';
    const scroller = this.host.nativeElement.closest<HTMLElement>('.content');
    if (scroller) {
      scroller.scrollTo({ top: 0, behavior });
      return;
    }
    globalThis.scrollTo?.({ top: 0, behavior });
  }

  private focusFirstInvalid(): void {
    // One tick out so ng-zorro has stamped `.ant-form-item-has-error`.
    setTimeout(() => {
      const el = this.host.nativeElement.querySelector<HTMLElement>(
        '.ant-form-item-has-error input:not([disabled]), .ant-form-item-has-error textarea, .ant-form-item-has-error .ant-select-selector',
      );
      if (!el) return;
      el.focus();
      el.scrollIntoView({
        block: 'center',
        behavior: this.prefersReducedMotion ? 'auto' : 'smooth',
      });
    });
  }

  initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }

  /**
   * Feature 010: the "Optional features" checkbox grid is gone. Five of its six
   * switches gated fields the matching engine never read (buyout rate delta +
   * floor, Sharia contract type, down-payment percent + LTV ceiling) or merely
   * duplicated a field that already existed:
   *   - variable rate      -> `pricing.isVariableRate`, a checkbox beside the rate
   *   - income surrogate   -> derived from `identity.programType`
   *   - Sharia-compliant   -> `identity.isShariaCompliant`, a program attribute
   * Only tiered-by-amount rates remain a real opt-in, because it swaps a single
   * rate for a band table. It lives in Advanced.
   */
  readonly toggles = {
    tieredRates: signal(false),
  } as const;

  /**
   * Income-assumption fields follow the program TYPE rather than a separate
   * switch — an `income_surrogate` program by definition estimates income, and
   * having two controls that had to agree was a standing source of bad data.
   */
  readonly incomeSurrogateActive = computed(() => this.programTypeSignal() === 'income_surrogate');

  readonly mode = toSignal(
    this.route.url.pipe(map((seg) => (seg[seg.length - 1]?.path === 'edit' ? 'edit' : 'create'))),
    { initialValue: 'create' as const },
  );
  readonly editProgramCode = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('programCode') ?? '')),
    { initialValue: '' },
  );
  readonly isEditMode = computed(() => this.mode() === 'edit');

  readonly createTitle = signal($localize`:@@bank_programs.form.title_create:Add bank program`);
  /** Bank name of the program being edited; drives the named edit title. */
  readonly editBankName = signal<string>('');
  readonly editTitle = computed(() => {
    const name = this.editBankName();
    return name
      ? $localize`:@@bank_programs.form.title_edit_named:Edit ${name}:bankName: bank program`
      : $localize`:@@bank_programs.form.title_edit:Edit bank program`;
  });
  readonly createLabel = signal($localize`:@@bank_programs.form.cta_create:Create bank program`);
  readonly saveLabel = signal($localize`:@@bank_programs.form.cta_save:Save changes`);

  private currentVersion = 0;
  /**
   * The code of the program actually LOADED from the API, or `null` while creating.
   *
   * A signal rather than a plain field because `editingProgramCode` derives from it:
   * the rule-check panel must be enabled by "a saved program exists", not by "a code
   * has been typed into the identity box", which on the create wizard is neither.
   */
  private readonly loadedProgramCode = signal<string | null>(null);

  // Enum-driven option signals
  readonly employmentOptions = computed(() =>
    this.enums
      .membersFor('employment_type')()
      .map((m) => ({ value: m.key, label: m.labelEn })),
  );
  readonly transferOptions = computed(() =>
    this.enums
      .membersFor('transfer_type')()
      .map((m) => ({ value: m.key, label: m.labelEn })),
  );
  // Localised, unlike the transfer-type list directly above: a doctor's syndicate card and
  // facility licence have no English name a Cairo operator would recognise, and this list is
  // read beside Arabic values everywhere else on the form (Principle IV / A20).
  readonly documentOptions = computed(() =>
    this.enums
      .membersFor('required_document')()
      .map((m) => ({ value: m.key, label: this.localeIsAr ? m.labelAr : m.labelEn })),
  );
  /**
   * The loan type this form is operating under, or `null` when it has not been
   * decided (create reached without `?category=`). Read-only by design: the
   * choice is made one screen earlier, so this is a fact the form displays, not
   * a field it collects.
   */
  readonly lockedCategory = computed<LoanCategory | null>(() => {
    const cat = this.productCategorySignal();
    return isLoanCategory(cat) ? cat : null;
  });

  /** Template-side access to the shared category label (Principle II / A20). */
  protected categoryLabelOf(cat: LoanCategory): string {
    return categoryLabel(cat);
  }

  /** ng-zorro icon nzType per loan category — generic map, no bank branching. */
  private static readonly CAT_ICONS: Readonly<Record<LoanCategory, string>> = {
    personal: 'user',
    car: 'car',
    mortgage: 'home',
    business: 'shop',
  };

  protected catIcon(cat: LoanCategory): string {
    return BankProgramFormPage.CAT_ICONS[cat] ?? 'appstore';
  }

  /** Per-category accent, resolved against the theme tokens (A18). */
  private static readonly CAT_COLORS: Readonly<Record<LoanCategory, string>> = {
    personal: 'var(--color-cat-personal)',
    car: 'var(--color-cat-car)',
    mortgage: 'var(--color-cat-mortgage)',
    business: 'var(--color-cat-business)',
  };

  protected catColor(cat: LoanCategory): string {
    return BankProgramFormPage.CAT_COLORS[cat] ?? 'var(--color-cat-other)';
  }

  readonly form = this.fb.nonNullable.group({
    identity: this.fb.nonNullable.group({
      // Read-only display on edit; auto-generated by backend on create (never user-typed).
      programCode: new FormControl('', { nonNullable: true }),
      bankName: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(80)],
      }),
      /**
       * The predefined catalog archetype this program instantiates. This is what
       * the picker binds and what the API persists; `friendlyName` below is
       * derived from it (the member's English label) and never typed by hand.
       */
      programNameKey: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(64)],
      }),
      friendlyName: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(120)],
      }),
      friendlyNameAr: new FormControl<string | null>(null, {
        validators: [Validators.maxLength(120)],
      }),
      programType: new FormControl<ProgramType>('income_proof', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      productCategory: new FormControl('personal', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      /**
       * Islamic-finance program, asked as the last row of step 1.
       *
       * (The comment here used to say the checkbox was hidden because the
       * customer-facing half — offer badge, Islamic-only filter, "profit rate"
       * wording — was never built. It has been on screen for some time; the
       * customer-facing caveat is still true, so what the flag reaches remains
       * the API field, the DB column and the offer snapshot.)
       */
      isShariaCompliant: new FormControl(false, { nonNullable: true }),
    }),
    tenor: this.fb.nonNullable.group(
      {
        minMonths: new FormControl(12, {
          nonNullable: true,
          validators: [Validators.required, Validators.min(1), Validators.max(600)],
        }),
        maxMonths: new FormControl(60, {
          nonNullable: true,
          validators: [Validators.required, Validators.min(1), Validators.max(600)],
        }),
      },
      { validators: [tenorRangeValidator] },
    ),
    loanLimits: this.fb.nonNullable.group({
      minAmountEGP: new FormControl('50000', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      maxAmountEGP: new FormControl('1500000', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      // Not rendered — the "Optional ceilings" disclosure that edited it is
      // gone. The control stays so an EXISTING program's ceiling survives an
      // edit: `payloadFromForm` reads the form, and update is a
      // full-replacement PUT, so dropping the control would silently clear a
      // value the admin never saw and never asked to change. New programs leave
      // it null, exactly as before.
      qualitativeReviewMaxEGP: new FormControl<string | null>(null),
    }),
    pricing: this.fb.nonNullable.group({
      isVariableRate: new FormControl(false, { nonNullable: true }),
      // Declining unless the sheet says otherwise: it is what every program in the book is
      // priced at, and a new program that copies an existing one must not change basis by
      // arriving on a screen.
      rateBasis: new FormControl<RateBasis>('reducing', { nonNullable: true }),
      baseRatePercent: new FormControl<string | null>('24.0'),
      currentEffectiveRatePercent: new FormControl<string | null>(null),
      variableRateNote: new FormControl<string | null>(null),
      rateByLoanAmountBands: new FormArray<FormGroup>([], {
        validators: [rateBandsOrder],
      }),
    }),
    eligibility: this.fb.nonNullable.group({
      acceptedEmploymentTypes: new FormControl<string[]>(['salaried'], {
        nonNullable: true,
        validators: [Validators.required],
      }),
      // Defaults to the transfer types an applicant can actually answer. The old
      // default was the three bank-internal payroll grades, which no applicant
      // can ever produce — every new program rejected everyone on this check.
      acceptedTransferTypes: new FormControl<string[]>(
        ['payroll', 'salary_transfer_letter', 'income_transfer_letter'],
        { nonNullable: true, validators: [Validators.required] },
      ),
      ageMin: new FormControl(21, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(18), Validators.max(80)],
      }),
      ageMax: new FormControl(60, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(18), Validators.max(80)],
      }),
      minMonthlyIncomeEGP: new FormControl('5000', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      minMonthsInJob: new FormControl(6, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(0)],
      }),
      dbrCapPercent: new FormControl('50.0', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      skipDbrCheck: new FormControl(false, { nonNullable: true }),
      requiresCD: new FormControl(false, { nonNullable: true }),
      requiresAutoLoanAtABK: new FormControl(false, { nonNullable: true }),
      requiresAutoLoanAtOtherBank: new FormControl(false, { nonNullable: true }),
      requiresCreditCardAtOtherBank: new FormControl(false, { nonNullable: true }),
      requiresCompoundProperty: new FormControl(false, { nonNullable: true }),
      requiresCollateral: new FormControl(false, { nonNullable: true }),
      requiresClubMembership: new FormControl(false, { nonNullable: true }),
      requiresExistingLoan: new FormControl(false, { nonNullable: true }),
      requiresFRMUVerification: new FormControl(false, { nonNullable: true }),
      requiresQualitativeReview: new FormControl(false, { nonNullable: true }),
      requiresNoDocuments: new FormControl(false, { nonNullable: true }),
      minBankStatementBalanceEGP: new FormControl<string | null>(null),
      minAssetsValueEGP: new FormControl<string | null>(null),
    }),
    incomeAssumption: this.fb.nonNullable.group({
      /**
       * NOT a picker any more. The catalog program name states the one figure the income
       * is worked out from, and this control is SET from it — the server refuses a
       * program whose strategy is anything else. Kept as a control rather than derived
       * at payload time because the shared editor, the check panel and the review row
       * all read the rule through this group.
       */
      strategy: new FormControl<IncomeAssumptionStrategy>('declared', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      /**
       * Whose figures the tables are. `'own'` is the default and what every program
       * saved before this field existed means, so the default has to be the one that
       * changes nothing about a legacy program on read-back.
       */
      amounts: new FormControl<'catalog' | 'own'>('own', { nonNullable: true }),
      /**
       * Which of the product's ways this bank sells, when the product holds them as
       * alternatives. `null` everywhere else, and on every program saved before the field
       * existed — the server refuses a way named on a product that combines its ways.
       */
      wayId: new FormControl<string | null>(null),
      /**
       * Feature 011 — the CANONICAL scalar shape replaces the four per-method
       * fields. `unit` travels with the value so the stored blob says what
       * arithmetic it means, and the read path normalizes a legacy
       * `carInstallmentMultiplier` into exactly this pair.
       */
      scalar: this.fb.group({
        value: new FormControl<string | null>(null),
        unit: new FormControl<'percent' | 'multiplier'>('percent', { nonNullable: true }),
      }),
      /** FR-012 — empty means "use the program's own cap", which is the common case. */
      dbrCapPercentOverride: new FormControl<string | null>(null),
      /** FR-013 — `required_document` keys. A gap is warned about, never blocked. */
      requiredDocuments: new FormControl<string[]>([], { nonNullable: true }),
      /** Absent = the rule's figure REPLACES a declared salary. */
      combinationRule: new FormControl<'lesser_of' | 'greater_of' | null>(null),
    }),
    fees: this.fb.nonNullable.group({
      adminFeePercent: new FormControl('1.0', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      stampDutyPercent: new FormControl('0.5', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      lifeInsurancePercent: new FormControl('0.5', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      lifeInsuranceMandatory: new FormControl(false, { nonNullable: true }),
      latePaymentFeePercent: new FormControl('4.0', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      payoffCashPercent: new FormControl('12.0', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      payoffBuyoutPercent: new FormControl('15.0', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    }),
    documents: this.fb.nonNullable.group({
      requiredDocuments: new FormControl<string[]>([], { nonNullable: true }),
      operatorNotes: new FormControl<string | null>(null),
      operatorTips: this.fb.nonNullable.array<string>([]),
    }),
  });

  get identityGroup(): FormGroup {
    return this.form.controls.identity as FormGroup;
  }
  get tenorGroup(): FormGroup {
    return this.form.controls.tenor as FormGroup;
  }
  get loanLimitsGroup(): FormGroup {
    return this.form.controls.loanLimits as FormGroup;
  }
  get pricingGroup(): FormGroup {
    return this.form.controls.pricing as FormGroup;
  }
  get eligibilityGroup(): FormGroup {
    return this.form.controls.eligibility as FormGroup;
  }
  /** Drives the dimmed cap field + the lit toggle row on the Debt burden card. */
  get skipDbr(): boolean {
    return this.eligibilityGroup.get('skipDbrCheck')?.value === true;
  }
  get isSharia(): boolean {
    return this.identityGroup.get('isShariaCompliant')?.value === true;
  }
  get incomeAssumptionGroup(): FormGroup {
    return this.form.controls.incomeAssumption as FormGroup;
  }
  get feesGroup(): FormGroup {
    return this.form.controls.fees as FormGroup;
  }
  get documentsGroup(): FormGroup {
    return this.form.controls.documents as FormGroup;
  }

  // ── Loan-duration helpers ────────────────────────────────────────────────
  // Plain min/max month inputs (consistent with the rest of the form, e.g. the
  // age fields). tenor.minMonths/maxMonths remain the source of truth; these
  // signals only drive the "≈ N years" hint shown under each input.
  private readonly tenorValue = toSignal(this.form.controls.tenor.valueChanges, {
    initialValue: this.form.controls.tenor.getRawValue(),
  });
  /** Years-equivalent hint under the Minimum months input ("≈ 1 yr"). */
  readonly minMonthsHint = computed(() => this.formatMonths(this.tenorValue().minMonths ?? 0));
  /** Years-equivalent hint under the Maximum months input ("≈ 7 yr"). */
  readonly maxMonthsHint = computed(() => this.formatMonths(this.tenorValue().maxMonths ?? 0));

  /** Months → years label: 84 → "7 yr", 18 → "1 yr 6 mo", 1 → "1 mo". */
  readonly formatMonths = (total: number): string => {
    const years = Math.floor(total / 12);
    const months = total % 12;
    if (years > 0 && months > 0) {
      return $localize`:@@bank_programs.tenor.ym:${years}:years: yr ${months}:months: mo`;
    }
    if (years > 0) {
      return $localize`:@@bank_programs.tenor.y:${years}:years: yr`;
    }
    return $localize`:@@bank_programs.tenor.m:${months}:months: mo`;
  };

  // Reactive view of identity.productCategory so the template + effects react.
  readonly productCategorySignal = toSignal(
    this.form.controls.identity.controls.productCategory.valueChanges,
    { initialValue: this.form.controls.identity.controls.productCategory.value },
  );
  /** Reactive view of identity.programType — drives the income-assumption block. */
  readonly programTypeSignal = toSignal(
    this.form.controls.identity.controls.programType.valueChanges,
    { initialValue: this.form.controls.identity.controls.programType.value },
  );

  /**
   * The same value in the words the operator sees. `programType` stays the stored value
   * and the only source of truth; this is a lens over it, so there is no second field to
   * keep in step.
   */
  readonly incomeBasis = computed<IncomeBasis>(() => basisOf(this.programTypeSignal()));

  /**
   * Is the figure this program's chosen METHOD reads actually asked of this loan type?
   *
   * `null` when there is nothing to say: the basis is payslip, the method reads no
   * question at all (six of the eleven read profile fields no question fills), or the
   * registry has not loaded.
   *
   * Answered from the QUESTIONNAIRE's own assignment, carried on the fact's bound
   * question. It used to be answered from a per-name tick-list on the catalog screen —
   * a second claim an operator had to keep in step by hand, which no quote, publish
   * check or save validation ever read. A rule whose figure is never asked resolves to
   * no income at all, in silence, and that depends on the question, not on the name.
   */
  protected readonly factBinding = computed<{
    label: string;
    category: string;
    asked: boolean;
  } | null>(() => {
    if (this.incomeBasis() !== 'no_payslip') return null;
    const cat = this.productCategorySignal();
    if (!isLoanCategory(cat)) return null;
    // Read through the draft SIGNAL, not the control: a bare `.value` inside a computed
    // registers no dependency, so the line would freeze on whichever method happened to be
    // selected when the program loaded.
    const strategy = this.liveIncomeRuleDraft().strategy;
    // A registry fact names its own question; the four built-in methods are looked up in
    // the frozen map, because their tokens say nothing about what they read.
    const factKey = factKeyOf(strategy);
    const code =
      factKey !== null
        ? (this.incomeFacts().find((f) => f.key === factKey)?.question?.code ?? null)
        : (SURROGATE_FACT_BY_METHOD[strategy] ?? null);
    if (!code) return null;
    const question = this.incomeFacts().find((f) => f.question?.code === code)?.question;
    // The registry has not answered yet. Silence beats "never asked here": the warning
    // would fire on every load and clear a moment later.
    if (!question) return null;
    return {
      label: this.factLabel(code),
      category: categoryLabel(cat),
      asked: question.askedIn.includes(cat),
    };
  });

  /**
   * The fact's own words.
   *
   * A REGISTRY fact carries its question's label, so it is used as-is — that is the whole
   * benefit of the binding being data. The four built-ins keep hardcoded wording: this
   * form cannot read the question pool, and those four labels are the questions' own
   * English text, which the backend test pins to the binding codes.
   */
  private factLabel(fact: string): string {
    const fromRegistry = this.incomeFacts().find((f) => f.question?.code === fact);
    if (fromRegistry?.question) return fromRegistry.question.label;
    switch (fact) {
      case 'military_grade':
        return $localize`:@@surrogate.fact.military_grade:Military grade`;
      case 'academic_rank':
        return $localize`:@@surrogate.fact.academic_rank:Academic rank`;
      case 'years_in_practice':
        return $localize`:@@surrogate.fact.years_in_practice:Years in practice`;
      case 'credit_card_total_limit':
        return $localize`:@@surrogate.fact.credit_card_total_limit:Total credit-card limit`;
      default:
        return fact;
    }
  }

  /** Plum for no-payslip, neutral for the ordinary case (and for the unanswered
   * one) — the board-wide pairing. */
  protected basisAccent(): string {
    return this.basisAnswered() === 'no_payslip'
      ? 'var(--color-income-surrogate)'
      : 'var(--color-text-secondary)';
  }

  /**
   * The chip's glyph follows the chip's WORDS: a payslip page for the ordinary case,
   * a calculator for the worked-out one, and a question mark while the chip is still
   * saying "Not set yet" — a document icon beside those words reads as an answer.
   */
  protected basisIcon(): string {
    const basis = this.basisAnswered();
    if (!basis) return 'question-circle';
    return this.basisIconFor(basis);
  }

  /**
   * The glyph for a named basis, so the two pills carry the SAME marks as the header
   * chip they set. A radio dot said only "one of these" — the icons say which is
   * which before the label is read, and they are what the operator will keep seeing
   * in the chip for the remaining five steps.
   */
  protected basisIconFor(basis: IncomeBasis): string {
    return basis === 'no_payslip' ? 'calculator' : 'file-text';
  }

  protected readonly incomeStepAria = $localize`:@@bank_programs.income.aria:How the bank reads the income`;
  /** Named for a screen reader, which has no card heading in view when it reaches the pair. */
  protected readonly rateBasisAria = $localize`:@@bank_programs.rate_basis.aria:How the interest is charged`;

  /**
   * What the answer COMMITS the operator to, said on the card before it is picked.
   *
   * The income step reshapes two later steps — it filters the program names step 2
   * offers, and a no-payslip program has a whole rate-table editor on Eligibility
   * that a payslip one does not. Discovering that two steps in reads as the wizard
   * changing under you; naming it here makes the dependency the point of the step.
   */
  /** The two consequence lines, as the shared component's `effects` map. */
  protected readonly basisEffects = computed<Partial<Record<IncomeBasis, string>>>(() => ({
    payslip: this.basisEffect('payslip'),
    no_payslip: this.basisEffect('no_payslip'),
  }));

  private basisEffect(basis: IncomeBasis): string {
    return basis === 'no_payslip'
      ? // NOT "you fill in the bank's table". Of the eleven methods only two
        // (`byProfessorRank`, `byMilitaryGrade`) are a key table — four are bands, four
        // are a single number, and `declared` is nothing at all, which seven seeded
        // business/professional programs use on purpose. Promising a table here
        // described one method in eleven, so it named the SETTING instead.
        $localize`:@@bank_programs.income.effect.no_payslip_v2:Pick this and the next step shows the program names sold on a surrogate basis. On the Calculation step you then set how the bank works the income out.`
      : $localize`:@@bank_programs.income.effect.payslip:Pick this and the next step shows the program names that need income proof.`;
  }

  /**
   * Answer the income question. `programType` stays the stored value and the only
   * thing that ships; `basisPicked` records that a human answered, which the control's
   * default cannot express.
   *
   * Changing the answer re-narrows the name list, so the "show the rest" escape is
   * dropped: it was granted against the previous basis, and leaving it on would hand
   * the operator an unfiltered list they never asked to see twice. A name already
   * picked is deliberately left alone — the catalog refuses nothing, so a program
   * whose name the new basis hides is legal, and clearing it would throw away a
   * choice over a disagreement the API does not care about.
   */
  protected pickBasis(basis: IncomeBasis): void {
    this.basisPicked.set(basis);
    this.showAllNamesSignal.set(false);
    this.form.controls.identity.controls.programType.setValue(programTypeOf(basis));
    this.form.controls.identity.controls.programType.markAsDirty();
  }

  /**
   * Put the catalog's figures into the editor, so the operator sees the numbers this bank
   * will quote instead of an empty grid beside a promise that a table exists somewhere.
   *
   * Called on every arrival of a catalog rule, and again by `resetToCatalog`. It
   * OVERWRITES while the program is inheriting — that is the point, the grid is a view of
   * the catalog until someone edits it — and does nothing once the program is on its own
   * figures, or a name change would silently replace numbers a bank had typed.
   */
  private seedFromCatalog(): void {
    if (this.amountsValue() !== 'catalog') return;
    const catalog = this.catalogEffectiveRule();
    if (!catalog) {
      this.incomeKeyTable.set([]);
      this.incomeBands.set([]);
      this.stepFigures.set({});
      return;
    }
    this.incomeKeyTable.set((catalog.keyTable ?? []).map((row: IncomeKeyTableRow) => ({ ...row })));
    this.incomeBands.set((catalog.bands ?? []).map((band: IncomeBand) => ({ ...band })));
    // Cloned one level deeper than the tables: a step's figure is itself a table or a
    // pair of bounds, and a shallow copy would hand the editor the catalog's own arrays
    // to mutate in place — the operator's first keystroke would then edit the catalog
    // copy this program is supposed to be detaching FROM.
    this.stepFigures.set(cloneStepFigures(catalog.stepParams));
    this.form.controls.incomeAssumption.controls.scalar.patchValue({
      value: catalog.scalar?.value ?? null,
      ...(catalog.scalar ? { unit: catalog.scalar.unit } : {}),
    });
  }

  /**
   * The detachment. One edit anywhere in the grid and this program stops following the
   * catalog — for good, until someone asks for the catalog's figures back.
   *
   * The whole figure set is already in the signals (`seedFromCatalog` put it there), so
   * flipping the flag is all this does. That ordering is load-bearing: if the grid held
   * only the row being edited, saving would store a one-row table and the program would
   * quote nothing for every key the operator never touched.
   */
  private detachFromCatalog(): void {
    if (this.amountsValue() !== 'catalog') return;
    this.setAmountsSource('own');
    // Marks the strip for its one-shot sweep. A state this consequential should be
    // felt, and a toast for something the operator is mid-typing would be worse.
    //
    // Cleared once it has played. The class has to stop describing a transition that is
    // over, or leaving and re-entering step 5 would destroy and rebuild the strip and the
    // sweep would fire again on a program that detached ten minutes ago.
    this.justDetached.set(true);
    setTimeout(() => this.justDetached.set(false), SOURCE_SWEEP_MS);
  }

  /** Every figure edit routes through one of these three, and each detaches first. */
  protected onKeyTableEdit(rows: IncomeKeyTableRow[]): void {
    this.detachFromCatalog();
    this.incomeKeyTable.set(rows);
  }

  protected onBandsEdit(bands: IncomeBand[]): void {
    this.detachFromCatalog();
    this.incomeBands.set(bands);
  }

  protected onStepFiguresEdit(figures: Record<string, StepFigures>): void {
    this.detachFromCatalog();
    this.stepFigures.set(figures);
  }

  /**
   * Back to the catalog's figures. Warns first, because the numbers this bank typed are
   * dropped — and names them as lost rather than asking whether the operator is sure.
   *
   * The guard covers every shape a bank can have typed, not just the two tables: a
   * program whose only own figure was a percentage or a step figure used to revert with
   * no prompt at all, and the branch that would have cleared it never ran.
   */
  protected resetToCatalog(): void {
    if (this.amountsValue() === 'catalog') return;
    const hasOwn =
      this.incomeKeyTable().length > 0 ||
      this.incomeBands().length > 0 ||
      Object.keys(this.stepFigures()).length > 0 ||
      Boolean(this.form.controls.incomeAssumption.controls.scalar.controls.value.value);

    const commit = (): void => {
      this.setAmountsSource('catalog');
      this.justDetached.set(false);
      this.seedFromCatalog();
    };

    if (!hasOwn) {
      commit();
      return;
    }
    this.modal.confirm({
      nzTitle: $localize`:@@bank_programs.income.revert_title:Go back to the catalog amounts?`,
      nzContent: $localize`:@@bank_programs.income.revert_body:The figures you typed for this bank are dropped, and it starts quoting the catalog's.`,
      nzOkText: $localize`:@@bank_programs.income.revert_ok:Use the catalog amounts`,
      nzCancelText: $localize`:@@bank_programs.income.revert_cancel:Keep this bank's amounts`,
      nzOnOk: commit,
    });
  }

  private setAmountsSource(value: 'catalog' | 'own'): void {
    const control = this.form.controls.incomeAssumption.controls.amounts;
    control.setValue(value);
    control.markAsDirty();
  }

  /**
   * Read what the picked program name says. Runs on every name change, because the
   * proof is the NAME's property — switching the name changes the whole block.
   */
  private async loadCatalogRule(): Promise<void> {
    const key = this.programNameKeyValue();
    if (!key) {
      this.catalogRule.set(null);
      return;
    }
    this.catalogRuleLoading.set(true);
    try {
      const { data } = await this.api.getProgramNameIncomeRule(key);
      this.catalogRule.set(data);
    } catch {
      // Left as "states nothing", which renders the blocked notice and the catalog link.
      // Silent because the notice IS the report, and a toast on a background read would
      // fire while the operator is typing three steps away.
      this.catalogRule.set(null);
    } finally {
      this.catalogRuleLoading.set(false);
    }
    // The grid is a VIEW of the catalog until someone edits it, so the figures have to
    // arrive with the rule. Seeding here rather than in the template keeps one owner for
    // the signals the editor writes to — a computed view would be read-only, and the
    // operator has to be able to type straight into it.
    this.seedFromCatalog();
    this.seedCapFromProduct();
    this.recordSingleWay();
    if (this.fillOnArrival) {
      this.fillOnArrival = false;
      this.fillFromProduct();
    }
  }

  // --- the product's maximum-loan grid, copied ------------------------------------------

  /**
   * What we last seeded, so a name change can replace an untouched copy and nothing else.
   *
   * A COPY, not a link: the bank stores its own rows, and editing the product's defaults
   * later moves no program that has already saved. That is the right semantics on a platform
   * whose offers are immutable (Principle I / A6), and it is why there is no
   * `amounts: 'catalog' | 'own'` machinery here.
   */
  private capSeededSignature: string | null = null;

  /** The last `onNoMatch` this bank actually held, so a re-seed cannot overwrite it. */
  private capNoMatch: 'useProgramMax' | 'reject' | null = null;

  /**
   * Put the product's amounts into the grid, once.
   *
   * WITHOUT THIS the boxes would render the product's figures — `capGridFrom` falls back to
   * them — and save nothing, because the config would still be `null`. The operator would be
   * looking at six numbers that do not exist.
   *
   * Never overwrites a table this bank has touched: only a `null` config, or one byte-equal
   * to the copy we ourselves seeded, is replaced. So switching the name re-shapes an
   * untouched grid and leaves a typed one alone — and a typed one that no longer matches the
   * new product is shown on the free-form controls and refused by name on the next save,
   * rather than silently re-keyed to axes it was never written for.
   */
  /** Every write to the cap table, so the bank's `onNoMatch` is remembered as it is chosen. */
  protected onMaxLoanByFact(config: MaxLoanByFactConfig | null): void {
    if (config !== null) this.capNoMatch = config.onNoMatch;
    this.maxLoanByFact.set(config);
  }

  private seedCapFromProduct(): void {
    const shape = this.productCap();
    const defaults = this.productCapDefaults();
    if (shape === null || defaults.length === 0) return;

    const current = this.maxLoanByFact();
    const untouched = current === null || JSON.stringify(current) === this.capSeededSignature;
    if (!untouched) return;

    // The BANK's answer survives a re-seed. `onNoMatch` is not the product's to force —
    // `ABK-PER-DOCTORS_CLINIC` stores `reject` where its blueprint declares `useProgramMax` —
    // and re-picking the name after clearing the amounts used to flip a deliberate `reject`
    // back to the default with no interaction and nothing on screen saying it had moved.
    const onNoMatch = this.capNoMatch ?? shape.onNoMatch;
    const seeded = capConfigFrom(shape, capGridFrom(shape, null, defaults), onNoMatch);
    if (seeded === null) return;
    this.capSeededSignature = JSON.stringify(seeded);
    this.maxLoanByFact.set(seeded);
  }

  // --- the product's defaults, on a program that already has its own figures -------------

  /**
   * Arm the fill for the next catalog rule to arrive.
   *
   * The rule is fetched asynchronously and `applyInitial` runs before it lands, so the fill
   * cannot be done where the stored figures are set — there would be nothing to compare them
   * against. A flag rather than an effect, because this must happen exactly once per load and
   * never again as the operator edits.
   */
  private fillOnArrival = false;

  /** Slot ids filled on open, and the figure map as it was before. Both empty = no fill. */
  protected readonly filledFromProduct = signal<readonly SlotDefault[]>([]);
  private figuresBeforeFill: Record<string, StepFigures> | null = null;

  /**
   * Put the product's amount into every box this bank left blank.
   *
   * ONLY on a program already on its own figures: one still inheriting has the product's
   * numbers in every box already, and filling would be a no-op that printed a banner.
   *
   * The form is marked dirty and nothing is sent. That is the whole safety property: a blank
   * GATE reads as "this bank does not apply this condition", so a fill can switch a refusal
   * on, and the operator has to see which before it reaches a save.
   */
  private fillFromProduct(): void {
    if (this.amountsValue() !== 'own') return;
    const catalog = this.catalogEffectiveRule();
    if (!catalog) return;
    const missing = slotsMissingDefault(
      slotShapes(this.ruleSteps(), this.ruleGates()),
      this.stepFigures(),
      catalog.stepParams,
      { ownedSlots: this.ownedSlotIdsForFill() },
    );
    if (missing.length === 0) return;
    this.figuresBeforeFill = this.stepFigures();
    this.stepFigures.set(withAllDefaults(this.stepFigures(), missing).figures);
    this.filledFromProduct.set(missing);
    this.markIncomeRuleDirty();
  }

  /**
   * The slots a fill may touch: the way this bank sells, plus every slot no way owns.
   *
   * Mirrors the editor's own narrowing, through the same `wayOwnedSlots` — `undefined` when
   * the product does not make its ways exclusive, which means every slot is in play.
   */
  private ownedSlotIdsForFill(): ReadonlySet<string> | undefined {
    const steps = this.ruleSteps();
    const waysAre = this.ruleWaysAre();
    if (!picksBetweenWays(steps, waysAre)) return undefined;
    const chosen = this.wayIdValue();
    if (chosen === null) return new Set<string>();
    const owned = wayOwnedSlots(steps, chosen, waysAre);
    const everyWaySlot = new Set(waysOfRule(steps, waysAre).flatMap((way) => way.slots));
    for (const slot of slotShapes(steps, this.ruleGates()).keys()) {
      if (!everyWaySlot.has(slot)) owned.add(slot);
    }
    return owned;
  }

  /**
   * The banner's sentence: how many, and — for the ones that change who is refused — which.
   *
   * CONDITIONS are named and the rest are counted, deliberately. A blank condition reads as
   * "this bank does not apply this" (`gateIsConfigured`), so filling one switches a refusal
   * ON, and that is the only part of a fill an operator cannot infer from the boxes in front
   * of them. A filled table or percentage is visible where it landed; a condition that
   * quietly started refusing applicants is not.
   *
   * The gate's own title, not the slot id: the box holding `cond__paidenough__bound` is drawn
   * on the `cond__paidenough` row, and naming the bound step would point at a heading that is
   * not on screen.
   */
  protected filledNotice(): string {
    const filled = this.filledFromProduct();
    const gates = this.ruleGates();
    const conditions = filled
      .map((slot) => gates.find((gate) => gate.id === slot.rowId))
      .filter((gate): gate is RuleGate => gate !== undefined)
      .map((gate) => gateTitleFor(gate));
    const count = filled.length;
    const name = this.programNameLabel();
    // TWO SENTENCES, each agreeing with its own count. One sentence carrying both counts
    // read "1 figures were filled … and 1 of them turn a condition on" the moment a single
    // condition was the only thing filled — wrong in English, and worse in Arabic, where
    // the verb agrees too.
    const names = conditions.join(' · ');
    // The one-and-the-same case gets its own sentence: "One figure was filled … One of them
    // turns a condition on" is two sentences about one figure, and "of them" has nothing to
    // refer back to.
    if (count === 1 && conditions.length === 1) {
      return $localize`:@@bank_programs.income.filled_one_condition:One figure was filled from ${name}:NAME: and it turns a condition on — ${names}:NAMES:. It applies when you save.`;
    }
    const head =
      count === 1
        ? $localize`:@@bank_programs.income.filled_one:One figure was filled from ${name}:NAME:. It applies when you save.`
        : $localize`:@@bank_programs.income.filled_many:${count}:COUNT: figures were filled from ${name}:NAME:. They apply when you save.`;
    if (conditions.length === 0) return head;
    const tail =
      conditions.length === 1
        ? $localize`:@@bank_programs.income.filled_condition_one:One of them turns a condition on — ${names}:NAMES:.`
        : $localize`:@@bank_programs.income.filled_condition_many:${conditions.length}:COUNT: of them turn a condition on — ${names}:NAMES:.`;
    return `${head} ${tail}`;
  }

  /**
   * Put back exactly the boxes the fill touched — and nothing else.
   *
   * PER SLOT, never the whole map. Restoring the load-time snapshot undid every edit made
   * since: switch the way (which prunes the losing way's figures), type the new way's table,
   * then click Undo, and the pruned way came back while the freshly typed one vanished — a
   * state where `filledWayIds` disagrees with `wayId` and Save is refused, with no second
   * undo to escape it.
   */
  protected undoFillFromProduct(): void {
    const before = this.figuresBeforeFill;
    const filled = this.filledFromProduct();
    if (before === null || filled.length === 0) {
      this.clearFillBanner();
      return;
    }
    const next = { ...this.stepFigures() };
    for (const slot of filled) {
      const original = before[slot.id];
      if (original === undefined) delete next[slot.id];
      else next[slot.id] = original;
    }
    this.stepFigures.set(next);
    this.clearFillBanner();
  }

  /**
   * Drop the banner without touching a figure.
   *
   * Called when the fill stops describing the truth: picking a way prunes the losing way's
   * slots (`commitWay`), so an offer to undo figures that no longer exist counts boxes the
   * operator can no longer see.
   */
  private clearFillBanner(): void {
    this.figuresBeforeFill = null;
    this.filledFromProduct.set([]);
  }

  /**
   * Re-read the picked name's rule and take its proof as this program's.
   *
   * The strategy is COPIED onto the program rather than left to the server, because
   * every reader on this page switches on it — the editor's shape, the check panel's
   * sample field, the review row. Copying it keeps them all working against the form
   * alone, which is the same reason the backend stores it on the program.
   *
   * A proof change clears the bank's own tables: they are keyed by the OLD figure (rank
   * rows against a grade answer), so carrying them over would leave the operator looking
   * at a table that cannot match anything. Nothing is lost silently — the tables belong
   * to a name this program no longer uses.
   */
  private async adoptCatalogProof(): Promise<void> {
    const before = this.form.controls.incomeAssumption.controls.strategy.value;
    await this.loadCatalogRule();
    const proof = this.catalogEffectiveRule()?.strategy;
    if (proof === undefined || proof === before) return;

    const income = this.form.controls.incomeAssumption;
    income.controls.strategy.setValue(proof);
    income.controls.strategy.markAsDirty();
    // Back to the catalog's figures, because that is now the only table this program has.
    this.setAmountsSource('catalog');
    this.justDetached.set(false);
    // RE-SEEDED, not cleared. This used to blank all three shapes and leave the operator
    // on an empty editor under a line saying the catalog states a table — true, and
    // invisible. The old tables still have to go: they are keyed by the OLD figure (rank
    // rows against a grade answer) and could match nothing, and `seedFromCatalog` replaces
    // rather than merges, so the new name's rows are the only ones left standing.
    this.seedFromCatalog();
  }

  /** The chosen way's title, as the editor names it — for the name-change confirmation. */
  readonly currentWayTitle = signal<string | null>(null);

  /**
   * A product with ONE way has nothing to choose, and every surrogate program records the way
   * it sells — so the one way is written without asking, the moment the rule is on hand. A
   * stored way wins (this runs after `applyInitial` has patched the form); marked dirty only
   * when it actually changed, so an untouched edit stays pristine.
   */
  private recordSingleWay(): void {
    if (!this.productBacked()) return;
    const ways = waysOfRule(this.ruleSteps(), this.ruleWaysAre());
    const [only] = ways;
    if (ways.length !== 1 || only === undefined) return;
    const control = this.form.controls.incomeAssumption.controls.wayId;
    if (control.value === only.id) return;
    control.setValue(only.id);
    control.markAsDirty();
  }

  /**
   * The name change, applied — everything that used to run inline in the subscription, so a
   * confirmation can put ALL of it behind OK. Order matters at step 3: the grid is cleared
   * BEFORE the re-read, because `seedCapFromProduct` seeds only into an empty or still-seeded
   * grid, and `capNoMatch` goes with it — one bank's deliberate `reject` must not be carried
   * onto a different product's table.
   */
  private commitNameChange(key: string | null): void {
    const match = this.programNameMembers().find((m) => m.key === key);
    if (match) {
      this.seedFriendlyName(this.form.controls.identity.controls.friendlyName, match.labelEn);
      this.seedFriendlyName(this.form.controls.identity.controls.friendlyNameAr, match.labelAr);
    }
    this.lastPickedNameKey = key;
    const way = this.form.controls.incomeAssumption.controls.wayId;
    if (way.value !== null) {
      way.setValue(null);
      way.markAsDirty();
    }
    this.maxLoanByFact.set(null);
    this.capSeededSignature = null;
    this.capNoMatch = null;
    // The income proof is the NAME's property, so changing the name changes what this program
    // reads. Re-read, then adopt — the alternative is a program still carrying the previous
    // name's proof, which the server refuses on save with a message about a name the operator
    // has already moved away from.
    void this.adoptCatalogProof();
  }

  /**
   * Put the picker back on cancel. A `formControlName`-bound select has a real value accessor,
   * so `setValue` alone repaints it; `emitEvent: false` keeps this subscription from re-entering
   * and asking again. Strictly simpler than the radios' `syncRadios`, whose `[checked]` binding
   * is not re-applied when its value has not changed — do not "fix" this into a DOM write.
   */
  private restoreName(previous: string | null): void {
    this.form.controls.identity.controls.programNameKey.setValue(previous ?? '', {
      emitEvent: false,
    });
  }

  /**
   * Two clauses, each agreeing with its own count — never one sentence carrying two.
   *
   * Named after the program the operator is LEAVING. `programNameLabel()` is derived from the
   * control, which the picker has already moved, so it answers with the new name — the dialog
   * then read "Armed Forces works its figure out from …" about a way that belongs to Compound
   * Owner. Measured in a browser, not reasoned about.
   */
  private nameChangeBody(loss: NameChangeLoss, previousKey: string | null): string {
    const name = this.labelForNameKey(previousKey);
    const clauses: string[] = [];
    if (loss.wayTitle !== null) {
      clauses.push(
        $localize`:@@bank_programs.name_change.confirm_way:${name}:NAME: works its figure out from: ${loss.wayTitle}:WAY:. That choice goes.`,
      );
    }
    if (loss.typedCapRows === 1) {
      clauses.push(
        $localize`:@@bank_programs.name_change.confirm_cap_one:One maximum-by-answer row you typed goes.`,
      );
    } else if (loss.typedCapRows > 1) {
      const count = loss.typedCapRows;
      clauses.push(
        $localize`:@@bank_programs.name_change.confirm_cap_many:${count}:COUNT: maximum-by-answer rows you typed go.`,
      );
    }
    return clauses.join(' ');
  }

  private keepNameLabel(previousKey: string | null): string {
    return $localize`:@@bank_programs.name_change.confirm_cancel:Keep ${this.labelForNameKey(previousKey)}:OLDNAME:`;
  }

  /** A catalog name key → the words the picker shows, falling back to the key itself. */
  private labelForNameKey(key: string | null): string {
    if (key === null) return '';
    return this.programNameMembers().find((m) => m.key === key)?.labelEn ?? key;
  }

  /** A strategy token → the words the picker used, built-in or registry fact. */
  private incomeMethodLabelFor(strategy: IncomeAssumptionStrategy): string {
    return incomeMethodLabel(strategy, this.incomeFacts());
  }

  /** Reactive view of pricing.isVariableRate — decides which rate key ships. */
  readonly isVariableRateSignal = toSignal(
    this.form.controls.pricing.controls.isVariableRate.valueChanges,
    { initialValue: this.form.controls.pricing.controls.isVariableRate.value },
  );

  // ── Review step (read-back) ──────────────────────────────────────────────
  /** Any-value mirror of the form so the review rows recompute as fields change. */
  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.value,
  });
  readonly emptyValueLabel = $localize`:@@bank_programs.review.empty:Not set`;

  /**
   * The review step is a read-back of what the admin typed — no new inputs, no
   * derived numbers the engine would disagree with. Percentages are trimmed as
   * STRINGS (never parsed to a float, Principle I) and money is grouped digit-wise.
   */
  readonly reviewGroups = computed<ReviewGroup[]>(() => {
    this.formValue();
    const v = this.form.getRawValue();
    const id = v.identity;
    const bands = this.dbrBands().length;
    const rateRows: ReviewRow[] = v.pricing.isVariableRate
      ? [
          {
            label: $localize`:@@bank_programs.review.rate_variable:Rate (variable)`,
            value: pct(v.pricing.currentEffectiveRatePercent),
          },
        ]
      : [
          {
            label: $localize`:@@bank_programs.review.rate_base:Base rate`,
            value: pct(v.pricing.baseRatePercent),
          },
        ];
    // The basis rides WITH the rate, never on its own line elsewhere: a review that shows
    // "24%" and leaves the basis to another screen is the misread §10.6 is about.
    rateRows.push({
      label: $localize`:@@bank_programs.review.rate_basis:Charged on`,
      value:
        v.pricing.rateBasis === 'flat'
          ? $localize`:@@bank_programs.review.rate_basis_flat:The full amount (flat)`
          : $localize`:@@bank_programs.review.rate_basis_reducing:What is still owed (declining)`,
    });
    if (this.toggles.tieredRates() && this.rateBandsArray.length > 0) {
      rateRows.push({
        label: $localize`:@@bank_programs.review.rate_bands:Rate bands`,
        value: this.countLabel(this.rateBandsArray.length),
      });
    }

    return [
      // The income row is its own group now, because it is its own step: a review
      // that folds it back under "Program" would send an operator who wants to change
      // it to the step that no longer asks it.
      {
        step: this.indexOf('income'),
        title: this.labelOf('income'),
        rows: [
          {
            label: $localize`:@@bank_programs.review.income_basis:Income`,
            value: incomeBasisLabel(basisOf(id.programType)),
          },
        ],
      },
      {
        step: this.indexOf('program'),
        title: this.labelOf('program'),
        rows: [
          { label: $localize`:@@bank_programs.review.bank:Bank`, value: id.bankName },
          { label: $localize`:@@bank_programs.review.name:Program name`, value: id.friendlyName },
          {
            label: $localize`:@@bank_programs.review.product:Product`,
            value: isLoanCategory(id.productCategory)
              ? categoryLabel(id.productCategory)
              : id.productCategory,
          },
        ],
      },
      // Its own group because it is its own step: an Edit here has to land on the step that
      // asks the question, and the rule is no longer asked on Eligibility.
      ...(this.incomeSurrogateActive()
        ? [
            {
              step: this.indexOf('calculation'),
              title: this.labelOf('calculation'),
              rows: [this.incomeRuleReviewRow()],
            },
          ]
        : []),
      {
        step: this.indexOf('terms'),
        title: this.labelOf('terms'),
        rows: [
          {
            label: $localize`:@@bank_programs.review.amount:Loan amount`,
            value: `${money(v.loanLimits.minAmountEGP)} – ${money(v.loanLimits.maxAmountEGP)} EGP`,
          },
          {
            label: $localize`:@@bank_programs.review.duration:Duration`,
            value: `${this.formatMonths(v.tenor.minMonths)} – ${this.formatMonths(v.tenor.maxMonths)}`,
          },
        ],
      },
      {
        step: this.indexOf('pricing'),
        title: this.labelOf('pricing'),
        rows: [
          ...rateRows,
          {
            label: $localize`:@@bank_programs.review.admin_fee:Admin fee`,
            value: pct(v.fees.adminFeePercent),
          },
          {
            label: $localize`:@@bank_programs.review.stamp_duty:Stamp duty`,
            value: pct(v.fees.stampDutyPercent),
          },
          {
            label: $localize`:@@bank_programs.review.life_insurance:Life insurance`,
            value: v.fees.lifeInsuranceMandatory
              ? $localize`:@@bank_programs.review.life_insurance_mandatory:${pct(v.fees.lifeInsurancePercent)}:rate: · mandatory`
              : pct(v.fees.lifeInsurancePercent),
          },
          {
            label: $localize`:@@bank_programs.review.late_fee:Late payment fee`,
            value: pct(v.fees.latePaymentFeePercent),
          },
          {
            label: $localize`:@@bank_programs.review.payoff:Payoff (cash / buyout)`,
            value: `${pct(v.fees.payoffCashPercent)} / ${pct(v.fees.payoffBuyoutPercent)}`,
          },
        ],
      },
      {
        step: this.indexOf('eligibility'),
        title: this.labelOf('eligibility'),
        rows: [
          {
            label: $localize`:@@bank_programs.review.age:Age`,
            value: `${v.eligibility.ageMin} – ${v.eligibility.ageMax}`,
          },
          {
            label: $localize`:@@bank_programs.review.min_income:Minimum income`,
            value: `${money(v.eligibility.minMonthlyIncomeEGP)} EGP`,
          },
          {
            label: $localize`:@@bank_programs.review.min_job:Minimum months in job`,
            value: String(v.eligibility.minMonthsInJob),
          },
          {
            label: $localize`:@@bank_programs.review.employment:Employment types`,
            value: this.labelsFor('employment_type', v.eligibility.acceptedEmploymentTypes),
          },
          {
            label: $localize`:@@bank_programs.review.transfer:Transfer types`,
            value: this.labelsFor('transfer_type', v.eligibility.acceptedTransferTypes),
          },
          {
            label: $localize`:@@bank_programs.review.dbr:DBR cap`,
            value: v.eligibility.skipDbrCheck
              ? $localize`:@@bank_programs.review.dbr_skipped:Check skipped`
              : bands > 0
                ? $localize`:@@bank_programs.review.dbr_banded:${pct(v.eligibility.dbrCapPercent)}:cap: · ${bands}:bands: income bands`
                : pct(v.eligibility.dbrCapPercent),
          },
        ],
      },
      {
        step: this.indexOf('documents'),
        title: this.labelOf('documents'),
        rows: [
          {
            label: $localize`:@@bank_programs.review.documents:Required documents`,
            value: this.labelsFor('required_document', v.documents.requiredDocuments),
          },
          {
            label: $localize`:@@bank_programs.review.notes:Notes`,
            value: v.documents.operatorNotes ?? '',
          },
        ],
      },
    ];
  });

  /**
   * How the income is worked out, in one row: the method, how much of its table is filled
   * in, and — when the fact is not set up for this loan type — that the rule will produce
   * nothing. The last part is why this is a row and not a heading: a table can be complete
   * and still never fire.
   */
  private incomeRuleReviewRow(): ReviewRow {
    const draft = this.liveIncomeRuleDraft();
    const label = $localize`:@@bank_programs.review.income_rule:How the income is worked out`;
    // A step pipeline is not one of the eleven methods, so `incomeMethodLabel` returns
    // nothing for it and this row used to open with a stray separator.
    const method =
      draft.strategy === PRODUCT_RULE_STRATEGY
        ? $localize`:@@bank_programs.review.income_rule_steps:worked out step by step`
        : incomeMethodLabel(draft.strategy, this.incomeFacts());
    const parts: string[] = method === '' ? [] : [method];
    // WHOSE amounts, before how many rows. A reviewer glancing at this line needs to
    // know whether the figures are this bank's at all — "4 bands" on a program that
    // inherits describes the catalog's table, not a decision made on this screen.
    if (this.amountsValue() === 'catalog') {
      parts.push($localize`:@@bank_programs.review.income_rule_catalog:catalog amounts`);
    } else {
      parts.push($localize`:@@bank_programs.review.income_rule_own:this bank's own amounts`);
      // A pipeline's figures live per STEP, so counting the two legacy shapes reported
      // "no rows" for a fully filled compound program.
      const rows =
        draft.strategy === PRODUCT_RULE_STRATEGY
          ? this.stepFigureRowCount()
          : this.incomeKeyTable().length || this.incomeBands().length;
      if (rows > 0) parts.push(this.countLabel(rows));
    }
    const binding = this.factBinding();
    if (binding && !binding.asked) {
      parts.push(
        $localize`:@@bank_programs.review.income_rule_unbound:fact not set up — no income`,
      );
    }
    return { label, value: parts.join(' · ') };
  }

  /**
   * How many FIGURES this bank has typed into a pipeline — rows, bands, scalars and bounds.
   *
   * One number over the whole `stepParams` map rather than per step: the review row answers
   * "has this bank filled its side in", and a per-step breakdown is what the editor above is
   * for.
   */
  private stepFigureRowCount(): number {
    let count = 0;
    for (const figures of Object.values(this.stepFigures())) {
      count += figures.keyTable?.length ?? 0;
      count += figures.bands?.length ?? 0;
      if (figures.scalar?.value) count += 1;
      if (figures.valueEGP) count += 1;
      if (figures.minValue) count += 1;
      if (figures.maxValue) count += 1;
      if (figures.applies === true) count += 1;
    }
    return count;
  }

  /** Enum keys → their registry labels, joined for a review row. */
  private labelsFor(registry: string, keys: readonly string[]): string {
    if (keys.length === 0) return '';
    const members = this.enums.membersFor(registry as never)();
    return keys
      .map((k) => {
        const member = members.find((m) => m.key === k);
        if (!member) return k;
        return this.localeIsAr ? member.labelAr : member.labelEn;
      })
      .join(', ');
  }

  private countLabel(n: number): string {
    return n === 1
      ? $localize`:@@bank_programs.review.count_one:1 band`
      : $localize`:@@bank_programs.review.count_many:${n}:count: bands`;
  }

  /**
   * Income-banded DBR caps (FR-016), authored on this form by the DBR-bands
   * editor: the flat `eligibility.dbrCapPercent` is the program's floor for
   * every income and each band refines it above a salary threshold.
   *
   * Held in a signal rather than a FormArray because the editor owns its own
   * row-level validation and emits whole, already-sorted band lists. On edit the
   * program's stored bands are read in here and written straight back out, so a
   * save never silently wipes bands the admin did not touch.
   */
  readonly dbrBands = signal<DbrBand[]>([]);

  /**
   * The program's maximum loan keyed by an answer. `null` = this program states no such
   * table, which is the common case and the one every existing program is in.
   *
   * A signal rather than a form control for the same reason `dbrBands` is one: it is a
   * nested, variable-length shape, and a `FormArray` of `FormGroup`s whose CONTROLS change
   * with the picked fact is a second source of truth for what the rows are keyed by.
   */
  readonly maxLoanByFact = signal<MaxLoanByFactConfig | null>(null);

  /** Carried, never edited — see `LoanLimitsConfig.maxLoanAdjustments`. */
  private readonly maxLoanAdjustments = signal<NonNullable<
    BankProgramResponse['loanLimits']['maxLoanAdjustments']
  > | null>(null);

  /**
   * Whether the picked fact is answered with a number, which decides whether the rows are
   * option pickers or band edges. Computed here as well as inside the editor because the
   * save gate has to know it while the editor is not rendered.
   */
  private readonly maxLoanByFactIsNumeric = computed(() => {
    const key = this.maxLoanByFact()?.factKey;
    if (key === undefined) return false;
    return this.incomeFacts().find((f) => f.key === key)?.question?.type === 'NUMERIC';
  });

  /** The same verdict the editor shows inline, so Save is gated on it from any step. */
  readonly maxLoanByFactError = computed(() =>
    maxLoanByFactErrorFor(this.maxLoanByFact(), this.maxLoanByFactIsNumeric()),
  );

  /**
   * A DBR cap per kind of applicant — "50% salaried / 40% self-employed".
   *
   * A signal rather than a form control, exactly like `dbrBands` beside it and for the same
   * reason: it is a map, not a field, and the absorb / serialise pair has to be able to tell
   * "the admin cleared it" from "the admin never touched it".
   *
   * The BUCKETS are the bank's vocabulary, never the questionnaire's — the engine folds a
   * detailed answer (`business_owner_company_owner`) into one of these before it looks. Keys
   * outside this list are refused by the DTO, because a cap the engine never looks up reads
   * as configured on this screen and is dead at quote time.
   */
  readonly employmentBuckets = ['salaried', 'self_employed', 'retired'] as const;
  readonly dbrByEmployment = signal<Record<string, string>>({});

  protected employmentBucketLabel(bucket: string): string {
    return EMPLOYMENT_BUCKET_LABELS[bucket]?.() ?? bucket;
  }

  /** Blank REMOVES the row — an empty string would be refused, and means "no cap here". */
  protected setDbrForEmployment(bucket: string, raw: string): void {
    const value = raw.trim();
    this.dbrByEmployment.update((current) => {
      const next = { ...current };
      if (value === '') delete next[bucket];
      else next[bucket] = value;
      return next;
    });
  }

  /**
   * Feature 011 — the two TABLE shapes of the income rule.
   *
   * Signals rather than `FormArray`s, mirroring `dbrBands` above. The band table's
   * edges are LINKED (a band's end is the next band's start), so a `FormArray` would
   * give each boundary two owners — the array's control and the relink — which is
   * precisely how a gap nobody typed appears.
   */
  readonly incomeKeyTable = signal<IncomeKeyTableRow[]>([]);
  readonly incomeBands = signal<IncomeBand[]>([]);

  /**
   * Mark the rule dirty from a signal-backed edit.
   *
   * The figures live in a signal rather than in controls (the catalog decides how many there
   * are), and a signal cannot make the form dirty by itself — without this, an operator could
   * type a whole cap table and the wizard would still believe nothing had changed and let
   * them navigate away.
   */
  markIncomeRuleDirty(): void {
    this.form.controls.incomeAssumption.markAsDirty();
  }

  /**
   * The rule EXACTLY as it stands on screen, including unsaved edits (FR-028).
   *
   * Recomputed from the same form value the save payload is built from, so the panel
   * can never check something different from what Save would send — which is the one
   * way an in-place checker becomes worse than useless.
   */
  /**
   * The un-saved program the check runs against, on a CREATE only.
   *
   * `null` once the program exists, because the server then reads the STORED rate, fees and
   * limits — this program's own figures rather than a form's current state, which is the
   * better answer whenever there is a row to read.
   *
   * Built by `payloadFromForm`, the same function the Save button uses, so a draft check and
   * the program that save would create cannot describe different things. Only the five blobs
   * a quote actually reads are forwarded; the program code, bank name and Arabic friendly
   * name are none of the check's business, and demanding them is how this panel came to be
   * disabled for the whole of a create in the first place.
   *
   * Returns `null` while no rate is set. Pricing is step 4 and this is step 5, so in practice
   * it is filled — but an operator who went back and cleared it should get the panel's
   * "fill the Terms and Pricing steps first" line rather than a quote with no rate behind it.
   */
  protected readonly draftProgramForCheck = computed<IncomeRuleDraftProgram | null>(() => {
    if (this.editingProgramCode() !== null) return null;
    this.formValue();
    this.dbrBands();
    const payload = this.payloadFromForm(this.form.getRawValue());
    if (!payload.pricing.baseRatePercent && !payload.pricing.currentEffectiveRatePercent) {
      return null;
    }
    return {
      ...(payload.programNameKey ? { programNameKey: payload.programNameKey } : {}),
      productCategory: payload.productCategory,
      isShariaCompliant: payload.isShariaCompliant,
      programType: payload.programType,
      tenor: payload.tenor,
      loanLimits: payload.loanLimits,
      pricing: payload.pricing,
      eligibility: payload.eligibility,
      fees: payload.fees,
    };
  });

  readonly liveIncomeRuleDraft = computed<IncomeAssumptionConfig>(() => {
    // Touching the two table signals registers them as dependencies, so editing a row
    // re-derives the draft the panel holds.
    this.incomeKeyTable();
    this.incomeBands();
    // `formValue` is the existing any-value mirror of `form.valueChanges` — reading it
    // is what makes this recompute when the method select or a policy control moves.
    // The RAW value is then used, because `getRawValue()` includes disabled controls
    // and `formValue` alone would not.
    this.formValue();
    return this.incomeAssumptionPayload(this.form.getRawValue().incomeAssumption);
  });

  /**
   * The saved program's code, or `null` while creating.
   *
   * The check panel needs it because the check runs against THIS program's own rate,
   * fees, tenor and limits — a rule checked against nothing in particular would
   * produce an installment no bank would ever offer, which is worse than no check.
   */
  /**
   * A product rule's STRUCTURE, read off the catalog name's own rule.
   *
   * The wizard already fetches that rule for the whose-amounts card, so this adds no request.
   * It comes from there rather than from the program because the program does not store it:
   * `stripCatalogStructure` removes it on save, precisely so a bank cannot end up running a
   * pipeline the catalog has since changed.
   */
  readonly ruleSteps = computed<readonly RuleStep[]>(
    () => this.catalogEffectiveRule()?.steps ?? [],
  );
  readonly ruleGates = computed<readonly RuleGate[]>(
    () => this.catalogEffectiveRule()?.gates ?? [],
  );
  readonly ruleOutput = computed<ProductRuleOutput | null>(
    () => this.catalogEffectiveRule()?.output ?? null,
  );
  /**
   * Whether this product sells ONE of its ways, from the catalog rule beside the steps.
   *
   * The catalog's, like the steps — a bank cannot restate what the product IS. It travels on
   * the rule rather than being fetched from the product's form, because the rule is what both
   * the wizard and the server hold, and a calculation authored by hand has no form at all.
   */
  readonly ruleWaysAre = computed<WaysAre>(() => this.catalogEffectiveRule()?.waysAre ?? null);

  /**
   * Whether a surrogate PRODUCT stands behind the rule — which is what makes a way REQUIRED
   * (the server's `surrogateProductKey` gate). A name holding its own hand-wired rule is asked
   * for none, and neither is a payslip program.
   */
  readonly productBacked = computed<boolean>(() => catalogRuleIsProductBacked(this.catalogRule()));

  /**
   * The amount fields wait for the method. True only while a program WITH a choice of ways has
   * not made it — inert by construction for a payslip program (no steps), a single-way product
   * and a combined product, whose one way is recorded without asking. A create-time state in
   * practice: the backfill named every existing program's way, so an edit never opens locked.
   *
   * Only the POINTER is refused, never the control (`[attr.disabled]`, not `.disable()`): a
   * disabled control drops out of the group's validity, so the step would report itself
   * complete with two empty required fields, and it emits through `valueChanges`, which
   * every signal on this page hangs off. The Sharia checkbox states the same rule.
   */
  readonly amountsLocked = computed<boolean>(
    () =>
      this.incomeSurrogateActive() &&
      mustPickWayFirst(this.ruleSteps(), this.ruleWaysAre(), this.wayIdValue()),
  );

  /** The rule's own debt-burden cap, when the bank stated one — for the Eligibility cross-reference. */
  readonly dbrOverrideValue = computed<string | null>(() => {
    this.formValue();
    const raw = this.form.getRawValue().incomeAssumption.dbrCapPercentOverride;
    return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null;
  });

  /**
   * The surrogate product's own figures, whole.
   *
   * Not pruned to the chosen way: the editor already hides the ways this bank does not sell,
   * and `catalog-defaults.ts` narrows by `wayOwnedSlots` — which is the ONE owner of that
   * split. A second pruning here would be free to disagree with it.
   *
   * Cloned, for the hazard `cloneStepFigures` exists for: the editor writes into whatever it
   * is handed, and the operator's first keystroke would otherwise edit the catalog copy this
   * program is departing from.
   */
  readonly ruleCatalogFigures = computed<Record<string, StepFigures>>(() =>
    cloneStepFigures(this.catalogEffectiveRule()?.stepParams),
  );

  /**
   * The maximum-loan grid the picked name's product declares, or `null`.
   *
   * A property of the NAME's product, which is why it rides the rule payload this page
   * already fetches on load and on every name re-pick: changing the name re-shapes the grid
   * with no second request and no ordering to get wrong.
   */
  readonly productCap = computed<ProductCapShape | null>(
    () => this.catalogRule()?.surrogateProduct?.cap ?? null,
  );

  /**
   * The amounts a NEW program starts that grid from. Empty is the normal state.
   *
   * Withheld on an edit, deliberately. A grid that rendered the product's figures without
   * storing them would show six numbers that do not exist; and seeding them into a live
   * program would give it a maximum it has never had, silently, on a screen the operator
   * opened to change a fee. An existing program shows what it holds, and its empty boxes are
   * reported as empty.
   */
  readonly productCapDefaults = computed<readonly MaxLoanByFactRow[]>(() =>
    this.editProgramCode() ? [] : (this.catalogRule()?.surrogateProduct?.capDefaults ?? []),
  );

  /**
   * The BANK's figures, by step id and gate id. A signal for the same reason `incomeKeyTable`
   * is one: a pipeline is not a fixed set of named fields, so there is no control shape to
   * declare — the catalog decides how many there are.
   */
  readonly stepFigures = signal<Record<string, StepFigures>>({});

  readonly editingProgramCode = computed<string | null>(() => {
    // The LOADED program's code, not whatever is typed in the identity box. On the
    // create wizard that box is editable and empty, so reading it enabled the Check
    // button the moment an admin typed a code — and the check then 404'd
    // `BANK_PROGRAM_NOT_FOUND` inside the panel, on a program that does not exist yet.
    // `loadedProgramCode` is set only by `loadForEdit`, which is exactly the condition
    // "there is a saved program to check against".
    return this.loadedProgramCode() ?? null;
  });

  /**
   * The flat cap, live, so the editor seeds new rows with what the admin just
   * typed above rather than a value read once at construction.
   */
  private readonly dbrCapValue = toSignal(
    this.form.controls.eligibility.controls.dbrCapPercent.valueChanges,
    { initialValue: this.form.controls.eligibility.controls.dbrCapPercent.value },
  );
  readonly dbrFlatCap = computed(() => {
    const cap = this.dbrCapValue();
    return typeof cap === 'string' && cap.trim() !== '' ? cap : '50.0';
  });

  /**
   * Same verdict the editor renders inline, computed from the shared rule so the
   * wizard can refuse a broken band table even from a step where the editor is
   * not on screen. The backend re-validates on save (`DBR_BANDS_INVALID`).
   */
  readonly dbrBandsError = computed<DbrBandsError>(() => dbrBandsErrorFor(this.dbrBands()));

  /**
   * Feature 011 — the same verdict the income section renders inline, through the
   * same shared function, so the wizard can refuse a broken rule from a step where
   * that section is not on screen. Without it an admin pressed Save on an empty key
   * table, waited for a round trip, and got `INCOME_RULE_EMPTY` pointing at a control
   * three steps back.
   *
   * Only consulted for programs that actually read a rule — a program typed
   * `income_proof` carries the section's controls but nothing reads what they hold,
   * so gating on them would block a save the server would have accepted.
   */
  readonly incomeRuleError = computed<boolean>(() => {
    if (!this.incomeSurrogateActive()) return false;
    this.formValue();
    const ia = this.form.getRawValue().incomeAssumption;
    // WHICH WAY is true regardless of whose figures they are — so it is asked before the
    // catalog escape below, not after it. A program on catalog amounts is exactly the case
    // that needs the choice most: it has typed no figure anywhere, and the compound catalog
    // fills four of the five heads, so without a way it would inherit the lower of four
    // mechanisms nobody sells. Gate it after the early return and the one case that needs a
    // choice is the one case the client never gates.
    if (
      this.productBacked() &&
      waysOfRule(this.ruleSteps(), this.ruleWaysAre()).length > 0 &&
      !this.wayIdValue()
    ) {
      return true;
    }
    // A program on CATALOG amounts has no table of its own to be wrong about. Gating on
    // the local editor here would block Continue on an empty table for every program
    // that takes the catalog's — which is the default, so the wizard would refuse to
    // advance out of the box. The catalog's own table is validated where it is authored,
    // and again by the server on this save.
    if (ia.amounts === 'catalog') return false;
    // The name has not stated a proof, so there is nothing valid to save. Blocked here
    // rather than at the server, next to the notice that says where to fix it.
    if (!this.catalogProof()) return true;
    const shape = incomeMethodShape(ia.strategy, this.incomeFacts());
    if (shape === 'steps') {
      return productRuleHasError({
        steps: this.ruleSteps(),
        gates: this.ruleGates(),
        figures: this.stepFigures(),
        waysAre: this.ruleWaysAre(),
        wayId: this.wayIdValue(),
        productBacked: this.productBacked(),
      });
    }
    return incomeRuleHasError({
      shape,
      keyTable: this.incomeKeyTable(),
      bands: this.incomeBands(),
      scalarValue: ia.scalar.value,
      isValueMethod: ia.strategy === 'byCDValue' || ia.strategy === 'byTotalDeposits',
    });
  });

  // --- The name's ONE income proof, and whose amounts this bank uses ---------
  //
  // The Method dropdown is GONE from this step. The catalog program name states the one
  // figure the income is worked out from, every bank selling that name reads it, and the
  // server refuses a program that reads anything else. What is left for the bank to
  // decide is the AMOUNTS, which is one radio pair.

  /** The catalog name's rule as the server holds it. `null` = the name states nothing. */
  private readonly catalogRule = signal<ProgramNameIncomeRule | null>(null);
  protected readonly catalogRuleLoading = signal(false);

  /**
   * The rule this name actually quotes on — the linked PRODUCT's, or the name's own.
   *
   * Every read of the catalog rule on this page goes through here. Seven of them used to read
   * `incomeRule` alone, which is NULL on all eight linked names: step 5 rendered the "nobody
   * has said what this name reads its income from" blocker for every live surrogate program,
   * and the figures editor never mounted. The fallback itself is `catalogRuleOf`, shared with
   * the catalog name's own page so the two screens cannot answer this differently again.
   */
  private readonly catalogEffectiveRule = computed<IncomeAssumptionConfig | null>(() =>
    catalogRuleOf(this.catalogRule()),
  );

  /** The proof, in the operator's words. `null` means nothing is stated yet. */
  protected readonly catalogProof = computed<string | null>(() => {
    const strategy = this.catalogEffectiveRule()?.strategy;
    return strategy === undefined ? null : this.incomeMethodLabelFor(strategy);
  });

  /** The picked name's label, for a sentence that names it rather than saying "this name". */
  protected readonly programNameLabel = computed<string>(() => {
    const key = this.programNameKeySignal();
    if (!key) return '';
    const member = this.programNameMembers().find((m) => m.key === key);
    return member ? (this.localeIsAr ? member.labelAr : member.labelEn) : key;
  });

  /** Plain string, for the `routerLink` and the "is a name even picked" guard. */
  protected readonly programNameKeyValue = computed<string>(
    () => this.programNameKeySignal() ?? '',
  );

  /**
   * Whether the catalog states any figure at all — i.e. whether "back to the catalog's"
   * would land on something. A `declared` name has no table by design, so on one of those
   * there is nothing to offer and nothing to go back to.
   */
  protected readonly catalogHasFigures = computed<boolean>(() => {
    const rule = this.catalogEffectiveRule();
    if (!rule) return false;
    return Boolean(
      rule.keyTable?.length ||
      rule.bands?.length ||
      rule.scalar ||
      (rule.stepParams && Object.keys(rule.stepParams).length > 0),
    );
  });

  /**
   * Following the catalog, and the catalog holds no figures.
   *
   * The state every product starts in, and the one the two-branch strip could not name: the
   * grid renders empty, the wizard's own gate is off for catalog amounts by design, the save
   * succeeds, and the resolver then answers every applicant with `rule_unconfigured`.
   */
  protected readonly catalogStatesNothing = computed<boolean>(
    () => this.amountsValue() === 'catalog' && !this.catalogHasFigures(),
  );

  /** The strip's medallion: what the numbers ARE, or that there are none. */
  protected readonly sourceIcon = computed<string>(() => {
    if (this.amountsValue() === 'own') return 'edit';
    return this.catalogStatesNothing() ? 'exclamation-circle' : 'database';
  });

  /**
   * Set for the strip's one-shot sweep the moment a program stops following the catalog,
   * cleared when it starts again. Not persisted and not read by the payload — it marks
   * the transition, not the state, which `amountsValue()` already carries.
   */
  protected readonly justDetached = signal(false);

  /**
   * Which card is on. ABSENT reads as `'own'`, matching the wire contract: every
   * program saved before this field existed carries its own figures, so the absent case
   * has to be the one that changes nothing.
   */
  protected readonly amountsValue = computed<'catalog' | 'own'>(() => {
    this.formValue();
    return this.form.getRawValue().incomeAssumption.amounts === 'catalog' ? 'catalog' : 'own';
  });

  /** Which of the product's ways this program sells. `null` until the operator picks one. */
  protected readonly wayIdValue = computed<string | null>(() => {
    this.formValue();
    return this.form.getRawValue().incomeAssumption.wayId ?? null;
  });

  /**
   * The picker chose a way.
   *
   * The editor has already cleared the figures of the way being left — it is the one holding
   * them — so this only records the decision and marks the form dirty. Two writers for one
   * value would be two chances to disagree about which way is live.
   */
  protected onWayPicked(wayId: string | null): void {
    const control = this.form.controls.incomeAssumption.controls.wayId;
    if (control.value === wayId) return;
    control.setValue(wayId);
    control.markAsDirty();
    // The way change prunes the losing way's figures, so the fill's own record of what it
    // put where stops being true. The banner goes rather than offering to undo boxes that
    // are no longer there.
    this.clearFillBanner();
  }

  /** Reactive view of the bound key so the option list keeps a legacy value visible. */
  readonly programNameKeySignal = toSignal(
    this.form.controls.identity.controls.programNameKey.valueChanges,
    { initialValue: this.form.controls.identity.controls.programNameKey.value },
  );

  /**
   * The registry signal, hoisted: `membersFor()` allocates a fresh `computed()`
   * per call, and calling it inside another computed made a new reactive node on
   * every recomputation.
   */
  private readonly programNameMembers = this.enums.membersFor('program_name');

  /**
   * The labels of the name picked LAST, so a re-pick can tell "still following the catalog"
   * from "the bank worded this itself".
   *
   * Not derived from the form: once the field has been overwritten there is nothing left in
   * it to compare against, which is exactly how the old unconditional assignment lost the
   * distinction it was overwriting.
   */
  /**
   * The catalog name the display fields were last seeded from — stored as a KEY and resolved
   * to labels at compare time.
   *
   * A snapshot of the LABELS was tried first and is wrong: `programNameMembers()` is a lazily
   * populated cache that returns `[]` until its fetch lands, so on a cold edit-load the
   * snapshot resolved to `null` and `followsCatalogName` then answered `false` for every
   * programme — including one whose name genuinely still equals the catalog's, which should
   * move with it. Holding the key defers the lookup to the moment it is actually needed, by
   * which time the members are there.
   */
  private lastPickedNameKey: string | null = null;

  /** The labels of that name, or `null` if it is unset or the registry has not arrived. */
  private lastPickedNameLabels(): PickedNameLabels | null {
    if (this.lastPickedNameKey === null) return null;
    const m = this.programNameMembers().find((x) => x.key === this.lastPickedNameKey);
    return m ? { labelEn: m.labelEn, labelAr: m.labelAr } : null;
  }

  /** Fill a display name from the catalog, unless the bank has made it its own. */
  private seedFriendlyName(control: FormControl<string | null>, label: string): void {
    if (followsCatalogName(control.value, this.lastPickedNameLabels())) {
      control.setValue(label, { emitEvent: false });
    }
  }

  /**
   * Program-name options, sourced from the live `program_name` registry
   * (Principle II — names are DATA, no hardcoded list), narrowed to the names
   * assigned to the picked product category (Program catalog → Loan
   * categories). The API enforces the same pair, so offering a name the save
   * would reject is just a slower way to show the error.
   *
   * A name assigned to NOTHING is parked and appears nowhere — there is no
   * "show all" escape hatch, or the catalog's own parked warning would be a lie.
   *
   * Options carry the catalog KEY, which is what the API stores; a bound key
   * that is not in the filtered list stays visible so saving does not silently
   * re-classify the program — that now covers three cases (a pre-catalog key, a
   * deprecated one, and a live one valid under a different category), and the
   * label is resolved from the FULL registry so a known name never renders as a
   * raw machine key.
   */
  private readonly namesForCategory = computed(() => {
    const all = this.programNameMembers().filter((m) => m.active && !m.deprecated);
    const cat = this.productCategorySignal();
    // An unrecognised product category is a registry-config problem, not a
    // reason to hand the admin an empty picker.
    return isLoanCategory(cat) ? all.filter((m) => (m.categories ?? []).includes(cat)) : all;
  });

  /**
   * Does the catalog file this name under the ANSWERED basis for this loan type?
   *
   * Only an explicit disagreement hides a name. A pair the catalog has not settled —
   * field absent (older backend), name not offered under this category, or a legacy
   * row holding both — is shown under either answer: the filter is a shortcut through
   * the list, and silence is not a statement that the name is sold the other way.
   */
  private matchesBasis(key: string, basis: IncomeBasis): boolean {
    const cat = this.productCategorySignal();
    if (!isLoanCategory(cat)) return true;
    const bases = this.programNameMembers().find((m) => m.key === key)?.incomeBases?.[cat];
    if (!bases || bases.length !== 1) return true;
    return bases[0] === basis;
  }

  /** The operator asked to see past the basis filter. Reset whenever the answer changes. */
  private readonly showAllNamesSignal = signal(false);
  protected readonly showAllNames = this.showAllNamesSignal.asReadonly();

  protected toggleAllNames(): void {
    this.showAllNamesSignal.update((on) => !on);
  }

  /**
   * How many names this loan type offers that the answered basis is hiding.
   *
   * Rendered as the toggle's own count, so a list shortened by the filter can always
   * be explained — and so an operator who knows this bank sells a name the other way
   * can reach it. Zero while the basis is unanswered: nothing is hidden then, the
   * picker is simply not open for business yet.
   */
  protected readonly namesHiddenByBasis = computed(() => {
    const basis = this.basisAnswered();
    if (!basis) return 0;
    return this.namesForCategory().filter((m) => !this.matchesBasis(m.key, basis)).length;
  });

  /**
   * Program-name options, sourced from the live `program_name` registry
   * (Principle II — names are DATA, no hardcoded list), narrowed to the names
   * assigned to the picked product category (Program catalog → Loan
   * categories) and then to the ANSWERED income basis. The API enforces the
   * category pair, so offering a name the save would reject is just a slower way
   * to show the error; the basis half it does NOT enforce, which is why that half
   * is a default view with a "show the rest" escape rather than a filter with no
   * way out (v16.4.0's finding: a stale catalog entry must never make a program
   * the bank is entitled to sell unreachable).
   *
   * A name assigned to NOTHING is parked and appears nowhere — there is no
   * "show all" escape hatch for that, or the catalog's own parked warning would be
   * a lie.
   *
   * Empty until the basis is answered: this picker is the second question on the
   * step now, and an open list would invite the operator to skip the first.
   *
   * Options carry the catalog KEY, which is what the API stores; a bound key
   * that is not in the filtered list stays visible so saving does not silently
   * re-classify the program — that now covers four cases (a pre-catalog key, a
   * deprecated one, a live one valid under a different category, and one the
   * catalog files under the other basis), and the label is resolved from the FULL
   * registry so a known name never renders as a raw machine key.
   */
  readonly programNameOptions = computed(() => {
    const basis = this.basisAnswered();
    if (!basis) return [];
    const byBasis = this.showAllNames()
      ? this.namesForCategory()
      : this.namesForCategory().filter((m) => this.matchesBasis(m.key, basis));
    const opts = byBasis.map((m) => ({
      value: m.key,
      label: this.localeIsAr ? m.labelAr : m.labelEn,
    }));

    const current = this.programNameKeySignal();
    if (current && !opts.some((o) => o.value === current)) {
      const known = this.programNameMembers().find((m) => m.key === current);
      opts.unshift({
        value: current,
        label: known ? (this.localeIsAr ? known.labelAr : known.labelEn) : current,
      });
    }
    return opts;
  });

  /**
   * The picked name is not offered under the picked product category.
   *
   * A signal rather than a control validator: the verdict depends on the
   * registry, which arrives asynchronously, and a validator computed before it
   * lands would stay stale. Returns `null` when the registry has not shipped
   * `categories` at all (pre-rollout rows must never be blocked) and when the
   * pair is untouched on an existing program — the same grandfather rule the
   * backend applies, so the form and the API agree on what is refusable.
   */
  readonly programNameMismatch = computed<{ name: string; category: string } | null>(() => {
    const key = this.programNameKeySignal();
    const cat = this.productCategorySignal();
    if (!key || !isLoanCategory(cat)) return null;
    if (
      key === this.grandfatheredPair()?.programNameKey &&
      cat === this.grandfatheredPair()?.productCategory
    ) {
      return null;
    }
    const member = this.programNameMembers().find((m) => m.key === key);
    if (!member || member.categories === undefined) return null;
    const name = this.localeIsAr ? member.labelAr : member.labelEn;
    if (!member.categories.includes(cat)) {
      return { name, category: categoryLabel(cat) };
    }
    return null;
  });

  /**
   * The (name, category) pair this program was loaded with, on edit. Kept so an
   * operator who opened a program to change a fee is not blocked by an
   * assignment someone narrowed after the program was created — they did not
   * break it, and refusing the save would strand the row.
   */
  private readonly grandfatheredPair = signal<{
    programNameKey: string;
    productCategory: string;
  } | null>(null);

  // ── Income basis, asked first ────────────────────────────────────────────
  /**
   * The basis the operator has actually answered on THIS form. `null` on create
   * until they pick one.
   *
   * Distinct from {@link incomeBasis}, which reads `programType` — a control with a
   * default (`income_proof`), so it always has a value and can never say "nobody has
   * answered". That distinction is what lets the pills start with neither on and the
   * name picker stay shut until the question is answered.
   */
  private readonly basisPicked = signal<IncomeBasis | null>(null);

  /**
   * The answer in force: the operator's pick, or — on edit — the stored
   * `programType`, which IS an answer (a saved program states its own basis).
   */
  protected readonly basisAnswered = computed<IncomeBasis | null>(
    () => this.basisPicked() ?? (this.isEditMode() ? this.incomeBasis() : null),
  );

  /**
   * The header chip's words.
   *
   * `programType` defaults to `income_proof`, so an unanswered form would have the
   * chip asserting "Reads a payslip" — a claim about a bank nobody has described
   * yet. It reports the ANSWER, and says so only once there is one.
   */
  protected basisChipLabel(): string {
    const basis = this.basisAnswered();
    if (!basis) return $localize`:@@bank_programs.form.income.not_set:Not set yet`;
    return incomeBasisLabel(basis);
  }

  /**
   * Empty-picker copy. Deliberately does NOT tell the operator to go fix it in
   * the program catalog: this form is reachable by four roles, while
   * `/program-catalog` is super-admin only, so that instruction would be a
   * dead end for most of the people who see it.
   */
  private readonly noNamesForCategory = $localize`:@@bank_programs.field.friendly_name.none_for_category:No program names are set up for this loan type yet.`;

  /**
   * Two dead ends, two messages. "None at all" is a catalog gap; "none under this
   * income" is a filter the operator can lift on the spot, so the copy says so
   * rather than reading as the same emptiness.
   */
  protected readonly emptyPickerLabel = computed(() => {
    if (this.namesForCategory().length === 0) return this.noNamesForCategory;
    if (this.namesHiddenByBasis() > 0 && !this.showAllNames()) {
      return $localize`:@@bank_programs.field.friendly_name.none_for_basis:No name in this loan type is filed under this income — use the link below to see the rest.`;
    }
    return this.noNamesForCategory;
  });

  /**
   * The picker's placeholder doubles as the order of the step: while the income is
   * unanswered it names the question that unlocks it, instead of inviting a pick the
   * disabled control will not accept.
   */
  protected readonly namePlaceholder = computed(() =>
    this.basisAnswered()
      ? $localize`:@@bank_programs.field.friendly_name.placeholder:Select a program`
      : $localize`:@@bank_programs.field.friendly_name.awaiting_basis:Answer the income question first`,
  );

  constructor() {
    // Bank picker valueChanges → mirror into identity.bankName.
    // Guard inside onBankPicked prevents setValue recursion.
    this.bankIdControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((id) => this.onBankPicked(id ?? null));

    // A single rate input drives both rate keys; which one the payload carries is
    // decided by `isVariableRate`. Clearing the unused key here keeps the payload
    // free of a stale value the backend's variable-rate consistency check rejects.
    effect(() => {
      if (this.isVariableRateSignal()) {
        this.pricingGroup.patchValue({ baseRatePercent: null }, { emitEvent: false });
      } else {
        this.pricingGroup.patchValue(
          { currentEffectiveRatePercent: null, variableRateNote: null },
          { emitEvent: false },
        );
      }
    });
    // A program that no longer estimates income must not keep surrogate settings
    // (FR-011). The two table signals are cleared with the controls — leaving them
    // would send a table the server then reports as ignored, on a program the admin
    // deliberately moved off surrogate income.
    effect(() => {
      if (!this.incomeSurrogateActive()) {
        this.incomeAssumptionGroup.patchValue(
          {
            strategy: 'declared',
            scalar: { value: null, unit: 'percent' },
            dbrCapPercentOverride: null,
            requiredDocuments: [],
            combinationRule: null,
          },
          { emitEvent: false },
        );
        if (this.incomeKeyTable().length > 0) this.incomeKeyTable.set([]);
        if (this.incomeBands().length > 0) this.incomeBands.set([]);
        // A pipeline's figures go with them: they are keyed by the steps of the rule that was
        // just replaced, so keeping them would leave the save carrying numbers for steps the
        // new rule does not have — which the server refuses as `unknown_param_key`.
        if (Object.keys(this.stepFigures()).length > 0) this.stepFigures.set({});
        // …and the markers those tables carried, which the payload would otherwise
        // still name over a rule that no longer has either table (422
        // `VALUE_SOURCE_PATH_UNKNOWN`, with no control left on screen to clear it).
      }
    });
    effect(() => {
      if (!this.toggles.tieredRates()) {
        this.rateBandsArray.clear();
      }
    });

    // Program-name picker: the catalog member SEEDS both display names, and never
    // overwrites one the bank has already made its own.
    //
    // This used to assign unconditionally, on the stated reasoning that a display name is
    // "never hand-typed (A20 / Principle II)". Both halves of that are wrong here. A20 bans
    // hardcoded user-visible strings in the bundle; `friendlyName` is DB content an operator
    // types. And Principle II argues the other way — a bank naming its own programme IS
    // banks-as-data. What the old rule actually did was destroy the only record of a
    // distinction the catalog cannot carry: one product is deliberately sold as several
    // programmes off one mechanism, so ABK files "Doctors — Clinic Owners" and
    // "Doctors — In Practice" under the one catalog name "Doctors". Touching the picker
    // replaced both with "Doctors" and the two became indistinguishable, silently, with the
    // figures still differing by half at every band.
    //
    // Seeded when blank, and re-seeded only while the field still reads as the PREVIOUS
    // pick's label — so switching names on a programme that never diverged still follows
    // the catalog, and a programme that diverged keeps its own words.
    this.form.controls.identity.controls.programNameKey.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((key) => {
        // NOT while the form is being filled in from a stored program. `applyInitial`
        // patches `programNameKey` before it patches the rule, so on an edit load this
        // subscription fires with the form's default `declared` still in the strategy
        // control — the adopt then reads the name's real proof, sees a change, and flips a
        // live program onto CATALOG amounts, replacing the figures it quotes off with the
        // catalog's. Latent until the wizard could resolve a linked name's proof at all
        // (it read `incomeRule` alone, which is NULL on every linked name, so `proof` was
        // always `undefined` and the adopt returned early); measured in a browser the
        // moment that was fixed — FABMISR's program opened showing four of the catalog's
        // ways as its own. The baseline is still recorded, or a later operator-driven change
        // would compare against `null` and `followsCatalogName` would refuse to move a name
        // that genuinely still follows the catalog.
        if (this.hydrating) {
          this.lastPickedNameKey = key ?? null;
          return;
        }
        const previous = this.lastPickedNameKey;
        const next = key ?? null;
        if (next === previous) return;

        // THE NAME DECIDES THE PRODUCT, and two things belong to the product: the way this
        // program picked (a slot id of one product's rule — stale, the server refuses it as
        // PROGRAM_INCOME_WAY_UNKNOWN) and the maximum-by-answer rows (keyed by one product's
        // facts). Both are cleared. Warned FIRST, naming what goes, when the operator made
        // either — and silently when neither was theirs: a way recorded without asking and a
        // grid still equal to the product's seed are not decisions to lose. NOTHING moves
        // until they confirm: the friendly names, the way, the grid and the re-read all wait,
        // so a cancel has nothing to undo but the picker itself.
        const loss = nameChangeLoss({
          wayId: this.wayIdValue(),
          wayTitle: this.currentWayTitle(),
          hadChoice: picksBetweenWays(this.ruleSteps(), this.ruleWaysAre()),
          capConfig: this.maxLoanByFact(),
          capSeededSignature: this.capSeededSignature,
        });
        if (loss === null) {
          this.commitNameChange(next);
          return;
        }
        const ref = this.modal.confirm({
          nzTitle: $localize`:@@bank_programs.name_change.confirm_title:Change the program name?`,
          nzContent: this.nameChangeBody(loss, previous),
          nzOkDanger: true,
          nzOkText: $localize`:@@bank_programs.name_change.confirm_ok:Change the name and clear them`,
          nzCancelText: this.keepNameLabel(previous),
          // RETURNS TRUE, and it is load-bearing: `afterClose` emits whatever `nzOnOk` returned,
          // so a handler returning void reads as "not confirmed" below and the restore undoes
          // the very change the operator just approved. Measured in a browser — the name
          // snapped back to the old one with the dialog reporting success.
          nzOnOk: () => {
            this.commitNameChange(next);
            return true;
          },
        });
        // `afterClose`, not `nzOnCancel`: Esc, the mask and the close icon must ALL restore
        // the picker, or the form is left holding a new name with the old way — the state the
        // server refuses with no control on screen naming it.
        ref.afterClose.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((ok) => {
          if (ok !== true) this.restoreName(previous);
        });
      });
    // No category-change RESET. Changing the product category can invalidate the
    // picked name, but clearing the key would not clear `friendlyName` /
    // `friendlyNameAr` (derived above), leaving a program with no key and a
    // stale display name — worse than the problem. `programNameMismatch` warns
    // and blocks the step instead, so the operator decides which field is wrong.

    // No catalog → basis effect. The basis is asked FIRST now and narrows the name
    // list, so deriving it back from the name would be a loop: the catalog's entry
    // is intent, the bank's answer is the fact, and this form collects the fact.
  }

  ngOnInit(): void {
    this.enums.preload([
      'transfer_type',
      'employment_type',
      'property_type',
      'required_document',
      'program_name',
      // The fact registry. Preloaded HERE and not left to the income-assumption
      // section, which is the only other host that asks for it: that section renders
      // on step 5, and the max-loan cap table on step 3 reads the same registry — so
      // on the forward path its "Keyed by" list was empty and the table could not be
      // built at all, while on an edit a stored table rendered its rows with no answer
      // named. The detail page already preloads it for the same reason.
      'surrogate_fact',
    ]);

    void this.loadActiveBanks();

    if (this.isEditMode() && this.editProgramCode()) {
      void this.loadForEdit(this.editProgramCode());
    } else {
      this.preselectCategoryFromQuery();
    }
  }

  /**
   * Adopt the product category chosen on the bank-detail category section
   * (`?category=<loanCategory>`). There is no picker on this form, so an
   * unknown or absent value must NOT fall through to a default: filing the
   * program under the wrong product is worse than blocking the step, and the
   * empty value trips the `required` validator that keeps Continue shut while
   * the "start from a bank" notice explains where the choice lives.
   */
  private preselectCategoryFromQuery(): void {
    const cat = this.route.snapshot.queryParamMap.get('category');
    this.form.controls.identity.controls.productCategory.setValue(isLoanCategory(cat) ? cat : '');
  }

  private async loadActiveBanks(): Promise<void> {
    try {
      const res = await this.banksApi.list({ pageSize: 100, active: true });
      this.activeBanks.set(res.data);
      await this.preselectBankFromQuery(res.data);
    } catch {
      // dropdown stays empty; user can retry by reloading
    }
  }

  /**
   * Preselect + lock the bank when creating from a bank's detail page.
   * Prefers `?bankId=<id>` (robust); falls back to legacy `?bank=<nameEnglish>`.
   * If the id isn't in the active list (inactive / paginated out), fetch it
   * directly so the chip still resolves.
   */
  private async preselectBankFromQuery(active: BankWithProgramCount[]): Promise<void> {
    if (this.selectedBankId()) return;
    const params = this.route.snapshot.queryParamMap;
    const preId = params.get('bankId');
    if (preId) {
      let bank = active.find((b) => b.id === preId);
      if (!bank) {
        try {
          bank = (await this.banksApi.getById(preId)).data;
          this.activeBanks.set([bank, ...active]);
        } catch {
          return;
        }
      }
      this.onBankPicked(bank.id);
      this.bankFromUrl.set(true);
      return;
    }
    const preName = params.get('bank');
    if (preName) {
      const match = active.find((b) => b.nameEnglish === preName);
      if (match) {
        this.onBankPicked(match.id);
        this.bankFromUrl.set(true);
      }
    }
  }

  protected get preselectedBank() {
    const id = this.selectedBankId();
    if (!id) return null;
    return this.activeBanks().find((b) => b.id === id) ?? null;
  }

  /**
   * The bank came from the URL, so this wizard was opened FROM a bank and the bank
   * is a given, not a field. Distinct from `preselectedBank`, which only says one is
   * selected — after the step-2 picker is used that is true too, and the picker must
   * stay on screen to be re-openable.
   */
  protected readonly bankFromUrl = signal(false);

  onBankPicked(bankId: string | null): void {
    if (this.bankIdControl.value !== (bankId ?? null)) {
      this.bankIdControl.setValue(bankId ?? null);
    }
    const bank = this.activeBanks().find((b) => b.id === bankId);
    this.identityGroup.patchValue({
      bankName: bank?.nameEnglish ?? '',
    });
  }

  retryEnums(): void {
    this.enums.clear();
    this.enums.preload([
      'transfer_type',
      'employment_type',
      'property_type',
      'required_document',
      'program_name',
      'surrogate_fact',
    ]);
  }

  setToggle(key: ToggleKey, value: boolean): void {
    this.toggles[key].set(value);
    // Switching tiering on with no rows would render an empty table with no
    // affordance, so seed the first band.
    if (key === 'tieredRates' && value && this.rateBandsArray.length === 0) {
      this.addRateBand();
    }
  }

  get rateBandsArray(): FormArray {
    return this.pricingGroup.get('rateByLoanAmountBands') as FormArray;
  }

  readonly bandAriaMin = $localize`:@@bank_programs.bands.aria_min:Loan amount lower bound, EGP`;
  readonly bandAriaMax = $localize`:@@bank_programs.bands.aria_max:Loan amount upper bound, EGP — the same value as the next band's lower bound`;
  readonly bandAriaRate = $localize`:@@bank_programs.bands.aria_rate:Band rate, percent`;
  readonly bandAriaRemove = $localize`:@@bank_programs.bands.aria_remove:Remove band`;

  /**
   * Ordering verdict for the band table, mirroring `rateBandsOrder` so the inline
   * message and the Continue gate read the same state. Depends on `formValue()`
   * because control errors are not signals.
   */
  readonly rateBandsError = computed<'ORDER' | 'DUPLICATE' | null>(() => {
    this.formValue();
    const errors = this.rateBandsArray.errors;
    if (errors?.['bandDuplicate']) return 'DUPLICATE';
    if (errors?.['bandOrder']) return 'ORDER';
    return null;
  });

  /**
   * A first band starting above 0 is legal — the cascade simply finds no band and
   * falls through to the flat rate — but it is invisible in a table that only
   * shows bands, so it is said out loud where it happens instead of as an
   * instruction in the section copy nobody re-reads.
   */
  readonly bandsBelowFloorNote = computed<string | null>(() => {
    this.formValue();
    if (!this.toggles.tieredRates() || this.rateBandsArray.length === 0) return null;
    const raw = this.bandEdgeValue(0).trim();
    const floor = Number(raw);
    if (raw === '' || !Number.isFinite(floor) || floor <= 0) return null;
    const amount = money(raw);
    return $localize`:@@bank_programs.bands.below_floor:Loans under ${amount}:amount: EGP fall outside every band and use the single rate above.`;
  });

  bandEdgeControl(index: number): FormControl<string> {
    return this.rateBandsArray.at(index).get('minAmountEGP') as FormControl<string>;
  }

  bandRateControl(index: number): FormControl<string> {
    return this.rateBandsArray.at(index).get('ratePercent') as FormControl<string>;
  }

  /** Raw lower edge of a band, read by the previous row's mirrored upper box. */
  bandEdgeValue(index: number): string {
    return String(this.rateBandsArray.at(index)?.get('minAmountEGP')?.value ?? '');
  }

  /**
   * Typing a band's UPPER edge is the same edit as typing the next band's LOWER
   * edge, so it writes that control rather than a value of its own. Giving the
   * boundary two owners is exactly how a gap or an overlap appears.
   */
  setBandUpperEdge(index: number, value: string): void {
    const next = this.rateBandsArray.at(index + 1)?.get('minAmountEGP');
    if (!next) return;
    next.setValue(value ?? '');
    next.markAsDirty();
  }

  /**
   * Appends a band above the current top one, pre-filled: a blank row reads as
   * disabled next to its grey placeholder, and an admin cannot tell which of the
   * two states they are looking at. The floor doubles the previous one and the
   * rate is inherited, so both numbers are edits rather than guesses.
   */
  addRateBand(): void {
    const rows = this.rateBandsArray;
    const last = rows.length > 0 ? rows.at(rows.length - 1) : null;
    if (!last) {
      // First band opens at 0 so every loan amount lands inside the table, and
      // carries the rate the program already charges — banding starts as a
      // restatement of today's pricing, which the admin then edits.
      rows.push(this.bandRow('0', this.currentFlatRate()));
      return;
    }
    const floor = Number(String(last.get('minAmountEGP')?.value ?? '').trim());
    const next = Number.isFinite(floor) && floor > 0 ? Math.round(floor * 2) : 100000;
    rows.push(this.bandRow(String(next), String(last.get('ratePercent')?.value ?? '')));
  }

  removeRateBand(index: number): void {
    this.rateBandsArray.removeAt(index);
  }

  /** Whichever single rate this program charges today — base, or the variable one. */
  private currentFlatRate(): string {
    const key = this.isVariableRateSignal() ? 'currentEffectiveRatePercent' : 'baseRatePercent';
    return String(this.pricingGroup.get(key)?.value ?? '');
  }

  /** One editable band: a lower-bound loan amount (the floor key) → a rate. */
  private bandRow(minAmountEGP = '', ratePercent = ''): FormGroup {
    return this.fb.group({
      minAmountEGP: new FormControl<string>(minAmountEGP, {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(/^\d{1,12}$/)],
      }),
      ratePercent: new FormControl<string>(ratePercent, {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(/^\d{1,3}(\.\d{1,4})?$/)],
      }),
    });
  }

  /** Rows → wire map keyed by the integer floor amount (FR-008p floor-≤ resolver). */
  private serializeRateBands(): RateBandMap {
    const out: RateBandMap = {};
    for (const row of this.rateBandsArray.controls) {
      const min = String(row.get('minAmountEGP')?.value ?? '').trim();
      const rate = String(row.get('ratePercent')?.value ?? '').trim();
      if (min === '' || rate === '') continue;
      out[String(Number(min))] = { value: rate };
    }
    return out;
  }

  setArr(
    path:
      | 'eligibility.acceptedEmploymentTypes'
      | 'eligibility.acceptedTransferTypes'
      | 'documents.requiredDocuments',
    values: readonly unknown[],
  ): void {
    const ctl = this.form.get(path);
    if (!ctl) return;
    const stringValues = values.map((v) => String(v));
    if (ctl instanceof FormArray) {
      ctl.clear({ emitEvent: false });
      for (const v of stringValues)
        ctl.push(new FormControl(v, { nonNullable: true }), { emitEvent: false });
      ctl.updateValueAndValidity();
      return;
    }
    // Typed FormControl<string[]>
    ctl.setValue(stringValues);
  }

  private syncArr(
    ctl: ReturnType<FormGroup['get']>,
    sig: ReturnType<typeof signal<string[]>>,
  ): void {
    if (!ctl) return;
    sig.set((ctl.value as string[]) ?? []);
    ctl.valueChanges.subscribe((v) => sig.set((v as string[]) ?? []));
  }

  cancel(): void {
    if (this.busy()) return;
    void this.router.navigate(this.backLink());
  }

  async submit(): Promise<void> {
    if (this.busy()) return;
    // A dead Create button explains nothing. Instead, land the admin on the first
    // step that still has a problem, with the field focused.
    //
    // Signal-derived verdicts are tested alongside `form.invalid`: they are
    // invisible to it, so `goTo()`-ing back to an early step and hitting Create
    // would otherwise slip past them and fail on the server.
    if (
      this.form.invalid ||
      this.programNameMismatch() !== null ||
      this.dbrBandsError() !== null ||
      this.maxLoanByFactError() !== null ||
      this.incomeRuleError()
    ) {
      revealErrors(this.form);
      const blocked = this.steps().findIndex((_, i) => !this.isStepValid(i));
      if (blocked >= 0) {
        const blockedId = this.steps()[blocked]?.id ?? 'income';
        this.currentStepId.set(blockedId);
        this.reach(blockedId);
        this.showStepIssues.set(true);
        this.revealStepStart();
        this.focusFirstInvalid();
      }
      return;
    }
    this.busy.set(true);
    try {
      if (this.isEditMode()) {
        const payload = this.buildUpdatePayload();
        const res = await this.api.update(this.loadedProgramCode() ?? '', payload);
        this.message.success($localize`:@@bank_programs.form.updated:Bank program updated.`, {
          nzDuration: 4000,
        });
        // FR-035 — the save switched a LIVE program off. Said explicitly, because
        // otherwise the program simply goes dark and the admin has no way to connect
        // it to the marker they just set.
        this.notifyIfDeactivatedByEstimate(res.data.deactivatedByEstimate, 'updated');
        void this.router.navigate(['/banks/programs', res.data.programCode]);
      } else {
        const payload = this.buildCreatePayload();
        const res = await this.api.create(payload);
        this.message.success($localize`:@@bank_programs.form.created:Bank program created.`, {
          nzDuration: 4000,
        });
        // A program created WITH an estimate is born inactive (FR-033). Said out loud
        // for the same reason the update path says it.
        this.notifyIfDeactivatedByEstimate(res.data.deactivatedByEstimate, 'created');
        void this.router.navigate(['/banks/programs', res.data.programCode]);
      }
    } catch (err: unknown) {
      this.handleError(err);
    } finally {
      this.busy.set(false);
    }
  }

  private async loadForEdit(programCode: string): Promise<void> {
    try {
      const res = await this.api.getByCode(programCode);
      this.applyInitial(res.data);
      this.currentVersion = res.data.version;
      this.loadedProgramCode.set(res.data.programCode);
      this.autodetectToggles(res.data);
    } catch (err) {
      this.handleError(err);
    }
  }

  /**
   * On edit the program already exists, so every step is reachable immediately —
   * an admin fixing one fee should not have to walk the wizard to get to it.
   * Optional toggles turn themselves on only when they actually hold a value.
   */
  private autodetectToggles(d: BankProgramResponse): void {
    this.toggles.tieredRates.set(
      d.pricing.rateByLoanAmountBand != null &&
        Object.keys(d.pricing.rateByLoanAmountBand).length > 0,
    );
    this.furthestStepId.set('review');
  }

  private buildCreatePayload(): BankProgramCreatePayload {
    return this.payloadFromForm(this.form.getRawValue());
  }

  private buildUpdatePayload(): BankProgramUpdatePayload {
    return { ...this.payloadFromForm(this.form.getRawValue()), version: this.currentVersion };
  }

  /**
   * The canonical `incomeAssumption` (FR-014), assembled from the method select, the
   * two table signals and the policy controls.
   *
   * Shape-gated so exactly one of `keyTable` / `bands` / `scalar` is sent. An empty
   * table is sent as an empty array rather than omitted, so the backend's
   * `INCOME_RULE_EMPTY` fires instead of the request silently reading as "this
   * method has no table configured yet" — the defect this feature removes.
   */
  private incomeAssumptionPayload(
    ia: ReturnType<typeof this.form.getRawValue>['incomeAssumption'],
  ): BankProgramCreatePayload['incomeAssumption'] {
    // Through the SAME derivation the section renders with: if the payload's idea of a
    // fact's shape disagreed with the editor's, the operator would fill in a table and
    // the request would carry the other one — empty.
    const shape = incomeMethodShape(ia.strategy, this.incomeFacts());
    const scalarValue = ia.scalar.value;

    // A program on CATALOG amounts sends the proof, the policy, and no figures. The
    // server strips them anyway, but sending the pre-filled copy would make the request
    // say the bank typed numbers it only looked at — and the check panel reads this same
    // draft, so it would then check a table the program will not be quoted off.
    // Sent on BOTH branches, and that is the point of it being a decision rather than a
    // consequence: a program on the catalog's amounts has typed no figure anywhere, so
    // "which box did you fill in" cannot answer which way it sells — and the compound catalog
    // fills four of them.
    const way = shape === 'steps' && ia.wayId ? { wayId: ia.wayId } : {};

    if (ia.amounts === 'catalog') {
      return {
        strategy: ia.strategy,
        amounts: 'catalog',
        ...way,
        ...(shape !== 'none' && ia.dbrCapPercentOverride
          ? { dbrCapPercentOverride: ia.dbrCapPercentOverride }
          : {}),
        ...(shape !== 'none' && ia.requiredDocuments.length > 0
          ? { requiredDocuments: ia.requiredDocuments }
          : {}),
        ...(shape !== 'none' && ia.combinationRule ? { combinationRule: ia.combinationRule } : {}),
        // Carried on BOTH branches: what other money a bank counts is its own policy, not a
        // figure it inherited, so a program on the catalog's amounts still states it.
        ...(this.additionalIncome() ? { additionalIncome: this.additionalIncome()! } : {}),
      };
    }

    return {
      strategy: ia.strategy,
      amounts: 'own',
      ...way,
      ...(shape === 'keyTable' ? { keyTable: this.incomeKeyTable() } : {}),
      ...(shape === 'bands' ? { bands: this.incomeBands() } : {}),
      // A step pipeline sends ONLY its figures. The steps, gates and output belong to the
      // catalog name and are merged in on every read — sending a copy would make the link a
      // one-time copy, and the server strips them anyway.
      ...(shape === 'steps' ? { stepParams: this.stepFigures() } : {}),
      // A value method keeps its legacy percent while no bands are authored, so the
      // scalar rides along for `bands` too — dropping it would silently change what
      // an untouched legacy program derives (FR-015).
      ...((shape === 'scalar' || (shape === 'bands' && this.incomeBands().length === 0)) &&
      scalarValue !== null &&
      scalarValue !== ''
        ? { scalar: { value: scalarValue, unit: ia.scalar.unit } }
        : {}),
      ...(shape !== 'none' && ia.dbrCapPercentOverride
        ? { dbrCapPercentOverride: ia.dbrCapPercentOverride }
        : {}),
      ...(shape !== 'none' && ia.requiredDocuments.length > 0
        ? { requiredDocuments: ia.requiredDocuments }
        : {}),
      ...(shape !== 'none' && ia.combinationRule ? { combinationRule: ia.combinationRule } : {}),
      ...(this.additionalIncome() ? { additionalIncome: this.additionalIncome()! } : {}),
    };
  }

  private payloadFromForm(v: ReturnType<typeof this.form.getRawValue>): BankProgramCreatePayload {
    const id = v.identity;
    const tn = v.tenor;
    const ll = v.loanLimits;
    const pr = v.pricing;
    const el = v.eligibility;
    const ia = v.incomeAssumption;
    const fe = v.fees;
    const dc = v.documents;

    return {
      bankName: id.bankName,
      ...(this.selectedBankId() ? { bankId: this.selectedBankId()! } : {}),
      friendlyName: id.friendlyName,
      friendlyNameAr: id.friendlyNameAr ?? undefined,
      programNameKey: id.programNameKey,
      programType: id.programType,
      productCategory: id.productCategory,
      isShariaCompliant: id.isShariaCompliant,
      operatorNotes: dc.operatorNotes ?? undefined,
      operatorTips: dc.operatorTips,
      requiredDocuments: dc.requiredDocuments,
      tenor: { minMonths: tn.minMonths, maxMonths: tn.maxMonths },
      loanLimits: {
        minAmountEGP: ll.minAmountEGP,
        maxAmountEGP: ll.maxAmountEGP,
        qualitativeReviewMaxEGP: ll.qualitativeReviewMaxEGP ?? undefined,
        // Omitted rather than sent as `null` when there is no table: `forbidNonWhitelisted`
        // accepts an absent optional field and the backend reads absence as "no cap table".
        ...(this.maxLoanByFact() !== null ? { maxLoanByFact: this.maxLoanByFact()! } : {}),
        // Read and sent back unchanged. There is no editor for it: what this form does not
        // send, a full-replacement PUT deletes, so carrying it is what keeps an adjustment
        // authored by a seed or the API alive through an unrelated edit.
        ...(this.maxLoanAdjustments() !== null
          ? { maxLoanAdjustments: this.maxLoanAdjustments()! }
          : {}),
      },
      pricing: {
        isVariableRate: pr.isVariableRate,
        rateBasis: pr.rateBasis,
        baseRatePercent: pr.isVariableRate ? undefined : (pr.baseRatePercent ?? undefined),
        currentEffectiveRatePercent: pr.isVariableRate
          ? (pr.currentEffectiveRatePercent ?? undefined)
          : undefined,
        variableRateNote: pr.variableRateNote ?? undefined,
        ...(this.toggles.tieredRates() && this.rateBandsArray.length > 0
          ? { rateByLoanAmountBand: this.serializeRateBands() }
          : {}),
      },
      eligibility: {
        acceptedEmploymentTypes: el.acceptedEmploymentTypes,
        ageMin: el.ageMin,
        ageMax: el.ageMax,
        minMonthlyIncomeEGP: el.minMonthlyIncomeEGP,
        minMonthsInJob: el.minMonthsInJob,
        dbrCapPercent: el.dbrCapPercent,
        // Omitted entirely when empty so a program that never used bands keeps
        // resolving against its flat cap exactly as before (FR-020).
        ...(this.dbrBands().length > 0 ? { dbrBands: this.dbrBands() } : {}),
        // Absent when empty, never `{}`: the DTO treats an empty map as valid and storing
        // one would say "this bank considered the question and set no caps", which is a
        // different claim from "this bank has never been asked".
        ...(Object.keys(this.dbrByEmployment()).length > 0
          ? { dbrCapPercentByEmploymentType: this.dbrByEmployment() }
          : {}),
        skipDbrCheck: el.skipDbrCheck,
        acceptedTransferTypes: el.acceptedTransferTypes,
        requiresCD: el.requiresCD,
        requiresAutoLoanAtABK: el.requiresAutoLoanAtABK,
        requiresAutoLoanAtOtherBank: el.requiresAutoLoanAtOtherBank,
        requiresCreditCardAtOtherBank: el.requiresCreditCardAtOtherBank,
        requiresCompoundProperty: el.requiresCompoundProperty,
        requiresCollateral: el.requiresCollateral,
        requiresClubMembership: el.requiresClubMembership,
        requiresExistingLoan: el.requiresExistingLoan,
        requiresFRMUVerification: el.requiresFRMUVerification,
        requiresQualitativeReview: el.requiresQualitativeReview,
        requiresNoDocuments: el.requiresNoDocuments,
        minBankStatementBalanceEGP: el.minBankStatementBalanceEGP ?? undefined,
        minAssetsValueEGP: el.minAssetsValueEGP ?? undefined,
      },
      performanceCriteria: undefined,
      // Feature 011 — the CANONICAL rule. Only the selected method's shape is sent:
      // the server strips foreign configuration anyway (FR-011), but sending it would
      // make the request disagree with what the admin is looking at.
      incomeAssumption: this.incomeAssumptionPayload(ia),
      // Always empty now that the screen has no way to mark a figure. Sent rather than
      // omitted, and sent EMPTY rather than left alone, because a program that still
      // carries a marker from before this control was removed would otherwise keep it
      // for good — with nothing on any screen able to clear it.
      valueSources: {},
      fees: {
        adminFeePercent: fe.adminFeePercent,
        stampDutyPercent: fe.stampDutyPercent,
        lifeInsurancePercent: fe.lifeInsurancePercent,
        lifeInsuranceMandatory: fe.lifeInsuranceMandatory,
        latePaymentFeePercent: fe.latePaymentFeePercent,
        payoffCashPercent: fe.payoffCashPercent,
        payoffBuyoutPercent: fe.payoffBuyoutPercent,
      },
    };
  }

  /**
   * True only while `applyInitial` is populating the form from a stored program.
   *
   * The picker's `valueChanges` subscription cannot tell an OPERATOR changing the name from
   * the form being filled in with the name it already has, and the two must not do the same
   * thing: adopting on a load re-points a live program at the catalog's amounts and overwrites
   * the figures it was quoting off. Synchronous, because `patchValue` emits synchronously —
   * the async work the subscription kicks off has already been declined by then.
   */
  private hydrating = false;

  private applyInitial(initial: BankProgramResponse): void {
    this.hydrating = true;
    try {
      this.applyInitialFields(initial);
    } finally {
      this.hydrating = false;
    }
  }

  private applyInitialFields(initial: BankProgramResponse): void {
    this.editBankName.set(initial.bankName);
    // Remember the pair this row arrived with, so an assignment narrowed after
    // it was created does not block an edit to an unrelated field. Mirrors the
    // backend's own grandfather rule.
    if (initial.programNameKey) {
      this.grandfatheredPair.set({
        programNameKey: initial.programNameKey,
        productCategory: initial.productCategory,
      });
    }
    this.identityGroup.patchValue({
      programCode: initial.programCode,
      bankName: initial.bankName,
      // Pre-catalog rows have no key; fall back to the label match the old form
      // used, so editing one does not silently blank its name.
      programNameKey:
        initial.programNameKey ??
        this.programNameMembers().find((m) => m.labelEn === initial.friendlyName)?.key ??
        '',
      friendlyName: initial.friendlyName,
      friendlyNameAr: initial.friendlyNameAr ?? null,
      programType: initial.programType,
      productCategory: initial.productCategory,
      isShariaCompliant: initial.isShariaCompliant === true,
    });
    // The baseline for a later re-pick: which catalog name these display fields were last
    // seeded from. Stated here rather than left to the picker's subscription, which fires
    // mid-patch only because `programNameKey` precedes `friendlyName` in the object literal
    // above — an ordering nothing enforces.
    //
    // It is NOT what makes the edit-load itself safe. The patch writes the stored
    // `friendlyName` after the subscription has run, so the stored name wins regardless;
    // what this line decides is whether a LATER change of name may move that value.
    this.lastPickedNameKey = this.identityGroup.controls.programNameKey?.value ?? null;
    // programCode is immutable on edit — show it read-only.
    this.identityGroup.controls.programCode?.disable();
    if (initial.bankId) this.bankIdControl.setValue(initial.bankId);

    this.tenorGroup.patchValue({
      minMonths: initial.tenor.minMonths,
      maxMonths: initial.tenor.maxMonths,
    });
    this.loanLimitsGroup.patchValue({
      minAmountEGP: initial.loanLimits.minAmountEGP,
      maxAmountEGP: initial.loanLimits.maxAmountEGP,
    });
    this.loanLimitsGroup.patchValue({
      qualitativeReviewMaxEGP: initial.loanLimits.qualitativeReviewMaxEGP ?? null,
    });
    this.capNoMatch = initial.loanLimits.maxLoanByFact?.onNoMatch ?? null;
    this.maxLoanByFact.set(
      initial.loanLimits.maxLoanByFact === undefined
        ? null
        : {
            ...initial.loanLimits.maxLoanByFact,
            // Copied, not aliased: the editor replaces the object on every edit, and sharing
            // the row array with `initial` would make a cancelled edit look saved on the
            // review read-back.
            rows: initial.loanLimits.maxLoanByFact.rows.map((row) => ({ ...row })),
          },
    );
    this.maxLoanAdjustments.set(
      initial.loanLimits.maxLoanAdjustments === undefined
        ? null
        : initial.loanLimits.maxLoanAdjustments.map((adjustment) => ({ ...adjustment })),
    );

    // Percent strings arrive as Prisma `Decimal(_, 4)` — `24.0000` for a flat 24%.
    // Trimmed for DISPLAY only, on the string, so the value the admin reads back is
    // the one they typed and no digit is ever parsed through a float.
    this.pricingGroup.patchValue({
      isVariableRate: initial.pricing.isVariableRate,
      // Absent on every program saved before the field existed, and those were all priced
      // on the declining annuity — so the form shows the basis the engine actually used
      // rather than an empty pair of radios (`rate-basis.ts`).
      rateBasis: initial.pricing.rateBasis ?? 'reducing',
      baseRatePercent: trimZeros(initial.pricing.baseRatePercent) ?? null,
      currentEffectiveRatePercent: trimZeros(initial.pricing.currentEffectiveRatePercent) ?? null,
      variableRateNote: initial.pricing.variableRateNote ?? null,
    });

    this.rateBandsArray.clear();
    const bands = initial.pricing.rateByLoanAmountBand;
    if (bands) {
      Object.entries(bands)
        .sort(([a], [b]) => Number(a) - Number(b))
        .forEach(([key, band]) =>
          this.rateBandsArray.push(this.bandRow(key, trimZeros(band.value))),
        );
    }

    this.eligibilityGroup.patchValue({
      ageMin: initial.eligibility.ageMin,
      ageMax: initial.eligibility.ageMax,
      minMonthlyIncomeEGP: initial.eligibility.minMonthlyIncomeEGP,
      minMonthsInJob: initial.eligibility.minMonthsInJob,
      dbrCapPercent: trimZeros(initial.eligibility.dbrCapPercent),
      skipDbrCheck: initial.eligibility.skipDbrCheck,
      requiresCD: initial.eligibility.requiresCD,
      requiresAutoLoanAtABK: initial.eligibility.requiresAutoLoanAtABK,
      requiresAutoLoanAtOtherBank: initial.eligibility.requiresAutoLoanAtOtherBank,
      requiresCreditCardAtOtherBank: initial.eligibility.requiresCreditCardAtOtherBank,
      requiresCompoundProperty: initial.eligibility.requiresCompoundProperty,
      requiresCollateral: initial.eligibility.requiresCollateral,
      requiresClubMembership: initial.eligibility.requiresClubMembership,
      requiresExistingLoan: initial.eligibility.requiresExistingLoan,
      requiresFRMUVerification: initial.eligibility.requiresFRMUVerification,
      requiresQualitativeReview: initial.eligibility.requiresQualitativeReview,
      requiresNoDocuments: initial.eligibility.requiresNoDocuments,
      minBankStatementBalanceEGP: initial.eligibility.minBankStatementBalanceEGP ?? null,
      minAssetsValueEGP: initial.eligibility.minAssetsValueEGP ?? null,
    });
    this.dbrBands.set(initial.eligibility.dbrBands ?? []);
    this.dbrByEmployment.set({ ...(initial.eligibility.dbrCapPercentByEmploymentType ?? {}) });
    this.setArr('eligibility.acceptedEmploymentTypes', initial.eligibility.acceptedEmploymentTypes);
    this.setArr('eligibility.acceptedTransferTypes', initial.eligibility.acceptedTransferTypes);

    // Feature 011 — the server normalizes on read, so this is always the canonical
    // shape even for a program whose rule has never been re-saved through this form.
    this.incomeAssumptionGroup.patchValue({
      strategy: initial.incomeAssumption.strategy,
      // ABSENT means `'own'`. Every program saved before this field existed carries its
      // own figures, so defaulting to `'catalog'` here would open the wizard claiming a
      // link the program does not have — and the first save would make it true.
      amounts: initial.incomeAssumption.amounts === 'catalog' ? 'catalog' : 'own',
      // ABSENT means "this program has not named a way", which is what every row saved
      // before the field existed says — and what the backfill made false for every program
      // of a product that needs one. Never defaulted to a way here: guessing one would be the
      // screen deciding which mechanism a bank publishes.
      wayId: initial.incomeAssumption.wayId ?? null,
      scalar: {
        value: trimZeros(initial.incomeAssumption.scalar?.value) ?? null,
        unit: initial.incomeAssumption.scalar?.unit ?? 'percent',
      },
      dbrCapPercentOverride: trimZeros(initial.incomeAssumption.dbrCapPercentOverride) ?? null,
      requiredDocuments: initial.incomeAssumption.requiredDocuments ?? [],
      combinationRule: initial.incomeAssumption.combinationRule ?? null,
    });
    this.incomeKeyTable.set(initial.incomeAssumption.keyTable ?? []);
    this.incomeBands.set(initial.incomeAssumption.bands ?? []);
    // Absent = this program counts no other money. `null` rather than an empty policy, so a
    // program that states none sends none rather than an object the server refuses.
    this.additionalIncome.set(initial.incomeAssumption.additionalIncome ?? null);
    // A product rule's figures. Cloned per step rather than assigned: the editor patches one
    // step at a time, and sharing the response's own objects would mutate the loaded snapshot
    // the review step reads back.
    this.stepFigures.set(cloneStepFigures(initial.incomeAssumption.stepParams));
    // Armed here, run when the rule lands: the comparison needs BOTH this program's stored
    // figures and the product's, and only the first of those is available yet.
    this.fillOnArrival = true;
    // The name's rule, so the block can render the proof and the catalog's figures. NOT
    // adopted: this program's stored strategy is what it is quoting off today, and
    // overwriting it on load would silently rewrite a legacy program the moment an
    // operator opened it to change a fee.
    void this.loadCatalogRule();
    this.feesGroup.patchValue({
      adminFeePercent: trimZeros(initial.fees.adminFeePercent),
      stampDutyPercent: trimZeros(initial.fees.stampDutyPercent),
      lifeInsurancePercent: trimZeros(initial.fees.lifeInsurancePercent),
      lifeInsuranceMandatory: initial.fees.lifeInsuranceMandatory,
      latePaymentFeePercent: trimZeros(initial.fees.latePaymentFeePercent),
      payoffCashPercent: trimZeros(initial.fees.payoffCashPercent),
      payoffBuyoutPercent: trimZeros(initial.fees.payoffBuyoutPercent),
    });
    this.documentsGroup.patchValue({ operatorNotes: initial.operatorNotes ?? null });
    this.setArr('documents.requiredDocuments', initial.requiredDocuments);
  }

  /**
   * FR-035 — a save that introduced a team-estimated number on a LIVE program takes it
   * off air in the same transaction. A warning, not an error: the save SUCCEEDED and
   * the admin did the right thing by marking the guess. What they need is the reason,
   * so the program going dark does not read as someone else's edit.
   */
  /**
   * FR-035 — say WHY the program is off air.
   *
   * Two wordings, because the two situations read differently to the admin: an update
   * switched a live program OFF, while a create was never on in the first place. The
   * create path used to say nothing at all, so an admin who marked an estimate landed
   * on a detail page showing an inactive program with nothing connecting it to the
   * marker they had just set — the confusion this notification exists to prevent.
   */
  private notifyIfDeactivatedByEstimate(
    deactivated: boolean | undefined,
    mode: 'created' | 'updated',
  ): void {
    if (!deactivated) return;
    if (mode === 'created') {
      this.notification.warning(
        $localize`:@@bank_programs.form.created_inactive_title:Program created switched off`,
        $localize`:@@bank_programs.form.created_inactive_body:It holds a number the team estimated. Switch it on once the bank has confirmed the figure.`,
        { nzDuration: 8000 },
      );
      return;
    }
    this.notification.warning(
      $localize`:@@bank_programs.form.deactivated_title:Program switched off`,
      $localize`:@@bank_programs.form.deactivated_body:It now holds a number the team estimated. Switch it back on once the bank has confirmed the figure.`,
      { nzDuration: 8000 },
    );
  }

  private handleError(err: unknown): void {
    const envelope = (err as { error?: { code?: string; meta?: Record<string, unknown> } }).error;
    const code = envelope?.code ?? 'INTERNAL_ERROR';
    const msg = this.errorsService.toLocalizedMessage(code as never, envelope?.meta);
    this.notification.error($localize`:@@bank_programs.form.dismiss:Dismiss`, msg);

    if (code === 'INVALID_VARIABLE_RATE_CONFIGURATION') {
      this.pricingGroup.get('currentEffectiveRatePercent')?.setErrors({ variableRate: true });
      this.pricingGroup.get('baseRatePercent')?.setErrors({ variableRate: true });
    }
    // The two qualitative-review ceiling codes get the toast above and nothing
    // more. Flagging the control would mark the form invalid on a field this
    // wizard no longer renders — an admin would be blocked from saving with
    // nothing on screen to fix. The rejection can still reach an existing
    // program (toggling `requiresQualitativeReview` off under a stored
    // ceiling), and the localized message names it.
    if (code === 'CONFLICT_STALE_DATA' && this.isEditMode()) {
      void this.loadForEdit(this.loadedProgramCode() ?? '');
    }
  }
}

/**
 * Marks every leaf under `control` touched + dirty AND re-runs its validity so a
 * `statusChanges` event fires. `markAllAsTouched()` alone is silent, and every
 * `nz-form-control` is OnPush — it only repaints on that event, which is why the
 * inline `[nzErrorTip]` text never appeared under the offending field.
 */
function revealErrors(control: AbstractControl): void {
  if (control instanceof FormGroup) {
    for (const child of Object.values(control.controls)) revealErrors(child);
    control.markAsTouched({ onlySelf: true });
    control.markAsDirty({ onlySelf: true });
    control.updateValueAndValidity({ onlySelf: true });
    return;
  }
  if (control instanceof FormArray) {
    for (const child of control.controls) revealErrors(child);
    control.markAsTouched({ onlySelf: true });
    control.markAsDirty({ onlySelf: true });
    control.updateValueAndValidity({ onlySelf: true });
    return;
  }
  control.markAsTouched({ onlySelf: true });
  control.markAsDirty({ onlySelf: true });
  control.updateValueAndValidity({ onlySelf: true });
}

/**
 * Invalid LEAF controls under `control`, plus the group's own cross-field errors
 * (e.g. the tenor min/max guard), so the step banner counts what a human counts.
 */
function countInvalidLeaves(control: AbstractControl): number {
  if (control instanceof FormGroup) {
    const own = control.errors ? 1 : 0;
    return own + Object.values(control.controls).reduce((sum, c) => sum + countInvalidLeaves(c), 0);
  }
  if (control instanceof FormArray) {
    const own = control.errors ? 1 : 0;
    return own + control.controls.reduce((sum, c) => sum + countInvalidLeaves(c), 0);
  }
  return control.invalid ? 1 : 0;
}

/**
 * Invalid LEAF controls only — the group's own cross-field errors are excluded,
 * so a caller can tell "three boxes are empty" from "the boxes are all filled
 * and disagree with each other".
 */
function countInvalidFields(control: AbstractControl): number {
  if (control instanceof FormGroup) {
    return Object.values(control.controls).reduce((sum, c) => sum + countInvalidFields(c), 0);
  }
  if (control instanceof FormArray) {
    return control.controls.reduce((sum, c) => sum + countInvalidFields(c), 0);
  }
  return control.invalid ? 1 : 0;
}

/**
 * `'24.0000'` → `'24.0'`, `'1.5000'` → `'1.5'`, `'1'` → `'1.0'`, `'1.2500'` → `'1.25'`.
 *
 * A percent, written the way a rate is spoken: padding out to four decimals reads
 * as precision nobody chose, and cutting to a bare `1` reads as a count rather than
 * a rate. So trailing zeros go, but ONE decimal always stays — significant digits
 * beyond it are never dropped.
 *
 * String-only, never parsed to a float, so every digit the bank typed survives
 * (Principle I).
 */
/**
 * Clone a product rule's per-step figures one level deep.
 *
 * Deep enough matters: a step's figures are themselves a table, a band list or a pair of
 * bounds, and a shallow assignment hands the editor the SOURCE's own arrays to mutate in
 * place — which on the catalog path would mean the operator's first keystroke edits the very
 * catalog copy this program is detaching from, and on the edit path would mutate the loaded
 * snapshot the review step reads back.
 */
/** Sweep length, kept in step with the `source-sweep` keyframes in this component's CSS. */
const SOURCE_SWEEP_MS = 620;

function cloneStepFigures(
  source: Record<string, StepFigures> | undefined,
): Record<string, StepFigures> {
  return Object.fromEntries(
    Object.entries(source ?? {}).map(([id, figures]) => [
      id,
      {
        ...figures,
        ...(figures.keyTable ? { keyTable: figures.keyTable.map((row) => ({ ...row })) } : {}),
        ...(figures.bands ? { bands: figures.bands.map((band) => ({ ...band })) } : {}),
      },
    ]),
  );
}

function trimZeros<T extends string | null | undefined>(raw: T): T {
  if (raw == null || raw === '') return raw;
  if (!raw.includes('.')) return `${raw}.0` as T;
  const trimmed = raw.replace(/0+$/, '');
  return (trimmed.endsWith('.') ? `${trimmed}0` : trimmed) as T;
}

/** `'24.0000'` → `'24%'`, `'1.5000'` → `'1.5%'`. String-only — never parsed to a float. */
function pct(raw: string | null | undefined): string {
  if (raw == null || raw === '') return '';
  return `${trimZeros(raw)}%`;
}

/** `'1500000'` → `'1,500,000'`. Digit grouping on the string, so no precision loss. */
function money(raw: string | null | undefined): string {
  if (raw == null || raw === '') return '';
  const [int = '', frac] = raw.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? `${grouped}.${frac}` : grouped;
}

/**
 * The underwriting buckets, in the operator's words.
 *
 * Thunks: `$localize` resolves at call time, so a map built at module load would freeze the
 * first locale the bundle saw.
 */
const EMPLOYMENT_BUCKET_LABELS: Readonly<Record<string, () => string>> = {
  salaried: () => $localize`:@@bank_programs.employment.salaried:Salaried`,
  self_employed: () => $localize`:@@bank_programs.employment.self_employed:Self-employed`,
  retired: () => $localize`:@@bank_programs.employment.retired:Retired`,
};
