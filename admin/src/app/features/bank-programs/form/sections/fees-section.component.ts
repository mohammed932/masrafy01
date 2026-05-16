import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { SnippetsOutline } from '@ant-design/icons-angular/icons';

@Component({
  selector: 'app-fees-section',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzSwitchModule,
    NzIconModule,
  ],
  providers: [provideNzIconsPatch([SnippetsOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="section" [formGroup]="group" id="fees">
      <header class="section-header">
        <span class="section-icon" nz-icon nzType="snippets" nzTheme="outline" aria-hidden="true"></span>
        <div>
          <h3 class="section-title" i18n="@@bank_programs.section.fees">Fees</h3>
          <p class="section-sub" i18n="@@bank_programs.section.fees_sub">
            Admin fee, stamp duty, life insurance, late-payment, payoff percentages.
          </p>
        </div>
      </header>

      <div class="grid">
        <nz-form-item class="numeric">
          <nz-form-label [nzFor]="'adminFeePercent'" i18n="@@bank_programs.field.admin_fee"
            >Admin fee %</nz-form-label
          >
          <nz-form-control>
            <input
              nz-input
              id="adminFeePercent"
              formControlName="adminFeePercent"
              inputmode="decimal"
            />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item class="numeric">
          <nz-form-label [nzFor]="'stampDutyPercent'" i18n="@@bank_programs.field.stamp_duty"
            >Stamp duty %</nz-form-label
          >
          <nz-form-control>
            <input
              nz-input
              id="stampDutyPercent"
              formControlName="stampDutyPercent"
              inputmode="decimal"
            />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item class="numeric">
          <nz-form-label [nzFor]="'lifeInsurancePercent'" i18n="@@bank_programs.field.life_insurance_pct"
            >Life insurance %</nz-form-label
          >
          <nz-form-control>
            <input
              nz-input
              id="lifeInsurancePercent"
              formControlName="lifeInsurancePercent"
              inputmode="decimal"
            />
          </nz-form-control>
        </nz-form-item>
        <div class="row">
          <span class="row-label" i18n="@@bank_programs.field.life_insurance_mandatory"
            >Life insurance mandatory</span
          >
          <nz-switch formControlName="lifeInsuranceMandatory"></nz-switch>
        </div>
        <nz-form-item class="numeric">
          <nz-form-label [nzFor]="'latePaymentFeePercent'" i18n="@@bank_programs.field.late_payment"
            >Late payment %</nz-form-label
          >
          <nz-form-control>
            <input
              nz-input
              id="latePaymentFeePercent"
              formControlName="latePaymentFeePercent"
              inputmode="decimal"
            />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item class="numeric">
          <nz-form-label [nzFor]="'payoffCashPercent'" i18n="@@bank_programs.field.payoff_cash"
            >Payoff (cash) %</nz-form-label
          >
          <nz-form-control>
            <input
              nz-input
              id="payoffCashPercent"
              formControlName="payoffCashPercent"
              inputmode="decimal"
            />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item class="numeric">
          <nz-form-label [nzFor]="'payoffBuyoutPercent'" i18n="@@bank_programs.field.payoff_buyout"
            >Payoff (buyout) %</nz-form-label
          >
          <nz-form-control>
            <input
              nz-input
              id="payoffBuyoutPercent"
              formControlName="payoffBuyoutPercent"
              inputmode="decimal"
            />
          </nz-form-control>
        </nz-form-item>
      </div>
    </section>
  `,
  styleUrls: ['./section.styles.scss'],
})
export class FeesSectionComponent {
  @Input({ required: true }) group!: FormGroup;
}
