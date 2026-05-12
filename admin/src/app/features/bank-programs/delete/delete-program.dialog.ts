import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ErrorCodeService } from '../../../core/errors/error-code.service';
import { BankProgramsApiService } from '../bank-programs.api.service';

export interface DeleteProgramDialogData {
  programCode: string;
  friendlyName: string;
}

@Component({
  selector: 'app-delete-program-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>
      <mat-icon class="warn-icon" aria-hidden="true">warning_amber</mat-icon>
      <span i18n="@@bank_programs.delete.title">Permanently delete this program?</span>
    </h2>
    <mat-dialog-content>
      <p i18n="@@bank_programs.delete.body">
        This action cannot be undone. Existing bank offers referencing this program will block deletion;
        in that case, deactivate the program instead.
      </p>
      <p class="row">
        <strong>{{ data.programCode }}</strong>
        <em>· {{ data.friendlyName }}</em>
      </p>

      <ng-container *ngIf="offerCount() === null">
        <mat-form-field appearance="outline" class="full">
          <mat-label i18n="@@bank_programs.delete.confirm_label">Type the program code to confirm</mat-label>
          <input matInput [formControl]="confirmCtrl" />
          <mat-hint i18n="@@bank_programs.delete.confirm_hint">Must match exactly.</mat-hint>
        </mat-form-field>
      </ng-container>

      <ng-container *ngIf="offerCount() !== null">
        <p class="has-offers">
          <mat-icon aria-hidden="true">block</mat-icon>
          <span i18n="@@bank_programs.delete.has_offers">
            This program has {{ offerCount() }} referencing offers. Deactivate it instead.
          </span>
        </p>
      </ng-container>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button type="button" (click)="cancel()" [disabled]="busy()" i18n="@@bank_programs.form.cancel">Cancel</button>
      <button
        *ngIf="offerCount() === null"
        mat-flat-button
        color="warn"
        type="button"
        (click)="submit()"
        [disabled]="confirmCtrl.value !== data.programCode || busy()"
      >
        <mat-spinner *ngIf="busy()" diameter="16"></mat-spinner>
        <span *ngIf="!busy()" i18n="@@bank_programs.delete.cta">Delete program</span>
        <span *ngIf="busy()" i18n="@@bank_programs.delete.deleting">Deleting…</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .warn-icon { color: #b45309; margin-inline-end: var(--space-2); vertical-align: middle; }
      .row { display: flex; gap: var(--space-2); align-items: baseline; }
      .row strong { font-family: var(--font-family-mono, monospace); color: var(--color-text-primary); }
      .row em { color: var(--color-text-secondary); }
      .full { width: 100%; }
      .has-offers {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-3);
        background: #fef2f2;
        color: #991b1b;
        border-radius: var(--radius-sm);
      }
    `,
  ],
})
export class DeleteProgramDialog {
  private readonly dialogRef = inject(MatDialogRef<DeleteProgramDialog, boolean>);
  private readonly api = inject(BankProgramsApiService);
  private readonly snack = inject(MatSnackBar);
  private readonly errors = inject(ErrorCodeService);
  readonly data = inject<DeleteProgramDialogData>(MAT_DIALOG_DATA);

  readonly confirmCtrl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly busy = signal(false);
  readonly offerCount = signal<number | null>(null);

  cancel(): void {
    if (this.busy()) return;
    this.dialogRef.close(false);
  }

  async submit(): Promise<void> {
    if (this.confirmCtrl.value !== this.data.programCode || this.busy()) return;
    this.busy.set(true);
    try {
      await this.api.delete(this.data.programCode, this.data.programCode);
      this.snack.open(
        $localize`:@@bank_programs.delete.success:Program deleted.`,
        $localize`:@@bank_programs.form.dismiss:Dismiss`,
        { duration: 4000 },
      );
      this.dialogRef.close(true);
    } catch (err: unknown) {
      const envelope = (err as { error?: { code?: string; meta?: { offerCount?: number } } }).error;
      if (envelope?.code === 'BANK_PROGRAM_HAS_OFFERS' && typeof envelope.meta?.offerCount === 'number') {
        this.offerCount.set(envelope.meta.offerCount);
      } else {
        this.snack.open(
          this.errors.toLocalizedMessage((envelope?.code ?? 'INTERNAL_ERROR') as never, envelope?.meta),
          $localize`:@@bank_programs.form.dismiss:Dismiss`,
          { duration: 6000 },
        );
      }
    } finally {
      this.busy.set(false);
    }
  }
}
