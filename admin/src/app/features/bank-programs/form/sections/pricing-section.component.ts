import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

@Component({
  selector: 'app-pricing-section',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSlideToggleModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="section" [formGroup]="group" id="pricing">
      <header class="section-header">
        <mat-icon class="section-icon" aria-hidden="true">trending_up</mat-icon>
        <div>
          <h3 class="section-title" i18n="@@bank_programs.section.pricing">Pricing</h3>
          <p class="section-sub" i18n="@@bank_programs.section.pricing_sub">
            Base rate or current effective rate (variable). Tier maps + buyout + fee-waiver land in the next increment.
          </p>
        </div>
      </header>

      <div class="grid">
        <div class="full-row">
          <mat-slide-toggle formControlName="isVariableRate" i18n="@@bank_programs.field.is_variable_rate">
            Variable rate (CBE-linked, quarterly reset)
          </mat-slide-toggle>
        </div>

        @if (!isVariable) {
          <mat-form-field appearance="outline" class="numeric">
            <mat-label i18n="@@bank_programs.field.base_rate">Base rate %</mat-label>
            <input matInput formControlName="baseRatePercent" inputmode="decimal" placeholder="24.0000" />
            <mat-hint i18n="@@bank_programs.hint.precision_7_4">Up to 4 decimals (e.g., 26.5500).</mat-hint>
          </mat-form-field>
        } @else {
          <mat-form-field appearance="outline" class="numeric">
            <mat-label i18n="@@bank_programs.field.current_effective_rate">Current effective rate %</mat-label>
            <input matInput formControlName="currentEffectiveRatePercent" inputmode="decimal" placeholder="26.5500" />
            <mat-hint i18n="@@bank_programs.hint.var_rate_required">
              Required when "Variable rate" is on. Snapshots onto each offer at match time.
            </mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline" class="span-2">
            <mat-label i18n="@@bank_programs.field.variable_rate_note">Variable-rate disclosure note</mat-label>
            <textarea matInput formControlName="variableRateNote" rows="2" placeholder="CBE policy rate + 3%, reviewed quarterly"></textarea>
          </mat-form-field>
        }
      </div>
    </section>
  `,
  styleUrls: ['./section.styles.scss'],
})
export class PricingSectionComponent implements OnInit {
  @Input({ required: true }) group!: FormGroup;

  get isVariable(): boolean {
    return Boolean(this.group?.get('isVariableRate')?.value);
  }

  ngOnInit(): void {
    // Clear inactive rate field on toggle to satisfy FR-011a backend constraint.
    const ctl = this.group.get('isVariableRate');
    if (!ctl) return;
    const apply = (variable: boolean): void => {
      if (variable) {
        this.group.get('baseRatePercent')?.setValue(null, { emitEvent: false });
      } else {
        this.group.get('currentEffectiveRatePercent')?.setValue(null, { emitEvent: false });
        this.group.get('variableRateNote')?.setValue(null, { emitEvent: false });
      }
    };
    apply(Boolean(ctl.value));
    ctl.valueChanges.subscribe((v) => apply(Boolean(v)));
  }
}
