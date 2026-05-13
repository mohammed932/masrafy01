import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '@core/auth/auth.service';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode, ErrorEnvelope } from '@core/auth/auth.types';

interface SelfChangeControls {
  currentPassword: FormControl<string>;
  newPassword: FormControl<string>;
}

@Component({
  selector: 'app-self-change-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="shell" role="main">
      <section class="card" [attr.aria-labelledby]="titleId">
        <h1 [id]="titleId" class="title" i18n="@@selfChange.title">Change password</h1>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <mat-form-field appearance="outline" class="field">
            <mat-label i18n="@@selfChange.currentPassword">Current password</mat-label>
            <input
              matInput
              [type]="revealCurrent() ? 'text' : 'password'"
              autocomplete="current-password"
              formControlName="currentPassword"
            />
            <button
              mat-icon-button
              matSuffix
              type="button"
              (click)="revealCurrent.set(!revealCurrent())"
              [attr.aria-pressed]="revealCurrent()"
              [attr.aria-label]="revealCurrent() ? hideLabel() : showLabel()"
            >
              <mat-icon>{{ revealCurrent() ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
          </mat-form-field>

          <mat-form-field appearance="outline" class="field">
            <mat-label i18n="@@selfChange.newPassword">New password</mat-label>
            <input
              matInput
              [type]="revealNew() ? 'text' : 'password'"
              autocomplete="new-password"
              formControlName="newPassword"
            />
            <button
              mat-icon-button
              matSuffix
              type="button"
              (click)="revealNew.set(!revealNew())"
              [attr.aria-pressed]="revealNew()"
              [attr.aria-label]="revealNew() ? hideLabel() : showLabel()"
            >
              <mat-icon>{{ revealNew() ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
            @if (
              form.controls.newPassword.touched && form.controls.newPassword.errors?.['minlength']
            ) {
              <mat-error i18n="@@selfChange.tooShort">At least 12 characters.</mat-error>
            }
          </mat-form-field>

          @if (errorMessage(); as msg) {
            <div role="alert" aria-live="polite" class="alert">{{ msg }}</div>
          }

          <div class="actions">
            <button mat-button type="button" (click)="cancel()" i18n="@@selfChange.cancel">
              Cancel
            </button>
            <button
              mat-flat-button
              color="primary"
              type="submit"
              [disabled]="form.invalid || submitting()"
              [attr.aria-busy]="submitting()"
            >
              @if (submitting()) {
                <mat-progress-spinner mode="indeterminate" diameter="20" />
              } @else {
                <span i18n="@@selfChange.save">Save</span>
              }
            </button>
          </div>
        </form>
      </section>
    </main>
  `,
  styles: [
    `
      .shell {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: calc(100vh - 64px);
        padding: var(--space-5);
      }
      .card {
        width: 100%;
        max-width: 480px;
        padding: var(--space-7);
        background: var(--color-surface-default);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-md);
      }
      .title {
        margin: 0 0 var(--space-5);
        color: var(--color-brand-primary);
        font-size: var(--text-xl);
        font-weight: var(--font-weight-bold);
      }
      .field {
        width: 100%;
      }
      .actions {
        display: flex;
        gap: var(--space-2);
        justify-content: flex-end;
        margin-block-start: var(--space-3);
      }
      .alert {
        margin-block: var(--space-2);
        padding: var(--space-3);
        background: var(--color-error-bg);
        color: var(--color-error);
        border-radius: var(--radius-md);
      }
    `,
  ],
})
export class SelfChangePage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);
  private readonly errorCodes = inject(ErrorCodeService);

  protected readonly titleId = 'self-change-title';

  protected readonly form = new FormGroup<SelfChangeControls>({
    currentPassword: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(128)],
    }),
    newPassword: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(12), Validators.maxLength(128)],
    }),
  });

  protected readonly submitting = signal<boolean>(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly revealCurrent = signal<boolean>(false);
  protected readonly revealNew = signal<boolean>(false);

  protected readonly showLabel = (): string => $localize`:@@selfChange.show:Show password`;
  protected readonly hideLabel = (): string => $localize`:@@selfChange.hide:Hide password`;

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set(null);
    try {
      await this.auth.changePassword(this.form.getRawValue());
      this.snack.open(
        $localize`:@@selfChange.success:Password updated. Other devices have been signed out.`,
        undefined,
        { duration: 5000 },
      );
      await this.router.navigateByUrl('/dashboard');
    } catch (err) {
      this.errorMessage.set(this.toMessage(err));
    } finally {
      this.submitting.set(false);
    }
  }

  cancel(): void {
    void this.router.navigateByUrl('/dashboard');
  }

  private toMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as ErrorEnvelope | undefined;
      if (body && body.success === false && typeof body.code === 'string') {
        return this.errorCodes.toLocalizedMessage(body.code as ErrorCode, body.meta);
      }
    }
    return this.errorCodes.toLocalizedMessage('INTERNAL_ERROR');
  }
}
