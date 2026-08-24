import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import {
  ArrowRightOutline,
  BankOutline,
  CrownFill,
  ExclamationCircleFill,
  EyeOutline,
  EyeInvisibleOutline,
  LockFill,
  LockOutline,
  MailOutline,
  SafetyCertificateOutline,
  TeamOutline,
} from '@ant-design/icons-angular/icons';
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
  imports: [CommonModule, ReactiveFormsModule, NzIconModule],
  providers: [
    provideNzIconsPatch([
      ArrowRightOutline,
      BankOutline,
      CrownFill,
      ExclamationCircleFill,
      EyeOutline,
      EyeInvisibleOutline,
      LockFill,
      LockOutline,
      MailOutline,
      SafetyCertificateOutline,
      TeamOutline,
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="login-container" role="main">
      <div class="bg-effects" aria-hidden="true">
        <div class="orb orb-1"></div>
        <div class="orb orb-2"></div>
        <div class="orb orb-3"></div>
        <div class="grid-overlay"></div>
      </div>

      <div class="login-wrapper">
        <aside class="brand-panel" aria-hidden="true">
          <div class="brand-content">
            <div class="logo-row">
              <div class="logo-mark">
                <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M24 4L42 14V34L24 44L6 34V14L24 4Z" stroke="currentColor" stroke-width="2" />
                  <circle cx="24" cy="24" r="8" stroke="currentColor" stroke-width="2" />
                  <circle cx="24" cy="24" r="3" fill="currentColor" />
                </svg>
              </div>
              <div class="logo-text">
                <span class="logo-main" i18n="@@auth.login.brand">Masrafy</span>
                <span class="logo-sub" i18n="@@auth.login.tagline">Admin Portal</span>
              </div>
            </div>

            <div class="tagline">
              <h1 i18n="@@auth.login.welcome">Credit Match Console</h1>
              <p i18n="@@auth.login.subtitle">Match Egyptian borrowers with the best bank loan programs — at scale.</p>
            </div>

            <ul class="stats">
              <li>
                <span class="stat-icon"><i nz-icon nzType="bank" nzTheme="outline"></i></span>
                <span class="stat-text"><strong>20+</strong><em i18n="@@auth.login.stat.bank_programs">Bank Programs</em></span>
              </li>
              <li>
                <span class="stat-icon"><i nz-icon nzType="team" nzTheme="outline"></i></span>
                <span class="stat-text"><strong i18n="@@auth.login.stat.marketplace_value">Live</strong><em i18n="@@auth.login.stat.marketplace">Lead Marketplace</em></span>
              </li>
              <li>
                <span class="stat-icon"><i nz-icon nzType="safety-certificate" nzTheme="outline"></i></span>
                <span class="stat-text"><strong>99.9%</strong><em i18n="@@auth.login.stat.uptime">Uptime SLA</em></span>
              </li>
            </ul>

            <div class="security-pill">
              <i nz-icon nzType="lock" nzTheme="fill"></i>
              <span i18n="@@auth.login.security">Enterprise-Grade Security</span>
            </div>
          </div>
          <div class="deco-circle deco-1"></div>
          <div class="deco-circle deco-2"></div>
        </aside>

        <section class="form-panel" [attr.aria-labelledby]="titleId">
          <div class="form-container">
            <div class="form-header">
              <div class="header-badge">
                <i nz-icon nzType="crown" nzTheme="fill"></i>
                <span i18n="@@auth.login.admin_access">Administrator Access</span>
              </div>
              <h2 [id]="titleId" i18n="@@login.title">Welcome back</h2>
              <p i18n="@@login.subtitle">Sign in to the admin dashboard.</p>
            </div>

            @if (errorMessage(); as msg) {
              <div role="alert" aria-live="polite" class="error-alert">
                <span class="error-icon"><i nz-icon nzType="exclamation-circle" nzTheme="fill"></i></span>
                <div class="error-body">
                  <span class="error-title" i18n="@@login.error.title">Authentication failed</span>
                  <span class="error-text">{{ msg }}</span>
                </div>
              </div>
            }

            <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="login-form">
              <div class="field" [class.has-error]="showError('email')">
                <label for="email">
                  <i nz-icon nzType="mail" nzTheme="outline"></i>
                  <span i18n="@@login.email">Email</span>
                </label>
                <input
                  id="email"
                  type="email"
                  autocomplete="email"
                  formControlName="email"
                  placeholder="admin@masrafy.com"
                  [attr.aria-invalid]="showError('email')"
                />
                @if (form.controls.email.touched && form.controls.email.errors?.['required']) {
                  <span class="field-error" i18n="@@login.email.required">Email is required.</span>
                } @else if (form.controls.email.touched && form.controls.email.errors?.['email']) {
                  <span class="field-error" i18n="@@login.email.invalid">Email format is invalid.</span>
                }
              </div>

              <div class="field" [class.has-error]="showError('password')">
                <label for="password">
                  <i nz-icon nzType="lock" nzTheme="outline"></i>
                  <span i18n="@@login.password">Password</span>
                </label>
                <div class="input-with-toggle">
                  <input
                    id="password"
                    [type]="showPassword() ? 'text' : 'password'"
                    autocomplete="current-password"
                    formControlName="password"
                    placeholder="••••••••"
                    [attr.aria-invalid]="showError('password')"
                  />
                  <button
                    type="button"
                    class="toggle-eye"
                    (click)="togglePassword()"
                    [attr.aria-label]="passwordToggleLabel()"
                  >
                    <i nz-icon [nzType]="showPassword() ? 'eye-invisible' : 'eye'" nzTheme="outline"></i>
                  </button>
                </div>
                @if (form.controls.password.touched && form.controls.password.errors?.['required']) {
                  <span class="field-error" i18n="@@login.password.required">Password is required.</span>
                }
              </div>

              <button
                type="submit"
                class="submit-btn"
                [disabled]="form.invalid || submitting()"
                [class.is-loading]="submitting()"
                [attr.aria-busy]="submitting()"
              >
                <span class="btn-content">
                  @if (submitting()) {
                    <span class="spinner"></span>
                    <span i18n="@@login.submitting">Authenticating…</span>
                  } @else {
                    <span i18n="@@login.submit">Sign in to dashboard</span>
                    <i nz-icon nzType="arrow-right" nzTheme="outline" class="btn-arrow"></i>
                  }
                </span>
                <span class="btn-shine" aria-hidden="true"></span>
              </button>
            </form>

            <p class="form-footer" i18n="@@login.helper">
              Forgot your password? Contact a super-admin.
            </p>
          </div>
        </section>
      </div>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        min-height: 100vh;
      }

      /* ─── Backdrop ─────────────────────────────────────────────────────── */
      .login-container {
        position: relative;
        min-height: 100vh;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background:
          radial-gradient(ellipse at 20% 0%, rgba(8, 105, 195, 0.08) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 100%, rgba(161, 124, 91, 0.10) 0%, transparent 50%),
          var(--bg-base);
        overflow: hidden;
      }

      .bg-effects {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
      }

      .orb {
        position: absolute;
        border-radius: 50%;
        filter: blur(90px);
        opacity: 0.55;
      }
      .orb-1 {
        width: 520px; height: 520px;
        background: radial-gradient(circle, rgba(8, 105, 195, 0.18), transparent 70%);
        top: -180px; left: -160px;
      }
      .orb-2 {
        width: 460px; height: 460px;
        background: radial-gradient(circle, rgba(161, 124, 91, 0.20), transparent 70%);
        bottom: -160px; right: -140px;
      }
      .orb-3 {
        width: 360px; height: 360px;
        background: radial-gradient(circle, rgba(8, 105, 195, 0.10), transparent 70%);
        top: 50%; left: 50%; transform: translate(-50%, -50%);
      }

      .grid-overlay {
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(rgba(43, 35, 32, 0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(43, 35, 32, 0.04) 1px, transparent 1px);
        background-size: 64px 64px;
        mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
      }

      /* ─── Wrapper card ────────────────────────────────────────────────── */
      .login-wrapper {
        position: relative;
        z-index: 1;
        display: flex;
        width: 100%;
        max-width: 1120px;
        min-height: 640px;
        background: var(--bg-surface);
        border-radius: 24px;
        border: 1px solid var(--border-subtle);
        overflow: hidden;
        box-shadow:
          0 24px 64px -16px rgba(43, 35, 32, 0.18),
          0 4px 12px -4px rgba(43, 35, 32, 0.08);
        animation: cardRise 0.6s cubic-bezier(0.16, 1, 0.3, 1);
      }

      @keyframes cardRise {
        from { opacity: 0; transform: translateY(16px) scale(0.985); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }

      /* ─── Brand panel ─────────────────────────────────────────────────── */
      .brand-panel {
        flex: 1.05;
        position: relative;
        padding: 48px;
        color: var(--text-inverse);
        background: linear-gradient(135deg, var(--primary) 0%, var(--primary-active) 60%, var(--azure-950) 100%);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        overflow: hidden;
      }

      .brand-content {
        position: relative;
        z-index: 2;
        display: flex;
        flex-direction: column;
        gap: 40px;
      }

      .logo-row {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .logo-mark {
        width: 56px; height: 56px;
        display: flex; align-items: center; justify-content: center;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 16px;
        backdrop-filter: blur(10px);
        color: var(--bronze-300);
      }
      .logo-mark svg { width: 32px; height: 32px; }
      .logo-text { display: flex; flex-direction: column; line-height: 1.1; }
      .logo-main { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
      .logo-sub  {
        font-size: 11px; font-weight: 600; margin-top: 4px;
        text-transform: uppercase; letter-spacing: 0.2em;
        color: rgba(212, 184, 159, 0.85);
      }

      .tagline h1 {
        margin: 0 0 12px;
        font-size: 36px;
        font-weight: 700;
        letter-spacing: -0.02em;
        line-height: 1.15;
      }
      .tagline p {
        margin: 0;
        font-size: 15px;
        line-height: 1.6;
        color: rgba(253, 252, 251, 0.78);
        max-width: 360px;
      }

      .stats {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .stats li {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 12px 14px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        transition: background 220ms cubic-bezier(0.2, 0, 0, 1),
                    transform 220ms cubic-bezier(0.2, 0, 0, 1);
      }
      .stats li:hover {
        background: rgba(255, 255, 255, 0.08);
        transform: translateX(4px);
      }
      .stat-icon {
        width: 40px; height: 40px;
        display: flex; align-items: center; justify-content: center;
        background: var(--gradient-bronze);
        color: var(--azure-950);
        border-radius: var(--radius-field);
        font-size: 18px;
      }
      .stat-text { display: flex; flex-direction: column; line-height: 1.2; }
      .stat-text strong { font-size: 16px; font-weight: 700; }
      .stat-text em {
        font-style: normal; font-size: 12px;
        color: rgba(253, 252, 251, 0.65);
      }

      .security-pill {
        align-self: flex-start;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        font-size: 12px;
        font-weight: 500;
        color: var(--bronze-300);
        background: rgba(212, 184, 159, 0.10);
        border: 1px solid rgba(212, 184, 159, 0.22);
        border-radius: 999px;
      }

      .deco-circle {
        position: absolute;
        border-radius: 50%;
        border: 1px solid rgba(212, 184, 159, 0.16);
        pointer-events: none;
      }
      .deco-1 { width: 320px; height: 320px; bottom: -160px; right: -120px; }
      .deco-2 { width: 200px; height: 200px; top: -80px; right: 18%; }

      /* ─── Form panel ──────────────────────────────────────────────────── */
      .form-panel {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 48px;
        background: var(--bg-surface);
      }
      .form-container {
        width: 100%;
        max-width: 400px;
      }

      .form-header { text-align: center; margin-bottom: 28px; }
      .header-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        margin-bottom: 18px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--primary);
        background: linear-gradient(135deg, rgba(8, 105, 195, 0.10), rgba(8, 105, 195, 0.04));
        border: 1px solid rgba(8, 105, 195, 0.18);
        border-radius: 999px;
      }
      .header-badge i { color: var(--accent); font-size: 12px; }
      .form-header h2 {
        margin: 0 0 6px;
        font-size: 28px;
        font-weight: 700;
        letter-spacing: -0.02em;
        color: var(--text-primary);
      }
      .form-header p { margin: 0; font-size: 14px; color: var(--text-secondary); }

      /* ─── Error ───────────────────────────────────────────────────────── */
      .error-alert {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        padding: 14px 16px;
        margin-bottom: 20px;
        background: linear-gradient(135deg, rgba(193, 102, 107, 0.12), rgba(193, 102, 107, 0.04));
        border: 1px solid rgba(193, 102, 107, 0.30);
        border-radius: 12px;
        animation: alertSlide 240ms cubic-bezier(0.2, 0, 0, 1);
      }
      @keyframes alertSlide {
        from { opacity: 0; transform: translateY(-6px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .error-icon {
        width: 32px; height: 32px;
        display: flex; align-items: center; justify-content: center;
        background: rgba(193, 102, 107, 0.18);
        color: var(--error-500);
        border-radius: 8px;
        font-size: 16px;
        flex-shrink: 0;
      }
      .error-body { display: flex; flex-direction: column; gap: 2px; }
      .error-title { font-size: 13px; font-weight: 600; color: var(--error-600); }
      .error-text  { font-size: 12px; color: rgba(139, 51, 56, 0.85); }

      /* ─── Form fields ─────────────────────────────────────────────────── */
      .login-form {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }

      .field { display: flex; flex-direction: column; gap: 8px; }
      .field label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 500;
        color: var(--neutral-700);
      }
      .field label i { color: var(--text-tertiary); font-size: 14px; }

      .field input,
      .input-with-toggle input {
        width: 100%;
        height: 48px;
        padding: 0 16px;
        font-size: 14px;
        color: var(--text-primary);
        background: var(--bg-surface);
        border: 1.5px solid var(--border-default);
        border-radius: 12px;
        outline: none;
        transition: border-color 180ms cubic-bezier(0.2, 0, 0, 1),
                    box-shadow 180ms cubic-bezier(0.2, 0, 0, 1),
                    background 180ms cubic-bezier(0.2, 0, 0, 1);
        font-family: inherit;
      }
      .field input::placeholder,
      .input-with-toggle input::placeholder { color: var(--text-muted); }

      .field input:focus,
      .input-with-toggle input:focus {
        border-color: var(--accent);
        background: var(--bronze-50);
        box-shadow: 0 0 0 4px rgba(161, 124, 91, 0.16);
      }

      .field.has-error input { border-color: var(--error); }
      .field.has-error input:focus { box-shadow: 0 0 0 4px rgba(193, 102, 107, 0.16); }

      .input-with-toggle { position: relative; }
      .input-with-toggle input { padding-inline-end: 44px; }
      .toggle-eye {
        position: absolute;
        inset-inline-end: 12px;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        padding: 4px;
        color: var(--text-tertiary);
        cursor: pointer;
        transition: color 180ms;
      }
      .toggle-eye:hover { color: var(--accent); }

      .field-error {
        font-size: 12px;
        color: var(--error-500);
      }

      /* ─── Submit ──────────────────────────────────────────────────────── */
      .submit-btn {
        position: relative;
        width: 100%;
        height: 52px;
        margin-top: 6px;
        font-size: 15px;
        font-weight: 600;
        color: var(--text-on-primary);
        background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
        border: none;
        border-radius: 14px;
        cursor: pointer;
        overflow: hidden;
        transition: transform 220ms cubic-bezier(0.2, 0, 0, 1),
                    box-shadow 220ms cubic-bezier(0.2, 0, 0, 1),
                    opacity 180ms;
      }
      .submit-btn:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 12px 28px -8px rgba(8, 105, 195, 0.45);
      }
      .submit-btn:active:not(:disabled) { transform: translateY(0); }
      .submit-btn:disabled { opacity: 0.55; cursor: not-allowed; }

      .btn-content {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
      }
      .btn-arrow { transition: transform 220ms cubic-bezier(0.2, 0, 0, 1); }
      .submit-btn:hover:not(:disabled) .btn-arrow { transform: translateX(4px); }
      [dir='rtl'] .submit-btn:hover:not(:disabled) .btn-arrow { transform: translateX(-4px); }

      .btn-shine {
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.18), transparent);
        transform: translateX(-100%);
        transition: transform 600ms cubic-bezier(0.2, 0, 0, 1);
      }
      .submit-btn:hover:not(:disabled) .btn-shine { transform: translateX(100%); }

      .spinner {
        display: inline-block;
        width: 18px;
        height: 18px;
        border: 2px solid rgba(255, 255, 255, 0.32);
        border-top-color: var(--text-on-primary);
        border-radius: 50%;
        animation: spin 700ms linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }

      .form-footer {
        margin: 24px 0 0;
        padding-top: 18px;
        border-top: 1px solid var(--border-subtle);
        text-align: center;
        font-size: 12px;
        color: var(--text-tertiary);
      }

      /* ─── Responsive ──────────────────────────────────────────────────── */
      @media (max-width: 960px) {
        .login-wrapper { flex-direction: column; max-width: 480px; min-height: auto; }
        .brand-panel { display: none; }
        .form-panel { padding: 36px 28px; }
      }
      @media (max-width: 520px) {
        .login-container { padding: 0; }
        .login-wrapper {
          margin: 0;
          border-radius: 0;
          border: none;
          min-height: 100vh;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .login-wrapper,
        .error-alert,
        .submit-btn,
        .btn-arrow,
        .btn-shine,
        .spinner { animation: none; transition: none; }
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
  protected readonly showPassword = signal<boolean>(false);

  protected showError(field: keyof LoginControls): boolean {
    const ctrl = this.form.controls[field];
    return ctrl.touched && ctrl.invalid;
  }

  protected togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  protected passwordToggleLabel(): string {
    return this.showPassword()
      ? $localize`:@@auth.login.password.hide:Hide password`
      : $localize`:@@auth.login.password.show:Show password`;
  }

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
