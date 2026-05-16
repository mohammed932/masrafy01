import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { DisconnectOutline } from '@ant-design/icons-angular/icons';
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
  imports: [CommonModule, FormsModule, NzFormModule, NzSelectModule, NzIconModule],
  providers: [provideNzIconsPatch([DisconnectOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!enums.unavailable()) {
      <nz-form-item>
        <nz-form-label>{{ label() }}</nz-form-label>
        <nz-form-control>
          <nz-select
            [nzMode]="multiple() ? 'multiple' : 'default'"
            [ngModel]="value()"
            (ngModelChange)="emit($event)"
            name="tierKey"
          >
            @for (m of members(); track m.key) {
              <nz-option [nzValue]="m.key" [nzLabel]="m.labelEn"></nz-option>
            }
          </nz-select>
        </nz-form-control>
      </nz-form-item>
    } @else {
      <div class="unavailable">
        <span nz-icon nzType="disconnect" nzTheme="outline" aria-hidden="true"></span>
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
