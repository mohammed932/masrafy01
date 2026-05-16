import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, Input } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { PlatformEnumerationsService } from '../../../../core/platform-enumerations/platform-enumerations.service';
import {
  BrandSelectComponent,
  type BrandSelectOption,
} from '../../../../shared/brand-select/brand-select.component';

@Component({
  selector: 'app-identity-section',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatIconModule,
    BrandSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="section" [formGroup]="group" id="identity">
      <header class="section-header">
        <mat-icon class="section-icon" aria-hidden="true">badge</mat-icon>
        <div>
          <h3 class="section-title" i18n="@@bank_programs.section.identity">Identity</h3>
          <p class="section-sub" i18n="@@bank_programs.section.identity_sub">
            Program code (locked after creation), bank, friendly name, and product class.
          </p>
        </div>
      </header>

      <div class="grid">
        <mat-form-field appearance="outline">
          <mat-label i18n="@@bank_programs.field.program_code">Program code</mat-label>
          <input matInput formControlName="programCode" placeholder="ABK-AUTO-V1" />
          <mat-hint i18n="@@bank_programs.hint.program_code"
            >A–Z, 0–9, _, − (3–32 chars). Immutable.</mat-hint
          >
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label i18n="@@bank_programs.field.bank_name">Bank name</mat-label>
          <input matInput formControlName="bankName" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label i18n="@@bank_programs.field.friendly_name">Friendly name</mat-label>
          <input matInput formControlName="friendlyName" />
        </mat-form-field>

        <app-brand-select
          formControlName="programType"
          [options]="programTypeOptions"
          i18n-label="@@bank_programs.field.program_type"
          label="Program type"
        ></app-brand-select>

        <app-brand-select
          formControlName="productCategory"
          [options]="productCategoryOptions()"
          i18n-label="@@bank_programs.field.product_category"
          label="Product category"
        ></app-brand-select>

        <app-brand-select
          class="span-2"
          [options]="currencyOptions()"
          [multiple]="true"
          [value]="currentCurrencies"
          (valueChange)="onCurrenciesChange($event)"
          i18n-label="@@bank_programs.field.currencies"
          label="Currencies"
          i18n-hint="@@bank_programs.hint.currencies"
          hint="EGP is the default. Add USD / EUR for secured loans."
        ></app-brand-select>
      </div>
    </section>
  `,
  styleUrls: ['./section.styles.scss'],
})
export class IdentitySectionComponent {
  private readonly enums = inject(PlatformEnumerationsService);

  @Input({ required: true }) group!: FormGroup;
  @Input() editMode = false;

  readonly productCategories = this.enums.membersFor('product_category');
  readonly currencies = this.enums.membersFor('currency');

  readonly programTypeOptions: BrandSelectOption[] = [
    { value: 'income_proof', label: 'Income-proof' },
    { value: 'income_surrogate', label: 'Income-surrogate' },
  ];

  readonly productCategoryOptions = computed<BrandSelectOption[]>(() =>
    this.productCategories().map((m) => ({ value: m.key, label: m.labelEn })),
  );

  readonly currencyOptions = computed<BrandSelectOption[]>(() =>
    this.currencies().map((m) => ({ value: m.key, label: m.key, secondary: m.labelEn })),
  );

  get currentCurrencies(): string[] {
    const arr = this.group?.get('currencies') as FormArray | null;
    return (arr?.value as string[] | undefined) ?? ['EGP'];
  }

  setCurrencies(next: string[]): void {
    const arr = this.group.get('currencies') as FormArray;
    arr.clear();
    for (const c of next) {
      arr.push(new FormControl(c, { nonNullable: true }));
    }
    arr.markAsDirty();
  }

  onCurrenciesChange(next: string | string[]): void {
    this.setCurrencies(Array.isArray(next) ? next : [next]);
  }
}
