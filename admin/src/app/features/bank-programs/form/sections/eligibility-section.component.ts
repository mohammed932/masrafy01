import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, Input } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { PlatformEnumerationsService } from '../../../../core/platform-enumerations/platform-enumerations.service';
import {
  BrandSelectComponent,
  type BrandSelectOption,
} from '../../../../shared/brand-select/brand-select.component';

@Component({
  selector: 'app-eligibility-section',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatIconModule,
    BrandSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="section" [formGroup]="group" id="eligibility">
      <header class="section-header">
        <mat-icon class="section-icon" aria-hidden="true">checklist</mat-icon>
        <div>
          <h3 class="section-title" i18n="@@bank_programs.section.eligibility">Eligibility</h3>
          <p class="section-sub" i18n="@@bank_programs.section.eligibility_sub">
            Who qualifies for the program. Required flags + age / income gates + wealth tier gates.
          </p>
        </div>
      </header>

      <div class="grid">
        <app-brand-select
          class="span-2"
          [options]="employmentTypeOptions()"
          [multiple]="true"
          [value]="currentAcceptedEmployment"
          (valueChange)="onArrChange('acceptedEmploymentTypes', $event)"
          i18n-label="@@bank_programs.field.accepted_employment_types"
          label="Accepted employment types"
        ></app-brand-select>

        <app-brand-select
          class="span-2"
          [options]="loanPurposeOptions()"
          [multiple]="true"
          [value]="currentLoanPurposes"
          (valueChange)="onArrChange('acceptedLoanPurposes', $event)"
          i18n-label="@@bank_programs.field.accepted_loan_purposes"
          label="Accepted loan purposes"
        ></app-brand-select>

        <app-brand-select
          class="span-2"
          [options]="transferTypeOptions()"
          [multiple]="true"
          [value]="currentTransferTypes"
          (valueChange)="onArrChange('acceptedTransferTypes', $event)"
          i18n-label="@@bank_programs.field.accepted_transfer_types"
          label="Accepted transfer types"
        ></app-brand-select>

        <mat-form-field appearance="outline" class="numeric">
          <mat-label i18n="@@bank_programs.field.age_min">Minimum age</mat-label>
          <input matInput type="number" formControlName="ageMin" min="18" max="80" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="numeric">
          <mat-label i18n="@@bank_programs.field.age_max">Maximum age</mat-label>
          <input matInput type="number" formControlName="ageMax" min="18" max="80" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="numeric">
          <mat-label i18n="@@bank_programs.field.min_monthly_income_egp"
            >Minimum monthly income (EGP)</mat-label
          >
          <input matInput formControlName="minMonthlyIncomeEGP" inputmode="decimal" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="numeric">
          <mat-label i18n="@@bank_programs.field.min_months_in_job"
            >Minimum months in job</mat-label
          >
          <input matInput type="number" formControlName="minMonthsInJob" min="0" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="numeric">
          <mat-label i18n="@@bank_programs.field.dbr_cap">DBR cap %</mat-label>
          <input matInput formControlName="dbrCapPercent" inputmode="decimal" />
        </mat-form-field>
        <div class="row">
          <span class="row-label" i18n="@@bank_programs.field.skip_dbr"
            >Skip DBR check (secured loans only)</span
          >
          <mat-slide-toggle formControlName="skipDbrCheck"></mat-slide-toggle>
        </div>

        <div class="span-2 flag-grid">
          <mat-checkbox formControlName="requiresCD" i18n="@@bank_programs.flag.requires_cd"
            >Requires CD</mat-checkbox
          >
          <mat-checkbox
            formControlName="requiresAutoLoanAtABK"
            i18n="@@bank_programs.flag.requires_auto_abk"
            >Requires auto loan at ABK</mat-checkbox
          >
          <mat-checkbox
            formControlName="requiresAutoLoanAtOtherBank"
            i18n="@@bank_programs.flag.requires_auto_other"
            >Requires auto loan at another bank</mat-checkbox
          >
          <mat-checkbox
            formControlName="requiresCreditCardAtOtherBank"
            i18n="@@bank_programs.flag.requires_cc_other"
            >Requires credit card at another bank</mat-checkbox
          >
          <mat-checkbox
            formControlName="requiresCompoundProperty"
            i18n="@@bank_programs.flag.requires_compound"
            >Requires compound property</mat-checkbox
          >
          <mat-checkbox
            formControlName="requiresCollateral"
            i18n="@@bank_programs.flag.requires_collateral"
            >Requires collateral</mat-checkbox
          >
          <mat-checkbox
            formControlName="requiresClubMembership"
            i18n="@@bank_programs.flag.requires_club"
            >Requires club membership</mat-checkbox
          >
          <mat-checkbox
            formControlName="requiresExistingLoan"
            i18n="@@bank_programs.flag.requires_existing_loan"
            >Requires existing loan (buyout)</mat-checkbox
          >
          <mat-checkbox
            formControlName="requiresFRMUVerification"
            i18n="@@bank_programs.flag.requires_frmu"
            >Requires FRMU verification</mat-checkbox
          >
          <mat-checkbox
            formControlName="requiresQualitativeReview"
            i18n="@@bank_programs.flag.requires_qr"
            >Requires qualitative review (unlocks uplift)</mat-checkbox
          >
          <mat-checkbox
            formControlName="requiresNoDocuments"
            i18n="@@bank_programs.flag.requires_no_docs"
            >No-documents lending tier</mat-checkbox
          >
        </div>

        <mat-form-field appearance="outline" class="numeric span-2">
          <mat-label i18n="@@bank_programs.field.min_bank_statement_balance"
            >Wealth gate — minimum bank-statement balance (EGP)</mat-label
          >
          <input matInput formControlName="minBankStatementBalanceEGP" inputmode="decimal" />
          <mat-hint i18n="@@bank_programs.hint.wealth_and"
            >Combined with the minimum assets gate via AND when both are set.</mat-hint
          >
        </mat-form-field>
        <mat-form-field appearance="outline" class="numeric span-2">
          <mat-label i18n="@@bank_programs.field.min_assets_value"
            >Wealth gate — minimum assets value (EGP)</mat-label
          >
          <input matInput formControlName="minAssetsValueEGP" inputmode="decimal" />
        </mat-form-field>
      </div>
    </section>
  `,
  styleUrls: ['./section.styles.scss'],
  styles: [
    `
      .flag-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-2) var(--space-3);
      }
      @media (max-width: 720px) {
        .flag-grid {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `,
  ],
})
export class EligibilitySectionComponent {
  private readonly enums = inject(PlatformEnumerationsService);

  @Input({ required: true }) group!: FormGroup;

  readonly employmentTypes = this.enums.membersFor('employment_type');
  readonly loanPurposes = this.enums.membersFor('loan_purpose');
  readonly transferTypes = this.enums.membersFor('transfer_type');

  readonly employmentTypeOptions = computed<BrandSelectOption[]>(() =>
    this.employmentTypes().map((m) => ({ value: m.key, label: m.labelEn })),
  );
  readonly loanPurposeOptions = computed<BrandSelectOption[]>(() =>
    this.loanPurposes().map((m) => ({ value: m.key, label: m.labelEn })),
  );
  readonly transferTypeOptions = computed<BrandSelectOption[]>(() =>
    this.transferTypes().map((m) => ({ value: m.key, label: m.labelEn })),
  );

  get currentAcceptedEmployment(): string[] {
    return this.readArr('acceptedEmploymentTypes');
  }
  get currentLoanPurposes(): string[] {
    return this.readArr('acceptedLoanPurposes');
  }
  get currentTransferTypes(): string[] {
    return this.readArr('acceptedTransferTypes');
  }

  private readArr(name: string): string[] {
    const arr = this.group?.get(name) as FormArray | null;
    return (arr?.value as string[] | undefined) ?? [];
  }

  setArr(name: string, next: string[]): void {
    const arr = this.group.get(name) as FormArray;
    arr.clear();
    for (const k of next) {
      arr.push(new FormControl(k, { nonNullable: true }));
    }
    arr.markAsDirty();
  }

  onArrChange(name: string, next: string | string[]): void {
    this.setArr(name, Array.isArray(next) ? next : [next]);
  }
}
