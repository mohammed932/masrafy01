import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { HistoryOutline } from '@ant-design/icons-angular/icons';

@Component({
  selector: 'app-performance-criteria-section',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzCheckboxModule,
    NzSwitchModule,
    NzIconModule,
  ],
  providers: [provideNzIconsPatch([HistoryOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="section" [formGroup]="group" id="performance">
      <header class="section-header">
        <span class="section-icon" nz-icon nzType="history" nzTheme="outline" aria-hidden="true"></span>
        <div>
          <h3 class="section-title" i18n="@@bank_programs.section.performance">
            Performance criteria
          </h3>
          <p class="section-sub" i18n="@@bank_programs.section.performance_sub">
            Optional — used by buyout + cross-sell programs. Evidence is applicant-declared +
            optionally bureau-verified.
          </p>
        </div>
      </header>

      <div class="row">
        <span class="row-label" i18n="@@bank_programs.field.performance_include"
          >Include performance criteria for this program</span
        >
        <nz-switch formControlName="include"></nz-switch>
      </div>

      @if (includeOn) {
        <div class="grid">
          <nz-form-item class="numeric">
            <nz-form-label
              [nzFor]="'requiredMOBMonths'"
              i18n="@@bank_programs.field.required_mob_months"
              >Required months-on-book</nz-form-label
            >
            <nz-form-control>
              <input
                nz-input
                id="requiredMOBMonths"
                type="number"
                formControlName="requiredMOBMonths"
                min="0"
              />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item class="numeric">
            <nz-form-label [nzFor]="'bkt1NoHitWithinMonths'" i18n="@@bank_programs.field.bkt1"
              >BKT-1 no-hit window (months)</nz-form-label
            >
            <nz-form-control>
              <input
                nz-input
                id="bkt1NoHitWithinMonths"
                type="number"
                formControlName="bkt1NoHitWithinMonths"
                min="0"
              />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item class="numeric">
            <nz-form-label [nzFor]="'bkt2NoHitWithinMonths'" i18n="@@bank_programs.field.bkt2"
              >BKT-2 no-hit window (months)</nz-form-label
            >
            <nz-form-control>
              <input
                nz-input
                id="bkt2NoHitWithinMonths"
                type="number"
                formControlName="bkt2NoHitWithinMonths"
                min="0"
              />
            </nz-form-control>
          </nz-form-item>
          <div class="full-row">
            <label
              nz-checkbox
              formControlName="iScoreMOBPerformanceCheck"
              i18n="@@bank_programs.field.iscore_check"
              >Gate on I-Score MOB</label
            >
            <label
              nz-checkbox
              formControlName="requireCurrentLoanStatus"
              i18n="@@bank_programs.field.require_current_loan"
              >Require currently-active loan</label
            >
          </div>
        </div>
      }
    </section>
  `,
  styleUrls: ['./section.styles.scss'],
})
export class PerformanceCriteriaSectionComponent {
  @Input({ required: true }) group!: FormGroup;
  get includeOn(): boolean {
    return Boolean(this.group?.get('include')?.value);
  }
}
