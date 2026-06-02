import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzModalService } from 'ng-zorro-antd/modal';
import {
  ArrowLeftOutline,
  EditOutline,
  CopyOutline,
  DeleteOutline,
  WarningOutline,
  SlidersOutline,
} from '@ant-design/icons-angular/icons';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { CanDirective } from '../../../shared/can.directive';
import { HumanizePipe } from '../../../shared/humanize.pipe';
import { BankProgramsApiService } from '../bank-programs.api.service';
import { CloneProgramDialog, type CloneProgramDialogData } from '../clone/clone-program.dialog';
import { DeleteProgramDialog, type DeleteProgramDialogData } from '../delete/delete-program.dialog';
import { CascadePreviewComponent, type CascadeApplicantContext } from './cascade-preview.component';
import type { BankProgramResponse } from '../bank-programs.types';

@Component({
  selector: 'app-bank-program-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    NzButtonModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    CanDirective,
    HumanizePipe,
    CascadePreviewComponent,
  ],
  providers: [
    provideNzIconsPatch([
      ArrowLeftOutline,
      EditOutline,
      CopyOutline,
      DeleteOutline,
      WarningOutline,
      SlidersOutline,
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (program()) {
    <section class="page">
      <header class="page-header">
        <a routerLink="/bank-programs" class="back-link">
          <span nz-icon nzType="arrow-left" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@bank_programs.detail.back">Back to list</span>
        </a>
        <div class="title-row">
          <h1 class="page-title">{{ program()!.programCode }}</h1>
          <span
            class="status-chip"
            [class.active]="program()!.active"
            [class.inactive]="!program()!.active"
          >
            {{ program()!.active ? activeLabel() : inactiveLabel() }}
          </span>
        </div>
        <p class="page-subtitle">
          {{ program()!.friendlyName }} · {{ program()!.bankName }} ·
          {{ program()!.productCategory | humanize }} · v{{ program()!.version }}
        </p>
        <div class="actions">
          <a
            *can="['super_admin', 'sales_manager']"
            nz-button
            [routerLink]="['/bank-programs', program()!.programCode, 'edit']"
          >
            <span nz-icon nzType="edit" nzTheme="outline" aria-hidden="true"></span>
            <span i18n="@@bank_programs.action.edit">Edit</span>
          </a>
          <a
            *can="['super_admin', 'sales_manager']"
            nz-button
            [routerLink]="['/scoring-approvals', 'weights', program()!.productCategory.toLowerCase(), program()!.id]"
          >
            <span nz-icon nzType="sliders" nzTheme="outline" aria-hidden="true"></span>
            <span i18n="@@bank_programs.action.scoring_weights">Scoring weights</span>
          </a>
          <button *can="['super_admin', 'sales_manager']" nz-button (click)="openClone()">
            <span nz-icon nzType="copy" nzTheme="outline" aria-hidden="true"></span>
            <span i18n="@@bank_programs.action.clone">Clone</span>
          </button>
          <button *can="['super_admin']" nz-button nzDanger (click)="openDelete()">
            <span nz-icon nzType="delete" nzTheme="outline" aria-hidden="true"></span>
            <span i18n="@@bank_programs.action.delete">Delete</span>
          </button>
        </div>
      </header>

      @if (program()!.deprecatedKeys.length > 0) {
        <div class="deprecated-banner">
          <span nz-icon nzType="warning" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@bank_programs.detail.deprecated_banner">
            {{ program()!.deprecatedKeys.length }} tier key(s) have been deprecated in the registry —
            review.
          </span>
        </div>
      }

      <div class="layout">
        <div class="main">
          <section class="card">
            <h3 class="card-title" i18n="@@bank_programs.section.identity">Identity</h3>
            <dl class="kv">
              <dt i18n="@@bank_programs.field.bank_name">Bank</dt>
              <dd>{{ program()!.bankName }}</dd>
              <dt i18n="@@bank_programs.field.friendly_name">Friendly name</dt>
              <dd>{{ program()!.friendlyName }}</dd>
              <dt i18n="@@bank_programs.field.program_type">Type</dt>
              <dd>{{ program()!.programType | humanize }}</dd>
              <dt i18n="@@bank_programs.field.product_category">Category</dt>
              <dd>{{ program()!.productCategory | humanize }}</dd>
              <dt i18n="@@bank_programs.field.currencies">Currencies</dt>
              <dd>{{ program()!.currencies.join(', ') }}</dd>
            </dl>
          </section>

          <section class="card">
            <h3 class="card-title" i18n="@@bank_programs.section.tenor">Tenor</h3>
            <dl class="kv">
              <dt i18n="@@bank_programs.field.min_months">Min months</dt>
              <dd class="numeric">{{ program()!.tenor.minMonths }}</dd>
              <dt i18n="@@bank_programs.field.max_months">Max months</dt>
              <dd class="numeric">{{ program()!.tenor.maxMonths }}</dd>
            </dl>
          </section>

          <section class="card">
            <h3 class="card-title" i18n="@@bank_programs.section.loan_limits">Loan limits</h3>
            <dl class="kv">
              <dt>EGP min</dt>
              <dd class="numeric">{{ program()!.loanLimits.perCurrency['EGP']?.minAmount }}</dd>
              <dt>EGP max</dt>
              <dd class="numeric">{{ program()!.loanLimits.perCurrency['EGP']?.maxAmount }}</dd>
              @if (program()!.loanLimits.qualitativeReviewMaxEGP; as qr) {
                <dt i18n="@@bank_programs.detail.qr_max">Uplift ceiling (qualitative review)</dt>
                <dd class="numeric">{{ qr }}</dd>
              }
            </dl>
          </section>

          <section class="card">
            <h3 class="card-title" i18n="@@bank_programs.section.pricing">Pricing</h3>
            <dl class="kv">
              <dt i18n="@@bank_programs.field.is_variable_rate">Variable rate</dt>
              <dd>{{ program()!.pricing.isVariableRate ? 'Yes' : 'No' }}</dd>
              @if (!program()!.pricing.isVariableRate) {
                <dt i18n="@@bank_programs.field.base_rate">
                  Base rate
                </dt>
                <dd class="numeric">
                  {{ program()!.pricing.baseRatePercent }}%
                </dd>
              }
              @if (program()!.pricing.isVariableRate) {
                <dt i18n="@@bank_programs.field.current_effective_rate">
                  Current effective rate
                </dt>
                <dd class="numeric">
                  {{ program()!.pricing.currentEffectiveRatePercent }}%
                </dd>
              }
              @if (program()!.pricing.variableRateNote) {
                <dt i18n="@@bank_programs.field.variable_rate_note">Disclosure note</dt>
                <dd>{{ program()!.pricing.variableRateNote }}</dd>
              }
            </dl>
          </section>

          <section class="card">
            <h3 class="card-title" i18n="@@bank_programs.section.eligibility">Eligibility</h3>
            <dl class="kv">
              <dt i18n="@@bank_programs.field.accepted_employment_types">Employment</dt>
              <dd class="chips">
                @for (t of program()!.eligibility.acceptedEmploymentTypes; track t) {
                  <span class="enum-chip">{{ t | humanize }}</span>
                } @empty {
                  <span class="empty-dash">—</span>
                }
              </dd>
              <dt i18n="@@bank_programs.field.accepted_loan_purposes">Purposes</dt>
              <dd>{{ program()!.eligibility.acceptedLoanPurposes | humanize }}</dd>
              <dt i18n="@@bank_programs.field.age_min">Age</dt>
              <dd class="numeric">
                {{ program()!.eligibility.ageMin }}–{{ program()!.eligibility.ageMax }}
              </dd>
              <dt i18n="@@bank_programs.field.min_monthly_income_egp">Min income (EGP)</dt>
              <dd class="numeric">{{ program()!.eligibility.minMonthlyIncomeEGP }}</dd>
              <dt i18n="@@bank_programs.field.dbr_cap">DBR cap</dt>
              <dd class="numeric">{{ program()!.eligibility.dbrCapPercent }}%</dd>
              @if (program()!.eligibility.requiresNoDocuments) {
                <dt i18n="@@bank_programs.flag.requires_no_docs">
                  No-documents lending tier
                </dt>
                <dd>Yes</dd>
              }
              @if (program()!.eligibility.requiresQualitativeReview) {
                <dt i18n="@@bank_programs.flag.requires_qr">
                  Qualitative review
                </dt>
                <dd>Yes</dd>
              }
              @if (program()!.eligibility.minBankStatementBalanceEGP) {
                <dt i18n="@@bank_programs.field.min_bank_statement_balance">
                  Wealth gate · bank balance
                </dt>
                <dd class="numeric">{{ program()!.eligibility.minBankStatementBalanceEGP }}</dd>
              }
              @if (program()!.eligibility.minAssetsValueEGP) {
                <dt i18n="@@bank_programs.field.min_assets_value">Wealth gate · assets</dt>
                <dd class="numeric">{{ program()!.eligibility.minAssetsValueEGP }}</dd>
              }
            </dl>
          </section>

          <section class="card">
            <h3 class="card-title" i18n="@@bank_programs.section.fees">Fees</h3>
            <dl class="kv">
              <dt i18n="@@bank_programs.field.admin_fee">Admin fee</dt>
              <dd class="numeric">{{ program()!.fees.adminFeePercent }}%</dd>
              <dt i18n="@@bank_programs.field.stamp_duty">Stamp duty</dt>
              <dd class="numeric">{{ program()!.fees.stampDutyPercent }}%</dd>
              <dt i18n="@@bank_programs.field.life_insurance_pct">Life insurance</dt>
              <dd class="numeric">
                {{ program()!.fees.lifeInsurancePercent }}%{{
                  program()!.fees.lifeInsuranceMandatory ? ' (mandatory)' : ''
                }}
              </dd>
            </dl>
          </section>
        </div>

        <aside class="rail">
          <app-cascade-preview
            [program]="program()!"
            [context]="whatIfContext()"
          ></app-cascade-preview>

          <section class="card whatif" [formGroup]="whatIfForm">
            <h3 class="card-title" i18n="@@bank_programs.detail.whatif">Try a sample applicant</h3>
            <nz-form-item>
              <nz-form-label [nzFor]="'ctxEmployment'" i18n="@@bank_programs.field.employment_type"
                >Employment</nz-form-label
              >
              <nz-form-control>
                <nz-select id="ctxEmployment" formControlName="employmentType">
                  <nz-option nzValue="salaried" nzLabel="Salaried"></nz-option>
                  <nz-option nzValue="self_employed" nzLabel="Self-employed"></nz-option>
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label [nzFor]="'ctxTransfer'" i18n="@@bank_programs.field.transfer_type"
                >Transfer</nz-form-label
              >
              <nz-form-control>
                <nz-select id="ctxTransfer" formControlName="transferType">
                  <nz-option nzValue="payroll" nzLabel="Payroll"></nz-option>
                  <nz-option nzValue="payroll_cat_a" nzLabel="Payroll · Cat-A"></nz-option>
                  <nz-option nzValue="payroll_cat_b" nzLabel="Payroll · Cat-B"></nz-option>
                  <nz-option nzValue="payroll_cat_c" nzLabel="Payroll · Cat-C"></nz-option>
                  <nz-option nzValue="salary_transfer_letter" nzLabel="STL"></nz-option>
                  <nz-option nzValue="income_transfer_letter" nzLabel="ITL"></nz-option>
                  <nz-option nzValue="none" nzLabel="None"></nz-option>
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label [nzFor]="'ctxTenor'" i18n="@@bank_programs.detail.tenor_months"
                >Tenor (months)</nz-form-label
              >
              <nz-form-control>
                <input nz-input id="ctxTenor" type="number" formControlName="tenorMonths" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label
                [nzFor]="'ctxDownPayment'"
                i18n="@@bank_programs.detail.down_payment_pct"
                >Down payment %</nz-form-label
              >
              <nz-form-control>
                <input
                  nz-input
                  id="ctxDownPayment"
                  type="number"
                  formControlName="downPaymentPercent"
                />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label [nzFor]="'ctxAssetValue'" i18n="@@bank_programs.detail.asset_value"
                >Asset value (EGP)</nz-form-label
              >
              <nz-form-control>
                <input
                  nz-input
                  id="ctxAssetValue"
                  type="number"
                  formControlName="assetValueEGP"
                />
              </nz-form-control>
            </nz-form-item>
          </section>
        </aside>
      </div>
    </section>
    } @else {
      <div class="loading"><nz-spin nzSimple></nz-spin></div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        padding: var(--space-6);
        max-width: var(--content-max-width);
        margin-inline: auto;
      }
      .back-link {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        color: var(--color-text-secondary);
        text-decoration: none;
        font-size: var(--text-sm);
        margin-block-end: var(--space-2);
      }
      .back-link:hover {
        color: var(--color-text-link);
      }
      .title-row {
        display: flex;
        align-items: center;
        gap: var(--space-3);
      }
      .page-title {
        font-size: var(--text-2xl);
        font-weight: var(--font-weight-semibold);
        margin: 0;
        color: var(--color-text-primary);
        font-feature-settings: 'tnum';
      }
      .page-subtitle {
        color: var(--color-text-secondary);
        margin: var(--space-1) 0 var(--space-3);
      }
      .actions {
        display: flex;
        gap: var(--space-2);
        margin-block-end: var(--space-4);
      }
      .status-chip {
        display: inline-block;
        padding: 2px 8px;
        border-radius: var(--radius-sm);
        font-size: var(--text-xs);
      }
      .status-chip.active {
        background: var(--color-success-bg);
        color: var(--color-success);
      }
      .status-chip.inactive {
        background: var(--color-surface-muted);
        color: var(--color-text-tertiary);
      }
      .deprecated-banner {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        background: var(--color-warning-bg);
        color: var(--color-warning);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-sm);
        padding: var(--space-3);
        margin-block-end: var(--space-4);
      }
      .layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 320px;
        gap: var(--space-5);
      }
      @media (max-width: 980px) {
        .layout {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      .main,
      .rail {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .card {
        background: var(--color-surface);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        padding: var(--space-4);
      }
      .card-title {
        font-size: var(--text-md);
        font-weight: var(--font-weight-semibold);
        margin: 0 0 var(--space-2);
        color: var(--color-text-primary);
      }
      .kv {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: var(--space-1) var(--space-3);
        margin: 0;
      }
      .kv dt {
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }
      .kv dd {
        margin: 0;
        color: var(--color-text-primary);
        font-size: var(--text-sm);
      }
      /* Categorical enum values render as scannable brand pills, not a comma run-on. */
      .kv dd.chips {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2, 8px);
        align-self: center;
      }
      .enum-chip {
        --chip-accent: var(--ant-primary-color, #0869c3);
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 5px 13px;
        border-radius: var(--radius-pill, 999px);
        background: color-mix(in srgb, var(--chip-accent) 10%, var(--bg-surface, #ffffff));
        color: color-mix(in srgb, var(--chip-accent) 82%, #000000);
        border: 1px solid color-mix(in srgb, var(--chip-accent) 26%, transparent);
        font-size: 13px;
        font-weight: var(--font-weight-semibold, 600);
        line-height: 1.4;
        white-space: nowrap;
      }
      .enum-chip::before {
        content: '';
        inline-size: 6px;
        block-size: 6px;
        border-radius: 50%;
        background: var(--chip-accent);
        flex: none;
      }
      .empty-dash {
        color: var(--color-text-secondary);
      }
      .numeric {
        font-variant-numeric: tabular-nums lining-nums;
      }
      .rail nz-form-item,
      .rail nz-select {
        width: 100%;
      }
      .loading {
        display: flex;
        justify-content: center;
        padding: var(--space-8);
      }
    `,
  ],
})
export class BankProgramDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(BankProgramsApiService);
  private readonly modal = inject(NzModalService);

  readonly programCode = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('programCode') ?? '')),
    { initialValue: '' },
  );
  readonly program = signal<BankProgramResponse | null>(null);

  readonly whatIfForm = new FormGroup({
    employmentType: new FormControl<string>('salaried', { nonNullable: true }),
    transferType: new FormControl<string>('payroll', { nonNullable: true }),
    tenorMonths: new FormControl<number>(60, { nonNullable: true }),
    downPaymentPercent: new FormControl<number>(30, { nonNullable: true }),
    assetValueEGP: new FormControl<number>(1000000, { nonNullable: true }),
  });

  private readonly whatIfFormValue = toSignal(this.whatIfForm.valueChanges, {
    initialValue: this.whatIfForm.getRawValue(),
  });

  readonly whatIfContext = computed<CascadeApplicantContext>(() => {
    const v = this.whatIfFormValue();
    return {
      employmentType: v.employmentType ?? 'salaried',
      transferType: v.transferType ?? 'payroll',
      tenorMonths: v.tenorMonths ?? 60,
      downPaymentPercent: v.downPaymentPercent ?? 30,
      assetValueEGP: v.assetValueEGP ?? 1000000,
    };
  });

  readonly activeLabel = signal($localize`:@@bank_programs.col.active:Active`);
  readonly inactiveLabel = signal($localize`:@@bank_programs.col.inactive:Inactive`);

  constructor() {
    // Reactive fetch.
    queueMicrotask(() => this.load());
  }

  async load(): Promise<void> {
    const code = this.programCode();
    if (!code) return;
    const res = await this.api.getByCode(code);
    this.program.set(res.data);
  }

  openClone(): void {
    const p = this.program();
    if (!p) return;
    const ref = this.modal.create<
      CloneProgramDialog,
      CloneProgramDialogData,
      { newProgramCode?: string } | undefined
    >({
      nzContent: CloneProgramDialog,
      nzData: { sourceProgramCode: p.programCode, sourceFriendlyName: p.friendlyName },
      nzWidth: 440,
      nzFooter: null,
    });
    ref.afterClose.subscribe((res) => {
      if (res?.newProgramCode) void this.router.navigate(['/bank-programs', res.newProgramCode]);
    });
  }

  openDelete(): void {
    const p = this.program();
    if (!p) return;
    const ref = this.modal.create<DeleteProgramDialog, DeleteProgramDialogData, boolean | undefined>({
      nzContent: DeleteProgramDialog,
      nzData: { programCode: p.programCode, friendlyName: p.friendlyName },
      nzWidth: 480,
      nzFooter: null,
    });
    ref.afterClose.subscribe((deleted) => {
      if (deleted) void this.router.navigate(['/bank-programs']);
    });
  }
}
