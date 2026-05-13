import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { AuthService } from '@core/auth/auth.service';
import { ErrorCodeService } from '@core/errors/error-code.service';
import { UsersService } from './users.service';
import type {
  CreatableRole,
  CreateStaffRequest,
  ErrorCode,
  ErrorEnvelope,
  StaffAccountSummary,
  StaffRole,
  UpdateStaffRequest,
} from '@core/auth/auth.types';

export interface UserFormDialogData {
  mode: 'create' | 'edit';
  row?: StaffAccountSummary;
}

interface CreateFormControls {
  name: FormControl<string>;
  email: FormControl<string>;
  role: FormControl<CreatableRole>;
  initialPassword: FormControl<string>;
}

interface EditFormControls {
  name: FormControl<string>;
  role: FormControl<StaffRole>;
  isActive: FormControl<boolean>;
}

@Component({
  selector: 'app-user-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="header">
      <span class="header-icon" aria-hidden="true">
        <mat-icon>{{ data.mode === 'create' ? 'person_add' : 'edit' }}</mat-icon>
      </span>
      <div class="header-text">
        <h2 mat-dialog-title class="title">
          @if (data.mode === 'create') {
            <span i18n="@@userForm.titleCreate">Create user</span>
          } @else {
            <span i18n="@@userForm.titleEdit">Edit user</span>
          }
        </h2>
        <p class="subtitle">
          @if (data.mode === 'create') {
            <span i18n="@@userForm.descCreate">Add a new internal staff account. The user will be required to change the initial password on first sign-in.</span>
          } @else {
            <span i18n="@@userForm.descEdit">Update name, role, or active status.</span>
          }
        </p>
      </div>
    </header>

    <form
      mat-dialog-content
      [formGroup]="data.mode === 'create' ? createForm : editForm"
      (ngSubmit)="submit()"
      novalidate
      class="body"
    >
      @if (data.mode === 'create') {
        <section class="section">
          <header class="section-head">
            <span class="section-label" i18n="@@userForm.section.identity">Identity</span>
            <span class="section-desc" i18n="@@userForm.section.identityDesc">Who is this user?</span>
          </header>

          <div class="field-row">
            <mat-form-field appearance="outline" class="field">
              <mat-label i18n="@@userForm.name">Full name</mat-label>
              <input matInput formControlName="name" autocomplete="name" />
              <mat-hint i18n="@@userForm.nameHint">As it should appear in the dashboard.</mat-hint>
            </mat-form-field>
          </div>

          <div class="field-row">
            <mat-form-field appearance="outline" class="field">
              <mat-label i18n="@@userForm.email">Work email</mat-label>
              <input matInput type="email" autocomplete="email" formControlName="email" />
              <mat-icon matPrefix aria-hidden="true">mail</mat-icon>
              <mat-hint i18n="@@userForm.emailHint">Used to sign in. Must be unique.</mat-hint>
              @if (emailError(); as msg) {
                <mat-error>{{ msg }}</mat-error>
              }
            </mat-form-field>
          </div>
        </section>

        <section class="section">
          <header class="section-head">
            <span class="section-label" i18n="@@userForm.section.access">Access</span>
            <span class="section-desc" i18n="@@userForm.section.accessDesc">Role and initial credentials.</span>
          </header>

          <div class="field-row">
            <mat-form-field appearance="outline" class="field">
              <mat-label i18n="@@userForm.role">Role</mat-label>
              <mat-select formControlName="role">
                <mat-select-trigger>{{ roleLabel(createForm.controls.role.value) }}</mat-select-trigger>
                <mat-option value="sales_manager" class="role-option">
                  <span class="opt-title" i18n="@@role.sales_manager">Sales manager</span>
                  <span class="opt-desc" i18n="@@userForm.role.managerDesc">Manages bank programs + applications and oversees the sales team.</span>
                </mat-option>
                <mat-option value="sales_agent" class="role-option">
                  <span class="opt-title" i18n="@@role.sales_agent">Sales agent</span>
                  <span class="opt-desc" i18n="@@userForm.role.agentDesc">Handles their own applications; read-only on bank programs.</span>
                </mat-option>
                <mat-option value="analyst" class="role-option">
                  <span class="opt-title" i18n="@@role.analyst">Analyst</span>
                  <span class="opt-desc" i18n="@@userForm.role.analystDesc">Read-only across applications, programs, and audit logs.</span>
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <div class="field-row">
            <mat-form-field appearance="outline" class="field">
              <mat-label i18n="@@userForm.initialPassword">Initial password</mat-label>
              <input matInput [type]="revealPw() ? 'text' : 'password'" autocomplete="new-password" formControlName="initialPassword" />
              <button mat-icon-button matSuffix type="button" (click)="revealPw.set(!revealPw())" [attr.aria-pressed]="revealPw()">
                <mat-icon>{{ revealPw() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              <mat-hint i18n="@@userForm.passwordHint">12–128 chars. User must change on first sign-in.</mat-hint>
              @if (passwordError(); as msg) {
                <mat-error>{{ msg }}</mat-error>
              }
            </mat-form-field>
          </div>
        </section>
      } @else if (data.row) {
        <div class="field-row">
          <mat-form-field appearance="outline" class="field">
            <mat-label i18n="@@userForm.name">Name</mat-label>
            <input matInput formControlName="name" />
          </mat-form-field>
        </div>

        <div class="field-row">
          <mat-form-field appearance="outline" class="field">
            <mat-label i18n="@@userForm.email">Email</mat-label>
            <input matInput [value]="data.row.email" readonly />
            <mat-icon matSuffix aria-hidden="true">lock</mat-icon>
            <mat-hint i18n="@@userForm.emailReadonly">Email cannot be changed after account creation.</mat-hint>
          </mat-form-field>
        </div>

        <div class="field-row">
          <mat-form-field appearance="outline" class="field">
            <mat-label i18n="@@userForm.role">Role</mat-label>
            <mat-select formControlName="role" [disabled]="isSelf">
              <mat-option value="sales_manager" i18n="@@role.sales_manager">Sales manager</mat-option>
              <mat-option value="sales_agent" i18n="@@role.sales_agent">Sales agent</mat-option>
              <mat-option value="analyst" i18n="@@role.analyst">Analyst</mat-option>
            </mat-select>
            @if (isSelf) {
              <mat-hint i18n="@@userForm.selfRoleHint">You can't change your own role.</mat-hint>
            }
          </mat-form-field>
        </div>

        <div class="field-row toggle-row">
          <div class="toggle-text">
            <span class="toggle-title" i18n="@@userForm.active">Active</span>
            <span class="toggle-desc" i18n="@@userForm.activeDesc">Inactive users cannot sign in. Historical records are kept.</span>
          </div>
          <mat-slide-toggle formControlName="isActive" [disabled]="isSelf"></mat-slide-toggle>
        </div>
      }

      @if (formError(); as msg) {
        <div role="alert" aria-live="polite" class="alert">
          <mat-icon class="alert-icon" aria-hidden="true">error_outline</mat-icon>
          <span>{{ msg }}</span>
        </div>
      }
    </form>

    <div mat-dialog-actions align="end" class="actions">
      <button mat-button type="button" (click)="cancel()" i18n="@@userForm.cancel">Cancel</button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        (click)="submit()"
        [disabled]="submitting() || invalid()"
        [attr.aria-busy]="submitting()"
        class="primary-cta"
      >
        <mat-icon>{{ data.mode === 'create' ? 'person_add' : 'check' }}</mat-icon>
        @if (data.mode === 'create') {
          <span i18n="@@userForm.saveCreate">Create user</span>
        } @else {
          <span i18n="@@userForm.saveEdit">Save changes</span>
        }
      </button>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        width: 100%;
        max-height: 88vh;
        overflow: hidden;
        background: var(--color-surface-default);
        font-family: var(--font-family-base);
      }
      // Header — sticky, hairline shadow on scroll, NO illustration. Title carries the weight.
      .header {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        padding: var(--space-6) var(--space-6) var(--space-4);
        flex-shrink: 0;
        position: relative;
      }
      .header::after {
        content: '';
        position: absolute;
        inset-inline: var(--space-6);
        inset-block-end: 0;
        height: 1px;
        background: var(--color-border-default);
      }
      .header-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: var(--radius-md);
        background: var(--color-tonal-accent-bg);
        color: var(--color-brand-primary);
        flex-shrink: 0;
        box-shadow: inset 0 0 0 1px rgba(28, 66, 144, 0.12);
      }
      .header-icon mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
      .header-text {
        flex: 1;
        min-width: 0;
      }
      .title {
        margin: 0 0 4px;
        font-size: 20px;
        font-weight: var(--font-weight-bold);
        letter-spacing: -0.01em;
        color: var(--color-text-primary);
        line-height: 1.2;
      }
      .subtitle {
        margin: 0;
        font-size: 13px;
        color: var(--color-text-secondary);
        line-height: 1.5;
      }
      // Body — paper-form-style sections, generous vertical rhythm, hint typography refined
      .body {
        padding: var(--space-5) var(--space-6) var(--space-6);
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
        flex: 1;
        overflow-y: auto;
        scrollbar-gutter: stable;
      }
      .body::-webkit-scrollbar {
        width: 8px;
      }
      .body::-webkit-scrollbar-thumb {
        background: var(--color-border-default);
        border-radius: var(--radius-pill);
        border: 2px solid var(--color-surface-default);
      }
      .body::-webkit-scrollbar-thumb:hover {
        background: var(--color-border-strong);
      }
      .field-row {
        width: 100%;
      }
      .field {
        display: block;
        width: 100%;
      }
      // Sections — typographic structure inside the form, no card chrome
      .section {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .section-head {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding-block-end: var(--space-1);
      }
      .section-label {
        font-size: 11px;
        font-weight: var(--font-weight-bold);
        letter-spacing: 0.10em;
        text-transform: uppercase;
        color: var(--color-brand-primary);
      }
      .section-desc {
        font-size: 12px;
        color: var(--color-text-tertiary);
        line-height: 1.5;
      }
      // Toggle row — flat, hairline border, not a card (avoid card-in-card)
      .toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-4);
        padding: var(--space-3) var(--space-4);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        background: transparent;
        transition: border-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .toggle-row:hover {
        border-color: var(--color-border-strong);
      }
      .toggle-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .toggle-title {
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        font-size: 14px;
      }
      .toggle-desc {
        font-size: 12px;
        color: var(--color-text-secondary);
        line-height: 1.5;
      }
      // Alert — tighter, leading icon, no full border (less visual weight in normal flow)
      .alert {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        padding: var(--space-3);
        background: var(--color-error-bg);
        color: var(--color-error);
        border-radius: var(--radius-md);
        border-inline-start: 3px solid var(--color-error);
        font-size: 13px;
        line-height: 1.5;
      }
      .alert-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        margin-block-start: 1px;
      }
      // Actions footer — clean band, primary CTA carries the weight, NO background tint
      .actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding: var(--space-4) var(--space-6);
        gap: var(--space-2);
        border-block-start: 1px solid var(--color-border-default);
        background: var(--color-surface-default);
        flex-shrink: 0;
      }
      .primary-cta {
        min-height: 44px;
        padding-inline: var(--space-4);
        font-weight: var(--font-weight-semibold);
        letter-spacing: -0.005em;
      }
      .primary-cta mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        margin-inline-end: 6px;
      }
    `,
  ],
})
export class UserFormDialog {
  protected readonly data = inject<UserFormDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<UserFormDialog, StaffAccountSummary>>(MatDialogRef);
  private readonly api = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly errorCodes = inject(ErrorCodeService);

  protected readonly isSelf =
    this.data.mode === 'edit' && this.data.row?.id === this.auth.currentUser()?.id;

  protected readonly createForm = new FormGroup<CreateFormControls>({
    name: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(120)],
    }),
    email: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(320)],
    }),
    role: new FormControl<CreatableRole>('analyst', { nonNullable: true }),
    initialPassword: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(12), Validators.maxLength(128)],
    }),
  });

  protected readonly editForm = new FormGroup<EditFormControls>({
    name: new FormControl<string>(this.data.row?.name ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(120)],
    }),
    role: new FormControl<StaffRole>(this.data.row?.role ?? 'analyst', { nonNullable: true }),
    isActive: new FormControl<boolean>(this.data.row?.isActive ?? true, { nonNullable: true }),
  });

  protected readonly submitting = signal<boolean>(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly emailError = signal<string | null>(null);
  protected readonly passwordError = signal<string | null>(null);
  protected readonly revealPw = signal<boolean>(false);

  protected roleLabel(role: string | null | undefined): string {
    switch (role) {
      case 'super_admin':
        return $localize`:@@role.super_admin:Super-admin`;
      case 'sales_manager':
        return $localize`:@@role.sales_manager:Sales manager`;
      case 'sales_agent':
        return $localize`:@@role.sales_agent:Sales agent`;
      case 'analyst':
        return $localize`:@@role.analyst:Analyst`;
      default:
        return '';
    }
  }

  protected invalid(): boolean {
    return this.data.mode === 'create'
      ? this.createForm.invalid || !this.createForm.dirty
      : this.editForm.invalid || !this.editForm.dirty;
  }

  async submit(): Promise<void> {
    if (this.invalid() || this.submitting()) return;
    this.submitting.set(true);
    this.clearErrors();
    try {
      if (this.data.mode === 'create') {
        const body: CreateStaffRequest = this.createForm.getRawValue();
        const created = await this.api.create(body);
        this.ref.close(created);
      } else if (this.data.row) {
        const raw = this.editForm.getRawValue();
        const patch: UpdateStaffRequest = {};
        if (raw.name !== this.data.row.name) patch.name = raw.name;
        if (raw.role !== this.data.row.role) patch.role = raw.role;
        if (raw.isActive !== this.data.row.isActive) patch.isActive = raw.isActive;
        const updated = await this.api.update(this.data.row.id, patch);
        this.ref.close(updated);
      }
    } catch (err) {
      this.applyError(err);
    } finally {
      this.submitting.set(false);
    }
  }

  cancel(): void {
    this.ref.close();
  }

  private clearErrors(): void {
    this.formError.set(null);
    this.emailError.set(null);
    this.passwordError.set(null);
  }

  private applyError(err: unknown): void {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as ErrorEnvelope | undefined;
      if (body && body.success === false && typeof body.code === 'string') {
        const code = body.code as ErrorCode;
        const msg = this.errorCodes.toLocalizedMessage(code, body.meta);
        if (code === 'DUPLICATE_ENTRY') {
          this.emailError.set(msg);
          return;
        }
        if (
          code === 'PASSWORD_TOO_SHORT' ||
          code === 'PASSWORD_TOO_LONG' ||
          code === 'PASSWORD_BREACHED' ||
          code === 'PASSWORD_ON_COMMON_LIST'
        ) {
          this.passwordError.set(msg);
          return;
        }
        this.formError.set(msg);
        return;
      }
    }
    this.formError.set(this.errorCodes.toLocalizedMessage('INTERNAL_ERROR'));
  }
}
