import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
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
  PlusOutline,
  SaveOutline,
  ReloadOutline,
  CloudOutline,
  DownOutline,
  UpOutline,
  ThunderboltOutline,
  DeleteOutline,
} from '@ant-design/icons-angular/icons';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MoneyInputDirective } from '../../../core/directives/money-input.directive';
import { ErrorCodeService } from '../../../core/errors/error-code.service';
import { PlatformEnumerationsService } from '../../../core/platform-enumerations/platform-enumerations.service';
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

type ToggleKey =
  | 'tieredRates'
  | 'incomeSurrogate'
  | 'variableRate'
  | 'buyout'
  | 'downPayment'
  | 'shariaCompliant';

@Component({
  selector: 'app-bank-program-form-page',
  standalone: true,
  imports: [
    CommonModule,
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
    NzSpinModule,
    NzSwitchModule,
    IncomeAssumptionSectionComponent,
    MoneyInputDirective,
  ],
  providers: [
    provideNzIconsPatch([
      ArrowLeftOutline,
      PlusOutline,
      SaveOutline,
      ReloadOutline,
      CloudOutline,
      DownOutline,
      UpOutline,
      ThunderboltOutline,
      DeleteOutline,
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <a routerLink="/bank-programs" class="back-link">
          <span nz-icon nzType="arrow-left" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@bank_programs.form.back">Back to list</span>
        </a>
        <div class="title-block">
          <h1 class="page-title">{{ isEditMode() ? editTitle() : createTitle() }}</h1>
          <p class="page-subtitle" i18n="@@bank_programs.form.subtitle">
            Most programs need only the Core section. Advanced features stay hidden until you turn them on.
          </p>
        </div>
      </header>

      <ng-container *ngIf="enums.unavailable(); else readyTpl">
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
      </ng-container>

      <ng-template #readyTpl>
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

          <!-- ═══ WIZARD STEP BAR ════════════════════════════════════════════ -->
          <nav class="steps" aria-label="Form steps">
            @for (s of steps; track s.id; let i = $index) {
              <button
                type="button"
                class="step"
                [class.active]="currentStep() === s.id"
                [class.done]="currentStep() > s.id"
                (click)="goTo(s.id)"
                [attr.aria-current]="currentStep() === s.id ? 'step' : null"
              >
                <span class="step-num">{{ currentStep() > s.id ? '✓' : i + 1 }}</span>
                <span class="step-label">{{ s.label }}</span>
              </button>
              @if (i < steps.length - 1) {
                <span class="step-sep" aria-hidden="true"></span>
              }
            }
          </nav>

          @if (preselectedBank; as b) {
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

          @if (currentStep() === 1) {
          <!-- ═══ CORE ════════════════════════════════════════════════════════ -->
          <section class="card" formGroupName="identity">
            <header class="card-head">
              <div>
                <h2 class="card-title" i18n="@@bank_programs.form.core.title">Core</h2>
                <p class="card-sub" i18n="@@bank_programs.form.core.sub">
                  Identity, money, eligibility — the fields every program needs.
                </p>
              </div>
            </header>

            <div class="grid">
              <nz-form-item>
                <nz-form-label [nzFor]="'programCode'" nzRequired i18n="@@bank_programs.field.program_code">Program code</nz-form-label>
                <nz-form-control [nzErrorTip]="programCodeErrorTpl">
                  <input nz-input id="programCode" formControlName="programCode" placeholder="ABK-PAYROLL-CAT-A" />
                  <ng-template #programCodeErrorTpl let-control>
                    @if (control.hasError('required')) {
                      <span i18n="@@bank_programs.err.program_code_required">Program code is required.</span>
                    } @else if (control.hasError('minlength') || control.hasError('maxlength')) {
                      <span i18n="@@bank_programs.err.program_code_length">Must be 3–32 characters.</span>
                    }
                  </ng-template>
                </nz-form-control>
              </nz-form-item>
              @if (!preselectedBank) {
                <nz-form-item>
                  <nz-form-label [nzFor]="'bankId'" nzRequired i18n="@@bank_programs.field.bank">Bank</nz-form-label>
                  <nz-form-control [nzErrorTip]="fieldErrorTpl">
                    <nz-select
                      id="bankId"
                      [ngModel]="selectedBankId()"
                      [ngModelOptions]="{ standalone: true }"
                      (ngModelChange)="onBankPicked($event)"
                      [nzDropdownStyle]="dropdownStyle"
                      nzShowSearch
                      nzAllowClear
                      nzPlaceHolder="Pick a bank"
                    >
                      @for (b of activeBanks(); track b.id) {
                        <nz-option [nzValue]="b.id" [nzLabel]="b.nameEnglish + ' — ' + b.code"></nz-option>
                      }
                    </nz-select>
                    @if (identityGroup.controls['bankName']?.touched && !selectedBankId()) {
                      <div class="manual-error" i18n="@@bank_programs.err.bank_required">Bank is required.</div>
                    }
                  </nz-form-control>
                </nz-form-item>
              }
              <nz-form-item class="span-2">
                <nz-form-label [nzFor]="'friendlyName'" nzRequired i18n="@@bank_programs.field.friendly_name">Program name</nz-form-label>
                <nz-form-control [nzErrorTip]="friendlyNameErrorTpl">
                  <input nz-input id="friendlyName" formControlName="friendlyName" />
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
                    <nz-option nzValue="personal" nzLabel="Personal" i18n-nzLabel="@@product.personal"></nz-option>
                    <nz-option nzValue="car" nzLabel="Car" i18n-nzLabel="@@product.car"></nz-option>
                    <nz-option nzValue="mortgage" nzLabel="Mortgage" i18n-nzLabel="@@product.mortgage"></nz-option>
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

          @if (currentStep() === 2) {
          <!-- Loan amounts -->
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
                <p class="card-sub" i18n="@@bank_programs.form.tenor.sub">Minimum and maximum months.</p>
              </div>
            </header>
            <div class="grid">
              <nz-form-item>
                <nz-form-label [nzFor]="'minMonths'" nzRequired i18n="@@bank_programs.field.min_months">Minimum months</nz-form-label>
                <nz-form-control [nzErrorTip]="fieldErrorTpl">
                  <nz-input-number id="minMonths" class="num-field" formControlName="minMonths" [nzMin]="1" [nzMax]="600" [nzStep]="1" [nzPrecision]="0"></nz-input-number>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label [nzFor]="'maxMonths'" nzRequired i18n="@@bank_programs.field.max_months">Maximum months</nz-form-label>
                <nz-form-control [nzErrorTip]="fieldErrorTpl">
                  <nz-input-number id="maxMonths" class="num-field" formControlName="maxMonths" [nzMin]="1" [nzMax]="600" [nzStep]="1" [nzPrecision]="0"></nz-input-number>
                </nz-form-control>
              </nz-form-item>
            </div>
          </section>

          <!-- Interest rate (flat single — tier maps live behind tieredRates toggle) -->
          <section class="card" formGroupName="pricing">
            <header class="card-head">
              <div>
                <h2 class="card-title" i18n="@@bank_programs.form.rate.title">Interest rate</h2>
                <p class="card-sub" i18n="@@bank_programs.form.rate.sub">Single annual rate. Tier overrides live under the "Tiered rates" toggle.</p>
              </div>
            </header>
            <div class="grid">
              <nz-form-item>
                <nz-form-label [nzFor]="'baseRatePercent'" nzRequired i18n="@@bank_programs.field.base_rate">Base rate</nz-form-label>
                <nz-form-control [nzErrorTip]="fieldErrorTpl">
                  <nz-input-group nzAddOnAfter="%" class="rate-group">
                    <input nz-input id="baseRatePercent" formControlName="baseRatePercent" inputmode="decimal" placeholder="24.0000" />
                  </nz-input-group>
                </nz-form-control>
              </nz-form-item>
            </div>
          </section>

          <!-- Admin fee + eligibility basics (eligibility group) -->
          <section class="card" formGroupName="fees">
            <header class="card-head">
              <div>
                <h2 class="card-title" i18n="@@bank_programs.form.fees_core.title">Admin fee</h2>
                <p class="card-sub" i18n="@@bank_programs.form.fees_core.sub">Up-front fee charged on disbursement.</p>
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
            </div>
          </section>
          }

          @if (currentStep() === 3) {
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
                  <nz-select [ngModel]="employmentArr()" (ngModelChange)="setArr('eligibility.acceptedEmploymentTypes', $event)" [ngModelOptions]="{ standalone: true }" nzMode="multiple" nzPlaceHolder="Pick one or more" [nzDropdownStyle]="dropdownStyle">
                    @for (o of employmentOptions(); track o.value) {
                      <nz-option [nzValue]="o.value" [nzLabel]="o.label"></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item class="span-2">
                <nz-form-label nzRequired i18n="@@bank_programs.field.accepted_transfer">Accepted transfer types</nz-form-label>
                <nz-form-control [nzErrorTip]="fieldErrorTpl">
                  <nz-select [ngModel]="transferArr()" (ngModelChange)="setArr('eligibility.acceptedTransferTypes', $event)" [ngModelOptions]="{ standalone: true }" nzMode="multiple" nzPlaceHolder="Pick one or more" [nzDropdownStyle]="dropdownStyle">
                    @for (o of transferOptions(); track o.value) {
                      <nz-option [nzValue]="o.value" [nzLabel]="o.label"></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
            </div>
          </section>

          <!-- Documents + notes -->
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
                  <nz-select [ngModel]="docsArr()" (ngModelChange)="setArr('documents.requiredDocuments', $event)" [ngModelOptions]="{ standalone: true }" nzMode="multiple" nzPlaceHolder="Pick required documents">
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

          @if (currentStep() === 4) {
          <!-- ═══ ADVANCED FEES & LIMITS (collapsed) ═════════════════════════ -->
          <section class="card disclosure" [class.open]="advancedFeesOpen()">
            <button type="button" class="disclosure-head" (click)="advancedFeesOpen.set(!advancedFeesOpen())" [attr.aria-expanded]="advancedFeesOpen()">
              <div>
                <h2 class="card-title" i18n="@@bank_programs.form.advanced_fees.title">Advanced fees &amp; limits</h2>
                <p class="card-sub" i18n="@@bank_programs.form.advanced_fees.sub">Pre-filled with platform defaults — expand only if a value differs.</p>
              </div>
              <span class="chevron" nz-icon [nzType]="advancedFeesOpen() ? 'up' : 'down'" nzTheme="outline" aria-hidden="true"></span>
            </button>
            @if (advancedFeesOpen()) {
              <div class="disclosure-body">
                <div class="grid" formGroupName="fees">
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
                  <nz-form-item class="span-2">
                    <label nz-checkbox formControlName="lifeInsuranceMandatory" i18n="@@bank_programs.field.life_insurance_mandatory">Life insurance mandatory</label>
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
                </div>
                <div class="grid" formGroupName="eligibility">
                  <nz-form-item>
                    <nz-form-label nzRequired i18n="@@bank_programs.field.dbr_cap">DBR cap</nz-form-label>
                    <nz-form-control [nzErrorTip]="fieldErrorTpl">
                      <nz-input-group nzAddOnAfter="%" class="rate-group">
                        <input nz-input formControlName="dbrCapPercent" inputmode="decimal" placeholder="50.0000" />
                      </nz-input-group>
                    </nz-form-control>
                  </nz-form-item>
                  <nz-form-item>
                    <label nz-checkbox formControlName="skipDbrCheck" i18n="@@bank_programs.field.skip_dbr">Skip DBR check (secured loans only)</label>
                  </nz-form-item>
                </div>
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

          <!-- ═══ TOGGLE BAR ═════════════════════════════════════════════════ -->
          <section class="card toggles">
            <header class="card-head">
              <div>
                <h2 class="card-title" i18n="@@bank_programs.form.toggles.title">Optional features</h2>
                <p class="card-sub" i18n="@@bank_programs.form.toggles.sub">Turn on only what this program uses. Hidden fields submit as defaults.</p>
              </div>
            </header>
            <div class="toggle-grid">
              <label nz-checkbox [ngModel]="toggles.variableRate()" (ngModelChange)="setToggle('variableRate', $event)" [ngModelOptions]="{ standalone: true }" i18n="@@bank_programs.toggle.variable_rate">Variable-rate program</label>
              <label nz-checkbox [ngModel]="toggles.incomeSurrogate()" (ngModelChange)="setToggle('incomeSurrogate', $event)" [ngModelOptions]="{ standalone: true }" i18n="@@bank_programs.toggle.income_surrogate">Income-surrogate program</label>
              <label nz-checkbox [ngModel]="toggles.tieredRates()" (ngModelChange)="setToggle('tieredRates', $event)" [ngModelOptions]="{ standalone: true }" i18n="@@bank_programs.toggle.tiered_rates">Tiered interest rates (by loan amount)</label>
              <label nz-checkbox [ngModel]="toggles.buyout()" (ngModelChange)="setToggle('buyout', $event)" [ngModelOptions]="{ standalone: true }" i18n="@@bank_programs.toggle.buyout">Buyout / refinance program</label>
              @if (downPaymentApplicable()) {
                <label nz-checkbox [ngModel]="toggles.downPayment()" (ngModelChange)="setToggle('downPayment', $event)" [ngModelOptions]="{ standalone: true }" i18n="@@bank_programs.toggle.down_payment">Requires down payment</label>
              }
              <label nz-checkbox [ngModel]="toggles.shariaCompliant()" (ngModelChange)="setToggle('shariaCompliant', $event)" [ngModelOptions]="{ standalone: true }" i18n="@@bank_programs.toggle.sharia">Sharia-compliant (Islamic)</label>
            </div>
          </section>

          <!-- ═══ VARIABLE RATE ═════════════════════════════════════════════ -->
          @if (toggles.variableRate()) {
            <section class="card" formGroupName="pricing">
              <header class="card-head">
                <div>
                  <h2 class="card-title" i18n="@@bank_programs.section.variable_rate">Variable rate</h2>
                  <p class="card-sub" i18n="@@bank_programs.section.variable_rate_sub">CBE-linked or quarterly-reset programs.</p>
                </div>
              </header>
              <div class="grid">
                <nz-form-item class="span-2">
                  <label nz-checkbox formControlName="isVariableRate" i18n="@@bank_programs.field.is_variable_rate">Variable rate (CBE-linked, quarterly reset)</label>
                </nz-form-item>
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
              </div>
            </section>
          }

          <!-- ═══ INCOME-SURROGATE ══════════════════════════════════════════ -->
          @if (toggles.incomeSurrogate()) {
            <app-income-assumption-section [group]="incomeAssumptionGroup"></app-income-assumption-section>
          }

          <!-- ═══ TIERED RATES (by loan amount band) ═══════════════════════ -->
          @if (toggles.tieredRates()) {
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
            </section>
          }

          <!-- ═══ BUYOUT / REFINANCE ═══════════════════════════════════════ -->
          @if (toggles.buyout()) {
            <section class="card" formGroupName="pricing">
              <header class="card-head">
                <div>
                  <h2 class="card-title" i18n="@@bank_programs.section.buyout">Buyout / refinance</h2>
                  <p class="card-sub" i18n="@@bank_programs.section.buyout_sub">Closing out a loan at another bank. Applies a delta vs the base rate, bounded by a floor.</p>
                </div>
              </header>
              <div class="grid">
                <nz-form-item>
                  <nz-form-label i18n="@@bank_programs.field.buyout_delta">Buyout rate delta</nz-form-label>
                  <nz-form-control [nzErrorTip]="fieldErrorTpl">
                    <nz-input-group nzAddOnAfter="%" class="rate-group">
                      <input nz-input formControlName="buyoutRateDeltaPercent" inputmode="decimal" placeholder="-1.5000" />
                    </nz-input-group>
                  </nz-form-control>
                </nz-form-item>
                <nz-form-item>
                  <nz-form-label i18n="@@bank_programs.field.buyout_floor">Minimum floor rate</nz-form-label>
                  <nz-form-control [nzErrorTip]="fieldErrorTpl">
                    <nz-input-group nzAddOnAfter="%" class="rate-group">
                      <input nz-input formControlName="buyoutRateMinFloorPercent" inputmode="decimal" placeholder="22.0000" />
                    </nz-input-group>
                  </nz-form-control>
                </nz-form-item>
              </div>
            </section>
          }

          <!-- ═══ DOWN PAYMENT ═════════════════════════════════════════════ -->
          @if (toggles.downPayment() && downPaymentApplicable()) {
            <section class="card" formGroupName="loanLimits">
              <header class="card-head">
                <div>
                  <h2 class="card-title" i18n="@@bank_programs.section.down_payment">Down payment</h2>
                  <p class="card-sub" i18n="@@bank_programs.section.down_payment_sub">Mandatory for auto + mortgage programs. LTV ceiling caps the financed share of asset value.</p>
                </div>
              </header>
              <div class="grid">
                <nz-form-item>
                  <nz-form-label i18n="@@bank_programs.field.min_down_payment">Minimum down payment</nz-form-label>
                  <nz-form-control [nzErrorTip]="fieldErrorTpl">
                    <nz-input-group nzAddOnAfter="%" class="rate-group">
                      <input nz-input formControlName="minDownPaymentPercent" inputmode="decimal" placeholder="20.00" />
                    </nz-input-group>
                  </nz-form-control>
                </nz-form-item>
                <nz-form-item>
                  <nz-form-label i18n="@@bank_programs.field.max_ltv">Maximum LTV</nz-form-label>
                  <nz-form-control [nzErrorTip]="fieldErrorTpl">
                    <nz-input-group nzAddOnAfter="%" class="rate-group">
                      <input nz-input formControlName="ltvCeilingPercent" inputmode="decimal" placeholder="80.0000" />
                    </nz-input-group>
                  </nz-form-control>
                </nz-form-item>
              </div>
            </section>
          }

          <!-- ═══ SHARIA / ISLAMIC ═════════════════════════════════════════ -->
          @if (toggles.shariaCompliant()) {
            <section class="card" formGroupName="pricing">
              <header class="card-head">
                <div>
                  <h2 class="card-title" i18n="@@bank_programs.section.sharia">Sharia-compliant (Islamic)</h2>
                  <p class="card-sub" i18n="@@bank_programs.section.sharia_sub">Profit-rate pricing under an Islamic contract. Rate fields above are interpreted as profit rates, not interest.</p>
                </div>
              </header>
              <div class="grid">
                <nz-form-item>
                  <nz-form-label i18n="@@bank_programs.field.sharia_contract_type">Contract type</nz-form-label>
                  <nz-form-control [nzErrorTip]="fieldErrorTpl">
                    <nz-select formControlName="shariaContractType" [nzDropdownStyle]="dropdownStyle">
                      <nz-option nzValue="murabaha" nzLabel="Murabaha" i18n-nzLabel="@@bank_programs.contract.murabaha"></nz-option>
                      <nz-option nzValue="ijara" nzLabel="Ijara" i18n-nzLabel="@@bank_programs.contract.ijara"></nz-option>
                      <nz-option nzValue="tawarruq" nzLabel="Tawarruq" i18n-nzLabel="@@bank_programs.contract.tawarruq"></nz-option>
                    </nz-select>
                  </nz-form-control>
                </nz-form-item>
              </div>
            </section>
          }
          }

          <footer class="form-footer">
            <button nz-button type="button" (click)="cancel()" [disabled]="busy()">
              <span i18n="@@bank_programs.form.cancel">Cancel</span>
            </button>
            <span class="footer-spacer"></span>
            @if (currentStep() > 1) {
              <button nz-button type="button" (click)="back()" [disabled]="busy()">
                <span i18n="@@bank_programs.form.back">Back</span>
              </button>
            }
            @if (currentStep() < steps.length) {
              <button
                nz-button
                nzType="primary"
                type="button"
                (click)="next()"
                [disabled]="busy() || enums.unavailable()"
              >
                <span i18n="@@bank_programs.form.next">Next</span>
              </button>
            } @else {
              <button
                nz-button
                nzType="primary"
                type="button"
                (click)="submit()"
                [disabled]="form.invalid || busy() || enums.unavailable()"
                [nzLoading]="busy()"
              >
                <span *ngIf="!busy()" nz-icon [nzType]="isEditMode() ? 'save' : 'plus'" nzTheme="outline" aria-hidden="true"></span>
                <span *ngIf="!busy()">{{ isEditMode() ? saveLabel() : createLabel() }}</span>
                <span *ngIf="busy()" i18n="@@bank_programs.form.saving">Saving…</span>
              </button>
            }
          </footer>
        </form>
      </ng-template>
    </section>
  `,
  styles: [
    `
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
      .flag-grid {
        display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-2) var(--space-4);
      }
      .toggle-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-3);
      }
      @media (max-width: 720px) {
        .toggle-grid { grid-template-columns: minmax(0, 1fr); }
      }

      /* Each ng-zorro checkbox wrapper becomes a clickable tile. */
      .toggle-grid :where(.ant-checkbox-wrapper) {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        margin: 0;
        padding: 14px 16px;
        background: var(--bg-surface, var(--color-surface-default));
        border: 1px solid var(--border-default, var(--color-border-default));
        border-radius: var(--radius-lg, 12px);
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary, var(--color-text-primary));
        transition:
          background-color 160ms cubic-bezier(0.4, 0, 0.2, 1),
          border-color 160ms cubic-bezier(0.4, 0, 0.2, 1),
          box-shadow 160ms cubic-bezier(0.4, 0, 0.2, 1),
          transform 160ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .toggle-grid :where(.ant-checkbox-wrapper):hover {
        border-color: color-mix(in oklab, var(--primary, var(--color-brand-primary)) 50%, var(--border-default));
        background: var(--bg-subtle, var(--color-surface-row-hover));
        transform: translateY(-1px);
        box-shadow: 0 1px 3px color-mix(in oklab, var(--primary, var(--color-brand-primary)) 10%, transparent);
      }
      .toggle-grid :where(.ant-checkbox-wrapper):focus-within {
        border-color: var(--primary, var(--color-brand-primary));
        box-shadow: var(--focus-halo);
      }
      .toggle-grid :where(.ant-checkbox-wrapper-checked) {
        border-color: var(--primary, var(--color-brand-primary));
        background: color-mix(in oklab, var(--primary, var(--color-brand-primary)) 7%, var(--bg-surface));
        color: var(--primary, var(--color-brand-primary));
        font-weight: 600;
      }
      .toggle-grid :where(.ant-checkbox-wrapper-checked):hover {
        background: color-mix(in oklab, var(--primary, var(--color-brand-primary)) 11%, var(--bg-surface));
      }
      .toggle-grid :where(.ant-checkbox-wrapper) :where(.ant-checkbox) {
        margin: 0;
        flex-shrink: 0;
        top: 0;
      }
      .toggle-grid :where(.ant-checkbox-wrapper) :where(.ant-checkbox + span) {
        padding: 0;
        line-height: 1.3;
      }
      .toggle-grid :where(.ant-checkbox-inner) {
        inline-size: 18px;
        block-size: 18px;
        border-radius: 5px;
        border-color: var(--border-strong, var(--border-default));
        transition: background-color 140ms cubic-bezier(0.4, 0, 0.2, 1),
          border-color 140ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      @media (prefers-reduced-motion: reduce) {
        .toggle-grid :where(.ant-checkbox-wrapper) { transition: none !important; }
        .toggle-grid :where(.ant-checkbox-wrapper):hover { transform: none !important; }
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
      .template-card .tpl-grid {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: var(--space-3);
      }
      .tpl {
        appearance: none; cursor: pointer;
        background: var(--bg-subtle, var(--color-surface-row-hover));
        border: 1px solid var(--border-default, var(--color-border-default));
        border-radius: var(--radius-md);
        padding: var(--space-3) var(--space-4);
        display: flex; flex-direction: column; gap: 4px;
        text-align: start;
        transition: border-color 200ms ease, box-shadow 200ms ease, transform 200ms ease;
      }
      .tpl:hover { border-color: var(--primary, var(--color-brand-primary)); transform: translateY(-1px); }
      .tpl.selected {
        border-color: var(--primary, var(--color-brand-primary));
        background: var(--accent-subtle, var(--color-tonal-accent-bg));
      }
      .tpl-name { font-weight: 700; color: var(--text-primary, var(--color-text-primary)); font-size: var(--text-sm); }
      .tpl-desc { color: var(--text-tertiary, var(--color-text-tertiary)); font-size: var(--text-xs); }
      .placeholder { background: var(--bg-subtle, var(--color-surface-row-hover)); }
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

  readonly busy = signal(false);
  readonly advancedFeesOpen = signal(false);
  readonly dropdownStyle: Record<string, string> = { 'max-height': '360px', 'min-height': '120px' };
  readonly activeBanks = signal<BankWithProgramCount[]>([]);
  readonly selectedBankId = signal<string | null>(null);

  // Wizard state
  readonly currentStep = signal<number>(1);
  readonly steps: ReadonlyArray<{ id: number; label: string }> = [
    { id: 1, label: 'Identity' },
    { id: 2, label: 'Money' },
    { id: 3, label: 'Eligibility' },
    { id: 4, label: 'Features' },
  ];

  next(): void {
    if (this.currentStep() >= this.steps.length) return;
    if (!this.isCurrentStepValid()) {
      this.flushCurrentStepErrors();
      return;
    }
    this.currentStep.set(this.currentStep() + 1);
  }

  /** Form groups that must be valid before leaving the current step. */
  private currentStepGroups(): FormGroup[] {
    const s = this.currentStep();
    if (s === 1) return [this.identityGroup];
    if (s === 2) return [this.loanLimitsGroup, this.tenorGroup, this.pricingGroup, this.feesGroup];
    if (s === 3) return [this.eligibilityGroup];
    return [];
  }
  private isCurrentStepValid(): boolean {
    return this.currentStepGroups().every((g) => g.valid);
  }
  private flushCurrentStepErrors(): void {
    for (const g of this.currentStepGroups()) {
      g.markAllAsTouched();
      // Walk each child control + force a status emission so nz-form-control
      // re-renders its tip.
      for (const ctrl of Object.values(g.controls)) {
        ctrl.markAsTouched();
        ctrl.markAsDirty();
        ctrl.updateValueAndValidity({ onlySelf: true });
      }
      g.updateValueAndValidity();
    }
  }
  back(): void {
    if (this.currentStep() > 1) this.currentStep.set(this.currentStep() - 1);
  }
  goTo(step: number): void {
    if (step >= 1 && step <= this.steps.length) this.currentStep.set(step);
  }
  clearBank(): void {
    this.selectedBankId.set(null);
    this.identityGroup.patchValue({ bankName: '' });
  }
  initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }

  readonly toggles = {
    tieredRates: signal(false),
    incomeSurrogate: signal(false),
    variableRate: signal(false),
    buyout: signal(false),
    downPayment: signal(false),
    shariaCompliant: signal(false),
  } as const;


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
  readonly editTitle = signal($localize`:@@bank_programs.form.title_edit:Edit bank program`);
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

  readonly form = this.fb.nonNullable.group({
    identity: this.fb.nonNullable.group({
      programCode: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(3), Validators.maxLength(32)],
      }),
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
    }),
    tenor: this.fb.nonNullable.group({
      minMonths: new FormControl(12, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(1), Validators.max(600)],
      }),
      maxMonths: new FormControl(60, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(1), Validators.max(600)],
      }),
    }),
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
      minDownPaymentPercent: new FormControl<string | null>(null),
      ltvCeilingPercent: new FormControl<string | null>(null),
    }),
    pricing: this.fb.nonNullable.group({
      isVariableRate: new FormControl(false, { nonNullable: true }),
      baseRatePercent: new FormControl<string | null>('24.0000'),
      currentEffectiveRatePercent: new FormControl<string | null>(null),
      variableRateNote: new FormControl<string | null>(null),
      buyoutRateDeltaPercent: new FormControl<string | null>(null),
      buyoutRateMinFloorPercent: new FormControl<string | null>(null),
      shariaContractType: new FormControl<string | null>(null),
      rateByLoanAmountBands: new FormArray<FormGroup>([]),
    }),
    eligibility: this.fb.nonNullable.group({
      acceptedEmploymentTypes: this.fb.nonNullable.array<string>(['salaried'], {
        validators: [Validators.required],
      }),
      acceptedLoanPurposes: this.fb.nonNullable.array<string>(['personal'], {
        validators: [Validators.required],
      }),
      acceptedTransferTypes: this.fb.nonNullable.array<string>(
        ['payroll_cat_a', 'payroll_cat_b', 'payroll_cat_c'],
        { validators: [Validators.required] },
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
      requiredDocuments: this.fb.nonNullable.array<string>([]),
      operatorNotes: new FormControl<string | null>(null),
      operatorTips: this.fb.nonNullable.array<string>([]),
    }),
  });

  get identityGroup(): FormGroup { return this.form.controls.identity as FormGroup; }
  get tenorGroup(): FormGroup { return this.form.controls.tenor as FormGroup; }
  get loanLimitsGroup(): FormGroup { return this.form.controls.loanLimits as FormGroup; }
  get pricingGroup(): FormGroup { return this.form.controls.pricing as FormGroup; }
  get eligibilityGroup(): FormGroup { return this.form.controls.eligibility as FormGroup; }
  get incomeAssumptionGroup(): FormGroup { return this.form.controls.incomeAssumption as FormGroup; }
  get feesGroup(): FormGroup { return this.form.controls.fees as FormGroup; }
  get documentsGroup(): FormGroup { return this.form.controls.documents as FormGroup; }

  // Live array views for nz-select [ngModel] bindings
  readonly employmentArr = signal<string[]>(['salaried']);
  readonly transferArr = signal<string[]>(['payroll_cat_a', 'payroll_cat_b', 'payroll_cat_c']);
  readonly docsArr = signal<string[]>([]);
  readonly currenciesArrValue = signal<string[]>(['EGP']);

  // Reactive view of identity.productCategory so the template + effects react.
  readonly productCategorySignal = toSignal(
    this.form.controls.identity.controls.productCategory.valueChanges,
    { initialValue: this.form.controls.identity.controls.productCategory.value },
  );
  /** Down-payment toggle only applies to auto + mortgage. Personal loans never have one. */
  readonly downPaymentApplicable = computed(() => {
    const c = this.productCategorySignal();
    return c === 'car' || c === 'mortgage';
  });

  constructor() {
    // Reset hidden sections when toggle flips off — keeps payload clean per requirement
    effect(() => {
      if (!this.toggles.variableRate()) {
        this.pricingGroup.patchValue(
          { isVariableRate: false, currentEffectiveRatePercent: null, variableRateNote: null },
          { emitEvent: false },
        );
      }
    });
    effect(() => {
      if (!this.toggles.incomeSurrogate()) {
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
      if (!this.toggles.buyout()) {
        this.pricingGroup.patchValue(
          { buyoutRateDeltaPercent: null, buyoutRateMinFloorPercent: null },
          { emitEvent: false },
        );
      }
    });
    effect(() => {
      if (!this.toggles.downPayment()) {
        this.loanLimitsGroup.patchValue(
          { minDownPaymentPercent: null, ltvCeilingPercent: null },
          { emitEvent: false },
        );
      }
    });
    // Auto-disable down-payment toggle when productCategory switches to
    // personal — personal loans never carry a down payment.
    effect(() => {
      if (!this.downPaymentApplicable() && this.toggles.downPayment()) {
        this.toggles.downPayment.set(false);
      }
    });
    effect(() => {
      if (!this.toggles.tieredRates()) {
        this.rateBandsArray.clear();
      }
    });
    effect(() => {
      if (!this.toggles.shariaCompliant()) {
        this.pricingGroup.patchValue(
          { shariaContractType: null },
          { emitEvent: false },
        );
      }
    });
  }

  ngOnInit(): void {
    this.enums.preload([
      'salary_category',
      'transfer_type',
      'employment_type',
      'loan_purpose',
      'property_type',
      'city_tier',
      'product_category',
      'currency',
      'required_document',
      'customer_program_tier',
    ]);

    // Mirror form-arrays into signals for nz-select [ngModel] binding
    this.syncArr(this.identityGroup.get('currencies'), this.currenciesArrValue);
    this.syncArr(this.eligibilityGroup.get('acceptedEmploymentTypes'), this.employmentArr);
    this.syncArr(this.eligibilityGroup.get('acceptedTransferTypes'), this.transferArr);
    this.syncArr(this.documentsGroup.get('requiredDocuments'), this.docsArr);

    void this.loadActiveBanks();

    if (this.isEditMode() && this.editProgramCode()) {
      void this.loadForEdit(this.editProgramCode());
    }
  }

  private async loadActiveBanks(): Promise<void> {
    try {
      const res = await this.banksApi.list({ pageSize: 100, active: true });
      this.activeBanks.set(res.data);
      // Preselect bank from ?bank=<nameEnglish> query (passed from atlas "Add to {Bank}" CTA).
      const preName = this.route.snapshot.queryParamMap.get('bank');
      if (preName && !this.selectedBankId()) {
        const match = res.data.find((b) => b.nameEnglish === preName);
        if (match) this.onBankPicked(match.id);
      }
    } catch {
      // dropdown stays empty; user can retry by reloading
    }
  }

  protected get preselectedBank() {
    const id = this.selectedBankId();
    if (!id) return null;
    return this.activeBanks().find((b) => b.id === id) ?? null;
  }

  onBankPicked(bankId: string | null): void {
    this.selectedBankId.set(bankId ?? null);
    const bank = this.activeBanks().find((b) => b.id === bankId);
    this.identityGroup.patchValue({
      bankName: bank?.nameEnglish ?? '',
    });
  }

  retryEnums(): void {
    this.enums.clear();
    this.enums.preload([
      'salary_category',
      'transfer_type',
      'employment_type',
      'loan_purpose',
      'product_category',
      'currency',
      'required_document',
      'customer_program_tier',
    ]);
  }

  setToggle(key: ToggleKey, value: boolean): void {
    this.toggles[key].set(value);
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
    const arr = this.form.get(path) as FormArray;
    arr.clear({ emitEvent: false });
    for (const v of values) arr.push(new FormControl(String(v), { nonNullable: true }), { emitEvent: false });
    arr.updateValueAndValidity();
  }

  private syncArr(ctl: ReturnType<FormGroup['get']>, sig: ReturnType<typeof signal<string[]>>): void {
    if (!ctl) return;
    sig.set((ctl.value as string[]) ?? []);
    ctl.valueChanges.subscribe((v) => sig.set((v as string[]) ?? []));
  }

  cancel(): void {
    if (this.busy()) return;
    void this.router.navigate(['/bank-programs']);
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    try {
      if (this.isEditMode()) {
        const payload = this.buildUpdatePayload();
        const res = await this.api.update(this.currentProgramCode, payload);
        this.message.success($localize`:@@bank_programs.form.updated:Bank program updated.`, { nzDuration: 4000 });
        void this.router.navigate(['/bank-programs', res.data.programCode]);
      } else {
        const payload = this.buildCreatePayload();
        const res = await this.api.create(payload);
        this.message.success($localize`:@@bank_programs.form.created:Bank program created.`, { nzDuration: 4000 });
        void this.router.navigate(['/bank-programs', res.data.programCode]);
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

  private autodetectToggles(d: BankProgramResponse): void {
    this.toggles.variableRate.set(d.pricing.isVariableRate);
    this.toggles.incomeSurrogate.set(d.incomeAssumption.strategy !== 'declared');
    this.toggles.shariaCompliant.set(d.isShariaCompliant === true);
    this.toggles.tieredRates.set(
      d.pricing.rateByLoanAmountBand != null &&
        Object.keys(d.pricing.rateByLoanAmountBand).length > 0,
    );
    this.toggles.buyout.set(
      d.pricing.buyoutRateDeltaPercent != null || d.pricing.buyoutRateMinFloorPercent != null,
    );
    this.toggles.downPayment.set(
      d.loanLimits.minDownPaymentPercent != null || d.loanLimits.ltvCeilingPercent != null,
    );
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
      programCode: id.programCode,
      bankName: id.bankName,
      ...(this.selectedBankId() ? { bankId: this.selectedBankId()! } : {}),
      friendlyName: id.friendlyName,
      friendlyNameAr: id.friendlyNameAr ?? undefined,
      programType: id.programType,
      productCategory: id.productCategory,
      currencies: id.currencies,
      isShariaCompliant: this.toggles.shariaCompliant(),
      operatorNotes: dc.operatorNotes ?? undefined,
      operatorTips: dc.operatorTips,
      requiredDocuments: dc.requiredDocuments,
      tenor: { minMonths: tn.minMonths, maxMonths: tn.maxMonths },
      loanLimits: {
        perCurrency: { EGP: { minAmount: ll.minAmountEGP, maxAmount: ll.maxAmountEGP } },
        qualitativeReviewMaxEGP: ll.qualitativeReviewMaxEGP ?? undefined,
        minDownPaymentPercent: this.toggles.downPayment() ? (ll.minDownPaymentPercent ?? undefined) : undefined,
        ltvCeilingPercent: this.toggles.downPayment() ? (ll.ltvCeilingPercent ?? undefined) : undefined,
      },
      pricing: {
        isVariableRate: pr.isVariableRate,
        baseRatePercent: pr.isVariableRate ? undefined : (pr.baseRatePercent ?? undefined),
        currentEffectiveRatePercent: pr.isVariableRate ? (pr.currentEffectiveRatePercent ?? undefined) : undefined,
        variableRateNote: pr.variableRateNote ?? undefined,
        buyoutRateDeltaPercent: this.toggles.buyout() ? (pr.buyoutRateDeltaPercent ?? undefined) : undefined,
        buyoutRateMinFloorPercent: this.toggles.buyout() ? (pr.buyoutRateMinFloorPercent ?? undefined) : undefined,
        shariaContractType: this.toggles.shariaCompliant()
          ? ((pr.shariaContractType as 'murabaha' | 'ijara' | 'tawarruq' | null) ?? undefined)
          : undefined,
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
        acceptedLoanPurposes: el.acceptedLoanPurposes,
        dbrCapPercent: el.dbrCapPercent,
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
    this.identityGroup.patchValue({
      programCode: initial.programCode,
      bankName: initial.bankName,
      friendlyName: initial.friendlyName,
      friendlyNameAr: initial.friendlyNameAr ?? null,
      programType: initial.programType,
      productCategory: initial.productCategory,
    });
    this.identityGroup.get('programCode')?.disable();
    if (initial.bankId) this.selectedBankId.set(initial.bankId);
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

    if (code === 'PROGRAM_CODE_ALREADY_IN_USE') {
      this.identityGroup.get('programCode')?.setErrors({ duplicate: true });
    }
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
