import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { CreditCardOutline } from '@ant-design/icons-angular/icons';

@Component({
  selector: 'app-loan-limits-section',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NzFormModule, NzInputModule, NzIconModule],
  providers: [provideNzIconsPatch([CreditCardOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="section" [formGroup]="group" id="loan-limits">
      <header class="section-header">
        <span class="section-icon" nz-icon nzType="credit-card" nzTheme="outline" aria-hidden="true"></span>
        <div>
          <h3 class="section-title" i18n="@@bank_programs.section.loan_limits">Loan limits</h3>
          <p class="section-sub" i18n="@@bank_programs.section.loan_limits_sub">
            Min / max loan amount in EGP. Multi-currency editing and tier overrides land in the next
            increment.
          </p>
        </div>
      </header>

      <div class="grid">
        <nz-form-item class="numeric">
          <nz-form-label [nzFor]="'minAmountEGP'" i18n="@@bank_programs.field.min_amount_egp"
            >Minimum amount (EGP)</nz-form-label
          >
          <nz-form-control>
            <input
              nz-input
              id="minAmountEGP"
              formControlName="minAmountEGP"
              inputmode="decimal"
            />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item class="numeric">
          <nz-form-label [nzFor]="'maxAmountEGP'" i18n="@@bank_programs.field.max_amount_egp"
            >Maximum amount (EGP)</nz-form-label
          >
          <nz-form-control>
            <input
              nz-input
              id="maxAmountEGP"
              formControlName="maxAmountEGP"
              inputmode="decimal"
            />
          </nz-form-control>
        </nz-form-item>

        @if (requiresQualitativeReview) {
          <nz-form-item class="numeric span-2">
            <nz-form-label
              [nzFor]="'qualitativeReviewMaxEGP'"
              i18n="@@bank_programs.field.qr_max_egp"
              >Qualitative-review uplift ceiling (EGP)</nz-form-label
            >
            <nz-form-control
              [nzExtra]="qrHint"
            >
              <input
                nz-input
                id="qualitativeReviewMaxEGP"
                formControlName="qualitativeReviewMaxEGP"
                inputmode="decimal"
              />
              <ng-template #qrHint>
                <span i18n="@@bank_programs.hint.qr_max">
                  Unlocked per-offer only after an operator approves the qualitative-review badge.
                  Must be strictly greater than the base maximum.
                </span>
              </ng-template>
            </nz-form-control>
          </nz-form-item>
        }
      </div>
    </section>
  `,
  styleUrls: ['./section.styles.scss'],
})
export class LoanLimitsSectionComponent implements OnChanges {
  @Input({ required: true }) group!: FormGroup;
  @Input() currencies: string[] = ['EGP'];
  @Input() requiresQualitativeReview = false;

  ngOnChanges(_changes: SimpleChanges): void {
    if (!this.group) return;
    const ctl = this.group.get('qualitativeReviewMaxEGP');
    if (!ctl) return;
    if (this.requiresQualitativeReview) {
      ctl.enable({ emitEvent: false });
    } else {
      ctl.disable({ emitEvent: false });
      ctl.setValue(null, { emitEvent: false });
    }
  }
}
