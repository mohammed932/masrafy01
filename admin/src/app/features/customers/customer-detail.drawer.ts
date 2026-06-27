import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { NZ_DRAWER_DATA } from 'ng-zorro-antd/drawer';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzMessageService } from 'ng-zorro-antd/message';
import { StopOutline, CheckCircleOutline } from '@ant-design/icons-angular/icons';
import { StatusPillComponent, SkeletonRowsComponent, type StatusTone } from '@shared/ui';
import { CanDirective } from '@shared/can.directive';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode, ErrorEnvelope } from '@core/auth/auth.types';
import { CustomersApiService, type CustomerDetail } from './customers.api.service';

/** Data handed to the drawer when the list page opens it. */
export interface CustomerDetailDrawerData {
  customerId: string;
  /** Called after a successful status toggle so the list can reload. */
  onChanged?: () => void;
}

/**
 * Read-only customer detail, rendered inside an NzDrawer (portaled to body —
 * full-viewport backdrop, satisfies A34). Identity meta + the customer's
 * applications and support history. Opened from CustomersListPage.
 */
@Component({
  selector: 'app-customer-detail-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    NzButtonModule,
    NzIconModule,
    StatusPillComponent,
    SkeletonRowsComponent,
    CanDirective,
  ],
  providers: [provideNzIconsPatch([StopOutline, CheckCircleOutline])],
  template: `
    @if (loading()) {
      <app-skeleton-rows
        [rows]="6"
        [cols]="[2, 3]"
        ariaLabel="Loading customer"
        i18n-ariaLabel="@@customers.detail.loading"
      />
    } @else {
      @if (detail(); as d) {
        <div class="wrap">
          <header class="hero">
            <span
              class="avatar"
              [attr.data-status]="d.isVerified ? 'verified' : 'pending'"
              aria-hidden="true"
              >{{ initials(d.firstName, d.lastName) }}</span
            >
            <div class="hero-text">
              <span class="hero-contact">{{ d.phone || d.email || d.locale }}</span>
              <div class="status-row">
                @if (d.isVerified) {
                  <app-status-pill
                    tone="success"
                    label="Verified"
                    i18n-label="@@customers.status.verified"
                  />
                } @else {
                  <app-status-pill
                    tone="neutral"
                    label="Unverified"
                    i18n-label="@@customers.status.unverified"
                  />
                }
                @if (d.isActive) {
                  <app-status-pill
                    tone="info"
                    label="Active"
                    i18n-label="@@customers.status.active"
                  />
                } @else {
                  <app-status-pill
                    tone="error"
                    label="Inactive"
                    i18n-label="@@customers.status.inactive"
                  />
                }
              </div>
            </div>
          </header>

          <dl class="meta">
            <div class="meta-item">
              <dt i18n="@@customers.detail.meta.phone">Phone</dt>
              <dd>
                <code>{{ d.phone || '—' }}</code>
              </dd>
            </div>
            <div class="meta-item">
              <dt i18n="@@customers.detail.meta.email">Email</dt>
              <dd>{{ d.email || '—' }}</dd>
            </div>
            <div class="meta-item">
              <dt i18n="@@customers.detail.meta.age">Age</dt>
              <dd>{{ d.age ?? '—' }}</dd>
            </div>
            <div class="meta-item">
              <dt i18n="@@customers.detail.meta.locale">Locale</dt>
              <dd>{{ d.locale }}</dd>
            </div>
            <div class="meta-item">
              <dt i18n="@@customers.detail.meta.joined">Joined</dt>
              <dd>{{ d.createdAt | date: 'mediumDate' }}</dd>
            </div>
            <div class="meta-item">
              <dt i18n="@@customers.detail.meta.lastLogin">Last login</dt>
              <dd>{{ d.lastLoginAt ? (d.lastLoginAt | date: 'short') : '—' }}</dd>
            </div>
          </dl>

          <section class="block">
            <h2 i18n="@@customers.detail.applications">Applications</h2>
            @if (d.applications.length === 0) {
              <p class="empty" i18n="@@customers.detail.applications.empty">No applications yet.</p>
            } @else {
              @for (a of d.applications; track a.id) {
                <article class="row-card">
                  <div class="row-head">
                    <span class="row-title">{{ humanize(a.loanPurpose) }}</span>
                    <app-status-pill [tone]="appTone(a.status)" [label]="humanize(a.status)" />
                  </div>
                  <dl class="row-stats">
                    <div>
                      <dt i18n="@@customers.detail.app.amount">Requested</dt>
                      <dd>{{ formatAmount(a.requestedAmountEGP) }} EGP</dd>
                    </div>
                    <div>
                      <dt i18n="@@customers.detail.app.created">Created</dt>
                      <dd>{{ a.createdAt | date: 'mediumDate' }}</dd>
                    </div>
                    <div>
                      <dt i18n="@@customers.detail.app.proceeded">Proceeded</dt>
                      <dd>
                        {{ a.userProceededAt ? (a.userProceededAt | date: 'mediumDate') : '—' }}
                      </dd>
                    </div>
                  </dl>
                </article>
              }
            }
          </section>

          <section class="block">
            <h2 i18n="@@customers.detail.support">Support requests</h2>
            @if (d.supportRequests.length === 0) {
              <p class="empty" i18n="@@customers.detail.support.empty">No support requests.</p>
            } @else {
              @for (s of d.supportRequests; track s.id) {
                <article class="row-card">
                  <div class="row-head">
                    <span class="row-title">{{ humanize(s.channel) }}</span>
                    <app-status-pill [tone]="supportTone(s.status)" [label]="humanize(s.status)" />
                  </div>
                  <dl class="row-stats">
                    <div>
                      <dt i18n="@@customers.detail.support.created">Opened</dt>
                      <dd>{{ s.createdAt | date: 'mediumDate' }}</dd>
                    </div>
                    <div>
                      <dt i18n="@@customers.detail.support.resolved">Resolved</dt>
                      <dd>{{ s.resolvedAt ? (s.resolvedAt | date: 'mediumDate') : '—' }}</dd>
                    </div>
                  </dl>
                </article>
              }
            }
          </section>

          <div class="actions" *can="['super_admin']">
            @if (d.isActive) {
              <button
                nz-button
                nzDanger
                nzType="default"
                [nzLoading]="busy()"
                (click)="deactivate(d)"
              >
                <span nz-icon nzType="stop" nzTheme="outline"></span>
                <span i18n="@@customers.action.deactivate">Deactivate account</span>
              </button>
            } @else {
              <button nz-button nzType="primary" [nzLoading]="busy()" (click)="reactivate()">
                <span nz-icon nzType="check-circle" nzTheme="outline"></span>
                <span i18n="@@customers.action.activate">Reactivate account</span>
              </button>
            }
          </div>
        </div>
      } @else {
        <p class="empty" i18n="@@customers.detail.notFound">Customer not found.</p>
      }
    }
  `,
  styles: [
    `
      .wrap {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
        animation: fade var(--motion-duration-base) var(--motion-easing-standard) both;
      }
      @keyframes fade {
        from {
          opacity: 0;
          transform: translateY(6px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .wrap {
          animation: none;
        }
      }
      /* Identity hero — mirrors the list avatar for continuity */
      .hero {
        display: flex;
        align-items: center;
        gap: var(--space-3);
      }
      .avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 48px;
        block-size: 48px;
        border-radius: var(--radius-pill);
        background: var(--color-tonal-accent-bg);
        color: var(--color-brand-primary);
        font-size: var(--text-md);
        font-weight: var(--font-weight-bold);
        letter-spacing: 0.04em;
        flex-shrink: 0;
        box-shadow: inset 0 0 0 1px var(--color-border-default);
      }
      .avatar[data-status='verified'] {
        background: var(--color-brand-primary);
        color: var(--color-text-on-brand);
        box-shadow: inset 0 0 0 1px var(--color-brand-primary-hover);
      }
      .avatar[data-status='pending'] {
        background: var(--color-surface-muted);
        color: var(--color-text-secondary);
      }
      .hero-text {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        min-inline-size: 0;
      }
      .hero-contact {
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-secondary);
        overflow-wrap: anywhere;
      }
      .status-row {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }
      code {
        font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
        font-variant-numeric: tabular-nums;
      }
      /* Identity meta grid */
      .meta {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-4) var(--space-5);
        margin: 0;
        padding-block: var(--space-4);
        border-block: 1px dashed var(--color-border-default);
      }
      .meta-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-inline-size: 0;
      }
      .meta-item dt {
        margin: 0;
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-text-tertiary);
      }
      .meta-item dd {
        margin: 0;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
        overflow-wrap: anywhere;
      }
      /* Sections */
      .block h2 {
        margin: 0 0 var(--space-3);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-text-secondary);
      }
      .row-card {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        padding: var(--space-4);
        margin-block-end: var(--space-3);
      }
      .row-card:last-child {
        margin-block-end: 0;
      }
      .row-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-3);
      }
      .row-title {
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .row-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
        gap: var(--space-3);
        margin: 0;
      }
      .row-stats > div {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .row-stats dt {
        margin: 0;
        font-size: var(--text-xxs);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-text-tertiary);
      }
      .row-stats dd {
        margin: 0;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        font-variant-numeric: tabular-nums lining-nums;
        color: var(--color-text-primary);
      }
      .empty {
        margin: 0;
        color: var(--color-text-tertiary);
        font-size: var(--text-sm);
      }
      .actions {
        display: flex;
        padding-block-start: var(--space-4);
        border-block-start: 1px solid var(--color-border-default);
      }
      .actions button {
        inline-size: 100%;
        justify-content: center;
      }
    `,
  ],
})
export class CustomerDetailDrawerComponent implements OnInit {
  private readonly api = inject(CustomersApiService);
  private readonly data = inject<CustomerDetailDrawerData>(NZ_DRAWER_DATA);
  private readonly modal = inject(NzModalService);
  private readonly message = inject(NzMessageService);
  private readonly errorCodes = inject(ErrorCodeService);

  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly detail = signal<CustomerDetail | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      this.detail.set(await this.api.detail(this.data.customerId));
    } finally {
      this.loading.set(false);
    }
  }

  /** Deactivate — destructive, so confirm first. Locks the customer out + revokes sessions. */
  deactivate(d: CustomerDetail): void {
    this.modal.confirm({
      nzTitle: $localize`:@@customers.action.deactivate.title:Deactivate this customer?`,
      nzContent: $localize`:@@customers.action.deactivate.body:${d.firstName} ${d.lastName} will be signed out of every device and blocked from logging in until reactivated.`,
      nzOkText: $localize`:@@customers.action.deactivate:Deactivate account`,
      nzOkDanger: true,
      nzOnOk: () => this.apply(false),
    });
  }

  /** Reactivate — non-destructive, applied immediately. */
  reactivate(): void {
    void this.apply(true);
  }

  private async apply(isActive: boolean): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.api.setActive(this.data.customerId, isActive);
      const current = this.detail();
      if (current) this.detail.set({ ...current, isActive });
      this.message.success(
        isActive
          ? $localize`:@@customers.action.activated:Customer reactivated.`
          : $localize`:@@customers.action.deactivated:Customer deactivated.`,
        { nzDuration: 4000 },
      );
      this.data.onChanged?.();
    } catch (err) {
      this.message.error(this.toMessage(err), { nzDuration: 6000 });
    } finally {
      this.busy.set(false);
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

  /** Initials from first + last name; skips non-letter last names (e.g. SOCIAL "—"). */
  protected initials(firstName: string, lastName: string): string {
    const first = firstName.trim()[0] ?? '';
    const last = lastName.trim().match(/[\p{L}]/u)?.[0] ?? '';
    return (first + last).toUpperCase() || '?';
  }

  /** Humanize an enum code (e.g. "personal_loan" → "Personal loan"). Codes are data, not translated. */
  protected humanize(code: string): string {
    const s = code.replace(/_/g, ' ').trim();
    return s.length === 0 ? '—' : s.charAt(0).toUpperCase() + s.slice(1);
  }

  protected appTone(status: string): StatusTone {
    const s = status.toLowerCase();
    if (s.includes('approv') || s.includes('qualif') || s.includes('won')) return 'success';
    if (s.includes('reject') || s.includes('declin') || s.includes('lost')) return 'error';
    if (s.includes('pending') || s.includes('contact') || s.includes('progress')) return 'warning';
    return 'neutral';
  }

  protected supportTone(status: string): StatusTone {
    const s = status.toLowerCase();
    if (s.includes('resolv') || s.includes('closed') || s.includes('done')) return 'success';
    if (s.includes('open') || s.includes('pending') || s.includes('progress')) return 'warning';
    return 'neutral';
  }

  protected formatAmount(raw: string | number): string {
    const value = typeof raw === 'string' ? Number(raw) : raw;
    if (!Number.isFinite(value)) return String(raw);
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
  }
}
