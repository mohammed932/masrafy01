import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '@core/auth/auth.service';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode, ErrorEnvelope } from '@core/auth/auth.types';

interface LoginControls {
  email: FormControl<string>;
  password: FormControl<string>;
}

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="login-shell" role="main">
      <section class="login-card" [attr.aria-labelledby]="titleId">
        <h1 [id]="titleId" class="brand-mark" i18n="@@login.title">Masrafy</h1>
        <p class="subtitle" i18n="@@login.subtitle">Sign in to the admin dashboard.</p>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <mat-form-field appearance="outline" class="field">
            <mat-label i18n="@@login.email">Email</mat-label>
            <input
              matInput
              type="email"
              autocomplete="email"
              formControlName="email"
              [attr.aria-invalid]="
                form.controls.email.touched && form.controls.email.invalid
              "
            />
            @if (form.controls.email.touched && form.controls.email.errors?.['required']) {
              <mat-error i18n="@@login.email.required">Email is required.</mat-error>
            }
            @if (form.controls.email.touched && form.controls.email.errors?.['email']) {
              <mat-error i18n="@@login.email.invalid">Email format is invalid.</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="field">
            <mat-label i18n="@@login.password">Password</mat-label>
            <input
              matInput
              type="password"
              autocomplete="current-password"
              formControlName="password"
            />
            @if (form.controls.password.touched && form.controls.password.errors?.['required']) {
              <mat-error i18n="@@login.password.required">Password is required.</mat-error>
            }
          </mat-form-field>

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
              <span i18n="@@login.submit">Sign in</span>
            }
          </button>
        </form>

        <p class="helper" i18n="@@login.helper">
          Forgot your password? Contact a super-admin.
        </p>
      </section>
    </main>
  `,
  styles: [
    `
      .login-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: var(--space-5);
        background: var(--color-surface-elevated);
      }
      .login-card {
        width: min(var(--card-max-width-auth), 100% - var(--space-7));
        padding: var(--space-7);
        background: var(--color-surface-default);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-md);
      }
      .brand-mark {
        margin: 0 0 var(--space-1);
        color: var(--color-brand-primary);
        font-size: var(--text-2xl);
        font-weight: var(--font-weight-bold);
      }
      .subtitle {
        margin: 0 0 var(--space-5);
        color: var(--color-text-secondary);
      }
      .field {
        width: 100%;
      }
      .submit {
        width: 100%;
        margin-block-start: var(--space-2);
        min-height: 48px;
      }
      .alert {
        margin-block: var(--space-2);
        padding: var(--space-3);
        background: var(--color-error-bg);
        color: var(--color-error);
        border-radius: var(--radius-md);
      }
      .helper {
        margin-block-start: var(--space-5);
        color: var(--color-text-tertiary);
        font-size: var(--text-sm);
      }
    `,
  ],
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly errorCodes = inject(ErrorCodeService);

  protected readonly titleId = 'login-title';

  protected readonly form = new FormGroup<LoginControls>({
    email: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(320)],
    }),
    password: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(128)],
    }),
  });

  protected readonly submitting = signal<boolean>(false);
  protected readonly errorMessage = signal<string | null>(null);

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set(null);

    try {
      await this.auth.login(this.form.getRawValue());
      const next = this.route.snapshot.queryParamMap.get('next');
      await this.router.navigateByUrl(next && next.startsWith('/') ? next : '/dashboard');
    } catch (err) {
      this.errorMessage.set(this.toMessage(err));
      // Clear password on failure; keep email.
      this.form.patchValue({ password: '' });
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
