import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzMessageService } from 'ng-zorro-antd/message';
import { EyeOutline, EyeInvisibleOutline } from '@ant-design/icons-angular/icons';
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
    NzButtonModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzSpinModule,
  ],
  providers: [provideNzIconsPatch([EyeOutline, EyeInvisibleOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="shell" role="main">
      <section class="card" [attr.aria-labelledby]="titleId">
        <h1 [id]="titleId" class="title" i18n="@@selfChange.title">Change password</h1>

        <form nz-form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <nz-form-item class="field">
            <nz-form-label [nzFor]="'currentPassword'" nzRequired i18n="@@selfChange.currentPassword">Current password</nz-form-label>
            <nz-form-control>
              <nz-input-group [nzSuffix]="suffixCurrentTpl">
                <input
                  nz-input
                  id="currentPassword"
                  [type]="revealCurrent() ? 'text' : 'password'"
                  autocomplete="current-password"
                  formControlName="currentPassword"
                />
              </nz-input-group>
              <ng-template #suffixCurrentTpl>
                <button
                  nz-button
                  nzType="text"
                  type="button"
                  (click)="revealCurrent.set(!revealCurrent())"
                  [attr.aria-pressed]="revealCurrent()"
                  [attr.aria-label]="revealCurrent() ? hideLabel() : showLabel()"
                >
                  <span
                    nz-icon
                    [nzType]="revealCurrent() ? 'eye-invisible' : 'eye'"
                    nzTheme="outline"
                  ></span>
                </button>
              </ng-template>
            </nz-form-control>
          </nz-form-item>

          <nz-form-item class="field">
            <nz-form-label [nzFor]="'newPassword'" nzRequired i18n="@@selfChange.newPassword">New password</nz-form-label>
            <nz-form-control [nzErrorTip]="newPwErrTpl">
              <nz-input-group [nzSuffix]="suffixNewTpl">
                <input
                  nz-input
                  id="newPassword"
                  [type]="revealNew() ? 'text' : 'password'"
                  autocomplete="new-password"
                  formControlName="newPassword"
                />
              </nz-input-group>
              <ng-template #suffixNewTpl>
                <button
                  nz-button
                  nzType="text"
                  type="button"
                  (click)="revealNew.set(!revealNew())"
                  [attr.aria-pressed]="revealNew()"
                  [attr.aria-label]="revealNew() ? hideLabel() : showLabel()"
                >
                  <span
                    nz-icon
                    [nzType]="revealNew() ? 'eye-invisible' : 'eye'"
                    nzTheme="outline"
                  ></span>
                </button>
              </ng-template>
              <ng-template #newPwErrTpl let-control>
                @if (control.errors?.['minlength']) {
                  <span i18n="@@selfChange.tooShort">At least 12 characters.</span>
                }
              </ng-template>
            </nz-form-control>
          </nz-form-item>

          @if (errorMessage(); as msg) {
            <div role="alert" aria-live="polite" class="alert">{{ msg }}</div>
          }

          <div class="actions">
            <button nz-button type="button" (click)="cancel()" i18n="@@selfChange.cancel">
              Cancel
            </button>
            <button
              nz-button
              nzType="primary"
              type="submit"
              [disabled]="form.invalid || submitting()"
              [attr.aria-busy]="submitting()"
            >
              @if (submitting()) {
                <nz-spin nzSimple [nzSize]="'small'" />
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
  private readonly message = inject(NzMessageService);
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
      this.message.success(
        $localize`:@@selfChange.success:Password updated. Other devices have been signed out.`,
        { nzDuration: 5000 },
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
