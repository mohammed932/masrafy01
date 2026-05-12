import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { CanDirective } from '../../../shared/can.directive';
import { BankProgramsApiService } from '../bank-programs.api.service';
import { CloneProgramDialog } from '../clone/clone-program.dialog';
import { DeleteProgramDialog } from '../delete/delete-program.dialog';
import { CascadePreviewComponent, type CascadeApplicantContext } from './cascade-preview.component';
import type { BankProgramResponse } from '../bank-programs.types';

@Component({
  selector: 'app-bank-program-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTooltipModule,
    CanDirective,
    CascadePreviewComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page" *ngIf="program(); else loadingTpl">
      <header class="page-header">
        <a routerLink="/bank-programs" class="back-link">
          <mat-icon aria-hidden="true">arrow_back</mat-icon>
          <span i18n="@@bank_programs.detail.back">Back to list</span>
        </a>
        <div class="title-row">
          <h1 class="page-title">{{ program()!.programCode }}</h1>
          <span class="status-chip" [class.active]="program()!.active" [class.inactive]="!program()!.active">
            {{ program()!.active ? activeLabel() : inactiveLabel() }}
          </span>
        </div>
        <p class="page-subtitle">
          {{ program()!.friendlyName }} · {{ program()!.bankName }} · {{ program()!.productCategory }} · v{{ program()!.version }}
        </p>
        <div class="actions">
          <a *can="['ADMIN', 'SUPER_ADMIN']" mat-stroked-button [routerLink]="['/bank-programs', program()!.programCode, 'edit']">
            <mat-icon>edit</mat-icon> <span i18n="@@bank_programs.action.edit">Edit</span>
          </a>
          <button *can="['ADMIN', 'SUPER_ADMIN']" mat-stroked-button (click)="openClone()">
            <mat-icon>content_copy</mat-icon> <span i18n="@@bank_programs.action.clone">Clone</span>
          </button>
          <button *can="['SUPER_ADMIN']" mat-stroked-button color="warn" (click)="openDelete()">
            <mat-icon>delete</mat-icon> <span i18n="@@bank_programs.action.delete">Delete</span>
          </button>
        </div>
      </header>

      <div *ngIf="program()!.deprecatedKeys.length > 0" class="deprecated-banner">
        <mat-icon aria-hidden="true">warning</mat-icon>
        <span i18n="@@bank_programs.detail.deprecated_banner">
          {{ program()!.deprecatedKeys.length }} tier key(s) have been deprecated in the registry — review.
        </span>
      </div>

      <div class="layout">
        <div class="main">
          <section class="card">
            <h3 class="card-title" i18n="@@bank_programs.section.identity">Identity</h3>
            <dl class="kv">
              <dt i18n="@@bank_programs.field.bank_name">Bank</dt><dd>{{ program()!.bankName }}</dd>
              <dt i18n="@@bank_programs.field.friendly_name">Friendly name</dt><dd>{{ program()!.friendlyName }}</dd>
              <dt i18n="@@bank_programs.field.friendly_name_ar">Arabic name</dt><dd dir="rtl">{{ program()!.friendlyNameAr ?? '—' }}</dd>
              <dt i18n="@@bank_programs.field.program_type">Type</dt><dd>{{ program()!.programType }}</dd>
              <dt i18n="@@bank_programs.field.product_category">Category</dt><dd>{{ program()!.productCategory }}</dd>
              <dt i18n="@@bank_programs.field.currencies">Currencies</dt><dd>{{ program()!.currencies.join(', ') }}</dd>
            </dl>
          </section>

          <section class="card">
            <h3 class="card-title" i18n="@@bank_programs.section.tenor">Tenor</h3>
            <dl class="kv">
              <dt i18n="@@bank_programs.field.min_months">Min months</dt><dd class="numeric">{{ program()!.tenor.minMonths }}</dd>
              <dt i18n="@@bank_programs.field.max_months">Max months</dt><dd class="numeric">{{ program()!.tenor.maxMonths }}</dd>
            </dl>
          </section>

          <section class="card">
            <h3 class="card-title" i18n="@@bank_programs.section.loan_limits">Loan limits</h3>
            <dl class="kv">
              <dt>EGP min</dt><dd class="numeric">{{ program()!.loanLimits.perCurrency['EGP']?.minAmount }}</dd>
              <dt>EGP max</dt><dd class="numeric">{{ program()!.loanLimits.perCurrency['EGP']?.maxAmount }}</dd>
              <ng-container *ngIf="program()!.loanLimits.qualitativeReviewMaxEGP as qr">
                <dt i18n="@@bank_programs.detail.qr_max">Uplift ceiling (qualitative review)</dt>
                <dd class="numeric">{{ qr }}</dd>
              </ng-container>
            </dl>
          </section>

          <section class="card">
            <h3 class="card-title" i18n="@@bank_programs.section.pricing">Pricing</h3>
            <dl class="kv">
              <dt i18n="@@bank_programs.field.is_variable_rate">Variable rate</dt>
              <dd>{{ program()!.pricing.isVariableRate ? 'Yes' : 'No' }}</dd>
              <dt *ngIf="!program()!.pricing.isVariableRate" i18n="@@bank_programs.field.base_rate">Base rate</dt>
              <dd *ngIf="!program()!.pricing.isVariableRate" class="numeric">{{ program()!.pricing.baseRatePercent }}%</dd>
              <dt *ngIf="program()!.pricing.isVariableRate" i18n="@@bank_programs.field.current_effective_rate">Current effective rate</dt>
              <dd *ngIf="program()!.pricing.isVariableRate" class="numeric">{{ program()!.pricing.currentEffectiveRatePercent }}%</dd>
              <ng-container *ngIf="program()!.pricing.variableRateNote">
                <dt i18n="@@bank_programs.field.variable_rate_note">Disclosure note</dt>
                <dd>{{ program()!.pricing.variableRateNote }}</dd>
              </ng-container>
            </dl>
          </section>

          <section class="card">
            <h3 class="card-title" i18n="@@bank_programs.section.eligibility">Eligibility</h3>
            <dl class="kv">
              <dt i18n="@@bank_programs.field.accepted_employment_types">Employment</dt>
              <dd>{{ program()!.eligibility.acceptedEmploymentTypes.join(', ') }}</dd>
              <dt i18n="@@bank_programs.field.accepted_loan_purposes">Purposes</dt>
              <dd>{{ program()!.eligibility.acceptedLoanPurposes.join(', ') }}</dd>
              <dt i18n="@@bank_programs.field.age_min">Age</dt>
              <dd class="numeric">{{ program()!.eligibility.ageMin }}–{{ program()!.eligibility.ageMax }}</dd>
              <dt i18n="@@bank_programs.field.min_monthly_income_egp">Min income (EGP)</dt>
              <dd class="numeric">{{ program()!.eligibility.minMonthlyIncomeEGP }}</dd>
              <dt i18n="@@bank_programs.field.dbr_cap">DBR cap</dt>
              <dd class="numeric">{{ program()!.eligibility.dbrCapPercent }}%</dd>
              <dt *ngIf="program()!.eligibility.requiresNoDocuments" i18n="@@bank_programs.flag.requires_no_docs">No-documents lending tier</dt>
              <dd *ngIf="program()!.eligibility.requiresNoDocuments">Yes</dd>
              <dt *ngIf="program()!.eligibility.requiresQualitativeReview" i18n="@@bank_programs.flag.requires_qr">Qualitative review</dt>
              <dd *ngIf="program()!.eligibility.requiresQualitativeReview">Yes</dd>
              <ng-container *ngIf="program()!.eligibility.minBankStatementBalanceEGP">
                <dt i18n="@@bank_programs.field.min_bank_statement_balance">Wealth gate · bank balance</dt>
                <dd class="numeric">{{ program()!.eligibility.minBankStatementBalanceEGP }}</dd>
              </ng-container>
              <ng-container *ngIf="program()!.eligibility.minAssetsValueEGP">
                <dt i18n="@@bank_programs.field.min_assets_value">Wealth gate · assets</dt>
                <dd class="numeric">{{ program()!.eligibility.minAssetsValueEGP }}</dd>
              </ng-container>
            </dl>
          </section>

          <section class="card">
            <h3 class="card-title" i18n="@@bank_programs.section.fees">Fees</h3>
            <dl class="kv">
              <dt i18n="@@bank_programs.field.admin_fee">Admin fee</dt><dd class="numeric">{{ program()!.fees.adminFeePercent }}%</dd>
              <dt i18n="@@bank_programs.field.stamp_duty">Stamp duty</dt><dd class="numeric">{{ program()!.fees.stampDutyPercent }}%</dd>
              <dt i18n="@@bank_programs.field.life_insurance_pct">Life insurance</dt>
              <dd class="numeric">{{ program()!.fees.lifeInsurancePercent }}%{{ program()!.fees.lifeInsuranceMandatory ? ' (mandatory)' : '' }}</dd>
            </dl>
          </section>
        </div>

        <aside class="rail">
          <app-cascade-preview [program]="program()!" [context]="whatIfContext()"></app-cascade-preview>

          <section class="card whatif">
            <h3 class="card-title" i18n="@@bank_programs.detail.whatif">Try a sample applicant</h3>
            <mat-form-field appearance="outline">
              <mat-label i18n="@@bank_programs.field.employment_type">Employment</mat-label>
              <mat-select [(ngModel)]="ctxEmployment" (ngModelChange)="recompute()">
                <mat-option value="salaried">Salaried</mat-option>
                <mat-option value="self_employed">Self-employed</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label i18n="@@bank_programs.field.transfer_type">Transfer</mat-label>
              <mat-select [(ngModel)]="ctxTransfer" (ngModelChange)="recompute()">
                <mat-option value="payroll">Payroll</mat-option>
                <mat-option value="payroll_cat_a">Payroll · Cat-A</mat-option>
                <mat-option value="payroll_cat_b">Payroll · Cat-B</mat-option>
                <mat-option value="payroll_cat_c">Payroll · Cat-C</mat-option>
                <mat-option value="salary_transfer_letter">STL</mat-option>
                <mat-option value="income_transfer_letter">ITL</mat-option>
                <mat-option value="none">None</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label i18n="@@bank_programs.detail.tenor_months">Tenor (months)</mat-label>
              <input matInput type="number" [(ngModel)]="ctxTenor" (ngModelChange)="recompute()" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label i18n="@@bank_programs.detail.down_payment_pct">Down payment %</mat-label>
              <input matInput type="number" [(ngModel)]="ctxDownPayment" (ngModelChange)="recompute()" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label i18n="@@bank_programs.detail.asset_value">Asset value (EGP)</mat-label>
              <input matInput type="number" [(ngModel)]="ctxAssetValue" (ngModelChange)="recompute()" />
            </mat-form-field>
          </section>
        </aside>
      </div>
    </section>

    <ng-template #loadingTpl>
      <div class="loading"><mat-spinner diameter="32"></mat-spinner></div>
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: block;
        padding: var(--space-6);
        max-width: var(--content-max-width);
        margin-inline: auto;
      }
      .back-link { display: inline-flex; align-items: center; gap: var(--space-1); color: var(--color-text-secondary); text-decoration: none; font-size: var(--text-sm); margin-block-end: var(--space-2); }
      .back-link:hover { color: var(--color-text-link); }
      .title-row { display: flex; align-items: center; gap: var(--space-3); }
      .page-title { font-size: var(--text-2xl); font-weight: var(--font-weight-semibold); margin: 0; color: var(--color-text-primary); font-feature-settings: 'tnum'; }
      .page-subtitle { color: var(--color-text-secondary); margin: var(--space-1) 0 var(--space-3); }
      .actions { display: flex; gap: var(--space-2); margin-block-end: var(--space-4); }
      .status-chip { display: inline-block; padding: 2px 8px; border-radius: var(--radius-sm); font-size: var(--text-xs); }
      .status-chip.active { background: #ecfdf5; color: #047857; }
      .status-chip.inactive { background: #f1f5f9; color: var(--color-text-tertiary); }
      .deprecated-banner {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        background: #fffbeb;
        color: #92400e;
        border: 1px solid #fde68a;
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
        .layout { grid-template-columns: minmax(0, 1fr); }
      }
      .main, .rail { display: flex; flex-direction: column; gap: var(--space-4); }
      .card {
        background: var(--color-surface);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        padding: var(--space-4);
      }
      .card-title { font-size: var(--text-md); font-weight: var(--font-weight-semibold); margin: 0 0 var(--space-2); color: var(--color-text-primary); }
      .kv {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: var(--space-1) var(--space-3);
        margin: 0;
      }
      .kv dt { color: var(--color-text-secondary); font-size: var(--text-sm); }
      .kv dd { margin: 0; color: var(--color-text-primary); font-size: var(--text-sm); }
      .numeric { font-variant-numeric: tabular-nums lining-nums; }
      .rail mat-form-field { width: 100%; }
      .loading { display: flex; justify-content: center; padding: var(--space-8); }
    `,
  ],
})
export class BankProgramDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(BankProgramsApiService);
  private readonly dialog = inject(MatDialog);

  readonly programCode = toSignal(this.route.paramMap.pipe(map((p) => p.get('programCode') ?? '')), { initialValue: '' });
  readonly program = signal<BankProgramResponse | null>(null);

  ctxEmployment = 'salaried';
  ctxTransfer = 'payroll';
  ctxTenor = 60;
  ctxDownPayment = 30;
  ctxAssetValue = 1000000;
  readonly _trigger = signal(0);

  readonly whatIfContext = computed<CascadeApplicantContext>(() => {
    this._trigger();
    return {
      employmentType: this.ctxEmployment,
      transferType: this.ctxTransfer,
      tenorMonths: this.ctxTenor,
      downPaymentPercent: this.ctxDownPayment,
      assetValueEGP: this.ctxAssetValue,
    };
  });

  readonly activeLabel = signal($localize`:@@bank_programs.col.active:Active`);
  readonly inactiveLabel = signal($localize`:@@bank_programs.col.inactive:Inactive`);

  constructor() {
    // Reactive fetch.
    queueMicrotask(() => this.load());
  }

  recompute(): void {
    this._trigger.update((n) => n + 1);
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
    const ref = this.dialog.open(CloneProgramDialog, {
      data: { sourceProgramCode: p.programCode, sourceFriendlyName: p.friendlyName },
      width: '440px',
      maxWidth: '95vw',
    });
    ref.afterClosed().subscribe((res) => {
      if (res?.newProgramCode) void this.router.navigate(['/bank-programs', res.newProgramCode]);
    });
  }

  openDelete(): void {
    const p = this.program();
    if (!p) return;
    const ref = this.dialog.open(DeleteProgramDialog, {
      data: { programCode: p.programCode, friendlyName: p.friendlyName },
      width: '480px',
      maxWidth: '95vw',
    });
    ref.afterClosed().subscribe((deleted) => {
      if (deleted) void this.router.navigate(['/bank-programs']);
    });
  }
}
