import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerRef, NZ_DRAWER_DATA } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import {
  UserAddOutline,
  EditOutline,
  MailOutline,
  LockOutline,
  EyeOutline,
  EyeInvisibleOutline,
  CheckOutline,
  CloseCircleOutline,
} from '@ant-design/icons-angular/icons';
import { FormDrawerComponent } from '@shared/ui';
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

export interface UserFormDrawerData {
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
  selector: 'app-user-form-drawer',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzSwitchModule,
    NzIconModule,
    FormDrawerComponent,
  ],
  providers: [
    provideNzIconsPatch([
      UserAddOutline,
      EditOutline,
      MailOutline,
      LockOutline,
      EyeOutline,
      EyeInvisibleOutline,
      CheckOutline,
      CloseCircleOutline,
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-form-drawer
      [title]="drawerTitle"
      [subtitle]="drawerSubtitle"
      [submitLabel]="submitLabel"
      [submitDisabled]="invalid()"
      [submitting]="submitting()"
      (cancelled)="cancel()"
      (submitted)="submit()"
    >
      <span
        drawerIcon
        nz-icon
        [nzType]="data.mode === 'create' ? 'user-add' : 'edit'"
        nzTheme="outline"
      ></span>
      <span
        drawerSubmitIcon
        nz-icon
        [nzType]="data.mode === 'create' ? 'user-add' : 'check'"
        nzTheme="outline"
      ></span>
      <form
        [formGroup]="data.mode === 'create' ? createForm : editForm"
        (ngSubmit)="submit()"
        novalidate
        class="body"
      >
        @if (data.mode === 'create') {
          <section class="section">
            <header class="section-head">
              <span class="section-label" i18n="@@userForm.section.identity">Identity</span>
              <span class="section-desc" i18n="@@userForm.section.identityDesc"
                >Who is this user?</span
              >
            </header>

            <nz-form-item>
              <nz-form-label [nzFor]="'name'" nzRequired i18n="@@userForm.name"
                >Full name</nz-form-label
              >
              <nz-form-control [nzErrorTip]="nameErrTpl" [nzExtra]="nameHint">
                <input nz-input id="name" formControlName="name" autocomplete="name" />
              </nz-form-control>
              <ng-template #nameHint>
                <span i18n="@@userForm.nameHint">As it should appear in the dashboard.</span>
              </ng-template>
              <ng-template #nameErrTpl let-control>
                @if (control.errors?.['required']) {
                  <span i18n="@@userForm.err.nameRequired">Name is required.</span>
                } @else if (control.errors?.['minlength']) {
                  <span i18n="@@userForm.err.nameMin">Must be at least 2 characters.</span>
                } @else if (control.errors?.['maxlength']) {
                  <span i18n="@@userForm.err.nameMax">Must be at most 120 characters.</span>
                }
              </ng-template>
            </nz-form-item>

            <nz-form-item>
              <nz-form-label [nzFor]="'email'" nzRequired i18n="@@userForm.email"
                >Work email</nz-form-label
              >
              <nz-form-control [nzErrorTip]="emailErrTpl" [nzExtra]="emailHint">
                <nz-input-group [nzPrefix]="mailPrefix">
                  <input
                    nz-input
                    id="email"
                    type="email"
                    autocomplete="email"
                    formControlName="email"
                  />
                </nz-input-group>
              </nz-form-control>
              <ng-template #mailPrefix>
                <span nz-icon nzType="mail" nzTheme="outline" aria-hidden="true"></span>
              </ng-template>
              <ng-template #emailHint>
                <span i18n="@@userForm.emailHint">Used to sign in. Must be unique.</span>
              </ng-template>
              <ng-template #emailErrTpl let-control>
                @if (emailError(); as msg) {
                  {{ msg }}
                } @else if (control.errors?.['required']) {
                  <span i18n="@@userForm.err.emailRequired">Email is required.</span>
                } @else if (control.errors?.['email']) {
                  <span i18n="@@userForm.err.emailInvalid">Invalid email address.</span>
                }
              </ng-template>
            </nz-form-item>
          </section>

          <section class="section">
            <header class="section-head">
              <span class="section-label" i18n="@@userForm.section.access">Access</span>
              <span class="section-desc" i18n="@@userForm.section.accessDesc"
                >Role and initial credentials.</span
              >
            </header>

            <nz-form-item>
              <nz-form-label [nzFor]="'role'" i18n="@@userForm.role">Role</nz-form-label>
              <nz-form-control>
                <nz-select id="role" formControlName="role">
                  <nz-option nzValue="sales_manager" [nzLabel]="managerLabel"></nz-option>
                  <nz-option nzValue="sales_agent" [nzLabel]="agentLabel"></nz-option>
                  <nz-option nzValue="analyst" [nzLabel]="analystLabel"></nz-option>
                </nz-select>
              </nz-form-control>
            </nz-form-item>

            <nz-form-item>
              <nz-form-label
                [nzFor]="'initialPassword'"
                nzRequired
                i18n="@@userForm.initialPassword"
                >Initial password</nz-form-label
              >
              <nz-form-control [nzErrorTip]="pwErrTpl" [nzExtra]="pwHint">
                <nz-input-group [nzSuffix]="pwSuffix">
                  <input
                    nz-input
                    id="initialPassword"
                    [type]="revealPw() ? 'text' : 'password'"
                    autocomplete="new-password"
                    formControlName="initialPassword"
                  />
                </nz-input-group>
              </nz-form-control>
              <ng-template #pwSuffix>
                <button
                  nz-button
                  nzType="text"
                  nzShape="circle"
                  type="button"
                  (click)="revealPw.set(!revealPw())"
                  [attr.aria-pressed]="revealPw()"
                >
                  <span
                    nz-icon
                    [nzType]="revealPw() ? 'eye-invisible' : 'eye'"
                    nzTheme="outline"
                  ></span>
                </button>
              </ng-template>
              <ng-template #pwHint>
                <span i18n="@@userForm.passwordHint"
                  >12–128 chars. User must change on first sign-in.</span
                >
              </ng-template>
              <ng-template #pwErrTpl let-control>
                @if (passwordError(); as msg) {
                  {{ msg }}
                } @else if (control.errors?.['required']) {
                  <span i18n="@@userForm.err.pwRequired">Password is required.</span>
                } @else if (control.errors?.['minlength']) {
                  <span i18n="@@userForm.err.pwMin">Must be at least 12 characters.</span>
                } @else if (control.errors?.['maxlength']) {
                  <span i18n="@@userForm.err.pwMax">Must be at most 128 characters.</span>
                }
              </ng-template>
            </nz-form-item>
          </section>
        } @else if (data.row) {
          <nz-form-item>
            <nz-form-label [nzFor]="'name'" nzRequired i18n="@@userForm.name">Name</nz-form-label>
            <nz-form-control [nzErrorTip]="editNameErrTpl">
              <input nz-input id="name" formControlName="name" />
            </nz-form-control>
            <ng-template #editNameErrTpl let-control>
              @if (control.errors?.['required']) {
                <span i18n="@@userForm.err.nameRequired">Name is required.</span>
              } @else if (control.errors?.['minlength']) {
                <span i18n="@@userForm.err.nameMin">Must be at least 2 characters.</span>
              } @else if (control.errors?.['maxlength']) {
                <span i18n="@@userForm.err.nameMax">Must be at most 120 characters.</span>
              }
            </ng-template>
          </nz-form-item>

          <nz-form-item>
            <nz-form-label [nzFor]="'editEmail'" i18n="@@userForm.email">Email</nz-form-label>
            <nz-form-control [nzExtra]="emailReadonlyHint">
              <nz-input-group [nzSuffix]="lockSuffix">
                <input nz-input id="editEmail" [value]="data.row.email" readonly />
              </nz-input-group>
            </nz-form-control>
            <ng-template #lockSuffix>
              <span nz-icon nzType="lock" nzTheme="outline" aria-hidden="true"></span>
            </ng-template>
            <ng-template #emailReadonlyHint>
              <span i18n="@@userForm.emailReadonly"
                >Email cannot be changed after account creation.</span
              >
            </ng-template>
          </nz-form-item>

          <nz-form-item>
            <nz-form-label [nzFor]="'editRole'" i18n="@@userForm.role">Role</nz-form-label>
            <nz-form-control [nzExtra]="isSelf ? selfRoleHint : ''">
              <nz-select id="editRole" formControlName="role" [nzDisabled]="isSelf">
                <nz-option nzValue="sales_manager" [nzLabel]="managerLabel"></nz-option>
                <nz-option nzValue="sales_agent" [nzLabel]="agentLabel"></nz-option>
                <nz-option nzValue="analyst" [nzLabel]="analystLabel"></nz-option>
              </nz-select>
            </nz-form-control>
            <ng-template #selfRoleHint>
              <span i18n="@@userForm.selfRoleHint">You can't change your own role.</span>
            </ng-template>
          </nz-form-item>

          <div class="field-row toggle-row">
            <div class="toggle-text">
              <span class="toggle-title" i18n="@@userForm.active">Active</span>
              <span class="toggle-desc" i18n="@@userForm.activeDesc"
                >Inactive users cannot sign in. Historical records are kept.</span
              >
            </div>
            <nz-switch formControlName="isActive" [nzDisabled]="isSelf"></nz-switch>
          </div>
        }

        @if (formError(); as msg) {
          <div role="alert" aria-live="polite" class="alert">
            <span
              nz-icon
              nzType="close-circle"
              nzTheme="outline"
              class="alert-icon"
              aria-hidden="true"
            ></span>
            <span>{{ msg }}</span>
          </div>
        }
      </form>
    </app-form-drawer>
  `,
  styles: [
    `
      :host {
        display: block;
        font-family: var(--font-family-base);
      }
      .body {
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
      }
      .field-row {
        width: 100%;
      }
      .section {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .section-head {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .section-label {
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--color-text-secondary);
      }
      .section-desc {
        font-size: var(--text-sm);
        color: var(--color-text-primary);
        font-weight: var(--font-weight-medium);
        line-height: var(--line-height-base);
      }
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
        font-size: var(--text-sm);
      }
      .toggle-desc {
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
        line-height: var(--line-height-base);
      }
      .alert {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        padding: var(--space-3);
        background: var(--color-error-bg);
        color: var(--color-error);
        border-radius: var(--radius-md);
        border-inline-start: 3px solid var(--color-error);
        font-size: var(--text-sm);
        line-height: var(--line-height-base);
      }
      .alert-icon {
        font-size: var(--text-lg);
        flex-shrink: 0;
        margin-block-start: 1px;
      }
      @media (prefers-reduced-motion: reduce) {
        .primary-cta {
          transition: none;
        }
        .primary-cta:not(:disabled):hover {
          transform: none;
        }
      }
    `,
  ],
})
export class UserFormDrawer {
  protected readonly data = inject<UserFormDrawerData>(NZ_DRAWER_DATA);
  private readonly ref = inject<NzDrawerRef<UserFormDrawer, StaffAccountSummary>>(NzDrawerRef);

  protected readonly drawerTitle =
    this.data.mode === 'create'
      ? $localize`:@@userForm.titleCreate:Create user`
      : $localize`:@@userForm.titleEdit:Edit user`;
  protected readonly drawerSubtitle =
    this.data.mode === 'create'
      ? $localize`:@@userForm.descCreate:Add a new internal staff account. The user will be required to change the initial password on first sign-in.`
      : $localize`:@@userForm.descEdit:Update name, role, or active status.`;
  protected readonly submitLabel =
    this.data.mode === 'create'
      ? $localize`:@@userForm.saveCreate:Create user`
      : $localize`:@@userForm.saveEdit:Save changes`;
  private readonly api = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly errorCodes = inject(ErrorCodeService);

  protected readonly isSelf =
    this.data.mode === 'edit' && this.data.row?.id === this.auth.currentUser()?.id;

  protected readonly managerLabel = $localize`:@@role.sales_manager:Sales manager`;
  protected readonly agentLabel = $localize`:@@role.sales_agent:Sales agent`;
  protected readonly analystLabel = $localize`:@@role.analyst:Analyst`;

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
