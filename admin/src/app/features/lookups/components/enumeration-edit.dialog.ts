import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogModule,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import {
  LookupsApiService,
  type EnumerationRow,
} from '../lookups.api.service';

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
    MatDialogModule,
    MatDialogActions,
    MatDialogContent,
    MatDialogTitle,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>
      @if (data.mode === 'create') {
        <span i18n="@@lookups.dialog.titleCreate">Add new value</span>
      } @else {
        <span i18n="@@lookups.dialog.titleEdit">Edit value</span>
      }
      <span class="type-chip">{{ data.type }}</span>
    </h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="form">
        <mat-form-field appearance="outline">
          <mat-label i18n="@@lookups.field.key">Key (machine-readable)</mat-label>
          <input matInput formControlName="key" [readonly]="data.mode === 'edit'" />
          <mat-hint i18n="@@lookups.field.keyHint"
            >letters, digits, underscore or hyphen only — used in API + database</mat-hint
          >
        </mat-form-field>

        <div class="row-2">
          <mat-form-field appearance="outline">
            <mat-label i18n="@@lookups.field.labelEn">Label (English)</mat-label>
            <input matInput formControlName="labelEn" maxlength="160" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="rtl-field">
            <mat-label i18n="@@lookups.field.labelAr">Label (Arabic)</mat-label>
            <input matInput formControlName="labelAr" maxlength="160" dir="rtl" />
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label i18n="@@lookups.field.sortOrder">Sort order</mat-label>
          <input matInput type="number" formControlName="sortOrder" min="0" />
          <mat-hint i18n="@@lookups.field.sortOrderHint"
            >controls the order in dropdowns</mat-hint
          >
        </mat-form-field>

        @if (errorCode()) {
          <p class="error" role="alert">
            <mat-icon>error</mat-icon>
            <span>{{ errorCode() }}</span>
          </p>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="cancel()" i18n="@@lookups.dialog.cancel">
        Cancel
      </button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        (click)="save()"
        [disabled]="!form.valid || submitting()"
        [attr.aria-busy]="submitting()"
        i18n="@@lookups.dialog.save"
      >
        Save
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      :host {
        display: block;
        inline-size: min(640px, calc(100vw - var(--space-6) * 2));
      }
      h2 {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
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
        gap: var(--space-3);
        padding-block-end: var(--space-2);
      }
      .row-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-3);
      }
      @media (max-width: 600px) {
        .row-2 {
          grid-template-columns: 1fr;
        }
      }
      .rtl-field input {
        text-align: end;
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
    `,
  ],
})
export class EnumerationEditDialogComponent {
  private readonly api = inject(LookupsApiService);
  private readonly dialogRef =
    inject<MatDialogRef<EnumerationEditDialogComponent, boolean>>(MatDialogRef);
  protected readonly data = inject<EnumerationEditDialogData>(MAT_DIALOG_DATA);

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
    labelAr: new FormControl<string>(this.data.row?.labelAr ?? '', {
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
      if (this.data.mode === 'create') {
        await this.api.create({
          type: this.data.type,
          key: v.key!,
          labelEn: v.labelEn!,
          labelAr: v.labelAr!,
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
      this.errorCode.set(code ?? 'INTERNAL_ERROR');
    } finally {
      this.submitting.set(false);
    }
  }
}
