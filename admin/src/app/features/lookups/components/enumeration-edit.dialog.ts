import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { LookupsApiService, type EnumerationRow } from '../lookups.api.service';

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
    MatIconModule,
    ButtonModule,
    InputTextModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-body">
      <h2 class="dialog-title">
        @if (data.mode === 'create') {
          <span i18n="@@lookups.dialog.titleCreate">Add new value</span>
        } @else {
          <span i18n="@@lookups.dialog.titleEdit">Edit value</span>
        }
        <span class="type-chip">{{ data.type }}</span>
      </h2>

      <form [formGroup]="form" class="form">
        <div class="field">
          <label for="lk-key" class="field-label" i18n="@@lookups.field.key"
            >Key (machine-readable)</label
          >
          <input
            pInputText
            id="lk-key"
            formControlName="key"
            [readonly]="data.mode === 'edit'"
            class="w-full"
          />
          <small class="field-hint" i18n="@@lookups.field.keyHint"
            >letters, digits, underscore or hyphen only — used in API + database</small
          >
        </div>

        <div class="field">
          <label for="lk-label" class="field-label" i18n="@@lookups.field.labelEn">Label</label>
          <input
            pInputText
            id="lk-label"
            formControlName="labelEn"
            maxlength="160"
            class="w-full"
          />
        </div>

        <div class="field">
          <label for="lk-sort" class="field-label" i18n="@@lookups.field.sortOrder">Sort order</label>
          <input
            pInputText
            id="lk-sort"
            type="number"
            formControlName="sortOrder"
            min="0"
            class="w-full"
          />
          <small class="field-hint" i18n="@@lookups.field.sortOrderHint"
            >controls the order in dropdowns</small
          >
        </div>

        @if (errorCode()) {
          <p class="error" role="alert">
            <mat-icon>error</mat-icon>
            <span>{{ errorCode() }}</span>
          </p>
        }
      </form>

      <div class="dialog-actions">
        <p-button
          severity="secondary"
          [text]="true"
          (onClick)="cancel()"
          i18n-label="@@lookups.dialog.cancel"
          label="Cancel"
        />
        <p-button
          (onClick)="save()"
          [disabled]="!form.valid || submitting()"
          [loading]="submitting()"
          i18n-label="@@lookups.dialog.save"
          label="Save"
        />
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
      .dialog-title {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0;
        font-size: var(--text-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .type-chip {
        font-size: var(--text-xs);
        font-weight: var(--font-weight-medium);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        background: var(--color-tonal-accent-bg);
        color: var(--color-tonal-accent);
        padding: 2px 10px;
        border-radius: var(--radius-pill);
      }
      .form {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        margin: 0;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .field-label {
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-secondary);
        letter-spacing: 0.02em;
      }
      .field-hint {
        font-size: var(--text-xxs);
        color: var(--color-text-tertiary);
        line-height: var(--line-height-base);
      }
      .w-full {
        inline-size: 100%;
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
  private readonly dialogRef = inject(DynamicDialogRef);
  private readonly dialogConfig = inject(DynamicDialogConfig);
  protected readonly data: EnumerationEditDialogData = this.dialogConfig.data;

  protected readonly submitting = signal(false);
  protected readonly errorCode = signal<string | null>(null);

  protected readonly form = new FormGroup({
    key: new FormControl<string>(this.data.row?.key ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)],
    }),
    labelEn: new FormControl<string>(this.data.row?.labelEn ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(160)],
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
    this.errorCode.set(null);
    this.submitting.set(true);
    try {
      const v = this.form.value;
      const labelMirror = v.labelEn ?? '';
      if (this.data.mode === 'create') {
        await this.api.create({
          type: this.data.type,
          key: v.key!,
          labelEn: v.labelEn!,
          labelAr: labelMirror,
          sortOrder: v.sortOrder,
        });
      } else if (this.data.row) {
        await this.api.update(this.data.row.id, {
          labelEn: v.labelEn,
          labelAr: labelMirror,
          sortOrder: v.sortOrder,
        });
      }
      this.dialogRef.close(true);
    } catch (err) {
      const code = (err as { error?: { code?: string } }).error?.code;
      this.errorCode.set(code ?? 'INTERNAL_ERROR');
    } finally {
      this.submitting.set(false);
    }
  }
}
