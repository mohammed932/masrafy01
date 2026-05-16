import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, Input } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { CheckSquareOutline } from '@ant-design/icons-angular/icons';
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
    NzFormModule,
    NzInputModule,
    NzCheckboxModule,
    NzSwitchModule,
    NzIconModule,
    BrandSelectComponent,
  ],
  providers: [provideNzIconsPatch([CheckSquareOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="section" [formGroup]="group" id="eligibility">
      <header class="section-header">
        <span class="section-icon" nz-icon nzType="check-square" nzTheme="outline" aria-hidden="true"></span>
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

        <nz-form-item class="numeric">
          <nz-form-label [nzFor]="'ageMin'" i18n="@@bank_programs.field.age_min"
            >Minimum age</nz-form-label
          >
          <nz-form-control>
            <input
              nz-input
              id="ageMin"
              type="number"
              formControlName="ageMin"
              min="18"
              max="80"
            />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item class="numeric">
          <nz-form-label [nzFor]="'ageMax'" i18n="@@bank_programs.field.age_max"
            >Maximum age</nz-form-label
          >
          <nz-form-control>
            <input
              nz-input
              id="ageMax"
              type="number"
              formControlName="ageMax"
              min="18"
              max="80"
            />
          </nz-form-control>
        </nz-form-item>

        <nz-form-item class="numeric">
          <nz-form-label
            [nzFor]="'minMonthlyIncomeEGP'"
            i18n="@@bank_programs.field.min_monthly_income_egp"
            >Minimum monthly income (EGP)</nz-form-label
          >
          <nz-form-control>
            <input
              nz-input
              id="minMonthlyIncomeEGP"
              formControlName="minMonthlyIncomeEGP"
              inputmode="decimal"
            />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item class="numeric">
          <nz-form-label
            [nzFor]="'minMonthsInJob'"
            i18n="@@bank_programs.field.min_months_in_job"
            >Minimum months in job</nz-form-label
          >
          <nz-form-control>
            <input
              nz-input
              id="minMonthsInJob"
              type="number"
              formControlName="minMonthsInJob"
              min="0"
            />
          </nz-form-control>
        </nz-form-item>

        <nz-form-item class="numeric">
          <nz-form-label [nzFor]="'dbrCapPercent'" i18n="@@bank_programs.field.dbr_cap"
            >DBR cap %</nz-form-label
          >
          <nz-form-control>
            <input
              nz-input
              id="dbrCapPercent"
              formControlName="dbrCapPercent"
              inputmode="decimal"
            />
          </nz-form-control>
        </nz-form-item>
        <div class="row">
          <span class="row-label" i18n="@@bank_programs.field.skip_dbr"
            >Skip DBR check (secured loans only)</span
          >
          <nz-switch formControlName="skipDbrCheck"></nz-switch>
        </div>

        <div class="span-2 flag-grid">
          <label nz-checkbox formControlName="requiresCD" i18n="@@bank_programs.flag.requires_cd"
            >Requires CD</label
          >
          <label
            nz-checkbox
            formControlName="requiresAutoLoanAtABK"
            i18n="@@bank_programs.flag.requires_auto_abk"
            >Requires auto loan at ABK</label
          >
          <label
            nz-checkbox
            formControlName="requiresAutoLoanAtOtherBank"
            i18n="@@bank_programs.flag.requires_auto_other"
            >Requires auto loan at another bank</label
          >
          <label
            nz-checkbox
            formControlName="requiresCreditCardAtOtherBank"
            i18n="@@bank_programs.flag.requires_cc_other"
            >Requires credit card at another bank</label
          >
          <label
            nz-checkbox
            formControlName="requiresCompoundProperty"
            i18n="@@bank_programs.flag.requires_compound"
            >Requires compound property</label
          >
          <label
            nz-checkbox
            formControlName="requiresCollateral"
            i18n="@@bank_programs.flag.requires_collateral"
            >Requires collateral</label
          >
          <label
            nz-checkbox
            formControlName="requiresClubMembership"
            i18n="@@bank_programs.flag.requires_club"
            >Requires club membership</label
          >
          <label
            nz-checkbox
            formControlName="requiresExistingLoan"
            i18n="@@bank_programs.flag.requires_existing_loan"
            >Requires existing loan (buyout)</label
          >
          <label
            nz-checkbox
            formControlName="requiresFRMUVerification"
            i18n="@@bank_programs.flag.requires_frmu"
            >Requires FRMU verification</label
          >
          <label
            nz-checkbox
            formControlName="requiresQualitativeReview"
            i18n="@@bank_programs.flag.requires_qr"
            >Requires qualitative review (unlocks uplift)</label
          >
          <label
            nz-checkbox
            formControlName="requiresNoDocuments"
            i18n="@@bank_programs.flag.requires_no_docs"
            >No-documents lending tier</label
          >
        </div>

        <nz-form-item class="numeric span-2">
          <nz-form-label
            [nzFor]="'minBankStatementBalanceEGP'"
            i18n="@@bank_programs.field.min_bank_statement_balance"
            >Wealth gate — minimum bank-statement balance (EGP)</nz-form-label
          >
          <nz-form-control [nzExtra]="wealthAndHint">
            <input
              nz-input
              id="minBankStatementBalanceEGP"
              formControlName="minBankStatementBalanceEGP"
              inputmode="decimal"
            />
            <ng-template #wealthAndHint>
              <span i18n="@@bank_programs.hint.wealth_and"
                >Combined with the minimum assets gate via AND when both are set.</span
              >
            </ng-template>
          </nz-form-control>
        </nz-form-item>
        <nz-form-item class="numeric span-2">
          <nz-form-label
            [nzFor]="'minAssetsValueEGP'"
            i18n="@@bank_programs.field.min_assets_value"
            >Wealth gate — minimum assets value (EGP)</nz-form-label
          >
          <nz-form-control>
            <input
              nz-input
              id="minAssetsValueEGP"
              formControlName="minAssetsValueEGP"
              inputmode="decimal"
            />
          </nz-form-control>
        </nz-form-item>
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
