import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { PlatformEnumerationsService } from '../../../core/platform-enumerations/platform-enumerations.service';
import type { EnumerationType } from '../../../core/platform-enumerations/platform-enumerations.types';

/**
 * Generic dropdown bound to the live `PlatformEnumeration` registry.
 * Fail-closed: disables itself + surfaces the localized "enumerations unavailable" state.
 *
 * Used by tier-map editors in the next increment (Phase 4) for richer tier overrides.
 * For Phase 3 MVP the form has hardcoded employment/transfer-type pickers; this
 * component is in place so Phase 4 can wire it in without churn.
 */
@Component({
  selector: 'app-tier-key-picker',
  standalone: true,
  imports: [CommonModule, MatFormFieldModule, MatSelectModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!enums.unavailable()) {
      <mat-form-field appearance="outline">
        <mat-label>{{ label() }}</mat-label>
        <mat-select
          [value]="value()"
          (selectionChange)="emit($event.value)"
          [multiple]="multiple()"
        >
          @for (m of members(); track m.key) {
            <mat-option [value]="m.key">{{ m.labelEn }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    } @else {
      <div class="unavailable">
        <mat-icon aria-hidden="true">cloud_off</mat-icon>
        <span i18n="@@bank_programs.form.enums_unavailable"
          >Enumerations unavailable, retry shortly.</span
        >
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .unavailable {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        color: var(--color-text-tertiary);
        font-size: var(--text-xs);
        padding: var(--space-2);
        border: 1px dashed var(--color-border-default);
        border-radius: var(--radius-sm);
      }
    `,
  ],
})
export class TierKeyPickerComponent {
  readonly enums = inject(PlatformEnumerationsService);
  readonly enumerationType = input.required<EnumerationType>();
  readonly label = input<string>('');
  readonly value = input<string | string[] | null>(null);
  readonly multiple = input<boolean>(false);
  readonly valueChange = output<string | string[]>();

  readonly members = computed(() => this.enums.membersFor(this.enumerationType())());

  emit(next: string | string[]): void {
    this.valueChange.emit(next);
  }
}
