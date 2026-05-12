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

export interface CloneProgramDialogData {
  sourceProgramCode: string;
  sourceFriendlyName: string;
}

export interface CloneProgramDialogResult {
  newProgramCode?: string;
}

@Component({
  selector: 'app-clone-program-dialog',
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
    <h2 mat-dialog-title i18n="@@bank_programs.clone.title">Clone bank program</h2>
    <mat-dialog-content>
      <p class="source">
        <mat-icon aria-hidden="true">content_copy</mat-icon>
        <span i18n="@@bank_programs.clone.source">Cloning from</span>
        <strong>{{ data.sourceProgramCode }}</strong>
        <em>· {{ data.sourceFriendlyName }}</em>
      </p>

      <mat-form-field appearance="outline" class="full">
        <mat-label i18n="@@bank_programs.clone.new_code">New program code</mat-label>
        <input matInput [formControl]="codeCtrl" placeholder="ABK-AUTO-V2" />
        <mat-hint i18n="@@bank_programs.hint.program_code">A–Z, 0–9, _, − (3–32 chars).</mat-hint>
        <mat-error *ngIf="codeCtrl.hasError('duplicate')" i18n="@@bank_programs.clone.duplicate">
          This program code is already in use.
        </mat-error>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button type="button" (click)="cancel()" [disabled]="busy()" i18n="@@bank_programs.form.cancel">Cancel</button>
      <button mat-flat-button color="primary" type="button" (click)="submit()" [disabled]="codeCtrl.invalid || busy()">
        <mat-spinner *ngIf="busy()" diameter="16"></mat-spinner>
        <span *ngIf="!busy()" i18n="@@bank_programs.clone.cta">Clone program</span>
        <span *ngIf="busy()" i18n="@@bank_programs.clone.cloning">Cloning…</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .source {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0 0 var(--space-3) 0;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }
      .source mat-icon { color: var(--color-tonal-accent); }
      .source strong { color: var(--color-text-primary); font-family: var(--font-family-mono, monospace); }
      .full { width: 100%; }
    `,
  ],
})
export class CloneProgramDialog {
  private readonly dialogRef = inject(MatDialogRef<CloneProgramDialog, CloneProgramDialogResult>);
  private readonly api = inject(BankProgramsApiService);
  private readonly snack = inject(MatSnackBar);
  private readonly errors = inject(ErrorCodeService);
  readonly data = inject<CloneProgramDialogData>(MAT_DIALOG_DATA);

  readonly codeCtrl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^[A-Z0-9_-]{3,32}$/)],
  });
  readonly busy = signal(false);

  cancel(): void {
    if (this.busy()) return;
    this.dialogRef.close({});
  }

  async submit(): Promise<void> {
    if (this.codeCtrl.invalid || this.busy()) return;
    this.busy.set(true);
    try {
      const res = await this.api.clone(this.data.sourceProgramCode, this.codeCtrl.value);
      this.dialogRef.close({ newProgramCode: res.data.programCode });
    } catch (err: unknown) {
      const envelope = (err as { error?: { code?: string } }).error;
      if (envelope?.code === 'PROGRAM_CODE_ALREADY_IN_USE') {
        this.codeCtrl.setErrors({ duplicate: true });
      } else {
        this.snack.open(
          this.errors.toLocalizedMessage((envelope?.code ?? 'INTERNAL_ERROR') as never),
          $localize`:@@bank_programs.form.dismiss:Dismiss`,
          { duration: 6000 },
        );
      }
    } finally {
      this.busy.set(false);
    }
  }
}
