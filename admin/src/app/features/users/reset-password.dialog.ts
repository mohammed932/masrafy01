import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzModalRef, NZ_MODAL_DATA } from 'ng-zorro-antd/modal';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { EyeOutline, EyeInvisibleOutline } from '@ant-design/icons-angular/icons';
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
    NzButtonModule,
    NzFormModule,
    NzInputModule,
    NzIconModule,
  ],
  providers: [provideNzIconsPatch([EyeOutline, EyeInvisibleOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="dialog-header">
      <h2 class="dialog-title">
        <span i18n="@@resetPw.title">Reset password for</span> {{ data.row.name }}
      </h2>
    </header>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="dialog-body">
      <p class="hint" i18n="@@resetPw.hint">The user must change this password on next sign-in.</p>
      <nz-form-item>
        <nz-form-label [nzFor]="'newPassword'" nzRequired i18n="@@resetPw.new"
          >New password</nz-form-label
        >
        <nz-form-control [nzErrorTip]="pwErrTpl">
          <nz-input-group [nzSuffix]="suffixTpl">
            <input
              nz-input
              id="newPassword"
              [type]="reveal() ? 'text' : 'password'"
              autocomplete="new-password"
              formControlName="newPassword"
            />
          </nz-input-group>
          <ng-template #suffixTpl>
            <button
              nz-button
              nzType="text"
              nzShape="circle"
              type="button"
              (click)="reveal.set(!reveal())"
              [attr.aria-pressed]="reveal()"
            >
              <span nz-icon [nzType]="reveal() ? 'eye-invisible' : 'eye'" nzTheme="outline"></span>
            </button>
          </ng-template>
          <ng-template #pwErrTpl let-control>
            @if (fieldError(); as msg) {
              {{ msg }}
            } @else if (control.errors?.['required']) {
              <span i18n="@@resetPw.err.required">Password is required.</span>
            } @else if (control.errors?.['minlength']) {
              <span i18n="@@resetPw.err.min">Must be at least 12 characters.</span>
            } @else if (control.errors?.['maxlength']) {
              <span i18n="@@resetPw.err.max">Must be at most 128 characters.</span>
            }
          </ng-template>
        </nz-form-control>
      </nz-form-item>

      @if (formError(); as msg) {
        <div role="alert" aria-live="polite" class="alert">{{ msg }}</div>
      }
    </form>

    <footer class="dialog-footer">
      <button nz-button type="button" (click)="cancel()" i18n="@@resetPw.cancel">Cancel</button>
      <button
        nz-button
        nzType="primary"
        type="button"
        (click)="submit()"
        [disabled]="form.invalid || submitting()"
        [nzLoading]="submitting()"
        [attr.aria-busy]="submitting()"
      >
        <span i18n="@@resetPw.confirm">Reset password</span>
      </button>
    </footer>
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
      .dialog-header {
        padding: var(--space-4) var(--space-5) var(--space-2);
      }
      .dialog-title {
        margin: 0;
        font-size: var(--text-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .dialog-body {
        padding: var(--space-3) var(--space-5);
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .hint {
        margin: 0;
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
      .dialog-footer {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-5) var(--space-4);
        border-block-start: 1px solid var(--color-border-default);
      }
    `,
  ],
})
export class ResetPasswordDialog {
  protected readonly data = inject<Data>(NZ_MODAL_DATA);
  private readonly ref = inject<NzModalRef<ResetPasswordDialog, boolean>>(NzModalRef);
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
