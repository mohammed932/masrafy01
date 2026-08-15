import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { IdcardOutline } from '@ant-design/icons-angular/icons';
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
    NzFormModule,
    NzInputModule,
    NzCheckboxModule,
    NzIconModule,
    BrandSelectComponent,
  ],
  providers: [provideNzIconsPatch([IdcardOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="section" [formGroup]="group" id="identity">
      <header class="section-header">
        <span
          class="section-icon"
          nz-icon
          nzType="idcard"
          nzTheme="outline"
          aria-hidden="true"
        ></span>
        <div>
          <h3 class="section-title" i18n="@@bank_programs.section.identity">Identity</h3>
          <p class="section-sub" i18n="@@bank_programs.section.identity_sub">
            Program code (locked after creation), bank, friendly name, and product class.
          </p>
        </div>
      </header>

      <div class="grid">
        <nz-form-item>
          <nz-form-label [nzFor]="'programCode'" i18n="@@bank_programs.field.program_code"
            >Program code</nz-form-label
          >
          <nz-form-control [nzExtra]="programCodeHint">
            <input
              nz-input
              id="programCode"
              formControlName="programCode"
              placeholder="ABK-AUTO-V1"
            />
            <ng-template #programCodeHint>
              <span i18n="@@bank_programs.hint.program_code"
                >A–Z, 0–9, _, − (3–32 chars). Immutable.</span
              >
            </ng-template>
          </nz-form-control>
        </nz-form-item>

        <nz-form-item>
          <nz-form-label [nzFor]="'bankName'" i18n="@@bank_programs.field.bank_name"
            >Bank name</nz-form-label
          >
          <nz-form-control>
            <input nz-input id="bankName" formControlName="bankName" />
          </nz-form-control>
        </nz-form-item>

        <nz-form-item>
          <nz-form-label [nzFor]="'friendlyName'" i18n="@@bank_programs.field.friendly_name"
            >Friendly name</nz-form-label
          >
          <nz-form-control>
            <input nz-input id="friendlyName" formControlName="friendlyName" />
          </nz-form-control>
        </nz-form-item>

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

  readonly programTypeOptions: BrandSelectOption[] = [
    { value: 'income_proof', label: 'Income-proof' },
    { value: 'income_surrogate', label: 'Income-surrogate' },
  ];

  readonly productCategoryOptions = computed<BrandSelectOption[]>(() =>
    this.productCategories().map((m) => ({ value: m.key, label: m.labelEn })),
  );
}
