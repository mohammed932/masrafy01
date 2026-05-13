import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { UsersService } from './users.service';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode, ErrorEnvelope, StaffAccountSummary } from '@core/auth/auth.types';

interface Data {
  row: StaffAccountSummary;
}

interface Controls {
  newPassword: FormControl<string>;
}

@Component({
  selector: 'app-reset-password-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>
      <span i18n="@@resetPw.title">Reset password for</span> {{ data.row.name }}
    </h2>
    <form mat-dialog-content [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <p class="hint" i18n="@@resetPw.hint">The user must change this password on next sign-in.</p>
      <mat-form-field appearance="outline" class="field">
        <mat-label i18n="@@resetPw.new">New password</mat-label>
        <input
          matInput
          [type]="reveal() ? 'text' : 'password'"
          autocomplete="new-password"
          formControlName="newPassword"
        />
        <button
          mat-icon-button
          matSuffix
          type="button"
          (click)="reveal.set(!reveal())"
          [attr.aria-pressed]="reveal()"
        >
          <mat-icon>{{ reveal() ? 'visibility_off' : 'visibility' }}</mat-icon>
        </button>
        @if (fieldError(); as msg) {
          <mat-error>{{ msg }}</mat-error>
        }
      </mat-form-field>

      @if (formError(); as msg) {
        <div role="alert" aria-live="polite" class="alert">{{ msg }}</div>
      }
    </form>

    <div mat-dialog-actions align="end">
      <button mat-button type="button" (click)="cancel()" i18n="@@resetPw.cancel">Cancel</button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        (click)="submit()"
        [disabled]="form.invalid || submitting()"
        [attr.aria-busy]="submitting()"
      >
        <span i18n="@@resetPw.confirm">Reset password</span>
      </button>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: var(--color-surface-default);
      }
      .field {
        width: 100%;
      }
      .hint {
        margin: 0 0 var(--space-3);
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }
      .alert {
        margin-block-start: var(--space-2);
        padding: var(--space-3);
        background: var(--color-error-bg);
        color: var(--color-error);
        border-radius: var(--radius-md);
      }
    `,
  ],
})
export class ResetPasswordDialog {
  protected readonly data = inject<Data>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<ResetPasswordDialog, boolean>>(MatDialogRef);
  private readonly api = inject(UsersService);
  private readonly errorCodes = inject(ErrorCodeService);

  protected readonly form = new FormGroup<Controls>({
    newPassword: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(12), Validators.maxLength(128)],
    }),
  });

  protected readonly submitting = signal<boolean>(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly fieldError = signal<string | null>(null);
  protected readonly reveal = signal<boolean>(false);

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.formError.set(null);
    this.fieldError.set(null);
    try {
      await this.api.resetPassword(this.data.row.id, {
        newPassword: this.form.controls.newPassword.value,
      });
      this.ref.close(true);
    } catch (err) {
      this.apply(err);
    } finally {
      this.submitting.set(false);
    }
  }

  cancel(): void {
    this.ref.close(false);
  }

  private apply(err: unknown): void {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as ErrorEnvelope | undefined;
      if (body && body.success === false && typeof body.code === 'string') {
        const code = body.code as ErrorCode;
        const msg = this.errorCodes.toLocalizedMessage(code, body.meta);
        if (
          code === 'PASSWORD_TOO_SHORT' ||
          code === 'PASSWORD_TOO_LONG' ||
          code === 'PASSWORD_BREACHED' ||
          code === 'PASSWORD_ON_COMMON_LIST'
        ) {
          this.fieldError.set(msg);
          return;
        }
        this.formError.set(msg);
        return;
      }
    }
    this.formError.set(this.errorCodes.toLocalizedMessage('INTERNAL_ERROR'));
  }
}
