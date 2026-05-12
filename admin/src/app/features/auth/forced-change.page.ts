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
import { AuthService } from '@core/auth/auth.service';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode, ErrorEnvelope } from '@core/auth/auth.types';

interface ForcedChangeControls {
  newPassword: FormControl<string>;
}

@Component({
  selector: 'app-forced-change-page',
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
      <section class="card locked-step" [attr.aria-labelledby]="titleId">
        <h1 [id]="titleId" class="title" i18n="@@forcedChange.title">
          Set your password
        </h1>
        <p class="subtitle" i18n="@@forcedChange.subtitle">
          For your security, set a new password before continuing.
        </p>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <mat-form-field appearance="outline" class="field">
            <mat-label i18n="@@forcedChange.newPassword">New password</mat-label>
            <input
              matInput
              [type]="reveal() ? 'text' : 'password'"
              autocomplete="new-password"
              formControlName="newPassword"
              [attr.aria-describedby]="hintsId"
            />
            <button
              mat-icon-button
              matSuffix
              type="button"
              (click)="reveal.set(!reveal())"
              [attr.aria-pressed]="reveal()"
              [attr.aria-label]="reveal() ? hideLabel() : showLabel()"
            >
              <mat-icon>{{ reveal() ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
          </mat-form-field>

          <ul [id]="hintsId" class="hints" aria-live="polite">
            <li [class.ok]="lengthOk()">
              <mat-icon class="hint-icon">{{ lengthOk() ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
              <span i18n="@@forcedChange.hint.length">Length 12–128</span>
            </li>
            <li>
              <mat-icon class="hint-icon">radio_button_unchecked</mat-icon>
              <span i18n="@@forcedChange.hint.common">Not a common password</span>
            </li>
            <li>
              <mat-icon class="hint-icon">radio_button_unchecked</mat-icon>
              <span i18n="@@forcedChange.hint.breach">Not in any known breach</span>
            </li>
          </ul>

          @if (errorMessage(); as msg) {
            <div role="alert" aria-live="polite" class="alert">{{ msg }}</div>
          }

          <button
            mat-flat-button
            color="primary"
            type="submit"
            [disabled]="form.invalid || submitting()"
            [attr.aria-busy]="submitting()"
            class="submit"
          >
            @if (submitting()) {
              <mat-progress-spinner mode="indeterminate" diameter="20" />
            } @else {
              <span i18n="@@forcedChange.submit">Save and continue</span>
            }
          </button>
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
        min-height: 100vh;
        padding: var(--space-5);
        background: var(--color-surface-elevated);
      }
      .card {
        width: 100%;
        max-width: 420px;
        padding: var(--space-7);
        background: var(--color-surface-default);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-md);
      }
      .title {
        margin: 0 0 var(--space-1);
        color: var(--color-brand-primary);
        font-size: var(--text-xl);
        font-weight: var(--font-weight-bold);
      }
      .subtitle {
        margin: 0 0 var(--space-5);
        color: var(--color-text-secondary);
      }
      .field {
        width: 100%;
      }
      .hints {
        list-style: none;
        margin: 0 0 var(--space-3);
        padding: 0;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .hints li {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
      }
      .hint-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: var(--color-text-tertiary);
        transition: color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .hints li.ok {
        color: var(--color-success);
      }
      .hints li.ok .hint-icon {
        color: var(--color-success);
      }
      .submit {
        width: 100%;
        min-height: 48px;
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
export class ForcedChangePage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly errorCodes = inject(ErrorCodeService);

  protected readonly titleId = 'forced-change-title';
  protected readonly hintsId = 'forced-change-hints';

  protected readonly form = new FormGroup<ForcedChangeControls>({
    newPassword: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(12), Validators.maxLength(128)],
    }),
  });

  protected readonly submitting = signal<boolean>(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly reveal = signal<boolean>(false);

  protected readonly showLabel = () => $localize`:@@forcedChange.show:Show password`;
  protected readonly hideLabel = () => $localize`:@@forcedChange.hide:Hide password`;

  protected lengthOk(): boolean {
    const v = this.form.controls.newPassword.value;
    return v.length >= 12 && v.length <= 128;
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set(null);
    try {
      await this.auth.changePassword({ newPassword: this.form.controls.newPassword.value });
      await this.router.navigateByUrl('/dashboard');
    } catch (err) {
      this.errorMessage.set(this.toMessage(err));
    } finally {
      this.submitting.set(false);
    }
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
