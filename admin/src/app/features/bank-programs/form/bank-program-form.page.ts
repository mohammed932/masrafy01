import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  LOCALE_ID,
  OnInit,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
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
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import {
  ArrowLeftOutline,
  ArrowRightOutline,
  CheckOutline,
  ExclamationCircleOutline,
  PlusOutline,
  SaveOutline,
  ReloadOutline,
  CloudOutline,
  DownOutline,
  UpOutline,
  DeleteOutline,
} from '@ant-design/icons-angular/icons';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { map, merge } from 'rxjs';
import { MoneyInputDirective } from '../../../core/directives/money-input.directive';
import { ErrorCodeService } from '../../../core/errors/error-code.service';
import { PlatformEnumerationsService } from '../../../core/platform-enumerations/platform-enumerations.service';
import { LOAN_CATEGORIES, categoryLabel, isLoanCategory } from '@core/loan-category';
import { BankProgramsApiService } from '../bank-programs.api.service';
import type {
  BankProgramCreatePayload,
  BankProgramResponse,
  BankProgramUpdatePayload,
  IncomeAssumptionStrategy,
  ProgramType,
  RateBandMap,
} from '../bank-programs.types';
import { IncomeAssumptionSectionComponent } from './sections/income-assumption-section.component';
import { BanksApiService } from '../../banks/banks.api.service';
import type { BankWithProgramCount } from '../../banks/banks.types';
import type { DbrBand, PrefillOrigin } from '../bank-programs.types';

/** The one remaining genuine opt-in — see `BankProgramFormPage.toggles`. */
type ToggleKey = 'tieredRates';

/** Wizard steps, in order. `review` owns no controls — it reads the form back. */
type StepId = 'program' | 'terms' | 'pricing' | 'eligibility' | 'documents' | 'review';

interface WizardStep {
  readonly id: StepId;
  readonly label: string;
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

@Component({
  selector: 'app-bank-program-form-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    NzButtonModule,
    NzCheckboxModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzSpinModule,
    NzSwitchModule,
    IncomeAssumptionSectionComponent,
    MoneyInputDirective,
  ],
  providers: [
    provideNzIconsPatch([
      ArrowLeftOutline,
      ArrowRightOutline,
      CheckOutline,
      ExclamationCircleOutline,
      PlusOutline,
      SaveOutline,
      ReloadOutline,
      CloudOutline,
      DownOutline,
      UpOutline,
          DeleteOutline,
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
        <div class="title-block">
          <h1 class="page-title">{{ isEditMode() ? editTitle() : createTitle() }}</h1>
          <p class="page-subtitle" i18n="@@bank_programs.form.subtitle">
            Six short steps. Every field is pre-filled where we can infer it, and nothing is saved until you
            confirm on the last step.
          </p>
        </div>
      </header>

      @if (enums.unavailable()) {
        <div class="unavailable">
          <span class="unavailable-icon" nz-icon nzType="cloud" nzTheme="outline" aria-hidden="true"></span>
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
          <ol class="steps" [attr.aria-label]="stepsAria">
            @for (s of steps; track s.id; let i = $index, last = $last) {
              <li class="steps-item" [class.is-last]="last">
                <button
                  type="button"
                  class="step"
                  [class.active]="stepIndex() === i"
                  [class.done]="isStepComplete(i)"
                  [class.invalid]="isStepInvalidTouched(i)"
                  [attr.aria-current]="stepIndex() === i ? 'step' : null"
                  [disabled]="!canJumpTo(i)"
                  (click)="goTo(i)"
                >
                  <span class="step-num" aria-hidden="true">
                    @if (isStepComplete(i)) {
                      <span nz-icon nzType="check" nzTheme="outline"></span>
                    } @else {
                      {{ i + 1 }}
                    }
                  </span>
                  <span class="step-label">{{ s.label }}</span>
                  <!-- Done / needs-attention is carried by colour AND by a word,
                       so the rail is not a colour-only signal. -->
                  @if (isStepInvalidTouched(i)) {
                    <span class="step-state">{{ stepNeedsAttentionLabel }}</span>
                  } @else if (isStepComplete(i)) {
                    <span class="step-state">{{ stepDoneLabel }}</span>
                  }
                </button>
                @if (!last) {
                  <span class="step-sep" aria-hidden="true"></span>
                }
              </li>
            }
          </ol>
          <p class="step-caption">{{ stepCaption() }}</p>

          @if (showStepIssues() && stepIssueCount() > 0) {
            <div class="step-alert" role="alert">
              <span nz-icon nzType="exclamation-circle" nzTheme="outline" aria-hidden="true"></span>
              <span>{{ stepIssueLabel() }}</span>
            </div>
          }
          </div>

          <!-- ═══ STEP 1 — PROGRAM ════════════════════════════════════════════ -->
          @if (stepIndex() === 0) {
          @if (!isEditMode() && preselectedBank; as b) {
            <div class="bank-chip">
              <span class="bank-chip-avatar" aria-hidden="true">{{ initialsOf(b.nameEnglish) }}</span>
              <span class="bank-chip-body">
                <span class="bank-chip-eyebrow" i18n="@@bank_programs.form.for_bank">For bank</span>
                <span class="bank-chip-name">{{ b.nameEnglish }}</span>
              </span>
              <button type="button" class="bank-chip-change" (click)="clearBank()">
                <span i18n="@@bank_programs.form.change_bank">Change</span>
              </button>
            </div>
          }

          <section class="card" formGroupName="identity">
            <header class="card-head">
              <div>
                <h2 class="card-title" i18n="@@bank_programs.form.core.title">Program</h2>
                <p class="card-sub" i18n="@@bank_programs.form.core.sub">
                  Which bank, which product, which name customers will see.
                </p>
              </div>
            </header>

            <div class="grid">
              @if (!preselectedBank && !isEditMode()) {
                <nz-form-item>
                  <nz-form-label [nzFor]="'bankId'" nzRequired i18n="@@bank_programs.field.bank">Bank</nz-form-label>
                  <nz-form-control [nzErrorTip]="fieldErrorTpl">
                    <nz-select
                      id="bankId"
                      [formControl]="bankIdControl"
                      [nzDropdownStyle]="dropdownStyle"
                      nzShowSearch
                      nzAllowClear
                      nzPlaceHolder="Pick a bank"
                    >
                      @for (b of activeBanks(); track b.id) {
                        <nz-option [nzValue]="b.id" [nzLabel]="b.nameEnglish"></nz-option>
                      }
                    </nz-select>
                    @if (identityGroup.controls['bankName']?.touched && !selectedBankId()) {
                      <div class="manual-error" i18n="@@bank_programs.err.bank_required">Bank is required.</div>
                    }
                  </nz-form-control>
                </nz-form-item>
              }
              @if (isEditMode()) {
                <nz-form-item class="span-2">
                  <nz-form-label [nzFor]="'programCode'" i18n="@@bank_programs.field.program_code">Program code</nz-form-label>
                  <nz-form-control>
                    <input nz-input id="programCode" formControlName="programCode" />
                  </nz-form-control>
                </nz-form-item>
              }
              <nz-form-item class="span-2">
                <nz-form-label [nzFor]="'friendlyName'" nzRequired i18n="@@bank_programs.field.friendly_name">Program name</nz-form-label>
                <nz-form-control [nzErrorTip]="friendlyNameErrorTpl">
                  <nz-select
                    id="friendlyName"
                    formControlName="friendlyName"
                    nzShowSearch
                    [nzDropdownStyle]="dropdownStyle"
                    nzPlaceHolder="Select a program"
                    i18n-nzPlaceHolder="@@bank_programs.field.friendly_name.placeholder"
                  >
                    @for (opt of programNameOptions(); track opt.value) {
                      <nz-option [nzValue]="opt.value" [nzLabel]="opt.label"></nz-option>
                    }
                  </nz-select>
                  <ng-template #friendlyNameErrorTpl let-control>
                    @if (control.hasError('required')) {
                      <span i18n="@@bank_programs.err.friendly_name_required">Program name is required.</span>
                    } @else if (control.hasError('maxlength')) {
                      <span i18n="@@bank_programs.err.friendly_name_length">Must be 120 characters or fewer.</span>
                    }
                  </ng-template>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label [nzFor]="'productCategory'" nzRequired i18n="@@bank_programs.field.product_type">Product type</nz-form-label>
                <nz-form-control [nzErrorTip]="productCategoryErrorTpl">
                  <nz-select id="productCategory" formControlName="productCategory" [nzDropdownStyle]="dropdownStyle">
                    @for (opt of categoryOptions(); track opt.value) {
                      <nz-option [nzValue]="opt.value" [nzLabel]="opt.label"></nz-option>
                    }
                  </nz-select>
                  <ng-template #productCategoryErrorTpl>
                    <span i18n="@@bank_programs.err.product_required">Product type is required.</span>
                  </ng-template>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label [nzFor]="'programType'" nzRequired i18n="@@bank_programs.field.program_type">Program type</nz-form-label>
                <nz-form-control [nzErrorTip]="programTypeErrorTpl">
                  <nz-select id="programType" formControlName="programType" [nzDropdownStyle]="dropdownStyle">
                    <nz-option nzValue="income_proof" nzLabel="Income-proof" i18n-nzLabel="@@program_type.proof"></nz-option>
                    <nz-option nzValue="income_surrogate" nzLabel="Income-surrogate" i18n-nzLabel="@@program_type.surrogate"></nz-option>
                  </nz-select>
                  <ng-template #programTypeErrorTpl>
                    <span i18n="@@bank_programs.err.program_type_required">Program type is required.</span>
                  </ng-template>
                </nz-form-control>
              </nz-form-item>
            </div>
          </section>

          }

          <!-- ═══ STEP 2 — AMOUNT & DURATION ══════════════════════════════════ -->
          @if (stepIndex() === 1) {
          <section class="card" formGroupName="loanLimits">
            <header class="card-head">
              <div>
                <h2 class="card-title" i18n="@@bank_programs.form.amount.title">Loan amount</h2>
                <p class="card-sub" i18n="@@bank_programs.form.amount.sub">
                  Minimum and maximum loan size in EGP.
                </p>
              </div>
            </header>
            <div class="grid">
              <nz-form-item>
                <nz-form-label [nzFor]="'minAmountEGP'" nzRequired i18n="@@bank_programs.field.min_amount">Minimum amount</nz-form-label>
                <nz-form-control [nzErrorTip]="fieldErrorTpl">
                  <nz-input-group nzAddOnBefore="EGP" class="money-group">
                    <input nz-input appMoneyInput id="minAmountEGP" formControlName="minAmountEGP" inputmode="numeric" placeholder="50,000" />
                  </nz-input-group>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label [nzFor]="'maxAmountEGP'" nzRequired i18n="@@bank_programs.field.max_amount">Maximum amount</nz-form-label>
                <nz-form-control [nzErrorTip]="fieldErrorTpl">
                  <nz-input-group nzAddOnBefore="EGP" class="money-group">
                    <input nz-input appMoneyInput id="maxAmountEGP" formControlName="maxAmountEGP" inputmode="numeric" placeholder="1,500,000" />
                  </nz-input-group>
                </nz-form-control>
              </nz-form-item>
            </div>
          </section>

          <!-- Tenor -->
          <section class="card" formGroupName="tenor">
            <header class="card-head">
              <div>
                <h2 class="card-title" i18n="@@bank_programs.form.tenor.title">Loan duration</h2>
                <p class="card-sub" i18n="@@bank_programs.form.tenor.sub">Minimum and maximum months a customer can borrow over.</p>
              </div>
            </header>
            <div class="grid">
              <nz-form-item>
                <nz-form-label [nzFor]="'minMonths'" nzRequired i18n="@@bank_programs.field.min_months">Minimum months</nz-form-label>
                <nz-form-control [nzErrorTip]="fieldErrorTpl">
                  <nz-input-number id="minMonths" class="num-field" formControlName="minMonths" [nzMin]="1" [nzMax]="600" [nzStep]="1" [nzPrecision]="0"></nz-input-number>
                  <span class="field-hint">≈ {{ minMonthsHint() }}</span>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label [nzFor]="'maxMonths'" nzRequired i18n="@@bank_programs.field.max_months">Maximum months</nz-form-label>
                <nz-form-control [nzErrorTip]="fieldErrorTpl">
                  <nz-input-number id="maxMonths" class="num-field" formControlName="maxMonths" [nzMin]="1" [nzMax]="600" [nzStep]="1" [nzPrecision]="0"></nz-input-number>
                  <span class="field-hint">≈ {{ maxMonthsHint() }}</span>
                  @if (tenorGroup.hasError('minGtMax') && tenorGroup.controls['maxMonths']?.touched) {
                    <span class="field-error" role="alert" i18n="@@bank_programs.tenor.min_gt_max">Maximum must be greater than or equal to minimum.</span>
                  }
                </nz-form-control>
              </nz-form-item>
            </div>
          </section>

          <!-- Optional on this step. Nothing REQUIRED ever hides behind a
               disclosure — that was the failure mode of the old wizard. -->
          <section class="card disclosure" [class.open]="termsExtrasOpen()">
            <button type="button" class="disclosure-head" (click)="termsExtrasOpen.set(!termsExtrasOpen())" [attr.aria-expanded]="termsExtrasOpen()">
              <div>
                <h2 class="card-title" i18n="@@bank_programs.form.terms_extras.title">Optional ceilings</h2>
                <p class="card-sub" i18n="@@bank_programs.form.terms_extras.sub">Only needed for programs that grant a qualitative-review uplift.</p>
              </div>
              <span class="chevron" nz-icon [nzType]="termsExtrasOpen() ? 'up' : 'down'" nzTheme="outline" aria-hidden="true"></span>
            </button>
            @if (termsExtrasOpen()) {
              <div class="disclosure-body">
                <div class="grid" formGroupName="loanLimits">
                  <nz-form-item class="span-2">
                    <nz-form-label i18n="@@bank_programs.field.qr_max">Qualitative-review uplift ceiling</nz-form-label>
                    <nz-form-control [nzErrorTip]="fieldErrorTpl">
                      <nz-input-group nzAddOnBefore="EGP" class="money-group">
                        <input nz-input appMoneyInput formControlName="qualitativeReviewMaxEGP" inputmode="numeric" placeholder="Only with Special Eligibility → requiresQualitativeReview" />
                      </nz-input-group>
                    </nz-form-control>
                  </nz-form-item>
                </div>
              </div>
            }
          </section>
          }

          <!-- ═══ STEP 3 — PRICING & FEES ═════════════════════════════════════ -->
          @if (stepIndex() === 2) {
          <section class="card" formGroupName="pricing">
            <header class="card-head">
              <div>
                <h2 class="card-title" i18n="@@bank_programs.form.rate.title">Interest rate</h2>
                <p class="card-sub" i18n="@@bank_programs.form.rate.sub">One annual rate. Switch to a band table below if the rate depends on loan size.</p>
              </div>
            </header>
            <div class="grid">
              @if (!isVariableRateSignal()) {
                <nz-form-item>
                  <nz-form-label [nzFor]="'baseRatePercent'" nzRequired i18n="@@bank_programs.field.base_rate">Base rate</nz-form-label>
                  <nz-form-control [nzErrorTip]="fieldErrorTpl">
                    <nz-input-group nzAddOnAfter="%" class="rate-group">
                      <input nz-input id="baseRatePercent" formControlName="baseRatePercent" inputmode="decimal" placeholder="24.0000" />
                    </nz-input-group>
                  </nz-form-control>
                </nz-form-item>
              }
              <nz-form-item class="span-2">
                <label nz-checkbox formControlName="isVariableRate" i18n="@@bank_programs.field.is_variable_rate">Variable rate (CBE-linked, quarterly reset)</label>
              </nz-form-item>
              @if (isVariableRateSignal()) {
                <nz-form-item>
                  <nz-form-label i18n="@@bank_programs.field.current_effective_rate">Current effective rate</nz-form-label>
                  <nz-form-control [nzErrorTip]="fieldErrorTpl">
                    <nz-input-group nzAddOnAfter="%" class="rate-group">
                      <input nz-input formControlName="currentEffectiveRatePercent" inputmode="decimal" placeholder="26.5500" />
                    </nz-input-group>
                  </nz-form-control>
                </nz-form-item>
                <nz-form-item class="span-2">
                  <nz-form-label i18n="@@bank_programs.field.variable_rate_note">Disclosure note</nz-form-label>
                  <nz-form-control [nzErrorTip]="fieldErrorTpl">
                    <textarea nz-input formControlName="variableRateNote" rows="2" placeholder="CBE policy rate + 3%, reviewed quarterly"></textarea>
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
                <h2 class="card-title" i18n="@@bank_programs.section.tiered_rates">Tiered interest rates</h2>
                <p class="card-sub" i18n="@@bank_programs.section.tiered_rates_sub">
                  Rate by loan-amount band. Enter each band's lowest amount and its rate; the engine
                  applies the highest band at or below the applicant's loan amount. Start the first band at 0.
                </p>
              </div>
            </header>
            <label
              nz-checkbox
              [nzChecked]="toggles.tieredRates()"
              (nzCheckedChange)="setToggle('tieredRates', $event)"
              i18n="@@bank_programs.toggle.tiered_rates"
              >Tiered interest rates (by loan amount)</label
            >

            @if (toggles.tieredRates()) {
              <div class="bands" formArrayName="rateByLoanAmountBands">
                @if (rateBandsArray.length === 0) {
                  <p class="bands-empty" i18n="@@bank_programs.bands.empty">
                    No bands yet. Add the first threshold to start.
                  </p>
                } @else {
                  <div class="bands-head" aria-hidden="true">
                    <span i18n="@@bank_programs.bands.col_min">Loan amount from (EGP)</span>
                    <span i18n="@@bank_programs.bands.col_rate">Rate</span>
                    <span></span>
                  </div>
                  @for (band of rateBandsArray.controls; track band; let i = $index) {
                    <div class="band-row" [formGroupName]="i">
                      <nz-form-item class="band-cell">
                        <nz-form-control [nzErrorTip]="fieldErrorTpl">
                          <nz-input-group nzAddOnBefore="EGP" class="money-group">
                            <input nz-input appMoneyInput formControlName="minAmountEGP" inputmode="numeric"
                              [attr.aria-label]="bandAriaMin" placeholder="0" />
                          </nz-input-group>
                        </nz-form-control>
                      </nz-form-item>
                      <nz-form-item class="band-cell">
                        <nz-form-control [nzErrorTip]="fieldErrorTpl">
                          <nz-input-group nzAddOnAfter="%" class="rate-group">
                            <input nz-input formControlName="ratePercent" inputmode="decimal"
                              [attr.aria-label]="bandAriaRate" placeholder="28.0000" />
                          </nz-input-group>
                        </nz-form-control>
                      </nz-form-item>
                      <button type="button" class="band-remove" (click)="removeRateBand(i)"
                        [attr.aria-label]="bandAriaRemove">
                        <span nz-icon nzType="delete" nzTheme="outline" aria-hidden="true"></span>
                      </button>
                    </div>
                  }
                }

                <button type="button" nz-button nzType="dashed" class="bands-add" (click)="addRateBand()">
                  <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
                  <span i18n="@@bank_programs.bands.add">Add band</span>
                </button>
              </div>
            }
          </section>

          <!-- Every fee the backend requires is on this step, in the open. -->
          <section class="card" formGroupName="fees">
            <header class="card-head">
              <div>
                <h2 class="card-title" i18n="@@bank_programs.form.fees_core.title">Fees</h2>
                <p class="card-sub" i18n="@@bank_programs.form.fees_core.sub">Pre-filled with platform defaults — change only what this program charges differently.</p>
              </div>
            </header>
            <div class="grid">
              <nz-form-item>
                <nz-form-label [nzFor]="'adminFeePercent2'" nzRequired i18n="@@bank_programs.field.admin_fee">Admin fee</nz-form-label>
                <nz-form-control [nzErrorTip]="fieldErrorTpl">
                  <nz-input-group nzAddOnAfter="%" class="rate-group">
                    <input nz-input id="adminFeePercent2" formControlName="adminFeePercent" inputmode="decimal" placeholder="1.0000" />
                  </nz-input-group>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzRequired i18n="@@bank_programs.field.stamp_duty">Stamp duty</nz-form-label>
                <nz-form-control [nzErrorTip]="fieldErrorTpl">
                  <nz-input-group nzAddOnAfter="%" class="rate-group">
                    <input nz-input formControlName="stampDutyPercent" inputmode="decimal" placeholder="0.5000" />
                  </nz-input-group>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzRequired i18n="@@bank_programs.field.life_insurance">Life insurance</nz-form-label>
                <nz-form-control [nzErrorTip]="fieldErrorTpl">
                  <nz-input-group nzAddOnAfter="%" class="rate-group">
                    <input nz-input formControlName="lifeInsurancePercent" inputmode="decimal" placeholder="0.5000" />
                  </nz-input-group>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzRequired i18n="@@bank_programs.field.late_fee">Late payment fee</nz-form-label>
                <nz-form-control [nzErrorTip]="fieldErrorTpl">
                  <nz-input-group nzAddOnAfter="%" class="rate-group">
                    <input nz-input formControlName="latePaymentFeePercent" inputmode="decimal" placeholder="4.0000" />
                  </nz-input-group>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzRequired i18n="@@bank_programs.field.payoff_cash">Payoff (cash)</nz-form-label>
                <nz-form-control [nzErrorTip]="fieldErrorTpl">
                  <nz-input-group nzAddOnAfter="%" class="rate-group">
                    <input nz-input formControlName="payoffCashPercent" inputmode="decimal" placeholder="12.0000" />
                  </nz-input-group>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzRequired i18n="@@bank_programs.field.payoff_buyout">Payoff (buyout)</nz-form-label>
                <nz-form-control [nzErrorTip]="fieldErrorTpl">
                  <nz-input-group nzAddOnAfter="%" class="rate-group">
                    <input nz-input formControlName="payoffBuyoutPercent" inputmode="decimal" placeholder="15.0000" />
                  </nz-input-group>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item class="span-2">
                <label nz-checkbox formControlName="lifeInsuranceMandatory" i18n="@@bank_programs.field.life_insurance_mandatory">Life insurance mandatory</label>
              </nz-form-item>
            </div>
          </section>
          }

          <!-- ═══ STEP 4 — ELIGIBILITY ════════════════════════════════════════ -->
          @if (stepIndex() === 3) {
          <section class="card" formGroupName="eligibility">
            <header class="card-head">
              <div>
                <h2 class="card-title" i18n="@@bank_programs.form.eligibility_core.title">Eligibility</h2>
                <p class="card-sub" i18n="@@bank_programs.form.eligibility_core.sub">Who qualifies — age, income, employment.</p>
              </div>
            </header>
            <div class="grid">
              <nz-form-item>
                <nz-form-label [nzFor]="'ageMin'" nzRequired i18n="@@bank_programs.field.age_min">Minimum age</nz-form-label>
                <nz-form-control [nzErrorTip]="fieldErrorTpl">
                  <nz-input-number id="ageMin" class="num-field" formControlName="ageMin" [nzMin]="18" [nzMax]="80" [nzStep]="1" [nzPrecision]="0"></nz-input-number>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label [nzFor]="'ageMax'" nzRequired i18n="@@bank_programs.field.age_max">Maximum age</nz-form-label>
                <nz-form-control [nzErrorTip]="fieldErrorTpl">
                  <nz-input-number id="ageMax" class="num-field" formControlName="ageMax" [nzMin]="18" [nzMax]="80" [nzStep]="1" [nzPrecision]="0"></nz-input-number>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label [nzFor]="'minMonthlyIncomeEGP'" nzRequired i18n="@@bank_programs.field.min_income">Minimum monthly income</nz-form-label>
                <nz-form-control [nzErrorTip]="fieldErrorTpl">
                  <nz-input-group nzAddOnBefore="EGP" class="money-group">
                    <input nz-input appMoneyInput id="minMonthlyIncomeEGP" formControlName="minMonthlyIncomeEGP" inputmode="numeric" placeholder="5,000" />
                  </nz-input-group>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label [nzFor]="'minMonthsInJob'" nzRequired i18n="@@bank_programs.field.min_months_job">Minimum months in job</nz-form-label>
                <nz-form-control [nzErrorTip]="fieldErrorTpl">
                  <nz-input-number id="minMonthsInJob" class="num-field" formControlName="minMonthsInJob" [nzMin]="0" [nzMax]="240" [nzStep]="1" [nzPrecision]="0"></nz-input-number>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item class="span-2">
                <nz-form-label nzRequired i18n="@@bank_programs.field.accepted_employment">Accepted employment types</nz-form-label>
                <nz-form-control [nzErrorTip]="fieldErrorTpl">
                  <nz-select formControlName="acceptedEmploymentTypes" nzMode="multiple" nzPlaceHolder="Pick one or more" [nzDropdownStyle]="dropdownStyle">
                    @for (o of employmentOptions(); track o.value) {
                      <nz-option [nzValue]="o.value" [nzLabel]="o.label"></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item class="span-2">
                <nz-form-label nzRequired i18n="@@bank_programs.field.accepted_transfer">Accepted transfer types</nz-form-label>
                <nz-form-control [nzErrorTip]="fieldErrorTpl">
                  <nz-select formControlName="acceptedTransferTypes" nzMode="multiple" nzPlaceHolder="Pick one or more" [nzDropdownStyle]="dropdownStyle">
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
            <!-- One number, one switch: stacked rather than side-by-side, so the
                 cap keeps a hand-sized field instead of stretching half the card,
                 and the toggle that overrides it reads as the wider decision. -->
            <div class="dbr-grid">
              <nz-form-item class="dbr-cap" [class.is-muted]="skipDbr">
                <nz-form-label [nzFor]="'dbrCapPercent'" nzRequired>
                  <span i18n="@@bank_programs.field.dbr_cap">DBR cap</span>
                  <ng-container *ngTemplateOutlet="originTpl; context: { $implicit: 'eligibility.dbrCapPercent' }" />
                </nz-form-label>
                <nz-form-control [nzErrorTip]="fieldErrorTpl">
                  <nz-input-group nzAddOnAfter="%" class="rate-group">
                    <input nz-input id="dbrCapPercent" formControlName="dbrCapPercent" inputmode="decimal" placeholder="50.0000" />
                  </nz-input-group>
                  <p class="field-hint" i18n="@@bank_programs.field.dbr_cap.hint">
                    Counts every instalment the customer already carries.
                  </p>
                </nz-form-control>
              </nz-form-item>

              <label class="option-row" [class.is-on]="skipDbr" nz-checkbox formControlName="skipDbrCheck">
                <span class="option-text">
                  <span class="option-title" i18n="@@bank_programs.field.skip_dbr">Skip DBR check</span>
                  <span class="option-hint" i18n="@@bank_programs.field.skip_dbr.hint">
                    Secured loans only. The cap above is ignored while matching.
                  </span>
                </span>
              </label>
            </div>
          </section>

          @if (incomeSurrogateActive()) {
            <app-income-assumption-section [group]="incomeAssumptionGroup"></app-income-assumption-section>
          }
          }

          <!-- ═══ STEP 5 — DOCUMENTS & NOTES ══════════════════════════════════ -->
          @if (stepIndex() === 4) {
          <section class="card" formGroupName="documents">
            <header class="card-head">
              <div>
                <h2 class="card-title" i18n="@@bank_programs.form.documents.title">Documents &amp; notes</h2>
                <p class="card-sub" i18n="@@bank_programs.form.documents.sub">Required uploads and free-form operator notes.</p>
              </div>
            </header>
            <div class="grid">
              <nz-form-item class="span-2">
                <nz-form-label i18n="@@bank_programs.field.required_documents">Required documents</nz-form-label>
                <nz-form-control [nzErrorTip]="fieldErrorTpl">
                  <nz-select formControlName="requiredDocuments" nzMode="multiple" nzPlaceHolder="Pick required documents">
                    @for (o of documentOptions(); track o.value) {
                      <nz-option [nzValue]="o.value" [nzLabel]="o.label"></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item class="span-2">
                <nz-form-label [nzFor]="'operatorNotes'" i18n="@@bank_programs.field.notes">Notes</nz-form-label>
                <nz-form-control [nzErrorTip]="fieldErrorTpl">
                  <textarea nz-input id="operatorNotes" formControlName="operatorNotes" rows="3" placeholder="Operator-facing notes (optional)"></textarea>
                </nz-form-control>
              </nz-form-item>
            </div>
          </section>
          }

          <!-- ═══ STEP 6 — REVIEW ═════════════════════════════════════════════
               A read-back, not a form: every row is a value the admin typed, and
               every group jumps straight back to the step that owns it. -->
          @if (stepIndex() === 5) {
          <section class="card review">
            <header class="card-head">
              <div>
                <h2 class="card-title" i18n="@@bank_programs.form.review.title">Review</h2>
                <p class="card-sub" i18n="@@bank_programs.form.review.sub">
                  Last look before this program starts producing offers. Any row can be corrected in place.
                </p>
              </div>
            </header>

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
          </section>
          }
          <!-- FR-010: per-field provenance. Tone carries a hint, the WORD carries
               the meaning — colour alone would fail both contrast and RTL review. -->
          <ng-template #originTpl let-path>
            @if (originOf(path); as origin) {
              @switch (origin) {
                @case ('CATALOG') {
                  <span class="origin origin--catalog" i18n="@@bank_programs.origin.catalog"
                    >from program</span
                  >
                }
                @case ('BANK_POLICY') {
                  <span class="origin origin--policy" i18n="@@bank_programs.origin.bankPolicy"
                    >from bank policy</span
                  >
                }
                @case ('EDITED') {
                  <span class="origin origin--edited" i18n="@@bank_programs.origin.edited"
                    >edited</span
                  >
                }
              }
            }
          </ng-template>

          <!-- Sticky so the next action is always one glance away, whatever the
               step's height. Submit stays enabled and REPORTS what is missing
               instead of going dead with no explanation. -->
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
      /* --- FR-010 origin badges ------------------------------------------- */
      .origin {
        display: inline-block;
        margin-inline-start: var(--space-2);
        padding-block: 0;
        padding-inline: var(--space-2);
        border-radius: var(--radius-pill);
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-medium);
        /* Fixed box so the badge never shifts the label's baseline as its text
           swaps between "from program" and the longer "from bank policy". */
        line-height: 1.25rem;
        vertical-align: middle;
        white-space: nowrap;
      }
      .origin--catalog {
        background: var(--color-info-bg);
        color: var(--color-info);
      }
      .origin--policy {
        background: var(--color-surface-muted);
        color: var(--color-text-secondary);
      }
      .origin--edited {
        background: var(--color-warning-bg);
        color: var(--color-warning);
      }
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
      label.option-row:hover {
        border-color: color-mix(
          in oklab,
          var(--primary, var(--color-brand-primary)) 38%,
          var(--border-default, var(--color-border-default))
        );
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
      @media (prefers-reduced-motion: reduce) {
        .dbr-cap,
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

      :host {
        display: block;
        padding: var(--space-6);
        max-width: 1080px;
        margin-inline: auto;
      }
      .page-header { display: flex; flex-direction: column; gap: var(--space-2); margin-block-end: var(--space-5); }
      .back-link {
        display: inline-flex; align-items: center; gap: var(--space-1);
        color: var(--text-secondary, var(--color-text-secondary));
        text-decoration: none; font-size: var(--text-sm); width: max-content;
      }
      .back-link:hover { color: var(--primary, var(--color-brand-primary)); }
      .title-block { display: flex; flex-direction: column; gap: var(--space-1); }
      .page-title {
        font-size: var(--text-2xl); font-weight: 700; margin: 0;
        color: var(--text-primary, var(--color-text-primary)); letter-spacing: -0.01em;
      }
      .page-subtitle {
        margin: 0; font-size: var(--text-md); max-width: 72ch;
        color: var(--text-secondary, var(--color-text-secondary));
      }
      .form-body { display: flex; flex-direction: column; gap: var(--space-4); }

      /* ── Wizard step bar ───────────────────────────────────────── */
      .steps {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: var(--space-3) var(--space-4);
        background: var(--bg-surface, var(--color-surface-default));
        border: 1px solid var(--border-default, var(--color-border-default));
        border-radius: var(--radius-lg);
        overflow-x: auto;
      }
      .step {
        appearance: none;
        background: transparent;
        border: none;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border-radius: var(--radius-pill);
        flex: 0 0 auto;
        transition: background 150ms ease, color 150ms ease;
      }
      .step:hover { background: var(--bg-subtle, var(--color-surface-row-hover)); }
      .step:focus-visible {
        outline: 2px solid var(--primary, var(--color-brand-primary));
        outline-offset: 2px;
      }
      .step-num {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 22px;
        block-size: 22px;
        border-radius: 50%;
        background: var(--bg-muted, var(--color-surface-muted));
        color: var(--text-tertiary, var(--color-text-tertiary));
        font-size: 11px;
        font-weight: 700;
        line-height: 1;
      }
      .step.active .step-num {
        background: var(--primary, var(--color-brand-primary));
        color: var(--text-on-primary, var(--color-text-on-brand));
      }
      .step.done .step-num {
        background: var(--success, var(--color-success));
        color: var(--text-on-primary, var(--color-text-on-brand));
      }
      .step-label {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-secondary, var(--color-text-secondary));
        letter-spacing: -0.005em;
      }
      .step.active .step-label { color: var(--text-primary, var(--color-text-primary)); }
      .step-sep {
        flex: 1 1 auto;
        min-inline-size: 16px;
        block-size: 1px;
        background: var(--border-default, var(--color-border-default));
      }

      /* ── Bank chip (pre-selected from atlas CTA) ───────────────── */
      .bank-chip {
        display: inline-flex;
        align-items: center;
        gap: var(--space-3);
        padding: 8px 12px 8px 8px;
        background: var(--accent-subtle, var(--color-tonal-accent-bg));
        border: 1px solid color-mix(in srgb, var(--primary, var(--color-brand-primary)) 22%, transparent);
        border-radius: var(--radius-pill);
        align-self: flex-start;
      }
      .bank-chip-avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 32px;
        block-size: 32px;
        border-radius: 50%;
        background: var(--primary, var(--color-brand-primary));
        color: var(--text-on-primary, var(--color-text-on-brand));
        font-size: 12px;
        font-weight: 700;
      }
      .bank-chip-body { display: flex; flex-direction: column; gap: 1px; }
      .bank-chip-eyebrow {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-tertiary, var(--color-text-tertiary));
      }
      .bank-chip-name {
        font-size: 13px;
        font-weight: 700;
        color: var(--primary, var(--color-brand-primary));
      }
      .bank-chip-change {
        appearance: none;
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 4px 8px;
        color: var(--text-secondary, var(--color-text-secondary));
        font-size: 12px;
        font-weight: 600;
        border-radius: var(--radius-pill);
        transition: background 150ms ease, color 150ms ease;
      }
      .bank-chip-change:hover {
        background: rgba(255, 255, 255, 0.4);
        color: var(--primary, var(--color-brand-primary));
      }
      .footer-spacer { flex: 1 1 auto; }

      .card {
        background: var(--bg-surface, var(--color-surface-default));
        border: 1px solid var(--border-default, var(--color-border-default));
        border-radius: var(--radius-lg);
        padding: var(--space-5);
        display: flex; flex-direction: column; gap: var(--space-4);
      }
      .card-head {
        display: flex; align-items: flex-start; gap: var(--space-3);
        margin-block-end: var(--space-1);
      }
      .card-icon { font-size: 22px; color: var(--accent, var(--color-tonal-accent)); flex-shrink: 0; }
      .card-title {
        font-size: var(--text-lg); font-weight: 700; margin: 0 0 var(--space-1);
        color: var(--text-primary, var(--color-text-primary)); letter-spacing: -0.005em;
      }
      .card-sub {
        font-size: var(--text-sm); margin: 0; max-width: 72ch;
        color: var(--text-secondary, var(--color-text-secondary));
      }
      .grid {
        display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-3) var(--space-4);
        align-items: start;
      }
      .grid > * { align-self: start; min-block-size: 0; }
      .grid .span-2 { grid-column: span 2; }
      @media (max-width: 720px) {
        .grid { grid-template-columns: minmax(0, 1fr); }
        .grid .span-2 { grid-column: span 1; }
      }

      /* Cross-field tenor error (max < min), shown under the Maximum input. */
      .field-error {
        display: block; margin-block-start: var(--space-1);
        font-size: var(--text-xs); font-weight: var(--font-weight-medium);
        color: var(--color-error);
      }

      .disclosure { padding: 0; }
      .disclosure-head {
        appearance: none;
        background: transparent;
        border: none;
        cursor: pointer;
        text-align: start;
        width: 100%;
        padding: var(--space-5);
        display: flex; align-items: center; justify-content: space-between;
        gap: var(--space-3);
      }
      .disclosure-head:hover { background: var(--bg-subtle, var(--color-surface-row-hover)); }
      .disclosure-head:focus-visible {
        outline: 2px solid var(--primary, var(--color-brand-primary));
        outline-offset: -2px;
      }
      .chevron { color: var(--text-tertiary, var(--color-text-tertiary)); font-size: 14px; }
      .disclosure.open .chevron { color: var(--primary, var(--color-brand-primary)); }
      .disclosure-body {
        padding: 0 var(--space-5) var(--space-5);
        display: flex; flex-direction: column; gap: var(--space-4);
        border-block-start: 1px solid var(--border-default, var(--color-border-default));
        padding-block-start: var(--space-4);
      }
      .form-footer {
        display: flex; align-items: center; justify-content: flex-end;
        gap: var(--space-3); padding: var(--space-4);
        background: var(--bg-surface, var(--color-surface-default));
        border: 1px solid var(--border-default, var(--color-border-default));
        border-radius: var(--radius-lg);
      }
      .manual-error {
        margin-block-start: 4px;
        font-size: 12px;
        color: var(--error, var(--color-error));
        line-height: 1.4;
      }
      .unavailable {
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        padding: var(--space-10); gap: var(--space-3); text-align: center;
        background: var(--bg-surface, var(--color-surface-default));
        border: 1px solid var(--border-default, var(--color-border-default));
        border-radius: var(--radius-lg);
      }
      .unavailable-icon { font-size: 56px; width: 56px; height: 56px; color: var(--text-tertiary, var(--color-text-tertiary)); }
      .unavailable-text { margin: 0; font-size: var(--text-md); color: var(--text-primary, var(--color-text-primary)); }

      /* Tiered-rate band editor */
      .bands { display: flex; flex-direction: column; gap: var(--space-3); }
      .bands-empty {
        margin: 0; padding: var(--space-4); text-align: center;
        font-size: var(--text-sm); color: var(--text-secondary, var(--color-text-secondary));
        border: 1px dashed var(--border-default, var(--color-border-default));
        border-radius: var(--radius-lg);
        background: var(--bg-subtle, var(--color-surface-row-hover));
      }
      .bands-head {
        display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 44px;
        gap: var(--space-3); padding-inline: var(--space-1);
        font-size: var(--text-xs); font-weight: 600; letter-spacing: 0.02em;
        text-transform: uppercase;
        color: var(--text-tertiary, var(--color-text-tertiary));
      }
      .band-row {
        display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 44px;
        gap: var(--space-3); align-items: start;
      }
      .band-cell { margin: 0; }
      .band-remove {
        inline-size: 44px; block-size: 44px;
        display: inline-flex; align-items: center; justify-content: center;
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
      .bands-add { align-self: flex-start; }
      @media (max-width: 720px) {
        .bands-head { display: none; }
      }

      /* ── Wizard: rail semantics, step caption, issue banner ─────── */
      /* The rail, its caption and the issue banner pin together as ONE block
         parked flush at the top of the page scrollport.
         The scroll container is <main class="content"> in app.component (it owns
         overflow-y, the app top bar is its SIBLING and never scrolls) — so the
         sticky offset is 0, not --topbar-height: a 64px offset would park the
         rail 64px down inside the scrollport and let step content scroll
         visibly through the band above it.
         The wrapper — not the <ol> — is the sticky element so the flex gaps
         between the three carry an opaque backdrop; a bare sticky <ol> lets the
         step content scroll visibly through those gaps. The backdrop bleeds out
         past the host's inline padding, and up over the host's block padding, so
         nothing peeks at the edges either. */
      .wizard-rail {
        position: sticky;
        inset-block-start: 0;
        z-index: 3;
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        background: var(--bg-base, var(--color-surface-page));
        margin-inline: calc(var(--space-6) * -1);
        padding-inline: var(--space-6);
        padding-block: var(--space-3);
        margin-block: calc(var(--space-3) * -1);
        scroll-margin-block-start: 0;
      }
      /* Hairline under the pinned block so cards sliding beneath it read as
         passing UNDER the rail rather than colliding with it. */
      .wizard-rail::after {
        content: '';
        position: absolute;
        inset-inline: 0;
        inset-block-end: 0;
        block-size: 1px;
        background: var(--border-subtle, var(--color-border-default));
        opacity: 0.6;
        pointer-events: none;
      }
      .steps {
        list-style: none;
        margin: 0;
      }
      .steps-item {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex: 1 1 auto;
        min-inline-size: 0;
      }
      .steps-item.is-last { flex: 0 0 auto; }
      .step { position: relative; }
      .step:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }
      .step:disabled:hover { background: transparent; }
      .step.done .step-num .anticon { font-size: var(--text-xs); }
      /* Error state carries a tinted chip + the error hue on TEXT, not white on
         mid-red — that pairing fails contrast at this type size in both themes. */
      .step.invalid .step-num {
        background: color-mix(in oklab, var(--color-error) 18%, var(--bg-surface));
        box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--color-error) 45%, transparent);
        color: var(--error-500);
      }
      .step.invalid .step-label { color: var(--error-500); }
      /* Visible on the active/hovered step, always present for assistive tech. */
      .step-state {
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--text-tertiary, var(--color-text-tertiary));
      }
      .step.invalid .step-state { color: var(--error-500); }
      .step.done .step-state { color: var(--success, var(--color-success)); }
      @media (max-width: 900px) {
        .step-state {
          position: absolute;
          inline-size: 1px;
          block-size: 1px;
          overflow: hidden;
          clip-path: inset(50%);
          white-space: nowrap;
        }
      }
      .step-caption {
        margin: 0;
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--text-tertiary, var(--color-text-tertiary));
      }
      /* Labels compete for width on narrow screens; only the current step keeps
         its name so the rail never overflows into a horizontal scroll. */
      @media (max-width: 720px) {
        .step-label { display: none; }
        .step.active .step-label { display: inline; }
      }
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
      .form-body > .card,
      .form-body > app-income-assumption-section,
      .form-body > .bank-chip {
        animation: step-enter var(--motion-duration-base) var(--motion-easing-standard) both;
      }
      .form-body > section.card:nth-of-type(2) { animation-delay: 30ms; }
      .form-body > section.card:nth-of-type(3) { animation-delay: 60ms; }
      @keyframes step-enter {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: none; }
      }
      @media (prefers-reduced-motion: reduce) {
        .form-body > .card,
        .form-body > app-income-assumption-section,
        .form-body > .bank-chip { animation: none; }
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
      .review-edit:hover { background: var(--accent-subtle, var(--color-tonal-accent-bg)); }
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
        .review-list { grid-template-columns: minmax(0, 1fr); }
      }

      /* Sticky action bar: the next step is always reachable without scrolling
         back to the bottom of a long panel. */
      .form-footer {
        position: sticky;
        inset-block-end: 0;
        z-index: 2;
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
  private readonly notification = inject(NzNotificationService);
  private readonly errorsService = inject(ErrorCodeService);
  readonly enums = inject(PlatformEnumerationsService);
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
   * The form is a 6-step wizard again, with the defect that killed the previous
   * one designed out: **no required control lives behind a disclosure.** Every
   * fee, the DBR cap and the rate all render in the open on the step that owns
   * them, so an admin can never be blocked by a field they were never shown.
   * Disclosures now hold optional-only fields, and the rail marks the exact step
   * that still needs attention.
   */
  readonly steps: readonly WizardStep[] = [
    {
      id: 'program',
      label: $localize`:@@bank_programs.step.program:Program`,
      groups: ['identity'],
    },
    {
      id: 'terms',
      label: $localize`:@@bank_programs.step.terms:Amount & duration`,
      groups: ['loanLimits', 'tenor'],
    },
    {
      id: 'pricing',
      label: $localize`:@@bank_programs.step.pricing:Pricing & fees`,
      groups: ['pricing', 'fees'],
    },
    {
      id: 'eligibility',
      label: $localize`:@@bank_programs.step.eligibility:Eligibility`,
      groups: ['eligibility', 'incomeAssumption'],
    },
    {
      id: 'documents',
      label: $localize`:@@bank_programs.step.documents:Documents`,
      groups: ['documents'],
    },
    { id: 'review', label: $localize`:@@bank_programs.step.review:Review`, groups: [] },
  ];
  readonly stepsAria = $localize`:@@bank_programs.steps.aria:Program setup steps`;
  readonly stepDoneLabel = $localize`:@@bank_programs.steps.done:done`;
  readonly stepNeedsAttentionLabel = $localize`:@@bank_programs.steps.needs_attention:needs attention`;
  readonly stepIndex = signal(0);
  /** Highest step reached — the rail only lets an admin jump to what they've seen. */
  readonly furthestStep = signal(0);
  /** Set when Continue / Create is refused, cleared on every step change. */
  readonly showStepIssues = signal(false);
  /** Optional-only disclosure on the amount step (qualitative-review ceiling). */
  readonly termsExtrasOpen = signal(false);

  readonly isLastStep = computed(() => this.stepIndex() === this.steps.length - 1);
  readonly stepCaption = computed(() => {
    const current = this.stepIndex() + 1;
    const total = this.steps.length;
    const label = this.steps[this.stepIndex()]?.label ?? '';
    return $localize`:@@bank_programs.step.caption:Step ${current}:current: of ${total}:total: · ${label}:label:`;
  });

  private stepControls(index: number): AbstractControl[] {
    const step = this.steps[index];
    if (!step) return [];
    return step.groups
      .map((name) => this.form.get(name))
      .filter((c): c is AbstractControl => c !== null);
  }

  isStepValid(index: number): boolean {
    return this.stepControls(index).every((c) => c.valid);
  }

  /** Green check: a step already visited, left behind, and holding valid values. */
  isStepComplete(index: number): boolean {
    const step = this.steps[index];
    if (!step || step.groups.length === 0) return false;
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
    this.stepIndex.set(index);
    this.revealStepStart();
  }

  next(): void {
    if (this.isLastStep() || !this.commitStep()) return;
    const target = this.stepIndex() + 1;
    this.stepIndex.set(target);
    this.furthestStep.update((max) => Math.max(max, target));
    this.showStepIssues.set(false);
    this.revealStepStart();
  }

  prev(): void {
    if (this.stepIndex() === 0) return;
    this.showStepIssues.set(false);
    this.stepIndex.update((i) => i - 1);
    this.revealStepStart();
  }

  /**
   * Validates the step being left. On failure it marks the step's controls so the
   * inline errors appear, surfaces the count, and focuses the first bad field —
   * the admin never has to hunt for what blocked them.
   */
  private commitStep(): boolean {
    const controls = this.stepControls(this.stepIndex());
    if (controls.every((c) => c.valid)) {
      this.showStepIssues.set(false);
      return true;
    }
    for (const c of controls) revealErrors(c);
    this.showStepIssues.set(true);
    this.focusFirstInvalid();
    return false;
  }

  /** Number of fields on the current step that still fail validation. */
  stepIssueCount(): number {
    return this.stepControls(this.stepIndex()).reduce(
      (sum, c) => sum + countInvalidLeaves(c),
      0,
    );
  }

  stepIssueLabel(): string {
    const count = this.stepIssueCount();
    return count === 1
      ? $localize`:@@bank_programs.step.issue_one:1 field on this step needs a value before you continue.`
      : $localize`:@@bank_programs.step.issue_many:${count}:count: fields on this step need a value before you continue.`;
  }

  private get prefersReducedMotion(): boolean {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  }

  private revealStepStart(): void {
    const rail = this.host.nativeElement.querySelector('.wizard-rail');
    rail?.scrollIntoView({
      block: 'start',
      behavior: this.prefersReducedMotion ? 'auto' : 'smooth',
    });
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

  clearBank(): void {
    this.bankIdControl.setValue(null);
    this.identityGroup.patchValue({ bankName: '' });
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
  readonly incomeSurrogateActive = computed(
    () => this.programTypeSignal() === 'income_surrogate',
  );


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
  private currentProgramCode = '';

  // Enum-driven option signals
  readonly employmentOptions = computed(() =>
    this.enums.membersFor('employment_type')().map((m) => ({ value: m.key, label: m.labelEn })),
  );
  readonly transferOptions = computed(() =>
    this.enums.membersFor('transfer_type')().map((m) => ({ value: m.key, label: m.labelEn })),
  );
  readonly documentOptions = computed(() =>
    this.enums.membersFor('required_document')().map((m) => ({ value: m.key, label: m.labelEn })),
  );
  /**
   * Product-category options sourced from the live registry (`product_category`).
   * Localized via the shared `categoryLabel()` for the four known categories;
   * falls back to the canonical four if the registry hasn't loaded yet so the
   * picker is never empty. Adding `business` to the registry surfaces it here
   * automatically — no hardcoded option list (Principle II).
   */
  readonly categoryOptions = computed(() => {
    const members = this.enums
      .membersFor('product_category')()
      .filter((m) => m.active && !m.deprecated);
    if (members.length === 0) {
      return LOAN_CATEGORIES.map((cat) => ({ value: cat as string, label: categoryLabel(cat) }));
    }
    return members.map((m) => ({
      value: m.key,
      label: isLoanCategory(m.key) ? categoryLabel(m.key) : m.labelEn,
    }));
  });

  readonly form = this.fb.nonNullable.group({
    identity: this.fb.nonNullable.group({
      // Read-only display on edit; auto-generated by backend on create (never user-typed).
      programCode: new FormControl('', { nonNullable: true }),
      bankName: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(80)],
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
      currencies: this.fb.nonNullable.array<string>(['EGP'], { validators: [Validators.required] }),
      /**
       * Islamic-finance program. HIDDEN from the form UI — the customer-facing
       * half (offer badge, Islamic-only filter, "profit rate" wording) was never
       * built, so the checkbox let admins set a flag nobody could see. The
       * control stays so an existing program's stored value round-trips through
       * edit unchanged; the API field, DB column and offer snapshot are intact.
       * Re-expose the checkbox when the customer-facing surfaces ship.
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
      qualitativeReviewMaxEGP: new FormControl<string | null>(null),
    }),
    pricing: this.fb.nonNullable.group({
      isVariableRate: new FormControl(false, { nonNullable: true }),
      baseRatePercent: new FormControl<string | null>('24.0000'),
      currentEffectiveRatePercent: new FormControl<string | null>(null),
      variableRateNote: new FormControl<string | null>(null),
      rateByLoanAmountBands: new FormArray<FormGroup>([]),
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
      dbrCapPercent: new FormControl('50.0000', {
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
      strategy: new FormControl<IncomeAssumptionStrategy>('declared', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      carInstallmentMultiplier: new FormControl<string | null>(null),
      carLoanAmountPercent: new FormControl<string | null>(null),
      creditCardLimitMultiplier: new FormControl<string | null>(null),
      bankStatementPercent: new FormControl<string | null>(null),
    }),
    fees: this.fb.nonNullable.group({
      adminFeePercent: new FormControl('1.0000', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      stampDutyPercent: new FormControl('0.5000', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      lifeInsurancePercent: new FormControl('0.5000', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      lifeInsuranceMandatory: new FormControl(false, { nonNullable: true }),
      latePaymentFeePercent: new FormControl('4.0000', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      payoffCashPercent: new FormControl('12.0000', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      payoffBuyoutPercent: new FormControl('15.0000', {
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

  get identityGroup(): FormGroup { return this.form.controls.identity as FormGroup; }
  get tenorGroup(): FormGroup { return this.form.controls.tenor as FormGroup; }
  get loanLimitsGroup(): FormGroup { return this.form.controls.loanLimits as FormGroup; }
  get pricingGroup(): FormGroup { return this.form.controls.pricing as FormGroup; }
  get eligibilityGroup(): FormGroup { return this.form.controls.eligibility as FormGroup; }
  /** Drives the dimmed cap field + the lit toggle row on the Debt burden card. */
  get skipDbr(): boolean { return this.eligibilityGroup.get('skipDbrCheck')?.value === true; }
  get incomeAssumptionGroup(): FormGroup { return this.form.controls.incomeAssumption as FormGroup; }
  get feesGroup(): FormGroup { return this.form.controls.fees as FormGroup; }
  get documentsGroup(): FormGroup { return this.form.controls.documents as FormGroup; }

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

  // Live array view for the FormArray-backed currencies field (kept as FormArray to
  // preserve per-item validation hooks). Other multi-select fields are now typed
  // FormControl<string[]> bound directly via [formControl] / formControlName.
  readonly currenciesArrValue = signal<string[]>(['EGP']);

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
    if (this.toggles.tieredRates() && this.rateBandsArray.length > 0) {
      rateRows.push({
        label: $localize`:@@bank_programs.review.rate_bands:Rate bands`,
        value: this.countLabel(this.rateBandsArray.length),
      });
    }

    return [
      {
        step: 0,
        title: this.steps[0]?.label ?? '',
        rows: [
          { label: $localize`:@@bank_programs.review.bank:Bank`, value: id.bankName },
          { label: $localize`:@@bank_programs.review.name:Program name`, value: id.friendlyName },
          {
            label: $localize`:@@bank_programs.review.product:Product`,
            value: isLoanCategory(id.productCategory)
              ? categoryLabel(id.productCategory)
              : id.productCategory,
          },
          {
            label: $localize`:@@bank_programs.review.program_type:Program type`,
            value:
              id.programType === 'income_surrogate'
                ? $localize`:@@program_type.surrogate:Income-surrogate`
                : $localize`:@@program_type.proof:Income-proof`,
          },
        ],
      },
      {
        step: 1,
        title: this.steps[1]?.label ?? '',
        rows: [
          {
            label: $localize`:@@bank_programs.review.amount:Loan amount`,
            value: `${money(v.loanLimits.minAmountEGP)} – ${money(v.loanLimits.maxAmountEGP)} EGP`,
          },
          {
            label: $localize`:@@bank_programs.review.duration:Duration`,
            value: `${this.formatMonths(v.tenor.minMonths)} – ${this.formatMonths(v.tenor.maxMonths)}`,
          },
          {
            label: $localize`:@@bank_programs.review.qr_ceiling:Uplift ceiling`,
            value: v.loanLimits.qualitativeReviewMaxEGP
              ? `${money(v.loanLimits.qualitativeReviewMaxEGP)} EGP`
              : '',
          },
        ],
      },
      {
        step: 2,
        title: this.steps[2]?.label ?? '',
        rows: [
          ...rateRows,
          { label: $localize`:@@bank_programs.review.admin_fee:Admin fee`, value: pct(v.fees.adminFeePercent) },
          { label: $localize`:@@bank_programs.review.stamp_duty:Stamp duty`, value: pct(v.fees.stampDutyPercent) },
          {
            label: $localize`:@@bank_programs.review.life_insurance:Life insurance`,
            value: v.fees.lifeInsuranceMandatory
              ? $localize`:@@bank_programs.review.life_insurance_mandatory:${pct(v.fees.lifeInsurancePercent)}:rate: · mandatory`
              : pct(v.fees.lifeInsurancePercent),
          },
          { label: $localize`:@@bank_programs.review.late_fee:Late payment fee`, value: pct(v.fees.latePaymentFeePercent) },
          { label: $localize`:@@bank_programs.review.payoff:Payoff (cash / buyout)`, value: `${pct(v.fees.payoffCashPercent)} / ${pct(v.fees.payoffBuyoutPercent)}` },
        ],
      },
      {
        step: 3,
        title: this.steps[3]?.label ?? '',
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
        step: 4,
        title: this.steps[4]?.label ?? '',
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

  /** Enum keys → their registry labels, joined for a review row. */
  private labelsFor(registry: string, keys: readonly string[]): string {
    if (keys.length === 0) return '';
    const members = this.enums.membersFor(registry as never)();
    return keys
      .map((k) => members.find((m) => m.key === k)?.labelEn ?? k)
      .join(', ');
  }

  private countLabel(n: number): string {
    return n === 1
      ? $localize`:@@bank_programs.review.count_one:1 band`
      : $localize`:@@bank_programs.review.count_many:${n}:count: bands`;
  }

  /**
   * Income-banded DBR table (FR-016) — NOT editable here any more: the flat
   * `eligibility.dbrCapPercent` field is the only cap an admin sets on this form.
   *
   * The signal survives as a CARRIER: bands resolved from bank policy on create,
   * or already stored on the program being edited, are read in and written back
   * out unchanged. Dropping it would make every save silently wipe a program's
   * existing bands.
   */
  readonly dbrBands = signal<DbrBand[]>([]);

  // ── Prefill (FR-008, FR-010) ─────────────────────────────────────────────
  /**
   * Per-leaf provenance of the currently-shown values. `EDITED` is set locally
   * the moment an admin overrides an inherited value, so the badge answers
   * "is this the bank's number or mine?" without another round trip.
   *
   * Prefill is CREATE-ONLY: an existing program is self-contained (FR-009), so
   * re-resolving inherited values on edit would silently reprice it.
   */
  readonly prefillOrigin = signal<Record<string, PrefillOrigin>>({});
  readonly prefillBusy = signal(false);

  originOf(path: string): PrefillOrigin | null {
    return this.prefillOrigin()[path] ?? null;
  }

  /** Called on (change) of every prefillable control — flips its badge to EDITED. */
  markEdited(path: string): void {
    const current = this.prefillOrigin()[path];
    if (!current || current === 'EDITED' || current === 'EMPTY') return;
    this.prefillOrigin.set({ ...this.prefillOrigin(), [path]: 'EDITED' });
  }

  /**
   * Resolves bank policy → catalog defaults for the chosen bank + program name +
   * category and drops the merged values into the form. Only leaves the layers
   * actually supplied are written, so an admin's own edits survive a re-resolve.
   */
  private async refreshPrefill(): Promise<void> {
    if (this.isEditMode()) return;
    const category = this.identityGroup.controls['productCategory']?.value as string | undefined;
    if (!category) return;

    this.prefillBusy.set(true);
    try {
      const res = await this.api.prefill({
        category,
        bankId: this.selectedBankId() ?? undefined,
        programNameKey: this.selectedProgramNameKey() ?? undefined,
      });
      this.applyPrefill(res.values);
      this.prefillOrigin.set({ ...res.origin });
    } catch {
      // Prefill is a convenience, never a gate: a failure leaves the form on its
      // built-in defaults rather than blocking program creation.
      this.prefillOrigin.set({});
    } finally {
      this.prefillBusy.set(false);
    }
  }

  private applyPrefill(v: import('../bank-programs.types').ProgramDefaults): void {
    if (v.tenor) {
      this.tenorGroup.patchValue(
        pruneUndefined({ minMonths: v.tenor.minMonths, maxMonths: v.tenor.maxMonths }),
      );
    }
    const egp = v.loanLimits?.perCurrency?.['EGP'];
    if (egp) {
      this.loanLimitsGroup.patchValue(
        pruneUndefined({ minAmountEGP: egp.minAmount, maxAmountEGP: egp.maxAmount }),
      );
    }
    if (v.pricing) {
      this.pricingGroup.patchValue(
        pruneUndefined({
          isVariableRate: v.pricing.isVariableRate,
          baseRatePercent: v.pricing.baseRatePercent,
          currentEffectiveRatePercent: v.pricing.currentEffectiveRatePercent,
        }),
      );
    }
    if (v.eligibility) {
      this.eligibilityGroup.patchValue(
        pruneUndefined({
          ageMin: v.eligibility.ageMin,
          ageMax: v.eligibility.ageMax,
          minMonthlyIncomeEGP: v.eligibility.minMonthlyIncomeEGP,
          dbrCapPercent: v.eligibility.dbrCapPercent,
          skipDbrCheck: v.eligibility.skipDbrCheck,
          requiresCollateral: v.eligibility.requiresCollateral,
        }),
      );
      if (v.eligibility.dbrBands) this.dbrBands.set(v.eligibility.dbrBands);
    }
    if (v.fees) {
      this.feesGroup.patchValue(
        pruneUndefined({
          adminFeePercent: v.fees.adminFeePercent,
          stampDutyPercent: v.fees.stampDutyPercent,
          lifeInsurancePercent: v.fees.lifeInsurancePercent,
        }),
      );
    }
    if (v.requiredDocuments?.length) {
      this.setArr('documents.requiredDocuments', v.requiredDocuments);
    }
  }

  /**
   * The catalog member whose defaults should win. The friendly-name control holds
   * the member's English LABEL (legacy free-text is still allowed), so the key is
   * resolved back through the registry; an unmatched name simply means no catalog
   * layer, which prefill handles as `EMPTY`.
   */
  private selectedProgramNameKey(): string | null {
    const name = this.identityGroup.controls['friendlyName']?.value as string | undefined;
    if (!name) return null;
    const match = this.enums.membersFor('program_name')().find((m) => m.labelEn === name);
    return match?.key ?? null;
  }

  /** Reactive view of identity.friendlyName so the option list keeps a legacy/edit value visible. */
  readonly friendlyNameSignal = toSignal(
    this.form.controls.identity.controls.friendlyName.valueChanges,
    { initialValue: this.form.controls.identity.controls.friendlyName.value },
  );

  /**
   * Program-name options, sourced from the live `program_name` registry
   * (Principle II — names are DATA, no hardcoded list). The catalog is
   * category-agnostic: every active name is offerable under any product
   * category, so the list is NOT filtered by the picked category. The
   * currently-bound name is kept visible even when it isn't (yet) a catalog
   * member, so edit mode + legacy free-text programs still render.
   */
  readonly programNameOptions = computed(() => {
    const opts = this.enums
      .membersFor('program_name')()
      .filter((m) => m.active && !m.deprecated)
      .map((m) => ({ value: m.labelEn, label: this.localeIsAr ? m.labelAr : m.labelEn }));
    const current = this.friendlyNameSignal();
    if (current && !opts.some((o) => o.value === current)) {
      opts.unshift({ value: current, label: current });
    }
    return opts;
  });

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
    // A program that no longer estimates income must not keep surrogate settings.
    effect(() => {
      if (!this.incomeSurrogateActive()) {
        this.incomeAssumptionGroup.patchValue(
          {
            strategy: 'declared',
            carInstallmentMultiplier: null,
            carLoanAmountPercent: null,
            creditCardLimitMultiplier: null,
            bankStatementPercent: null,
          },
          { emitEvent: false },
        );
      }
    });
    effect(() => {
      if (!this.toggles.tieredRates()) {
        this.rateBandsArray.clear();
      }
    });

    // Program-name picker: fill the Arabic name from the chosen catalog member.
    this.form.controls.identity.controls.friendlyName.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((name) => {
        const match = this.enums.membersFor('program_name')().find((m) => m.labelEn === name);
        if (match) {
          this.form.controls.identity.controls.friendlyNameAr.setValue(match.labelAr, {
            emitEvent: false,
          });
        }
      });
    // No category-change reset: a program name serves every category, so a pick
    // stays valid when the product category changes (only its prefill re-resolves).

    // FR-008: re-resolve prefill whenever one of its three inputs changes.
    // Create mode only — `refreshPrefill` no-ops on edit (FR-009).
    merge(
      this.bankIdControl.valueChanges,
      this.form.controls.identity.controls.productCategory.valueChanges,
      this.form.controls.identity.controls.friendlyName.valueChanges,
    )
      .pipe(takeUntilDestroyed())
      .subscribe(() => void this.refreshPrefill());
  }

  ngOnInit(): void {
    this.enums.preload([
      'transfer_type',
      'employment_type',
      'property_type',
      'product_category',
      'currency',
      'required_document',
      'program_name',
    ]);

    // Mirror the currencies FormArray into a signal for read-only consumers.
    // The eligibility / documents multi-selects are now typed FormControl<string[]>
    // and bind directly via formControlName — no signal mirror needed.
    this.syncArr(this.identityGroup.get('currencies'), this.currenciesArrValue);

    void this.loadActiveBanks();

    if (this.isEditMode() && this.editProgramCode()) {
      void this.loadForEdit(this.editProgramCode());
    } else {
      this.preselectCategoryFromQuery();
    }
  }

  /**
   * Preselect the product category when creating from a bank-detail category
   * section (`?category=<loanCategory>`), overriding the `personal` default.
   * Ignored for unknown values so the registry/default still governs.
   */
  private preselectCategoryFromQuery(): void {
    const cat = this.route.snapshot.queryParamMap.get('category');
    if (isLoanCategory(cat)) {
      this.form.controls.identity.controls.productCategory.setValue(cat);
    }
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
      return;
    }
    const preName = params.get('bank');
    if (preName) {
      const match = active.find((b) => b.nameEnglish === preName);
      if (match) this.onBankPicked(match.id);
    }
  }

  protected get preselectedBank() {
    const id = this.selectedBankId();
    if (!id) return null;
    return this.activeBanks().find((b) => b.id === id) ?? null;
  }

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
      'product_category',
      'currency',
      'required_document',
      'program_name',
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
  readonly bandAriaRate = $localize`:@@bank_programs.bands.aria_rate:Band rate, percent`;
  readonly bandAriaRemove = $localize`:@@bank_programs.bands.aria_remove:Remove band`;

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

  addRateBand(): void {
    this.rateBandsArray.push(this.bandRow());
  }

  removeRateBand(index: number): void {
    this.rateBandsArray.removeAt(index);
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

  setArr(path: 'identity.currencies' | 'eligibility.acceptedEmploymentTypes' | 'eligibility.acceptedTransferTypes' | 'documents.requiredDocuments', values: readonly unknown[]): void {
    const ctl = this.form.get(path);
    if (!ctl) return;
    const stringValues = values.map((v) => String(v));
    if (ctl instanceof FormArray) {
      ctl.clear({ emitEvent: false });
      for (const v of stringValues) ctl.push(new FormControl(v, { nonNullable: true }), { emitEvent: false });
      ctl.updateValueAndValidity();
      return;
    }
    // Typed FormControl<string[]>
    ctl.setValue(stringValues);
  }

  private syncArr(ctl: ReturnType<FormGroup['get']>, sig: ReturnType<typeof signal<string[]>>): void {
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
    if (this.form.invalid) {
      revealErrors(this.form);
      const blocked = this.steps.findIndex((_, i) => !this.isStepValid(i));
      if (blocked >= 0) {
        this.stepIndex.set(blocked);
        this.furthestStep.update((max) => Math.max(max, blocked));
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
        const res = await this.api.update(this.currentProgramCode, payload);
        this.message.success($localize`:@@bank_programs.form.updated:Bank program updated.`, { nzDuration: 4000 });
        void this.router.navigate(['/banks/programs', res.data.programCode]);
      } else {
        const payload = this.buildCreatePayload();
        const res = await this.api.create(payload);
        this.message.success($localize`:@@bank_programs.form.created:Bank program created.`, { nzDuration: 4000 });
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
      this.currentProgramCode = res.data.programCode;
      this.autodetectToggles(res.data);
    } catch (err) {
      this.handleError(err);
    }
  }

  /**
   * On edit the program already exists, so every step is reachable immediately —
   * an admin fixing one fee should not have to walk the wizard to get to it.
   * Optional disclosures open only when they actually hold a value.
   */
  private autodetectToggles(d: BankProgramResponse): void {
    this.toggles.tieredRates.set(
      d.pricing.rateByLoanAmountBand != null &&
        Object.keys(d.pricing.rateByLoanAmountBand).length > 0,
    );
    this.termsExtrasOpen.set(d.loanLimits.qualitativeReviewMaxEGP != null);
    this.furthestStep.set(this.steps.length - 1);
  }

  private buildCreatePayload(): BankProgramCreatePayload {
    return this.payloadFromForm(this.form.getRawValue());
  }

  private buildUpdatePayload(): BankProgramUpdatePayload {
    return { ...this.payloadFromForm(this.form.getRawValue()), version: this.currentVersion };
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
      programType: id.programType,
      productCategory: id.productCategory,
      currencies: id.currencies,
      isShariaCompliant: id.isShariaCompliant,
      operatorNotes: dc.operatorNotes ?? undefined,
      operatorTips: dc.operatorTips,
      requiredDocuments: dc.requiredDocuments,
      tenor: { minMonths: tn.minMonths, maxMonths: tn.maxMonths },
      loanLimits: {
        perCurrency: { EGP: { minAmount: ll.minAmountEGP, maxAmount: ll.maxAmountEGP } },
        qualitativeReviewMaxEGP: ll.qualitativeReviewMaxEGP ?? undefined,
      },
      pricing: {
        isVariableRate: pr.isVariableRate,
        baseRatePercent: pr.isVariableRate ? undefined : (pr.baseRatePercent ?? undefined),
        currentEffectiveRatePercent: pr.isVariableRate ? (pr.currentEffectiveRatePercent ?? undefined) : undefined,
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
      incomeAssumption: {
        strategy: ia.strategy,
        carInstallmentMultiplier: ia.strategy === 'byCarInstallment' ? (ia.carInstallmentMultiplier ?? undefined) : undefined,
        carLoanAmountPercent: ia.strategy === 'byCarLoanAmount' ? (ia.carLoanAmountPercent ?? undefined) : undefined,
        creditCardLimitMultiplier: ia.strategy === 'byCreditCardLimit' ? (ia.creditCardLimitMultiplier ?? undefined) : undefined,
        bankStatementPercent: ia.strategy === 'byBankStatementPercent' ? (ia.bankStatementPercent ?? undefined) : undefined,
      },
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

  private applyInitial(initial: BankProgramResponse): void {
    this.editBankName.set(initial.bankName);
    this.identityGroup.patchValue({
      programCode: initial.programCode,
      bankName: initial.bankName,
      friendlyName: initial.friendlyName,
      friendlyNameAr: initial.friendlyNameAr ?? null,
      programType: initial.programType,
      productCategory: initial.productCategory,
      isShariaCompliant: initial.isShariaCompliant === true,
    });
    // programCode is immutable on edit — show it read-only.
    this.identityGroup.controls.programCode?.disable();
    if (initial.bankId) this.bankIdControl.setValue(initial.bankId);
    this.setArr('identity.currencies', initial.currencies);

    this.tenorGroup.patchValue({
      minMonths: initial.tenor.minMonths,
      maxMonths: initial.tenor.maxMonths,
    });
    const egp = initial.loanLimits.perCurrency['EGP'];
    if (egp) {
      this.loanLimitsGroup.patchValue({ minAmountEGP: egp.minAmount, maxAmountEGP: egp.maxAmount });
    }
    this.loanLimitsGroup.patchValue({
      qualitativeReviewMaxEGP: initial.loanLimits.qualitativeReviewMaxEGP ?? null,
    });

    this.pricingGroup.patchValue({
      isVariableRate: initial.pricing.isVariableRate,
      baseRatePercent: initial.pricing.baseRatePercent ?? null,
      currentEffectiveRatePercent: initial.pricing.currentEffectiveRatePercent ?? null,
      variableRateNote: initial.pricing.variableRateNote ?? null,
    });

    this.rateBandsArray.clear();
    const bands = initial.pricing.rateByLoanAmountBand;
    if (bands) {
      Object.entries(bands)
        .sort(([a], [b]) => Number(a) - Number(b))
        .forEach(([key, band]) => this.rateBandsArray.push(this.bandRow(key, band.value)));
    }

    this.eligibilityGroup.patchValue({
      ageMin: initial.eligibility.ageMin,
      ageMax: initial.eligibility.ageMax,
      minMonthlyIncomeEGP: initial.eligibility.minMonthlyIncomeEGP,
      minMonthsInJob: initial.eligibility.minMonthsInJob,
      dbrCapPercent: initial.eligibility.dbrCapPercent,
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
    this.setArr('eligibility.acceptedEmploymentTypes', initial.eligibility.acceptedEmploymentTypes);
    this.setArr('eligibility.acceptedTransferTypes', initial.eligibility.acceptedTransferTypes);

    this.incomeAssumptionGroup.patchValue({
      strategy: initial.incomeAssumption.strategy,
      carInstallmentMultiplier: initial.incomeAssumption.carInstallmentMultiplier ?? null,
      carLoanAmountPercent: initial.incomeAssumption.carLoanAmountPercent ?? null,
      creditCardLimitMultiplier: initial.incomeAssumption.creditCardLimitMultiplier ?? null,
      bankStatementPercent: initial.incomeAssumption.bankStatementPercent ?? null,
    });
    this.feesGroup.patchValue({
      adminFeePercent: initial.fees.adminFeePercent,
      stampDutyPercent: initial.fees.stampDutyPercent,
      lifeInsurancePercent: initial.fees.lifeInsurancePercent,
      lifeInsuranceMandatory: initial.fees.lifeInsuranceMandatory,
      latePaymentFeePercent: initial.fees.latePaymentFeePercent,
      payoffCashPercent: initial.fees.payoffCashPercent,
      payoffBuyoutPercent: initial.fees.payoffBuyoutPercent,
    });
    this.documentsGroup.patchValue({ operatorNotes: initial.operatorNotes ?? null });
    this.setArr('documents.requiredDocuments', initial.requiredDocuments);
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
    if (
      code === 'INVALID_QUALITATIVE_REVIEW_CEILING' ||
      code === 'QUALITATIVE_REVIEW_CEILING_BELOW_BASE'
    ) {
      this.loanLimitsGroup.get('qualitativeReviewMaxEGP')?.setErrors({ qrCeiling: true });
    }
    if (code === 'CONFLICT_STALE_DATA' && this.isEditMode()) {
      void this.loadForEdit(this.currentProgramCode);
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
    return (
      own +
      Object.values(control.controls).reduce((sum, c) => sum + countInvalidLeaves(c), 0)
    );
  }
  if (control instanceof FormArray) {
    const own = control.errors ? 1 : 0;
    return own + control.controls.reduce((sum, c) => sum + countInvalidLeaves(c), 0);
  }
  return control.invalid ? 1 : 0;
}

/** `'24.0000'` → `'24%'`, `'1.5000'` → `'1.5%'`. String-only — never parsed to a float. */
function pct(raw: string | null | undefined): string {
  if (raw == null || raw === '') return '';
  const trimmed = raw.includes('.') ? raw.replace(/0+$/, '').replace(/\.$/, '') : raw;
  return `${trimmed}%`;
}

/** `'1500000'` → `'1,500,000'`. Digit grouping on the string, so no precision loss. */
function money(raw: string | null | undefined): string {
  if (raw == null || raw === '') return '';
  const [int = '', frac] = raw.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? `${grouped}.${frac}` : grouped;
}

/** Drops undefined keys so a partial prefill never clears a field the layers didn't supply. */
function pruneUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}
