import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzModalRef, NZ_MODAL_DATA } from 'ng-zorro-antd/modal';
import { CloseCircleOutline } from '@ant-design/icons-angular/icons';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode } from '@core/auth/auth.types';
import { LookupsApiService, type EnumerationRow } from '../lookups.api.service';

/**
 * Enumeration type edited by business name only: the dialog hides the machine-key
 * field and derives the key from the English label. Predefined program names are
 * curated by non-technical staff, and a new one starts offerable under all four
 * loan categories (the server's default) — narrowing that is a separate job on
 * the catalog's "Loan categories" tab, so there is nothing to pick here beyond
 * the two labels.
 */
const AUTO_KEY_TYPE = 'program_name';

export interface EnumerationEditDialogData {
  mode: 'create' | 'edit';
  type: string;
  row?: EnumerationRow;
}

@Component({
  selector: 'app-enumeration-edit-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzInputModule,
    NzFormModule,
    NzIconModule,
  ],
  providers: [provideNzIconsPatch([CloseCircleOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-body">
      <form nz-form nzLayout="vertical" [formGroup]="form" class="form">
        @if (!autoKey) {
          <nz-form-item>
            <nz-form-label nzFor="lk-key" nzRequired i18n="@@lookups.field.key"
              >Key (machine-readable)</nz-form-label
            >
            <nz-form-control [nzErrorTip]="keyErrTpl" [nzExtra]="keyHintTpl">
              <input nz-input id="lk-key" formControlName="key" [readOnly]="data.mode === 'edit'" />
              <ng-template #keyErrTpl let-control>
                @if (control.errors?.['required']) {
                  <span i18n="@@lookups.field.key.required">Required</span>
                } @else if (control.errors?.['pattern']) {
                  <span i18n="@@lookups.field.key.pattern">Invalid format</span>
                }
              </ng-template>
              <ng-template #keyHintTpl>
                <span i18n="@@lookups.field.keyHint"
                  >letters, digits, underscore or hyphen only — used in API + database</span
                >
              </ng-template>
            </nz-form-control>
          </nz-form-item>
        }

        <nz-form-item>
          <nz-form-label nzFor="lk-label" nzRequired i18n="@@lookups.field.labelEnglish"
            >English label</nz-form-label
          >
          <nz-form-control [nzErrorTip]="labelErrTpl">
            <input nz-input id="lk-label" formControlName="labelEn" [attr.maxlength]="labelMax" />
            <ng-template #labelErrTpl let-control>
              @if (control.errors?.['required']) {
                <span i18n="@@lookups.field.label.required">Required</span>
              }
            </ng-template>
          </nz-form-control>
        </nz-form-item>

        <nz-form-item>
          <nz-form-label nzFor="lk-label-ar" nzRequired i18n="@@lookups.field.labelAr"
            >Arabic label</nz-form-label
          >
          <nz-form-control [nzErrorTip]="labelArErrTpl">
            <input
              nz-input
              id="lk-label-ar"
              formControlName="labelAr"
              dir="rtl"
              [attr.maxlength]="labelMax"
            />
            <ng-template #labelArErrTpl let-control>
              @if (control.errors?.['required']) {
                <span i18n="@@lookups.field.labelAr.required">Required</span>
              }
            </ng-template>
          </nz-form-control>
        </nz-form-item>

        <nz-form-item>
          <nz-form-label nzFor="lk-sort" i18n="@@lookups.field.sortOrder">Sort order</nz-form-label>
          <nz-form-control [nzExtra]="sortHintTpl">
            <input nz-input id="lk-sort" type="number" formControlName="sortOrder" min="0" />
            <ng-template #sortHintTpl>
              <span i18n="@@lookups.field.sortOrderHint">controls the order in dropdowns</span>
            </ng-template>
          </nz-form-control>
        </nz-form-item>

        @if (errorMessage(); as message) {
          <p class="error" role="alert">
            <span nz-icon nzType="close-circle" nzTheme="outline" aria-hidden="true"></span>
            <span>{{ message }}</span>
          </p>
        }
      </form>

      <div class="dialog-actions">
        <button
          nz-button
          nzType="default"
          type="button"
          (click)="cancel()"
          i18n="@@lookups.dialog.cancel"
        >
          Cancel
        </button>
        <button
          nz-button
          nzType="primary"
          type="button"
          (click)="save()"
          [disabled]="!form.valid || submitting()"
          [nzLoading]="submitting()"
          i18n="@@lookups.dialog.save"
        >
          Save
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .dialog-body {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .form {
        margin: 0;
      }
      .error {
        background: var(--color-error-bg);
        color: var(--color-error);
        border-radius: var(--radius-md);
        padding: var(--space-2) var(--space-3);
        margin: 0;
        display: inline-flex;
        gap: var(--space-2);
        align-items: center;
        font-size: var(--text-sm);
      }
      .dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-2);
        padding-block-start: var(--space-2);
        border-block-start: 1px solid var(--color-border-default);
      }
    `,
  ],
})
export class EnumerationEditDialogComponent {
  private readonly api = inject(LookupsApiService);
  private readonly errorCodes = inject(ErrorCodeService);
  private readonly dialogRef = inject(NzModalRef<EnumerationEditDialogComponent, boolean>);
  protected readonly data = inject<EnumerationEditDialogData>(NZ_MODAL_DATA);

  /** True for program names: no machine-key field, key derived from the English label. */
  protected readonly autoKey = this.data.type === AUTO_KEY_TYPE;
  /** Label length cap — program names must fit the bank_program.friendlyName column (120). */
  protected readonly labelMax = this.autoKey ? 120 : 160;

  protected readonly submitting = signal(false);
  /** Localized failure text — mapping goes through ErrorCodeService (Principle III, A22). */
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = new FormGroup({
    key: new FormControl<string>(this.data.row?.key ?? '', {
      nonNullable: true,
      validators: this.autoKey
        ? []
        : [Validators.required, Validators.pattern(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)],
    }),
    labelEn: new FormControl<string>(this.data.row?.labelEn ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(this.labelMax)],
    }),
    labelAr: new FormControl<string>(this.data.row?.labelAr ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(this.labelMax)],
    }),
    sortOrder: new FormControl<number>(this.data.row?.sortOrder ?? 0, {
      nonNullable: true,
      validators: [Validators.min(0)],
    }),
  });

  cancel(): void {
    this.dialogRef.close(false);
  }

  async save(): Promise<void> {
    this.errorMessage.set(null);
    this.submitting.set(true);
    try {
      const v = this.form.getRawValue();
      if (this.data.mode === 'create') {
        const key = this.autoKey ? this.slugify(v.labelEn) : v.key;
        if (!key) {
          this.fail('VALIDATION_FAILED');
          return;
        }
        await this.api.create({
          type: this.data.type,
          key,
          labelEn: v.labelEn,
          labelAr: v.labelAr,
          sortOrder: v.sortOrder,
        });
      } else if (this.data.row) {
        await this.api.update(this.data.row.id, {
          labelEn: v.labelEn,
          labelAr: v.labelAr,
          sortOrder: v.sortOrder,
        });
      }
      this.dialogRef.close(true);
    } catch (err) {
      const code = (err as { error?: { code?: string } }).error?.code;
      this.fail(code ?? 'INTERNAL_ERROR');
    } finally {
      this.submitting.set(false);
    }
  }

  private fail(code: string): void {
    this.errorMessage.set(this.errorCodes.toLocalizedMessage(code as ErrorCode));
  }

  /** Machine key derived from an English label — lowercase, non-alnum → `_`, trimmed, ≤64. */
  private slugify(s: string): string {
    return s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 64);
  }
}
