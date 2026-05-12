import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-tenor-section',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="section" [formGroup]="group" id="tenor">
      <header class="section-header">
        <mat-icon class="section-icon" aria-hidden="true">schedule</mat-icon>
        <div>
          <h3 class="section-title" i18n="@@bank_programs.section.tenor">Tenor</h3>
          <p class="section-sub" i18n="@@bank_programs.section.tenor_sub">
            Minimum and maximum loan duration in months. Tier overrides ship in the next increment.
          </p>
        </div>
      </header>

      <div class="grid">
        <mat-form-field appearance="outline" class="numeric">
          <mat-label i18n="@@bank_programs.field.min_months">Minimum months</mat-label>
          <input matInput type="number" formControlName="minMonths" min="1" max="480" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="numeric">
          <mat-label i18n="@@bank_programs.field.max_months">Maximum months</mat-label>
          <input matInput type="number" formControlName="maxMonths" min="1" max="480" />
        </mat-form-field>
      </div>
    </section>
  `,
  styleUrls: ['./section.styles.scss'],
})
export class TenorSectionComponent {
  @Input({ required: true }) group!: FormGroup;
}
