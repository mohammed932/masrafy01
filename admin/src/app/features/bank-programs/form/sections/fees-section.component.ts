import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

@Component({
  selector: 'app-fees-section',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MatIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="section" [formGroup]="group" id="fees">
      <header class="section-header">
        <mat-icon class="section-icon" aria-hidden="true">request_quote</mat-icon>
        <div>
          <h3 class="section-title" i18n="@@bank_programs.section.fees">Fees</h3>
          <p class="section-sub" i18n="@@bank_programs.section.fees_sub">
            Admin fee, stamp duty, life insurance, late-payment, payoff percentages.
          </p>
        </div>
      </header>

      <div class="grid">
        <mat-form-field appearance="outline" class="numeric">
          <mat-label i18n="@@bank_programs.field.admin_fee">Admin fee %</mat-label>
          <input matInput formControlName="adminFeePercent" inputmode="decimal" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="numeric">
          <mat-label i18n="@@bank_programs.field.stamp_duty">Stamp duty %</mat-label>
          <input matInput formControlName="stampDutyPercent" inputmode="decimal" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="numeric">
          <mat-label i18n="@@bank_programs.field.life_insurance_pct">Life insurance %</mat-label>
          <input matInput formControlName="lifeInsurancePercent" inputmode="decimal" />
        </mat-form-field>
        <div class="row">
          <span class="row-label" i18n="@@bank_programs.field.life_insurance_mandatory">Life insurance mandatory</span>
          <mat-slide-toggle formControlName="lifeInsuranceMandatory"></mat-slide-toggle>
        </div>
        <mat-form-field appearance="outline" class="numeric">
          <mat-label i18n="@@bank_programs.field.late_payment">Late payment %</mat-label>
          <input matInput formControlName="latePaymentFeePercent" inputmode="decimal" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="numeric">
          <mat-label i18n="@@bank_programs.field.payoff_cash">Payoff (cash) %</mat-label>
          <input matInput formControlName="payoffCashPercent" inputmode="decimal" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="numeric">
          <mat-label i18n="@@bank_programs.field.payoff_buyout">Payoff (buyout) %</mat-label>
          <input matInput formControlName="payoffBuyoutPercent" inputmode="decimal" />
        </mat-form-field>
      </div>
    </section>
  `,
  styleUrls: ['./section.styles.scss'],
})
export class FeesSectionComponent {
  @Input({ required: true }) group!: FormGroup;
}
