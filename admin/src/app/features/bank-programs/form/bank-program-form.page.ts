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
} from '@ant-design/icons-angular/icons';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ErrorCodeService } from '../../../core/errors/error-code.service';
import { PlatformEnumerationsService } from '../../../core/platform-enumerations/platform-enumerations.service';
import { BankProgramsApiService } from '../bank-programs.api.service';
import type {
  BankProgramCreatePayload,
  BankProgramResponse,
  BankProgramUpdatePayload,
  IncomeAssumptionStrategy,
  ProgramType,
} from '../bank-programs.types';
import { PerformanceCriteriaSectionComponent } from './sections/performance-criteria-section.component';
import { IncomeAssumptionSectionComponent } from './sections/income-assumption-section.component';

type ToggleKey =
  | 'tieredRates'
  | 'incomeSurrogate'
  | 'variableRate'
  | 'buyout'
  | 'downPayment'
  | 'specialEligibility'
  | 'performance'
  | 'multiCurrency';

type TemplateId =
  | 'simple_personal'
  | 'income_surrogate'
  | 'auto_down_payment'
  | 'variable_rate';

interface TemplateDef {
  id: TemplateId;
  name: string;
  desc: string;
  productCategory: 'personal' | 'car' | 'mortgage';
  toggles: Partial<Record<ToggleKey, boolean>>;
}

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
    PerformanceCriteriaSectionComponent,
    IncomeAssumptionSectionComponent,
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
        <form [formGroup]="form" (ngSubmit)="submit()" class="form-body">

          @if (!isEditMode()) {
            <section class="card template-card">
              <header class="card-head">
                <span class="card-icon" nz-icon nzType="thunderbolt" nzTheme="outline" aria-hidden="true"></span>
                <div>
                  <h2 class="card-title" i18n="@@bank_programs.form.tpl.title">Start from template</h2>
                  <p class="card-sub" i18n="@@bank_programs.form.tpl.sub">
                    Pick a starting point — adjust anything afterward.
                  </p>
                </div>
              </header>
              <div class="tpl-grid">
                @for (t of templates; track t.id) {
                  <button
                    type="button"
                    class="tpl"
                    [class.selected]="activeTemplate() === t.id"
                    (click)="applyTemplate(t)"
                  >
                    <span class="tpl-name">{{ t.name }}</span>
                    <span class="tpl-desc">{{ t.desc }}</span>
                  </button>
                }
              </div>
            </section>
          }

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
                <nz-form-control>
                  <input nz-input id="programCode" formControlName="programCode" placeholder="ABK-PAYROLL-CAT-A" />
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label [nzFor]="'bankName'" nzRequired i18n="@@bank_programs.field.bank_name">Bank name</nz-form-label>
                <nz-form-control>
                  <input nz-input id="bankName" formControlName="bankName" />
                </nz-form-control>
              </nz-form-item>
              <nz-form-item class="span-2">
                <nz-form-label [nzFor]="'friendlyName'" nzRequired i18n="@@bank_programs.field.friendly_name">Program name</nz-form-label>
                <nz-form-control>
                  <input nz-input id="friendlyName" formControlName="friendlyName" />
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label [nzFor]="'productCategory'" nzRequired i18n="@@bank_programs.field.product_type">Product type</nz-form-label>
                <nz-form-control>
                  <nz-select id="productCategory" formControlName="productCategory" [nzDropdownStyle]="dropdownStyle">
                    <nz-option nzValue="personal" nzLabel="Personal" i18n-nzLabel="@@product.personal"></nz-option>
                    <nz-option nzValue="car" nzLabel="Car" i18n-nzLabel="@@product.car"></nz-option>
                    <nz-option nzValue="mortgage" nzLabel="Mortgage" i18n-nzLabel="@@product.mortgage"></nz-option>
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label [nzFor]="'programType'" i18n="@@bank_programs.field.program_type">Program type</nz-form-label>
                <nz-form-control>
                  <nz-select id="programType" formControlName="programType" [nzDropdownStyle]="dropdownStyle">
                    <nz-option nzValue="income_proof" nzLabel="Income-proof" i18n-nzLabel="@@program_type.proof"></nz-option>
                    <nz-option nzValue="income_surrogate" nzLabel="Income-surrogate" i18n-nzLabel="@@program_type.surrogate"></nz-option>
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
            </div>
          </section>

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
                <nz-form-label [nzFor]="'minAmountEGP'" i18n="@@bank_programs.field.min_amount">Minimum amount</nz-form-label>
                <nz-form-control>
                  <nz-input-group nzAddOnBefore="EGP" class="money-group">
                    <input nz-input id="minAmountEGP" formControlName="minAmountEGP" inputmode="decimal" placeholder="50,000" />
                  </nz-input-group>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label [nzFor]="'maxAmountEGP'" i18n="@@bank_programs.field.max_amount">Maximum amount</nz-form-label>
                <nz-form-control>
                  <nz-input-group nzAddOnBefore="EGP" class="money-group">
                    <input nz-input id="maxAmountEGP" formControlName="maxAmountEGP" inputmode="decimal" placeholder="1,500,000" />
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
                <nz-form-label [nzFor]="'minMonths'" i18n="@@bank_programs.field.min_months">Minimum months</nz-form-label>
                <nz-form-control>
                  <nz-input-number id="minMonths" class="num-field" formControlName="minMonths" [nzMin]="1" [nzMax]="600" [nzStep]="1" [nzPrecision]="0"></nz-input-number>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label [nzFor]="'maxMonths'" i18n="@@bank_programs.field.max_months">Maximum months</nz-form-label>
                <nz-form-control>
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
                <nz-form-label [nzFor]="'baseRatePercent'" i18n="@@bank_programs.field.base_rate">Base rate</nz-form-label>
                <nz-form-control>
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
                <nz-form-label [nzFor]="'adminFeePercent2'" i18n="@@bank_programs.field.admin_fee">Admin fee</nz-form-label>
                <nz-form-control>
                  <nz-input-group nzAddOnAfter="%" class="rate-group">
                    <input nz-input id="adminFeePercent2" formControlName="adminFeePercent" inputmode="decimal" placeholder="1.0000" />
                  </nz-input-group>
                </nz-form-control>
              </nz-form-item>
            </div>
          </section>

          <section class="card" formGroupName="eligibility">
            <header class="card-head">
              <div>
                <h2 class="card-title" i18n="@@bank_programs.form.eligibility_core.title">Eligibility</h2>
                <p class="card-sub" i18n="@@bank_programs.form.eligibility_core.sub">Who qualifies — age, income, employment.</p>
              </div>
            </header>
            <div class="grid">
              <nz-form-item>
                <nz-form-label [nzFor]="'ageMin'" i18n="@@bank_programs.field.age_min">Minimum age</nz-form-label>
                <nz-form-control>
                  <nz-input-number id="ageMin" class="num-field" formControlName="ageMin" [nzMin]="18" [nzMax]="80" [nzStep]="1" [nzPrecision]="0"></nz-input-number>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label [nzFor]="'ageMax'" i18n="@@bank_programs.field.age_max">Maximum age</nz-form-label>
                <nz-form-control>
                  <nz-input-number id="ageMax" class="num-field" formControlName="ageMax" [nzMin]="18" [nzMax]="80" [nzStep]="1" [nzPrecision]="0"></nz-input-number>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label [nzFor]="'minMonthlyIncomeEGP'" i18n="@@bank_programs.field.min_income">Minimum monthly income</nz-form-label>
                <nz-form-control>
                  <nz-input-group nzAddOnBefore="EGP" class="money-group">
                    <input nz-input id="minMonthlyIncomeEGP" formControlName="minMonthlyIncomeEGP" inputmode="decimal" placeholder="5,000" />
                  </nz-input-group>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label [nzFor]="'minMonthsInJob'" i18n="@@bank_programs.field.min_months_job">Minimum months in job</nz-form-label>
                <nz-form-control>
                  <nz-input-number id="minMonthsInJob" class="num-field" formControlName="minMonthsInJob" [nzMin]="0" [nzMax]="240" [nzStep]="1" [nzPrecision]="0"></nz-input-number>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item class="span-2">
                <nz-form-label i18n="@@bank_programs.field.accepted_employment">Accepted employment types</nz-form-label>
                <nz-form-control>
                  <nz-select [ngModel]="employmentArr()" (ngModelChange)="setArr('eligibility.acceptedEmploymentTypes', $event)" [ngModelOptions]="{ standalone: true }" nzMode="multiple" nzPlaceHolder="Pick one or more" [nzDropdownStyle]="dropdownStyle">
                    @for (o of employmentOptions(); track o.value) {
                      <nz-option [nzValue]="o.value" [nzLabel]="o.label"></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item class="span-2">
                <nz-form-label i18n="@@bank_programs.field.accepted_transfer">Accepted transfer types</nz-form-label>
                <nz-form-control>
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
                <nz-form-control>
                  <nz-select [ngModel]="docsArr()" (ngModelChange)="setArr('documents.requiredDocuments', $event)" [ngModelOptions]="{ standalone: true }" nzMode="multiple" nzPlaceHolder="Pick required documents">
                    @for (o of documentOptions(); track o.value) {
                      <nz-option [nzValue]="o.value" [nzLabel]="o.label"></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
              <nz-form-item class="span-2">
                <nz-form-label [nzFor]="'operatorNotes'" i18n="@@bank_programs.field.notes">Notes</nz-form-label>
                <nz-form-control>
                  <textarea nz-input id="operatorNotes" formControlName="operatorNotes" rows="3" placeholder="Operator-facing notes (optional)"></textarea>
                </nz-form-control>
              </nz-form-item>
            </div>
          </section>

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
                    <nz-form-label i18n="@@bank_programs.field.stamp_duty">Stamp duty</nz-form-label>
                    <nz-form-control>
                      <nz-input-group nzAddOnAfter="%" class="rate-group">
                        <input nz-input formControlName="stampDutyPercent" inputmode="decimal" placeholder="0.5000" />
                      </nz-input-group>
                    </nz-form-control>
                  </nz-form-item>
                  <nz-form-item>
                    <nz-form-label i18n="@@bank_programs.field.life_insurance">Life insurance</nz-form-label>
                    <nz-form-control>
                      <nz-input-group nzAddOnAfter="%" class="rate-group">
                        <input nz-input formControlName="lifeInsurancePercent" inputmode="decimal" placeholder="0.5000" />
                      </nz-input-group>
                    </nz-form-control>
                  </nz-form-item>
                  <nz-form-item class="span-2">
                    <label nz-checkbox formControlName="lifeInsuranceMandatory" i18n="@@bank_programs.field.life_insurance_mandatory">Life insurance mandatory</label>
                  </nz-form-item>
                  <nz-form-item>
                    <nz-form-label i18n="@@bank_programs.field.late_fee">Late payment fee</nz-form-label>
                    <nz-form-control>
                      <nz-input-group nzAddOnAfter="%" class="rate-group">
                        <input nz-input formControlName="latePaymentFeePercent" inputmode="decimal" placeholder="4.0000" />
                      </nz-input-group>
                    </nz-form-control>
                  </nz-form-item>
                  <nz-form-item>
                    <nz-form-label i18n="@@bank_programs.field.payoff_cash">Payoff (cash)</nz-form-label>
                    <nz-form-control>
                      <nz-input-group nzAddOnAfter="%" class="rate-group">
                        <input nz-input formControlName="payoffCashPercent" inputmode="decimal" placeholder="12.0000" />
                      </nz-input-group>
                    </nz-form-control>
                  </nz-form-item>
                  <nz-form-item>
                    <nz-form-label i18n="@@bank_programs.field.payoff_buyout">Payoff (buyout)</nz-form-label>
                    <nz-form-control>
                      <nz-input-group nzAddOnAfter="%" class="rate-group">
                        <input nz-input formControlName="payoffBuyoutPercent" inputmode="decimal" placeholder="15.0000" />
                      </nz-input-group>
                    </nz-form-control>
                  </nz-form-item>
                </div>
                <div class="grid" formGroupName="eligibility">
                  <nz-form-item>
                    <nz-form-label i18n="@@bank_programs.field.dbr_cap">DBR cap</nz-form-label>
                    <nz-form-control>
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
                    <nz-form-control>
                      <nz-input-group nzAddOnBefore="EGP" class="money-group">
                        <input nz-input formControlName="qualitativeReviewMaxEGP" inputmode="decimal" placeholder="Only with Special Eligibility → requiresQualitativeReview" />
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
              <label nz-checkbox [ngModel]="toggles.tieredRates()" (ngModelChange)="setToggle('tieredRates', $event)" [ngModelOptions]="{ standalone: true }">Tiered interest rates</label>
              <label nz-checkbox [ngModel]="toggles.incomeSurrogate()" (ngModelChange)="setToggle('incomeSurrogate', $event)" [ngModelOptions]="{ standalone: true }">Income-surrogate program</label>
              <label nz-checkbox [ngModel]="toggles.variableRate()" (ngModelChange)="setToggle('variableRate', $event)" [ngModelOptions]="{ standalone: true }">Variable-rate program</label>
              <label nz-checkbox [ngModel]="toggles.buyout()" (ngModelChange)="setToggle('buyout', $event)" [ngModelOptions]="{ standalone: true }">Buyout program</label>
              <label nz-checkbox [ngModel]="toggles.downPayment()" (ngModelChange)="setToggle('downPayment', $event)" [ngModelOptions]="{ standalone: true }">Requires down payment</label>
              <label nz-checkbox [ngModel]="toggles.specialEligibility()" (ngModelChange)="setToggle('specialEligibility', $event)" [ngModelOptions]="{ standalone: true }">Special eligibility requirements</label>
              <label nz-checkbox [ngModel]="toggles.performance()" (ngModelChange)="setToggle('performance', $event)" [ngModelOptions]="{ standalone: true }">Performance criteria</label>
              <label nz-checkbox [ngModel]="toggles.multiCurrency()" (ngModelChange)="setToggle('multiCurrency', $event)" [ngModelOptions]="{ standalone: true }">Multi-currency</label>
            </div>
          </section>

          <!-- ═══ VARIABLE RATE ═════════════════════════════════════════════ -->
          @if (toggles.variableRate()) {
            <section class="card" formGroupName="pricing">
              <header class="card-head">
                <div>
                  <h2 class="card-title">Variable rate</h2>
                  <p class="card-sub">CBE-linked or quarterly-reset programs.</p>
                </div>
              </header>
              <div class="grid">
                <nz-form-item class="span-2">
                  <label nz-checkbox formControlName="isVariableRate" i18n="@@bank_programs.field.is_variable_rate">Variable rate (CBE-linked, quarterly reset)</label>
                </nz-form-item>
                <nz-form-item>
                  <nz-form-label i18n="@@bank_programs.field.current_effective_rate">Current effective rate</nz-form-label>
                  <nz-form-control>
                    <nz-input-group nzAddOnAfter="%" class="rate-group">
                      <input nz-input formControlName="currentEffectiveRatePercent" inputmode="decimal" placeholder="26.5500" />
                    </nz-input-group>
                  </nz-form-control>
                </nz-form-item>
                <nz-form-item class="span-2">
                  <nz-form-label i18n="@@bank_programs.field.variable_rate_note">Disclosure note</nz-form-label>
                  <nz-form-control>
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

          <!-- ═══ PERFORMANCE CRITERIA ═════════════════════════════════════ -->
          @if (toggles.performance()) {
            <app-performance-criteria-section [group]="performanceGroup"></app-performance-criteria-section>
          }

          <!-- ═══ SPECIAL ELIGIBILITY ══════════════════════════════════════ -->
          @if (toggles.specialEligibility()) {
            <section class="card" formGroupName="eligibility">
              <header class="card-head">
                <div>
                  <h2 class="card-title">Special eligibility</h2>
                  <p class="card-sub">Per-program gates (CD-backed, club membership, wealth tier, etc.).</p>
                </div>
              </header>
              <div class="flag-grid">
                <label nz-checkbox formControlName="requiresCD">Requires CD</label>
                <label nz-checkbox formControlName="requiresAutoLoanAtABK">Requires auto loan at ABK</label>
                <label nz-checkbox formControlName="requiresAutoLoanAtOtherBank">Requires auto loan at other bank</label>
                <label nz-checkbox formControlName="requiresCreditCardAtOtherBank">Requires credit card at other bank</label>
                <label nz-checkbox formControlName="requiresCompoundProperty">Requires compound property</label>
                <label nz-checkbox formControlName="requiresCollateral">Requires collateral</label>
                <label nz-checkbox formControlName="requiresClubMembership">Requires club membership</label>
                <label nz-checkbox formControlName="requiresFRMUVerification">Requires FRMU verification</label>
                <label nz-checkbox formControlName="requiresQualitativeReview">Requires qualitative review</label>
                <label nz-checkbox formControlName="requiresNoDocuments">No documents required</label>
              </div>
              <div class="grid">
                <nz-form-item>
                  <nz-form-label>Min bank-statement balance</nz-form-label>
                  <nz-form-control>
                    <nz-input-group nzAddOnBefore="EGP" class="money-group">
                      <input nz-input formControlName="minBankStatementBalanceEGP" inputmode="decimal" />
                    </nz-input-group>
                  </nz-form-control>
                </nz-form-item>
                <nz-form-item>
                  <nz-form-label>Min assets value</nz-form-label>
                  <nz-form-control>
                    <nz-input-group nzAddOnBefore="EGP" class="money-group">
                      <input nz-input formControlName="minAssetsValueEGP" inputmode="decimal" />
                    </nz-input-group>
                  </nz-form-control>
                </nz-form-item>
              </div>
            </section>
          }

          <!-- ═══ MULTI-CURRENCY ═══════════════════════════════════════════ -->
          @if (toggles.multiCurrency()) {
            <section class="card">
              <header class="card-head">
                <div>
                  <h2 class="card-title">Currencies</h2>
                  <p class="card-sub">Add USD / EUR for secured-loan programs.</p>
                </div>
              </header>
              <div class="grid">
                <nz-form-item class="span-2">
                  <nz-form-label>Accepted currencies</nz-form-label>
                  <nz-form-control>
                    <nz-select [ngModel]="currenciesArrValue()" (ngModelChange)="setArr('identity.currencies', $event)" [ngModelOptions]="{ standalone: true }" nzMode="multiple" [nzDropdownStyle]="dropdownStyle">
                      <nz-option nzValue="EGP" nzLabel="EGP"></nz-option>
                      <nz-option nzValue="USD" nzLabel="USD"></nz-option>
                      <nz-option nzValue="EUR" nzLabel="EUR"></nz-option>
                    </nz-select>
                  </nz-form-control>
                </nz-form-item>
              </div>
            </section>
          }

          <!-- ═══ FUTURE TOGGLES (placeholders for fields not yet in schema) ═ -->
          @if (toggles.tieredRates() || toggles.buyout() || toggles.downPayment()) {
            <section class="card placeholder">
              <header class="card-head">
                <div>
                  <h2 class="card-title">Tier-map editor (next increment)</h2>
                  <p class="card-sub">
                    @if (toggles.tieredRates()) { Tiered interest rates · }
                    @if (toggles.buyout()) { Buyout delta + floor · }
                    @if (toggles.downPayment()) { Down-payment tiers · }
                    UI editor lands in the next form increment. For now seed these via the catalog seed endpoint.
                  </p>
                </div>
              </header>
            </section>
          }

          <footer class="form-footer">
            <button nz-button type="button" (click)="cancel()" [disabled]="busy()">
              <span i18n="@@bank_programs.form.cancel">Cancel</span>
            </button>
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
        display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-2) var(--space-4);
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
        position: sticky; bottom: var(--space-3);
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

  readonly busy = signal(false);
  readonly advancedFeesOpen = signal(false);
  readonly activeTemplate = signal<TemplateId | null>(null);
  readonly dropdownStyle: Record<string, string> = { 'max-height': '360px', 'min-height': '120px' };

  readonly toggles = {
    tieredRates: signal(false),
    incomeSurrogate: signal(false),
    variableRate: signal(false),
    buyout: signal(false),
    downPayment: signal(false),
    specialEligibility: signal(false),
    performance: signal(false),
    multiCurrency: signal(false),
  } as const;

  readonly templates: TemplateDef[] = [
    {
      id: 'simple_personal',
      name: 'Simple personal loan',
      desc: 'Flat rate, payroll-transfer, document-backed.',
      productCategory: 'personal',
      toggles: {},
    },
    {
      id: 'income_surrogate',
      name: 'Income-surrogate program',
      desc: 'Income inferred from rank / grade / years / CD.',
      productCategory: 'personal',
      toggles: { incomeSurrogate: true },
    },
    {
      id: 'auto_down_payment',
      name: 'Auto loan with down-payment tiers',
      desc: 'Car loan, rate varies by down-payment %.',
      productCategory: 'car',
      toggles: { downPayment: true, tieredRates: true },
    },
    {
      id: 'variable_rate',
      name: 'Variable-rate program',
      desc: 'CBE-linked, quarterly reset.',
      productCategory: 'personal',
      toggles: { variableRate: true },
    },
  ];

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
    }),
    pricing: this.fb.nonNullable.group({
      isVariableRate: new FormControl(false, { nonNullable: true }),
      baseRatePercent: new FormControl<string | null>('24.0000'),
      currentEffectiveRatePercent: new FormControl<string | null>(null),
      variableRateNote: new FormControl<string | null>(null),
    }),
    eligibility: this.fb.nonNullable.group({
      acceptedEmploymentTypes: this.fb.nonNullable.array<string>(['salaried'], {
        validators: [Validators.required],
      }),
      acceptedLoanPurposes: this.fb.nonNullable.array<string>(['personal'], {
        validators: [Validators.required],
      }),
      acceptedTransferTypes: this.fb.nonNullable.array<string>(['payroll'], {
        validators: [Validators.required],
      }),
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
    performance: this.fb.nonNullable.group({
      include: new FormControl(false, { nonNullable: true }),
      requiredMOBMonths: new FormControl(0, { nonNullable: true }),
      iScoreMOBPerformanceCheck: new FormControl(false, { nonNullable: true }),
      bkt1NoHitWithinMonths: new FormControl<number | null>(null),
      bkt2NoHitWithinMonths: new FormControl<number | null>(null),
      requireCurrentLoanStatus: new FormControl(false, { nonNullable: true }),
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
  get performanceGroup(): FormGroup { return this.form.controls.performance as FormGroup; }
  get incomeAssumptionGroup(): FormGroup { return this.form.controls.incomeAssumption as FormGroup; }
  get feesGroup(): FormGroup { return this.form.controls.fees as FormGroup; }
  get documentsGroup(): FormGroup { return this.form.controls.documents as FormGroup; }

  // Live array views for nz-select [ngModel] bindings
  readonly employmentArr = signal<string[]>(['salaried']);
  readonly transferArr = signal<string[]>(['payroll']);
  readonly docsArr = signal<string[]>([]);
  readonly currenciesArrValue = signal<string[]>(['EGP']);

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
      if (!this.toggles.performance()) {
        this.performanceGroup.patchValue(
          {
            include: false,
            requiredMOBMonths: 0,
            iScoreMOBPerformanceCheck: false,
            bkt1NoHitWithinMonths: null,
            bkt2NoHitWithinMonths: null,
            requireCurrentLoanStatus: false,
          },
          { emitEvent: false },
        );
      }
    });
    effect(() => {
      if (!this.toggles.specialEligibility()) {
        this.eligibilityGroup.patchValue(
          {
            requiresCD: false,
            requiresAutoLoanAtABK: false,
            requiresAutoLoanAtOtherBank: false,
            requiresCreditCardAtOtherBank: false,
            requiresCompoundProperty: false,
            requiresCollateral: false,
            requiresClubMembership: false,
            requiresFRMUVerification: false,
            requiresQualitativeReview: false,
            requiresNoDocuments: false,
            minBankStatementBalanceEGP: null,
            minAssetsValueEGP: null,
          },
          { emitEvent: false },
        );
      }
    });
    effect(() => {
      if (!this.toggles.multiCurrency()) {
        this.setArr('identity.currencies', ['EGP']);
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

    if (this.isEditMode() && this.editProgramCode()) {
      void this.loadForEdit(this.editProgramCode());
    }
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
    this.activeTemplate.set(null);
  }

  applyTemplate(t: TemplateDef): void {
    this.activeTemplate.set(t.id);
    this.identityGroup.patchValue({ productCategory: t.productCategory });
    (Object.keys(this.toggles) as ToggleKey[]).forEach((k) => {
      this.toggles[k].set(t.toggles[k] === true);
    });
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
    this.toggles.performance.set(Boolean(d.performanceCriteria));
    this.toggles.multiCurrency.set(d.currencies.some((c) => c !== 'EGP'));
    const e = d.eligibility;
    const anyFlag =
      e.requiresCD || e.requiresAutoLoanAtABK || e.requiresAutoLoanAtOtherBank ||
      e.requiresCreditCardAtOtherBank || e.requiresCompoundProperty || e.requiresCollateral ||
      e.requiresClubMembership || e.requiresFRMUVerification || e.requiresQualitativeReview ||
      e.requiresNoDocuments || e.minBankStatementBalanceEGP != null || e.minAssetsValueEGP != null;
    this.toggles.specialEligibility.set(anyFlag);
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
    const pc = v.performance;
    const ia = v.incomeAssumption;
    const fe = v.fees;
    const dc = v.documents;

    return {
      programCode: id.programCode,
      bankName: id.bankName,
      friendlyName: id.friendlyName,
      friendlyNameAr: id.friendlyNameAr ?? undefined,
      programType: id.programType,
      productCategory: id.productCategory,
      currencies: id.currencies,
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
      performanceCriteria: pc.include
        ? {
            requiredMOBMonths: pc.requiredMOBMonths,
            iScoreMOBPerformanceCheck: pc.iScoreMOBPerformanceCheck,
            bkt1NoHitWithinMonths: pc.bkt1NoHitWithinMonths ?? undefined,
            bkt2NoHitWithinMonths: pc.bkt2NoHitWithinMonths ?? undefined,
            requireCurrentLoanStatus: pc.requireCurrentLoanStatus,
          }
        : undefined,
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

    if (initial.performanceCriteria) {
      this.performanceGroup.patchValue({ include: true, ...initial.performanceCriteria });
    }
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
