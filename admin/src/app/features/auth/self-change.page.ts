import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  LOCALE_ID,
  computed,
  inject,
  signal,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import {
  ArrowRightOutline,
  CheckOutline,
  CloseOutline,
  ExclamationCircleFill,
  EyeInvisibleOutline,
  EyeOutline,
  LoadingOutline,
  PoweroffOutline,
  SafetyCertificateOutline,
  WarningFill,
} from '@ant-design/icons-angular/icons';
import { PageHeaderComponent } from '@shared/ui';
import { AuthService } from '@core/auth/auth.service';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode, ErrorEnvelope, StaffRole } from '@core/auth/auth.types';

interface SelfChangeControls {
  currentPassword: FormControl<string>;
  newPassword: FormControl<string>;
}

/** The four rules the backend actually enforces (PasswordService.validatePolicy). */
type RuleKey = 'length' | 'distinct' | 'common' | 'breach';

/**
 * `deferred` = only the server can answer it, so the chip says "checked when
 * you save" instead of pretending to know. `checking` runs during the request,
 * `failed` is what a rejected save flips it to — the error lands ON the rule
 * rather than in a generic blob at the bottom of the form.
 */
type RuleState = 'idle' | 'met' | 'unmet' | 'deferred' | 'checking' | 'failed';

interface PolicyRule {
  readonly key: RuleKey;
  readonly label: string;
  readonly state: RuleState;
  readonly note: string;
}

/** Server rejections that belong to a specific rule chip, not the alert bar. */
const CODE_TO_RULE: Partial<Record<ErrorCode, RuleKey>> = {
  PASSWORD_TOO_SHORT: 'length',
  PASSWORD_TOO_LONG: 'length',
  PASSWORD_ON_COMMON_LIST: 'common',
  PASSWORD_BREACHED: 'breach',
  PASSWORD_BREACH_CHECK_UNAVAILABLE: 'breach',
  PASSWORD_REUSES_RESET_VALUE: 'distinct',
};

const MIN_LEN = 12;
const MAX_LEN = 128;
const REDIRECT_DELAY_MS = 2000;

@Component({
  selector: 'app-self-change-page',
  standalone: true,
  imports: [ReactiveFormsModule, NzIconModule, PageHeaderComponent],
  providers: [
    provideNzIconsPatch([
      ArrowRightOutline,
      CheckOutline,
      CloseOutline,
      ExclamationCircleFill,
      EyeInvisibleOutline,
      EyeOutline,
      LoadingOutline,
      PoweroffOutline,
      SafetyCertificateOutline,
      WarningFill,
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <app-page-header [eyebrow]="eyebrowText" [title]="titleText" [subtitle]="subtitleText" />

      @if (succeeded()) {
        <div class="done" role="status">
          <svg class="done-mark" viewBox="0 0 52 52" aria-hidden="true">
            <circle class="done-ring" cx="26" cy="26" r="23" />
            <path class="done-tick" d="M15 27.5 L23 35 L38 19" />
          </svg>
          <h2 class="done-title" i18n="@@selfChange.success.title">Password updated</h2>
          <p class="done-body" i18n="@@selfChange.success.body">
            Your other devices have been signed out.
          </p>
          <button type="button" class="btn btn-primary done-cta" (click)="goToDashboard()">
            <span i18n="@@selfChange.success.cta">Go to dashboard</span>
            <span nz-icon nzType="arrow-right" nzTheme="outline" class="btn-arrow"></span>
          </button>
        </div>
      } @else {
        <div class="grid">
          <form class="panel" [formGroup]="form" (ngSubmit)="submit()" novalidate>
            @if (errorMessage(); as msg) {
              <div class="alert" role="alert">
                <span class="alert-icon" aria-hidden="true">
                  <span nz-icon nzType="exclamation-circle" nzTheme="fill"></span>
                </span>
                <div class="alert-body">
                  <span class="alert-title" i18n="@@selfChange.error.title">
                    Couldn't update your password
                  </span>
                  <span class="alert-text">{{ msg }}</span>
                </div>
              </div>
            }

            <!-- Step 1 — prove it's you -->
            <div class="field" [class.has-error]="currentError() !== null">
              <label for="currentPassword" i18n="@@selfChange.currentPassword">
                Current password
              </label>
              <div class="control">
                <input
                  #currentInput
                  id="currentPassword"
                  [type]="revealCurrent() ? 'text' : 'password'"
                  autocomplete="current-password"
                  [attr.maxlength]="maxLen"
                  formControlName="currentPassword"
                  [attr.aria-invalid]="currentError() !== null"
                  [attr.aria-describedby]="currentError() ? currentErrorId : currentHintId"
                  (input)="clearServerFeedback()"
                  (keyup)="trackCapsLock($event)"
                  (keydown)="trackCapsLock($event)"
                  (blur)="capsLock.set(false)"
                />
                <button
                  type="button"
                  class="reveal"
                  (click)="revealCurrent.set(!revealCurrent())"
                  [attr.aria-pressed]="revealCurrent()"
                  [attr.aria-label]="revealCurrent() ? hideLabel : showLabel"
                >
                  <span
                    nz-icon
                    [nzType]="revealCurrent() ? 'eye-invisible' : 'eye'"
                    nzTheme="outline"
                  ></span>
                </button>
              </div>
              @if (currentError(); as msg) {
                <p [id]="currentErrorId" class="field-error">{{ msg }}</p>
              } @else {
                <p [id]="currentHintId" class="field-hint" i18n="@@selfChange.currentPassword.hint">
                  Verified before anything changes.
                </p>
              }
              @if (capsLock()) {
                <p class="caps" role="status">
                  <span nz-icon nzType="warning" nzTheme="fill" aria-hidden="true"></span>
                  <span i18n="@@selfChange.capsLock">Caps Lock is on.</span>
                </p>
              }
            </div>

            <!-- Step 2 — the new one, with live policy feedback -->
            <div class="field">
              <label for="newPassword" i18n="@@selfChange.newPassword">New password</label>
              <div class="control">
                <input
                  id="newPassword"
                  [type]="revealNew() ? 'text' : 'password'"
                  autocomplete="new-password"
                  [attr.maxlength]="maxLen"
                  formControlName="newPassword"
                  [attr.aria-describedby]="rulesId"
                  (input)="clearServerFeedback()"
                />
                <button
                  type="button"
                  class="reveal"
                  (click)="revealNew.set(!revealNew())"
                  [attr.aria-pressed]="revealNew()"
                  [attr.aria-label]="revealNew() ? hideLabel : showLabel"
                >
                  <span
                    nz-icon
                    [nzType]="revealNew() ? 'eye-invisible' : 'eye'"
                    nzTheme="outline"
                  ></span>
                </button>
              </div>

              @if (length() > 0) {
                <div class="strength" [attr.data-level]="strength()">
                  <div class="strength-head">
                    <span class="strength-label" i18n="@@selfChange.strength">Strength</span>
                    <span class="strength-value">{{ strengthLabel() }}</span>
                  </div>
                  <div
                    class="meter"
                    role="progressbar"
                    aria-valuemin="0"
                    aria-valuemax="4"
                    [attr.aria-valuenow]="strength()"
                    [attr.aria-valuetext]="strengthLabel()"
                    [attr.aria-label]="strengthAria"
                  >
                    @for (i of segments; track i) {
                      <span class="seg" [class.on]="strength() > i"></span>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- The rail: every rule the server enforces, visible before it runs -->
            <div class="rail">
              <div class="rail-head">
                <span class="rail-title" i18n="@@selfChange.requirements">Requirements</span>
                <span class="counter" [class.pending]="!lengthOk()">
                  {{ length() }}<span aria-hidden="true">/{{ maxLen }}</span>
                </span>
              </div>
              <ul [id]="rulesId" class="rules" [attr.aria-label]="rulesAria">
                @for (rule of rules(); track rule.key) {
                  <li [attr.data-state]="rule.state">
                    <span class="rule-mark" aria-hidden="true">
                      @switch (rule.state) {
                        @case ('met') {
                          <span nz-icon nzType="check" nzTheme="outline"></span>
                        }
                        @case ('failed') {
                          <span nz-icon nzType="close" nzTheme="outline"></span>
                        }
                        @case ('checking') {
                          <span nz-icon nzType="loading" nzTheme="outline"></span>
                        }
                        @case ('deferred') {
                          <span nz-icon nzType="safety-certificate" nzTheme="outline"></span>
                        }
                        @default {
                          <span class="dot"></span>
                        }
                      }
                    </span>
                    <span class="rule-text">
                      <span class="rule-label">{{ rule.label }}</span>
                      @if (rule.note) {
                        <span class="rule-note">{{ rule.note }}</span>
                      }
                    </span>
                  </li>
                }
              </ul>
              <!-- The chips are silent to a screen reader on every keystroke;
                   only the server's verdict is worth interrupting for. -->
              @if (ruleFailure(); as failure) {
                <p class="sr-only" role="alert">{{ failure.message }}</p>
              }
            </div>

            <div class="actions">
              <button type="button" class="btn btn-ghost" (click)="cancel()">
                <span i18n="@@selfChange.cancel">Cancel</span>
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                [disabled]="form.invalid || submitting()"
                [attr.aria-busy]="submitting()"
              >
                @if (submitting()) {
                  <span class="spinner" aria-hidden="true"></span>
                  <span i18n="@@selfChange.submitting">Updating…</span>
                } @else {
                  <span i18n="@@selfChange.save">Update password</span>
                  <span nz-icon nzType="arrow-right" nzTheme="outline" class="btn-arrow"></span>
                }
              </button>
            </div>
          </form>

          <aside class="side">
            @if (auth.currentUser(); as user) {
              <div class="who">
                <span class="avatar" aria-hidden="true">{{ initials(user.name) }}</span>
                <span class="who-text">
                  <span class="who-name">{{ user.name }}</span>
                  <span class="who-mail">{{ user.email }}</span>
                </span>
                <span class="who-role">{{ roleLabel(user.role) }}</span>
              </div>
              <dl class="meta">
                <dt i18n="@@selfChange.lastSignIn">Last sign-in</dt>
                <dd>{{ lastSignIn() }}</dd>
              </dl>
            }

            <div class="consequence">
              <span class="consequence-icon" aria-hidden="true">
                <span nz-icon nzType="poweroff" nzTheme="outline"></span>
              </span>
              <div>
                <p class="consequence-title" i18n="@@selfChange.consequence.title">
                  Saving ends your other sessions
                </p>
                <p class="consequence-body" i18n="@@selfChange.consequence.body">
                  This browser stays signed in. Every other device signs out immediately.
                </p>
              </div>
            </div>
          </aside>
        </div>
      }
    </section>
  `,
  styles: [
    `
      /* ─── Layout ──────────────────────────────────────────────────────── */
      /* Track is capped, not 1fr — a 1fr track leaves a dead gap between the
         620px form and the aside on wide viewports. */
      .grid {
        display: grid;
        grid-template-columns: minmax(0, 620px) 300px;
        align-items: start;
        gap: var(--space-6);
        margin-block-start: var(--space-6);
      }
      @media (max-width: 1040px) {
        .grid {
          grid-template-columns: minmax(0, 1fr);
          max-inline-size: 640px;
        }
      }

      .panel {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
        padding: var(--space-6);
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-xl);
        box-shadow: var(--shadow-sm);
      }

      /* ─── Fields ──────────────────────────────────────────────────────── */
      .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .field label {
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        color: var(--text-primary);
      }

      .control {
        position: relative;
      }
      .control input {
        inline-size: 100%;
        block-size: 48px;
        padding-inline: var(--space-4) 48px;
        font-family: inherit;
        font-size: var(--text-sm);
        color: var(--text-primary);
        background: var(--bg-subtle);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        outline: none;
        transition:
          border-color var(--motion-duration-base) var(--motion-easing-standard),
          box-shadow var(--motion-duration-base) var(--motion-easing-standard),
          background var(--motion-duration-base) var(--motion-easing-standard);
      }
      .control input:hover:not(:focus) {
        border-color: var(--border-strong);
      }
      .control input:focus {
        background: var(--bg-surface);
        border-color: var(--primary);
        box-shadow: var(--focus-halo);
      }
      .field.has-error .control input {
        border-color: var(--error);
      }
      .field.has-error .control input:focus {
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--error) 22%, transparent);
      }

      .reveal {
        position: absolute;
        inset-inline-end: var(--space-1);
        inset-block-start: 50%;
        transform: translateY(-50%);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 44px;
        block-size: 44px;
        color: var(--text-tertiary);
        background: none;
        border: none;
        border-radius: var(--radius-md);
        cursor: pointer;
        transition:
          color var(--motion-duration-fast) var(--motion-easing-standard),
          background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .reveal:hover {
        color: var(--primary);
        background: color-mix(in srgb, var(--primary) 8%, transparent);
      }
      .reveal:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: calc(var(--focus-ring-offset) * -1);
        color: var(--primary);
      }

      .field-hint,
      .field-error,
      .caps {
        margin: 0;
        font-size: var(--text-xs);
        line-height: var(--leading-normal);
      }
      .field-hint {
        color: var(--text-secondary);
      }
      .field-error {
        color: var(--error);
        font-weight: var(--font-medium);
      }
      .caps {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        align-self: flex-start;
        padding: var(--space-1) var(--space-2-5);
        color: var(--warning);
        background: color-mix(in srgb, var(--warning) 12%, transparent);
        border-radius: var(--radius-pill);
        font-weight: var(--font-medium);
      }

      /* ─── Strength meter ──────────────────────────────────────────────── */
      .strength {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        margin-block-start: var(--space-1);
      }
      .strength-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        font-size: var(--text-xs);
      }
      .strength-label {
        color: var(--text-secondary);
        letter-spacing: var(--tracking-wide);
        text-transform: uppercase;
        font-weight: var(--font-semibold);
      }
      .strength-value {
        font-weight: var(--font-semibold);
        color: var(--text-secondary);
        transition: color var(--motion-duration-base) var(--motion-easing-standard);
      }
      .meter {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 4px;
      }
      .seg {
        block-size: 4px;
        border-radius: var(--radius-pill);
        background: var(--border-subtle);
        transform-origin: left center;
        transition:
          background var(--motion-duration-base) var(--motion-easing-standard),
          transform var(--motion-duration-base) var(--motion-easing-standard);
      }
      [dir='rtl'] .seg {
        transform-origin: right center;
      }
      .seg.on {
        transform: scaleY(1.5);
      }
      .strength[data-level='1'] .seg.on {
        background: var(--error);
      }
      .strength[data-level='1'] .strength-value {
        color: var(--error);
      }
      .strength[data-level='2'] .seg.on {
        background: var(--warning);
      }
      .strength[data-level='2'] .strength-value {
        color: var(--warning);
      }
      .strength[data-level='3'] .seg.on,
      .strength[data-level='4'] .seg.on {
        background: var(--success);
      }
      .strength[data-level='3'] .strength-value,
      .strength[data-level='4'] .strength-value {
        color: var(--success);
      }

      /* ─── Requirement rail ────────────────────────────────────────────── */
      .rail {
        padding: var(--space-4);
        background: var(--bg-subtle);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-lg);
      }
      .rail-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-block-end: var(--space-3);
      }
      .rail-title {
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        letter-spacing: var(--tracking-wide);
        text-transform: uppercase;
        color: var(--text-secondary);
      }
      .counter {
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        font-feature-settings: var(--font-feature-tabular);
        color: var(--success);
      }
      .counter.pending {
        color: var(--text-secondary);
      }

      .rules {
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: var(--space-2-5);
        margin: 0;
        padding: 0;
      }
      .rules li {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2-5);
        font-size: var(--text-sm);
        color: var(--text-secondary);
        transition: color var(--motion-duration-base) var(--motion-easing-standard);
      }
      .rule-mark {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: none;
        inline-size: 22px;
        block-size: 22px;
        font-size: 12px;
        color: var(--text-tertiary);
        border: 1px solid var(--border-default);
        border-radius: 50%;
        transition:
          color var(--motion-duration-base) var(--motion-easing-standard),
          background var(--motion-duration-base) var(--motion-easing-standard),
          border-color var(--motion-duration-base) var(--motion-easing-standard);
      }
      .dot {
        inline-size: 4px;
        block-size: 4px;
        border-radius: 50%;
        background: currentColor;
      }
      .rule-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-inline-size: 0;
      }
      .rule-note {
        font-size: var(--text-xs);
        color: var(--text-secondary);
      }

      .rules li[data-state='met'] {
        color: var(--text-primary);
      }
      .rules li[data-state='met'] .rule-mark {
        color: var(--text-on-primary);
        background: var(--success);
        border-color: var(--success);
      }
      .rules li[data-state='unmet'] .rule-mark {
        color: var(--warning);
        border-color: color-mix(in srgb, var(--warning) 55%, transparent);
      }
      .rules li[data-state='deferred'] .rule-mark {
        color: var(--accent);
        border-color: color-mix(in srgb, var(--accent) 45%, transparent);
        background: color-mix(in srgb, var(--accent) 10%, transparent);
      }
      .rules li[data-state='checking'] .rule-mark {
        color: var(--primary);
        border-color: color-mix(in srgb, var(--primary) 45%, transparent);
      }
      .rules li[data-state='failed'] {
        color: var(--error);
      }
      .rules li[data-state='failed'] .rule-mark {
        color: var(--text-on-primary);
        background: var(--error);
        border-color: var(--error);
      }
      .rules li[data-state='failed'] .rule-note {
        color: var(--error);
      }

      .sr-only {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        margin: -1px;
        padding: 0;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }

      /* ─── Alert ───────────────────────────────────────────────────────── */
      .alert {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        background: color-mix(in srgb, var(--error) 10%, transparent);
        border: 1px solid color-mix(in srgb, var(--error) 28%, transparent);
        border-radius: var(--radius-lg);
        animation: alert-in var(--motion-duration-slow) var(--motion-easing-standard);
      }
      @keyframes alert-in {
        from {
          opacity: 0;
          transform: translateY(-4px);
        }
        to {
          opacity: 1;
        }
      }
      .alert-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: none;
        inline-size: 28px;
        block-size: 28px;
        font-size: 15px;
        color: var(--error);
        background: color-mix(in srgb, var(--error) 16%, transparent);
        border-radius: var(--radius-md);
      }
      .alert-body {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .alert-title {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--error);
      }
      .alert-text {
        font-size: var(--text-xs);
        color: var(--text-secondary);
      }

      /* ─── Actions ─────────────────────────────────────────────────────── */
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-3);
        padding-block-start: var(--space-4);
        border-block-start: 1px solid var(--border-subtle);
      }
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-2);
        min-block-size: 44px;
        padding-inline: var(--space-5);
        font-family: inherit;
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        border-radius: var(--radius-lg);
        cursor: pointer;
        transition:
          transform var(--motion-duration-base) var(--motion-easing-standard),
          box-shadow var(--motion-duration-base) var(--motion-easing-standard),
          background var(--motion-duration-base) var(--motion-easing-standard),
          border-color var(--motion-duration-base) var(--motion-easing-standard),
          opacity var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .btn:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .btn-ghost {
        color: var(--text-secondary);
        background: transparent;
        border: 1px solid var(--border-default);
      }
      .btn-ghost:hover {
        color: var(--text-primary);
        background: var(--bg-subtle);
        border-color: var(--border-strong);
      }
      .btn-ghost:active {
        background: var(--bg-muted);
      }
      .btn-primary {
        color: var(--text-on-primary);
        background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
        border: 1px solid transparent;
      }
      .btn-primary:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 10px 22px -10px color-mix(in srgb, var(--primary) 70%, transparent);
      }
      .btn-primary:active:not(:disabled) {
        transform: translateY(0);
        box-shadow: none;
      }
      .btn-primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }
      .btn-arrow {
        font-size: 13px;
        transition: transform var(--motion-duration-base) var(--motion-easing-standard);
      }
      .btn-primary:hover:not(:disabled) .btn-arrow {
        transform: translateX(3px);
      }
      [dir='rtl'] .btn-arrow {
        transform: scaleX(-1);
      }
      [dir='rtl'] .btn-primary:hover:not(:disabled) .btn-arrow {
        transform: scaleX(-1) translateX(3px);
      }

      .spinner {
        inline-size: 15px;
        block-size: 15px;
        border: 2px solid color-mix(in srgb, var(--text-on-primary) 35%, transparent);
        border-block-start-color: var(--text-on-primary);
        border-radius: 50%;
        animation: spin 700ms linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      /* ─── Aside ───────────────────────────────────────────────────────── */
      .side {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        position: sticky;
        inset-block-start: var(--space-2);
      }
      @media (max-width: 1040px) {
        .side {
          position: static;
        }
      }

      .who {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-4);
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-lg);
      }
      .avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 40px;
        block-size: 40px;
        font-size: var(--text-sm);
        font-weight: var(--font-bold);
        color: var(--text-on-primary);
        background: var(--gradient-hero);
        border-radius: var(--radius-md);
      }
      .who-text {
        display: flex;
        flex-direction: column;
        min-inline-size: 0;
      }
      .who-name {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--text-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .who-mail {
        font-size: var(--text-xs);
        color: var(--text-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .who-role {
        grid-column: 1 / -1;
        justify-self: start;
        padding: 3px var(--space-2-5);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        color: var(--accent-hover);
        background: color-mix(in srgb, var(--accent) 14%, transparent);
        border-radius: var(--radius-pill);
      }

      .meta {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--space-3);
        margin: 0;
        padding-inline: var(--space-4);
      }
      .meta dt {
        font-size: var(--text-xs);
        color: var(--text-secondary);
      }
      .meta dd {
        margin: 0;
        font-size: var(--text-xs);
        font-weight: var(--font-medium);
        color: var(--text-secondary);
        text-align: end;
      }

      .consequence {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        padding: var(--space-4);
        background: color-mix(in srgb, var(--accent) 12%, var(--bg-surface));
        border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
        border-radius: var(--radius-lg);
      }
      .consequence-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: none;
        inline-size: 28px;
        block-size: 28px;
        font-size: 14px;
        color: var(--accent-hover);
        background: color-mix(in srgb, var(--accent) 16%, transparent);
        border-radius: var(--radius-md);
      }
      .consequence-title {
        margin: 0 0 2px;
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--text-primary);
      }
      .consequence-body {
        margin: 0;
        font-size: var(--text-xs);
        line-height: var(--leading-relaxed);
        color: var(--text-secondary);
      }

      /* ─── Success ─────────────────────────────────────────────────────── */
      .done {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: var(--space-3);
        max-inline-size: 420px;
        margin: var(--space-8) auto 0;
        padding: var(--space-7) var(--space-6);
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-xl);
        box-shadow: var(--shadow-md);
        animation: done-in var(--motion-duration-slow) var(--motion-easing-standard);
      }
      @keyframes done-in {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
        }
      }
      .done-mark {
        inline-size: 64px;
        block-size: 64px;
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .done-ring {
        stroke: color-mix(in srgb, var(--success) 40%, transparent);
        stroke-width: 2;
        stroke-dasharray: 145;
        animation: draw 520ms var(--motion-easing-standard) forwards;
      }
      .done-tick {
        stroke: var(--success);
        stroke-width: 3.5;
        stroke-dasharray: 40;
        animation: draw 340ms var(--motion-easing-standard) 260ms backwards;
      }
      @keyframes draw {
        from {
          stroke-dashoffset: 145;
        }
        to {
          stroke-dashoffset: 0;
        }
      }
      .done-title {
        margin: 0;
        font-size: var(--text-xl);
        font-weight: var(--font-bold);
        color: var(--text-primary);
      }
      .done-body {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }
      .done-cta {
        margin-block-start: var(--space-3);
      }

      @media (prefers-reduced-motion: reduce) {
        .alert,
        .done,
        .done-ring,
        .done-tick,
        .spinner,
        .btn,
        .btn-arrow,
        .seg,
        .rule-mark {
          animation: none;
          transition: none;
        }
        .done-ring,
        .done-tick {
          stroke-dasharray: none;
        }
      }
    `,
  ],
})
export class SelfChangePage {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly errorCodes = inject(ErrorCodeService);
  private readonly locale = inject(LOCALE_ID);

  private readonly currentInput = viewChild<ElementRef<HTMLInputElement>>('currentInput');

  protected readonly currentHintId = 'self-change-current-hint';
  protected readonly currentErrorId = 'self-change-current-error';
  protected readonly rulesId = 'self-change-rules';
  protected readonly maxLen = MAX_LEN;
  protected readonly segments = [0, 1, 2, 3];

  protected readonly eyebrowText = $localize`:@@selfChange.eyebrow:Account security`;
  protected readonly titleText = $localize`:@@selfChange.title:Change password`;
  protected readonly subtitleText = $localize`:@@selfChange.subtitle:Set a new password for your admin account. Every other session ends the moment it saves.`;
  protected readonly showLabel = $localize`:@@selfChange.show:Show password`;
  protected readonly hideLabel = $localize`:@@selfChange.hide:Hide password`;
  protected readonly strengthAria = $localize`:@@selfChange.strengthAria:New password strength`;
  protected readonly rulesAria = $localize`:@@selfChange.requirementsAria:Password requirements`;

  protected readonly form = new FormGroup<SelfChangeControls>({
    currentPassword: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_LEN)],
    }),
    newPassword: new FormControl<string>('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(MIN_LEN),
        Validators.maxLength(MAX_LEN),
      ],
    }),
  });

  private readonly currentValue = toSignal(this.form.controls.currentPassword.valueChanges, {
    initialValue: '',
  });
  private readonly newValue = toSignal(this.form.controls.newPassword.valueChanges, {
    initialValue: '',
  });

  protected readonly submitting = signal<boolean>(false);
  protected readonly succeeded = signal<boolean>(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly currentError = signal<string | null>(null);
  protected readonly revealCurrent = signal<boolean>(false);
  protected readonly revealNew = signal<boolean>(false);
  protected readonly capsLock = signal<boolean>(false);

  /** A server rejection pinned to the rule it belongs to. */
  protected readonly ruleFailure = signal<{ key: RuleKey; message: string } | null>(null);

  protected readonly length = computed<number>(() => this.newValue().length);
  protected readonly lengthOk = computed<boolean>(
    () => this.length() >= MIN_LEN && this.length() <= MAX_LEN,
  );

  /**
   * Guidance only — never a policy claim. The four backend rules live in the
   * rail below; this bar just nudges toward something longer and more varied.
   */
  protected readonly strength = computed<number>(() => {
    const value = this.newValue();
    if (value.length === 0) return 0;

    let score = 0;
    if (value.length >= MIN_LEN) score += 1;
    if (value.length >= 16) score += 1;
    if (value.length >= 20) score += 1;

    const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) =>
      re.test(value),
    ).length;
    if (classes >= 3) score += 1;
    if (classes === 4) score += 1;

    // A single repeated character is long, not strong.
    if (new Set(value).size <= 2) score = Math.min(score, 1);

    return Math.max(1, Math.min(4, score));
  });

  protected readonly strengthLabel = computed<string>(() => {
    switch (this.strength()) {
      case 4:
        return $localize`:@@selfChange.strength.excellent:Excellent`;
      case 3:
        return $localize`:@@selfChange.strength.strong:Strong`;
      case 2:
        return $localize`:@@selfChange.strength.fair:Fair`;
      default:
        return $localize`:@@selfChange.strength.weak:Weak`;
    }
  });

  protected readonly rules = computed<readonly PolicyRule[]>(() => {
    const failure = this.ruleFailure();
    const busy = this.submitting();
    const typed = this.length() > 0;
    const deferredNote = busy
      ? $localize`:@@selfChange.rule.checking:Checking…`
      : $localize`:@@selfChange.rule.deferred:Checked when you save`;

    const clientState = (ok: boolean): RuleState => (!typed ? 'idle' : ok ? 'met' : 'unmet');
    const serverState = (): RuleState => (busy ? 'checking' : 'deferred');

    const build = (key: RuleKey, label: string, state: RuleState, note: string): PolicyRule =>
      failure?.key === key
        ? { key, label, state: 'failed', note: failure.message }
        : { key, label, state, note };

    return [
      build(
        'length',
        $localize`:@@selfChange.rule.length:12–128 characters`,
        clientState(this.lengthOk()),
        '',
      ),
      build(
        'distinct',
        $localize`:@@selfChange.rule.distinct:Different from your current password`,
        this.currentValue().length === 0
          ? 'idle'
          : clientState(this.newValue() !== this.currentValue()),
        '',
      ),
      build(
        'common',
        $localize`:@@selfChange.rule.common:Not a commonly used password`,
        serverState(),
        deferredNote,
      ),
      build(
        'breach',
        $localize`:@@selfChange.rule.breach:Not found in a known data breach`,
        serverState(),
        deferredNote,
      ),
    ];
  });

  protected readonly lastSignIn = computed<string>(() => {
    const iso = this.auth.currentUser()?.lastLoginAt;
    if (!iso) return $localize`:@@selfChange.lastSignIn.never:Not recorded`;
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) {
      return $localize`:@@selfChange.lastSignIn.never:Not recorded`;
    }
    // Intl, not DatePipe — no `registerLocaleData` call exists for ar-EG.
    return new Intl.DateTimeFormat(this.locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(parsed);
  });

  private redirectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearRedirect());
  }

  protected trackCapsLock(event: KeyboardEvent): void {
    this.capsLock.set(event.getModifierState('CapsLock'));
  }

  /** Any edit invalidates the last server verdict — drop it, don't stale it. */
  protected clearServerFeedback(): void {
    if (this.errorMessage() !== null) this.errorMessage.set(null);
    if (this.currentError() !== null) this.currentError.set(null);
    if (this.ruleFailure() !== null) this.ruleFailure.set(null);
  }

  protected initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const first = parts[0]?.charAt(0) ?? '';
    const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : '';
    return (first + last).toUpperCase() || '—';
  }

  protected roleLabel(role: StaffRole): string {
    switch (role) {
      case 'super_admin':
        return $localize`:@@role.super_admin:Super-admin`;
      case 'sales_manager':
        return $localize`:@@role.sales_manager:Sales manager`;
      case 'sales_agent':
        return $localize`:@@role.sales_agent:Sales agent`;
      case 'analyst':
        return $localize`:@@role.analyst:Analyst`;
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.currentError.set(null);
    this.ruleFailure.set(null);

    try {
      await this.auth.changePassword(this.form.getRawValue());
      this.succeeded.set(true);
      this.redirectTimer = setTimeout(() => this.goToDashboard(), REDIRECT_DELAY_MS);
    } catch (err) {
      this.applyFailure(err);
    } finally {
      this.submitting.set(false);
    }
  }

  protected cancel(): void {
    void this.router.navigateByUrl('/dashboard');
  }

  protected goToDashboard(): void {
    this.clearRedirect();
    void this.router.navigateByUrl('/dashboard');
  }

  private clearRedirect(): void {
    if (this.redirectTimer !== null) {
      clearTimeout(this.redirectTimer);
      this.redirectTimer = null;
    }
  }

  /**
   * Route the rejection to whatever it is actually about: the current-password
   * field, one requirement chip, or — only as a fallback — the alert bar.
   */
  private applyFailure(err: unknown): void {
    const code = this.readCode(err);
    if (code === null) {
      this.errorMessage.set(this.errorCodes.toLocalizedMessage('INTERNAL_ERROR'));
      return;
    }

    const message = this.errorCodes.toLocalizedMessage(code.code, code.meta);

    if (code.code === 'INVALID_CURRENT_PASSWORD') {
      this.currentError.set(message);
      const input = this.currentInput()?.nativeElement;
      input?.focus();
      input?.select();
      return;
    }

    const rule = CODE_TO_RULE[code.code];
    if (rule) {
      this.ruleFailure.set({ key: rule, message });
      return;
    }

    this.errorMessage.set(message);
  }

  private readCode(err: unknown): { code: ErrorCode; meta?: Record<string, unknown> } | null {
    if (!(err instanceof HttpErrorResponse)) return null;
    const body = err.error as ErrorEnvelope | undefined;
    if (!body || body.success !== false || typeof body.code !== 'string') return null;
    return { code: body.code, meta: body.meta };
  }
}
