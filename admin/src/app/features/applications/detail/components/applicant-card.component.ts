import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatusPillComponent } from '@shared/ui';
import type { ApplicantIdentity } from '../../api/applications.api.service';

/**
 * Applicant identity + contact card for the application detail page. Puts a
 * real person (name, avatar, contact, location, account standing) behind the
 * otherwise anonymous "#XXXX" application. Presentational only — the photo URL
 * (when present) is fetched by the parent from the presigned documents route.
 *
 * Mirrors the customer-detail drawer's identity hero + meta grid so the two
 * surfaces read as one system (same tokens, avatar, and dl.meta pattern).
 */
@Component({
  selector: 'app-applicant-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, StatusPillComponent],
  template: `
    @let a = applicant();
    <section class="applicant-card">
      <span class="stripe" aria-hidden="true"></span>

      <header class="hero">
        @if (photoUrl(); as url) {
          <img class="avatar" [src]="url" alt="" />
        } @else {
          <span
            class="avatar avatar--initials"
            [attr.data-status]="a.isVerified ? 'verified' : 'pending'"
            aria-hidden="true"
            >{{ initials() }}</span
          >
        }
        <div class="hero-text">
          <span class="eyebrow" i18n="@@applications.applicant.title">Applicant</span>
          <h2 class="name">{{ fullName() }}</h2>
          <div class="status-row">
            @if (a.isVerified) {
              <app-status-pill
                tone="success"
                label="Verified"
                i18n-label="@@applications.applicant.verified"
              />
            } @else {
              <app-status-pill
                tone="neutral"
                label="Unverified"
                i18n-label="@@applications.applicant.unverified"
              />
            }
            @if (!a.isActive) {
              <app-status-pill
                tone="error"
                label="Inactive"
                i18n-label="@@applications.applicant.inactive"
              />
            }
            @if (a.registrationPath === 'SOCIAL') {
              <app-status-pill
                tone="info"
                label="Social sign-in"
                i18n-label="@@applications.applicant.regSocial"
              />
            } @else {
              <app-status-pill
                tone="info"
                label="Phone sign-up"
                i18n-label="@@applications.applicant.regPhone"
              />
            }
          </div>
        </div>
      </header>

      <dl class="meta">
        <div class="meta-item">
          <dt i18n="@@applications.applicant.meta.phone">Phone</dt>
          <dd>
            <code>{{ a.phone || '—' }}</code>
          </dd>
        </div>
        <div class="meta-item">
          <dt i18n="@@applications.applicant.meta.email">Email</dt>
          <dd>{{ a.email || '—' }}</dd>
        </div>
        <div class="meta-item">
          <dt i18n="@@applications.applicant.meta.age">Age</dt>
          <dd>{{ a.age ?? '—' }}</dd>
        </div>
        <div class="meta-item">
          <dt i18n="@@applications.applicant.meta.location">Location</dt>
          <dd>{{ location() }}</dd>
        </div>
        @if (a.address) {
          <div class="meta-item meta-item--wide">
            <dt i18n="@@applications.applicant.meta.address">Address</dt>
            <dd>{{ a.address }}</dd>
          </div>
        }
        <div class="meta-item">
          <dt i18n="@@applications.applicant.meta.memberSince">Member since</dt>
          <dd>{{ a.memberSince | date: 'mediumDate' }}</dd>
        </div>
        <div class="meta-item">
          <dt i18n="@@applications.applicant.meta.lastLogin">Last login</dt>
          <dd>{{ a.lastLoginAt ? (a.lastLoginAt | date: 'short') : '—' }}</dd>
        </div>
      </dl>
    </section>
  `,
  styles: [
    `
      .applicant-card {
        position: relative;
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        padding: var(--space-5) var(--space-5) var(--space-4);
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        overflow: hidden;
      }
      .stripe {
        position: absolute;
        inset-block-start: 0;
        inset-inline-start: 0;
        inline-size: 4px;
        block-size: 100%;
        background: linear-gradient(
          180deg,
          var(--color-tonal-accent) 0%,
          var(--color-brand-primary) 100%
        );
      }
      .hero {
        display: flex;
        align-items: center;
        gap: var(--space-4);
      }
      .avatar {
        inline-size: 52px;
        block-size: 52px;
        border-radius: var(--radius-pill);
        flex-shrink: 0;
        object-fit: cover;
        box-shadow: inset 0 0 0 1px var(--color-border-default);
      }
      .avatar--initials {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--color-tonal-accent-bg);
        color: var(--color-brand-primary);
        font-size: var(--text-md);
        font-weight: var(--font-weight-bold);
        letter-spacing: 0.04em;
      }
      .avatar--initials[data-status='verified'] {
        background: var(--color-brand-primary);
        color: var(--color-text-on-brand);
        box-shadow: inset 0 0 0 1px var(--color-brand-primary-hover);
      }
      .hero-text {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-inline-size: 0;
      }
      .eyebrow {
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-text-tertiary);
      }
      .name {
        margin: 0;
        font-size: var(--text-xl);
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
        letter-spacing: -0.01em;
        overflow-wrap: anywhere;
      }
      .status-row {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
        margin-block-start: var(--space-2);
      }
      code {
        font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
        font-variant-numeric: tabular-nums;
      }
      .meta {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: var(--space-4) var(--space-5);
        margin: 0;
        padding-block-start: var(--space-4);
        border-block-start: 1px dashed var(--color-border-default);
      }
      .meta-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-inline-size: 0;
      }
      .meta-item--wide {
        grid-column: 1 / -1;
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
    `,
  ],
})
export class ApplicantCardComponent {
  readonly applicant = input.required<ApplicantIdentity>();
  readonly photoUrl = input<string | null>(null);

  protected readonly fullName = computed(() => {
    const a = this.applicant();
    const name = `${a.firstName ?? ''} ${a.lastName ?? ''}`.replace(/\s+/g, ' ').trim();
    return name.length > 0 ? name : $localize`:@@applications.applicant.unnamed:Unnamed applicant`;
  });

  protected readonly initials = computed(() => {
    const a = this.applicant();
    const first = a.firstName?.trim()[0] ?? '';
    const last = a.lastName?.trim().match(/[\p{L}]/u)?.[0] ?? '';
    return (first + last).toUpperCase() || '?';
  });

  protected readonly location = computed(() => {
    const a = this.applicant();
    const parts = [a.governorate, a.city].filter((p): p is string => !!p && p.trim().length > 0);
    return parts.length > 0 ? parts.join(' · ') : '—';
  });
}
