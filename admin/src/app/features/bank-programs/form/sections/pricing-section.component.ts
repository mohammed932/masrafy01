import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { RiseOutline } from '@ant-design/icons-angular/icons';

@Component({
  selector: 'app-pricing-section',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzIconModule,
    NzSwitchModule,
  ],
  providers: [provideNzIconsPatch([RiseOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="section" [formGroup]="group" id="pricing">
      <header class="section-header">
        <span class="section-icon" nz-icon nzType="rise" nzTheme="outline" aria-hidden="true"></span>
        <div>
          <h3 class="section-title" i18n="@@bank_programs.section.pricing">Pricing</h3>
          <p class="section-sub" i18n="@@bank_programs.section.pricing_sub">
            Base rate or current effective rate (variable). Tier maps + buyout + fee-waiver land in
            the next increment.
          </p>
        </div>
      </header>

      <div class="grid">
        <div class="full-row">
          <label>
            <nz-switch formControlName="isVariableRate"></nz-switch>
            <span i18n="@@bank_programs.field.is_variable_rate">
              Variable rate (CBE-linked, quarterly reset)
            </span>
          </label>
        </div>

        @if (!isVariable) {
          <nz-form-item class="numeric">
            <nz-form-label [nzFor]="'baseRatePercent'" i18n="@@bank_programs.field.base_rate"
              >Base rate</nz-form-label
            >
            <nz-form-control [nzExtra]="baseRateHint">
              <nz-input-group nzAddOnAfter="%" class="rate-group">
                <input
                  nz-input
                  id="baseRatePercent"
                  formControlName="baseRatePercent"
                  inputmode="decimal"
                  placeholder="24.0000"
                />
              </nz-input-group>
              <ng-template #baseRateHint>
                <span i18n="@@bank_programs.hint.precision_7_4"
                  >Up to 4 decimals (e.g., 26.5500).</span
                >
              </ng-template>
            </nz-form-control>
          </nz-form-item>
        } @else {
          <nz-form-item class="numeric">
            <nz-form-label
              [nzFor]="'currentEffectiveRatePercent'"
              i18n="@@bank_programs.field.current_effective_rate"
              >Current effective rate</nz-form-label
            >
            <nz-form-control [nzExtra]="effectiveHint">
              <nz-input-group nzAddOnAfter="%" class="rate-group">
                <input
                  nz-input
                  id="currentEffectiveRatePercent"
                  formControlName="currentEffectiveRatePercent"
                  inputmode="decimal"
                  placeholder="26.5500"
                />
              </nz-input-group>
              <ng-template #effectiveHint>
                <span i18n="@@bank_programs.hint.var_rate_required">
                  Required when "Variable rate" is on. Snapshots onto each offer at match time.
                </span>
              </ng-template>
            </nz-form-control>
          </nz-form-item>

          <nz-form-item class="span-2">
            <nz-form-label
              [nzFor]="'variableRateNote'"
              i18n="@@bank_programs.field.variable_rate_note"
              >Variable-rate disclosure note</nz-form-label
            >
            <nz-form-control>
              <textarea
                nz-input
                id="variableRateNote"
                formControlName="variableRateNote"
                rows="2"
                placeholder="CBE policy rate + 3%, reviewed quarterly"
              ></textarea>
            </nz-form-control>
          </nz-form-item>
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
