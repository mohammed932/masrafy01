import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-loan-limits-section',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="section" [formGroup]="group" id="loan-limits">
      <header class="section-header">
        <mat-icon class="section-icon" aria-hidden="true">payments</mat-icon>
        <div>
          <h3 class="section-title" i18n="@@bank_programs.section.loan_limits">Loan limits</h3>
          <p class="section-sub" i18n="@@bank_programs.section.loan_limits_sub">
            Min / max loan amount in EGP. Multi-currency editing and tier overrides land in the next increment.
          </p>
        </div>
      </header>

      <div class="grid">
        <mat-form-field appearance="outline" class="numeric">
          <mat-label i18n="@@bank_programs.field.min_amount_egp">Minimum amount (EGP)</mat-label>
          <input matInput formControlName="minAmountEGP" inputmode="decimal" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="numeric">
          <mat-label i18n="@@bank_programs.field.max_amount_egp">Maximum amount (EGP)</mat-label>
          <input matInput formControlName="maxAmountEGP" inputmode="decimal" />
        </mat-form-field>

        @if (requiresQualitativeReview) {
          <mat-form-field appearance="outline" class="numeric span-2">
            <mat-label i18n="@@bank_programs.field.qr_max_egp">Qualitative-review uplift ceiling (EGP)</mat-label>
            <input matInput formControlName="qualitativeReviewMaxEGP" inputmode="decimal" />
            <mat-hint i18n="@@bank_programs.hint.qr_max">
              Unlocked per-offer only after an operator approves the qualitative-review badge. Must be strictly greater than the base maximum.
            </mat-hint>
          </mat-form-field>
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

  ngOnChanges(changes: SimpleChanges): void {
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
