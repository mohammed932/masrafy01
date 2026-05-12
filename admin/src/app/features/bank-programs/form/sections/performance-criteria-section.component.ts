import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

@Component({
  selector: 'app-performance-criteria-section',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="section" [formGroup]="group" id="performance">
      <header class="section-header">
        <mat-icon class="section-icon" aria-hidden="true">history</mat-icon>
        <div>
          <h3 class="section-title" i18n="@@bank_programs.section.performance">Performance criteria</h3>
          <p class="section-sub" i18n="@@bank_programs.section.performance_sub">
            Optional — used by buyout + cross-sell programs. Evidence is applicant-declared + optionally bureau-verified.
          </p>
        </div>
      </header>

      <div class="row">
        <span class="row-label" i18n="@@bank_programs.field.performance_include">Include performance criteria for this program</span>
        <mat-slide-toggle formControlName="include"></mat-slide-toggle>
      </div>

      @if (includeOn) {
        <div class="grid">
          <mat-form-field appearance="outline" class="numeric">
            <mat-label i18n="@@bank_programs.field.required_mob_months">Required months-on-book</mat-label>
            <input matInput type="number" formControlName="requiredMOBMonths" min="0" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="numeric">
            <mat-label i18n="@@bank_programs.field.bkt1">BKT-1 no-hit window (months)</mat-label>
            <input matInput type="number" formControlName="bkt1NoHitWithinMonths" min="0" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="numeric">
            <mat-label i18n="@@bank_programs.field.bkt2">BKT-2 no-hit window (months)</mat-label>
            <input matInput type="number" formControlName="bkt2NoHitWithinMonths" min="0" />
          </mat-form-field>
          <div class="full-row">
            <mat-checkbox formControlName="iScoreMOBPerformanceCheck" i18n="@@bank_programs.field.iscore_check">Gate on I-Score MOB</mat-checkbox>
            <mat-checkbox formControlName="requireCurrentLoanStatus" i18n="@@bank_programs.field.require_current_loan">Require currently-active loan</mat-checkbox>
          </div>
        </div>
      }
    </section>
  `,
  styleUrls: ['./section.styles.scss'],
})
export class PerformanceCriteriaSectionComponent {
  @Input({ required: true }) group!: FormGroup;
  get includeOn(): boolean { return Boolean(this.group?.get('include')?.value); }
}
