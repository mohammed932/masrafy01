import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { ClockCircleOutline } from '@ant-design/icons-angular/icons';

@Component({
  selector: 'app-tenor-section',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NzFormModule, NzInputModule, NzIconModule],
  providers: [provideNzIconsPatch([ClockCircleOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="section" [formGroup]="group" id="tenor">
      <header class="section-header">
        <span
          class="section-icon"
          nz-icon
          nzType="clock-circle"
          nzTheme="outline"
          aria-hidden="true"
        ></span>
        <div>
          <h3 class="section-title" i18n="@@bank_programs.section.tenor">Tenor</h3>
          <p class="section-sub" i18n="@@bank_programs.section.tenor_sub">
            Minimum and maximum loan duration in months. Tier overrides ship in the next increment.
          </p>
        </div>
      </header>

      <div class="grid">
        <nz-form-item class="numeric">
          <nz-form-label [nzFor]="'minMonths'" i18n="@@bank_programs.field.min_months"
            >Minimum months</nz-form-label
          >
          <nz-form-control>
            <input
              nz-input
              id="minMonths"
              type="number"
              formControlName="minMonths"
              min="1"
              max="480"
            />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item class="numeric">
          <nz-form-label [nzFor]="'maxMonths'" i18n="@@bank_programs.field.max_months"
            >Maximum months</nz-form-label
          >
          <nz-form-control>
            <input
              nz-input
              id="maxMonths"
              type="number"
              formControlName="maxMonths"
              min="1"
              max="480"
            />
          </nz-form-control>
        </nz-form-item>
      </div>
    </section>
  `,
  styleUrls: ['./section.styles.scss'],
})
export class TenorSectionComponent {
  @Input({ required: true }) group!: FormGroup;
}
