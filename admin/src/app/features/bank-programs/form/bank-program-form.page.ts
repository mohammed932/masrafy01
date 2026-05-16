import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import {
  ArrowLeftOutline,
  PlusOutline,
  SaveOutline,
  ReloadOutline,
  CloudOutline,
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
import { IdentitySectionComponent } from './sections/identity-section.component';
import { TenorSectionComponent } from './sections/tenor-section.component';
import { LoanLimitsSectionComponent } from './sections/loan-limits-section.component';
import { PricingSectionComponent } from './sections/pricing-section.component';
import { EligibilitySectionComponent } from './sections/eligibility-section.component';
import { PerformanceCriteriaSectionComponent } from './sections/performance-criteria-section.component';
import { IncomeAssumptionSectionComponent } from './sections/income-assumption-section.component';
import { FeesSectionComponent } from './sections/fees-section.component';
import { DocumentsSectionComponent } from './sections/documents-section.component';

/**
 * Dedicated route-level page for creating + editing a bank program.
 * Routes:
 *   /bank-programs/new                       — create mode
 *   /bank-programs/:programCode/edit          — edit mode
 *
 * Spec anchors: FR-018 (create), FR-019 (edit excluding programCode), FR-021 (version on save).
 */
@Component({
  selector: 'app-bank-program-form-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    NzButtonModule,
    NzIconModule,
    NzSpinModule,
    IdentitySectionComponent,
    TenorSectionComponent,
    LoanLimitsSectionComponent,
    PricingSectionComponent,
    EligibilitySectionComponent,
    PerformanceCriteriaSectionComponent,
    IncomeAssumptionSectionComponent,
    FeesSectionComponent,
    DocumentsSectionComponent,
  ],
  providers: [
    provideNzIconsPatch([
      ArrowLeftOutline,
      PlusOutline,
      SaveOutline,
      ReloadOutline,
      CloudOutline,
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
          <h1 class="page-title">
            {{ isEditMode() ? editTitle() : createTitle() }}
          </h1>
          <p class="page-subtitle" i18n="@@bank_programs.form.subtitle">
            Configure every section below. All fields validate on blur; submit unlocks when the form
            is structurally valid.
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
          <app-identity-section
            [group]="identityGroup"
            [editMode]="isEditMode()"
          ></app-identity-section>
          <app-tenor-section [group]="tenorGroup"></app-tenor-section>
          <app-loan-limits-section
            [group]="loanLimitsGroup"
            [currencies]="currenciesSignal()"
            [requiresQualitativeReview]="requiresQualitativeReviewSignal()"
          ></app-loan-limits-section>
          <app-pricing-section [group]="pricingGroup"></app-pricing-section>
          <app-eligibility-section [group]="eligibilityGroup"></app-eligibility-section>
          <app-performance-criteria-section
            [group]="performanceGroup"
          ></app-performance-criteria-section>
          <app-income-assumption-section
            [group]="incomeAssumptionGroup"
          ></app-income-assumption-section>
          <app-fees-section [group]="feesGroup"></app-fees-section>
          <app-documents-section [group]="documentsGroup"></app-documents-section>

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
              <span *ngIf="!busy()">
                {{ isEditMode() ? saveLabel() : createLabel() }}
              </span>
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
      .page-header {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        margin-block-end: var(--space-5);
      }
      .back-link {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        color: var(--color-text-secondary);
        text-decoration: none;
        font-size: var(--text-sm);
        width: max-content;
      }
      .back-link:hover {
        color: var(--color-text-link);
      }
      .title-block {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .page-title {
        font-size: var(--text-2xl);
        font-weight: var(--font-weight-semibold);
        margin: 0;
        color: var(--color-text-primary);
        letter-spacing: -0.01em;
      }
      .page-subtitle {
        margin: 0;
        font-size: var(--text-md);
        color: var(--color-text-secondary);
        max-width: 72ch;
      }
      .form-body {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .form-footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: var(--space-3);
        padding: var(--space-4);
        background: var(--color-surface);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        margin-block-start: var(--space-2);
      }
      .unavailable {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--space-10);
        gap: var(--space-3);
        text-align: center;
        background: var(--color-surface);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
      }
      .unavailable-icon {
        font-size: 56px;
        width: 56px;
        height: 56px;
        color: var(--color-text-tertiary);
      }
      .unavailable-text {
        margin: 0;
        color: var(--color-text-primary);
        font-size: var(--text-md);
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

  readonly busy = signal(false);
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

  private currentVersion = 1;
  private currentProgramCode = '';

  readonly form = this.fb.nonNullable.group({
    identity: this.fb.nonNullable.group({
      programCode: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(/^[A-Z0-9_-]{3,32}$/)],
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
        validators: [Validators.required, Validators.min(1), Validators.max(480)],
      }),
      maxMonths: new FormControl(60, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(1), Validators.max(480)],
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
  get performanceGroup(): FormGroup {
    return this.form.controls.performance as FormGroup;
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

  readonly currenciesSignal = signal<string[]>(['EGP']);
  readonly requiresQualitativeReviewSignal = signal<boolean>(false);

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

    this.identityGroup.get('currencies')?.valueChanges.subscribe((cs) => {
      this.currenciesSignal.set((cs as string[]) ?? ['EGP']);
    });
    this.eligibilityGroup.get('requiresQualitativeReview')?.valueChanges.subscribe((b) => {
      this.requiresQualitativeReviewSignal.set(b === true);
      if (b !== true) {
        this.loanLimitsGroup.get('qualitativeReviewMaxEGP')?.setValue(null);
      }
    });

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
        this.message.success($localize`:@@bank_programs.form.updated:Bank program updated.`, {
          nzDuration: 4000,
        });
        void this.router.navigate(['/bank-programs', res.data.programCode]);
      } else {
        const payload = this.buildCreatePayload();
        const res = await this.api.create(payload);
        this.message.success($localize`:@@bank_programs.form.created:Bank program created.`, {
          nzDuration: 4000,
        });
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
    } catch (err) {
      this.handleError(err);
    }
  }

  private buildCreatePayload(): BankProgramCreatePayload {
    const v = this.form.getRawValue();
    return this.payloadFromForm(v);
  }

  private buildUpdatePayload(): BankProgramUpdatePayload {
    const v = this.form.getRawValue();
    return { ...this.payloadFromForm(v), version: this.currentVersion };
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
        currentEffectiveRatePercent: pr.isVariableRate
          ? (pr.currentEffectiveRatePercent ?? undefined)
          : undefined,
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
        carInstallmentMultiplier:
          ia.strategy === 'byCarInstallment'
            ? (ia.carInstallmentMultiplier ?? undefined)
            : undefined,
        carLoanAmountPercent:
          ia.strategy === 'byCarLoanAmount' ? (ia.carLoanAmountPercent ?? undefined) : undefined,
        creditCardLimitMultiplier:
          ia.strategy === 'byCreditCardLimit'
            ? (ia.creditCardLimitMultiplier ?? undefined)
            : undefined,
        bankStatementPercent:
          ia.strategy === 'byBankStatementPercent'
            ? (ia.bankStatementPercent ?? undefined)
            : undefined,
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
    const currenciesArr = this.identityGroup.get('currencies') as FormArray;
    currenciesArr.clear();
    for (const c of initial.currencies) {
      currenciesArr.push(new FormControl(c, { nonNullable: true }));
    }

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
    this.requiresQualitativeReviewSignal.set(initial.eligibility.requiresQualitativeReview);

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
      // Refresh local version so a re-submit can succeed.
      void this.loadForEdit(this.currentProgramCode);
    }
  }
}
