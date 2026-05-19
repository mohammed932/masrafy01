import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzModalService } from 'ng-zorro-antd/modal';
import {
  ArrowLeftOutline,
  PlusOutline,
  PaperClipOutline,
  UserSwitchOutline,
  CheckCircleOutline,
  EllipsisOutline,
  FileTextOutline,
  SnippetsOutline,
  SendOutline,
  InboxOutline,
  EditOutline,
} from '@ant-design/icons-angular/icons';
import { AuthService } from '@core/auth/auth.service';
import {
  ApplicationsApiService,
  type AdminApplicationDetail,
} from '../api/applications.api.service';
import { ApprovalPillComponent } from '../list/components/approval-pill.component';
import { WhyThisScorePanelComponent } from './components/why-this-score-panel.component';
import { ActivityTimelineComponent } from './components/activity-timeline.component';
import { AddActivityDialog, type AddActivityDialogData } from './components/add-activity.dialog';
import { LeadAssignDialog, type LeadAssignDialogData } from './components/lead-assign.dialog';
import { ACTIVITY_REASONS } from '../activity-reasons';

/**
 * Application detail page. Shows the masked applicant profile and every matched offer
 * with its full ApprovalProbability — including the expandable "Why this score?" panel.
 */
@Component({
  selector: 'app-application-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    NzSpinModule,
    NzIconModule,
    NzButtonModule,
    NzDropDownModule,
    ApprovalPillComponent,
    WhyThisScorePanelComponent,
    ActivityTimelineComponent,
  ],
  providers: [
    provideNzIconsPatch([
      ArrowLeftOutline,
      PlusOutline,
      PaperClipOutline,
      UserSwitchOutline,
      CheckCircleOutline,
      EllipsisOutline,
      FileTextOutline,
      SnippetsOutline,
      SendOutline,
      InboxOutline,
      EditOutline,
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <a routerLink="/applications" class="back-link">
        <span nz-icon nzType="arrow-left" nzTheme="outline" aria-hidden="true"></span>
        <span i18n="@@applications.detail.back">Back to applications</span>
      </a>

      @if (loading()) {
        <nz-spin nzSimple [nzSize]="'small'"></nz-spin>
      } @else if (detail()) {
        @let d = detail()!;
        <header class="hero-card">
          <span class="hero-stripe" aria-hidden="true"></span>

          <div class="hero-eyebrow">
            <span class="eyebrow-id">#{{ shortId(d.id) }}</span>
            <span class="eyebrow-sep" aria-hidden="true">·</span>
            <span class="eyebrow-purpose">{{ labelForPurpose(d.loanPurpose) }}</span>
          </div>

          <div class="hero-grid">
            <div class="hero-amount">
              <span class="amount-value">{{ formatAmount(d.requestedAmountEGP) }}</span>
              <span class="amount-currency">{{ d.requestedCurrency }}</span>
            </div>
            @if (d.leadStatus) {
              <span class="lead-status-pill" [attr.data-status]="d.leadStatus">
                <span class="dot" aria-hidden="true"></span>
                <span class="label">{{ labelForLeadStatus(d.leadStatus) }}</span>
              </span>
            }
          </div>

          <dl class="hero-meta">
            <div class="meta-item">
              <dt i18n="@@app.detail.meta.status">Status</dt>
              <dd>{{ labelForLeadStatus(d.status) }}</dd>
            </div>
            <div class="meta-item">
              <dt i18n="@@app.detail.meta.created">Created</dt>
              <dd>{{ d.createdAt | date: 'mediumDate' }}</dd>
            </div>
            <div class="meta-item">
              <dt i18n="@@app.detail.meta.time">Submitted at</dt>
              <dd>{{ d.createdAt | date: 'shortTime' }}</dd>
            </div>
          </dl>

          <div class="action-bar" role="toolbar" aria-label="Application actions">
            @if (canWrite()) {
              <button
                nz-button
                nzType="primary"
                class="action-primary"
                (click)="openAddActivity()"
                aria-label="Add Activity"
              >
                <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
                <span i18n="@@app.detail.addActivity">Add Activity</span>
              </button>
              <button
                type="button"
                class="action-tonal"
                (click)="openAttachDocuments()"
                aria-label="Attach Documents"
              >
                <span nz-icon nzType="paper-clip" nzTheme="outline" aria-hidden="true"></span>
                <span i18n="@@app.detail.attach">Attach Documents</span>
              </button>
            }
            @if (canAssign()) {
              <button
                type="button"
                class="action-tonal"
                (click)="openAssign()"
                aria-label="Assign or reassign"
              >
                <span nz-icon nzType="user-switch" nzTheme="outline" aria-hidden="true"></span>
                <span i18n="@@app.detail.assign">Assign / Reassign</span>
              </button>
            }
            @if (canMarkReady()) {
              <button
                type="button"
                class="action-tonal"
                (click)="markReady()"
                aria-label="Mark ready for bank"
              >
                <span nz-icon nzType="check-circle" nzTheme="outline" aria-hidden="true"></span>
                <span i18n="@@app.detail.markReady">Mark Ready</span>
              </button>
            }
            @if (canWrite()) {
              <button
                nz-button
                nzType="text"
                nzShape="circle"
                class="action-kebab"
                nz-dropdown
                [nzDropdownMenu]="moreMenu"
                nzTrigger="click"
                nzPlacement="bottomRight"
                aria-label="More actions"
              >
                <span nz-icon nzType="ellipsis" nzTheme="outline"></span>
              </button>
              <nz-dropdown-menu #moreMenu="nzDropdownMenu">
                <ul nz-menu>
                  <li nz-menu-item (click)="openTypedActivity('INTERNAL_NOTE')">
                    <span nz-icon nzType="file-text" nzTheme="outline"></span>
                    <span i18n="@@app.detail.menu.internalNote">Add Internal Note</span>
                  </li>
                  <li nz-menu-item (click)="openTypedActivity('REQUESTED_MORE_DOCS')">
                    <span nz-icon nzType="snippets" nzTheme="outline"></span>
                    <span i18n="@@app.detail.menu.requestMore">Request More Documents</span>
                  </li>
                  <li nz-menu-item (click)="openTypedActivity('MARKED_AS_REVIEWED')">
                    <span nz-icon nzType="check-circle" nzTheme="outline"></span>
                    <span i18n="@@app.detail.menu.markReviewed">Mark as Reviewed</span>
                  </li>
                  <li nz-menu-item (click)="openTypedActivity('SUBMITTED_TO_BANK')">
                    <span nz-icon nzType="send" nzTheme="outline"></span>
                    <span i18n="@@app.detail.menu.submitBank">Submitted to Bank</span>
                  </li>
                  <li nz-menu-item (click)="openTypedActivity('BANK_RESPONDED')">
                    <span nz-icon nzType="inbox" nzTheme="outline"></span>
                    <span i18n="@@app.detail.menu.bankResponded">Bank Responded</span>
                  </li>
                  <li nz-menu-item (click)="openTypedActivity('UPDATED_APPLICANT_INFO')">
                    <span nz-icon nzType="edit" nzTheme="outline"></span>
                    <span i18n="@@app.detail.menu.updateInfo">Update Applicant Info</span>
                  </li>
                </ul>
              </nz-dropdown-menu>
            }
          </div>
        </header>

        <section class="timeline-section">
          <h2 i18n="@@app.detail.timeline.heading">Activity timeline</h2>
          <app-activity-timeline #timeline [applicationId]="d.id" />
        </section>

        <section class="offers">
          <h2 i18n="@@applications.detail.offers">Matched offers</h2>

          @if (submittedProgramCode()) {
            <div class="submission-banner" [attr.data-tone]="decisionTone()">
              <span class="banner-label" i18n="@@applications.detail.submitted">SUBMITTED TO BANK</span>
              <span class="banner-program">{{ submittedProgramCode() }}</span>
              @if (submittedAt()) {
                <span class="banner-time">· {{ submittedAt() | date: 'short' }}</span>
              }
              @if (bankDecisionReason()) {
                <span class="banner-sep" aria-hidden="true">·</span>
                <span class="banner-decision">{{ decisionLabel() }}</span>
                @if (bankDecisionAt()) {
                  <span class="banner-time">{{ bankDecisionAt() | date: 'short' }}</span>
                }
              } @else {
                <span class="banner-sep" aria-hidden="true">·</span>
                <span class="banner-pending" i18n="@@applications.detail.awaitingDecision">awaiting decision</span>
              }
            </div>
          }

          @if (d.offers.length === 0) {
            <p class="muted" i18n="@@applications.detail.noOffers">No matched offers.</p>
          }
          @for (offer of sortedOffers(d); track offer.programCode) {
            <article class="offer-card" [class.selected]="isSubmittedOffer(offer.programCode)">
              @if (isSubmittedOffer(offer.programCode)) {
                <span class="selected-ribbon" [attr.data-tone]="decisionTone()">
                  @if (bankDecisionReason()) {
                    {{ decisionLabel() }}
                  } @else {
                    <span i18n="@@applications.detail.submittedShort">Submitted</span>
                  }
                </span>
              }
              <header class="offer-head">
                <div class="offer-title">
                  <span class="program-code">{{ offer.programCode }}</span>
                  <span class="bank">{{ offer.bankName }} · {{ offer.programFriendlyName }}</span>
                </div>
                <app-approval-pill
                  [bestOffer]="{
                    score: offer.approvalProbability.score,
                    tier: offer.approvalProbability.tier,
                    tierLabelCode: offer.approvalProbability.tierLabelCode,
                  }"
                />
              </header>

              <dl class="offer-stats">
                <div>
                  <dt i18n="@@applications.detail.rate">Effective rate</dt>
                  <dd>{{ offer.effectiveRatePercent }}%</dd>
                </div>
                <div>
                  <dt i18n="@@applications.detail.installment">Monthly installment</dt>
                  <dd>{{ offer.monthlyInstallmentEGP }} EGP</dd>
                </div>
                <div>
                  <dt i18n="@@applications.detail.tenor">Effective tenor</dt>
                  <dd>{{ offer.effectiveTenorMonths }} mo</dd>
                </div>
              </dl>

              <app-why-this-score-panel
                [probability]="offer.approvalProbability"
                [activeEngineVersion]="activeEngineVersion()"
              />
            </article>
          }
        </section>
      }
    </section>
  `,
  styles: [
    `
      .page {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
        max-width: var(--content-max-width);
        margin-inline: auto;
        padding: var(--space-5) var(--space-6);
      }
      .back-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: var(--color-text-secondary);
        text-decoration: none;
        font-size: var(--text-xs);
        font-weight: var(--font-weight-medium);
        letter-spacing: 0.02em;
        align-self: flex-start;
        padding-block: var(--space-1);
        transition: color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .back-link:hover {
        color: var(--color-text-primary);
      }
      .back-link [nz-icon] {
        font-size: 16px;
      }

      /* Hero card */
      .hero-card {
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
      .hero-stripe {
        position: absolute;
        inset-block-start: 0;
        inset-inline-start: 0;
        inline-size: 4px;
        block-size: 100%;
        background: linear-gradient(
          180deg,
          var(--color-brand-primary) 0%,
          var(--color-tonal-accent) 100%
        );
      }
      .hero-eyebrow {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-text-tertiary);
      }
      .eyebrow-id {
        font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
        background: var(--color-surface-muted);
        color: var(--color-text-secondary);
        padding-inline: var(--space-2);
        padding-block: 2px;
        border-radius: var(--radius-sm);
        letter-spacing: 0.02em;
      }
      .eyebrow-sep {
        opacity: 0.5;
      }
      .hero-grid {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: var(--space-4);
        flex-wrap: wrap;
      }
      .hero-amount {
        display: inline-flex;
        align-items: baseline;
        gap: var(--space-2);
      }
      .amount-value {
        font-size: var(--text-3xl);
        font-weight: var(--font-weight-bold);
        font-variant-numeric: tabular-nums lining-nums;
        color: var(--color-text-primary);
        letter-spacing: -0.025em;
        line-height: 1;
      }
      .amount-currency {
        font-size: var(--text-md);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-tertiary);
        letter-spacing: 0.04em;
      }
      .lead-status-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 28px;
        padding-inline: var(--space-3);
        border-radius: var(--radius-pill);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.04em;
        background: var(--color-surface-muted);
        color: var(--color-text-secondary);
        white-space: nowrap;
      }
      .lead-status-pill .dot {
        inline-size: 6px;
        block-size: 6px;
        border-radius: var(--radius-pill);
        background: currentColor;
      }
      .lead-status-pill[data-status='needs_first_contact'] {
        background: var(--color-warning-bg);
        color: var(--color-warning);
      }
      .lead-status-pill[data-status='document_collection'] {
        background: var(--color-info-bg);
        color: var(--color-info);
      }
      .lead-status-pill[data-status='ready_for_submission'] {
        background: var(--color-tonal-accent-bg);
        color: var(--color-tonal-accent);
      }
      .lead-status-pill[data-status='submitted_to_bank'] {
        background: var(--color-tonal-accent-bg);
        color: var(--color-brand-primary);
      }
      .lead-status-pill[data-status='bank_decided'],
      .lead-status-pill[data-status='matched'] {
        background: var(--color-success-bg);
        color: var(--color-success);
      }

      .hero-meta {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-5);
        margin: 0;
        padding-block-start: var(--space-3);
        border-block-start: 1px dashed var(--color-border-default);
      }
      .meta-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .meta-item dt {
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-text-tertiary);
        margin: 0;
      }
      .meta-item dd {
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
        margin: 0;
        font-variant-numeric: tabular-nums;
      }

      /* Buttons */
      .action-primary {
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.01em;
      }
      .action-tonal {
        appearance: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 36px;
        padding-inline: var(--space-3);
        border-radius: var(--radius-md);
        border: 1px solid var(--color-border-default);
        background: var(--color-surface-elevated);
        color: var(--color-text-primary);
        font-family: inherit;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        cursor: pointer;
        transition:
          background var(--motion-duration-fast) var(--motion-easing-standard),
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .action-tonal [nz-icon] {
        font-size: 18px;
        color: var(--color-text-secondary);
      }
      .action-tonal:hover {
        background: var(--color-surface-row-hover);
        border-color: var(--color-border-strong);
      }
      .action-tonal:hover [nz-icon] {
        color: var(--color-text-primary);
      }
      .action-tonal:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .action-kebab {
        margin-inline-start: auto;
      }
      .offers h2 {
        margin: 0 0 var(--space-3);
        font-size: 15px;
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-text-secondary);
      }
      .submission-banner {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        padding: 8px 14px;
        margin-block-end: var(--space-3);
        background: var(--bg-subtle, var(--color-surface-row-hover));
        border: 1px solid var(--border-default, var(--color-border-default));
        border-radius: var(--radius-md);
        font-size: 13px;
        color: var(--text-secondary, var(--color-text-secondary));
      }
      .submission-banner[data-tone='success'] {
        background: color-mix(in oklab, var(--success) 6%, var(--bg-subtle));
        border-color: color-mix(in oklab, var(--success) 30%, var(--border-default));
      }
      .submission-banner[data-tone='error'] {
        background: color-mix(in oklab, var(--error) 6%, var(--bg-subtle));
        border-color: color-mix(in oklab, var(--error) 30%, var(--border-default));
      }
      .submission-banner[data-tone='warning'] {
        background: color-mix(in oklab, var(--warning) 6%, var(--bg-subtle));
        border-color: color-mix(in oklab, var(--warning) 30%, var(--border-default));
      }
      .banner-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.1em;
        color: var(--primary, var(--color-brand-primary));
      }
      .banner-program {
        font-weight: 700;
        font-family: var(--font-mono);
        font-size: 12px;
        padding: 2px 6px;
        border-radius: var(--radius-sm);
        background: var(--bg-surface, var(--color-surface-default));
        border: 1px solid var(--border-default);
      }
      .banner-decision { font-weight: 700; }
      .submission-banner[data-tone='success'] .banner-decision { color: var(--success); }
      .submission-banner[data-tone='error'] .banner-decision { color: var(--error); }
      .submission-banner[data-tone='warning'] .banner-decision { color: var(--warning); }
      .banner-pending { font-weight: 600; color: var(--warning); }
      .banner-time { color: var(--text-tertiary, var(--color-text-tertiary)); font-variant-numeric: tabular-nums; }
      .banner-sep { opacity: 0.5; }

      .offer-card {
        position: relative;
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg, 12px);
        padding: var(--space-4) var(--space-5);
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        margin-block-end: var(--space-3);
      }
      .offer-card.selected {
        border-color: var(--primary, var(--color-brand-primary));
        box-shadow: 0 0 0 1px var(--primary, var(--color-brand-primary)) inset,
          0 4px 16px color-mix(in oklab, var(--primary) 14%, transparent);
      }
      .selected-ribbon {
        position: absolute;
        inset-block-start: -10px;
        inset-inline-start: var(--space-4);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        padding: 3px 10px;
        border-radius: var(--radius-pill);
        background: var(--primary);
        color: var(--text-on-primary);
      }
      .selected-ribbon[data-tone='success'] { background: var(--success); }
      .selected-ribbon[data-tone='error'] { background: var(--error); }
      .selected-ribbon[data-tone='warning'] { background: var(--warning); }
      .offer-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: var(--space-3);
      }
      .offer-title {
        display: flex;
        flex-direction: column;
      }
      .program-code {
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .bank {
        font-size: 12px;
        color: var(--color-text-tertiary);
      }
      .offer-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: var(--space-3);
        margin: 0;
      }
      .offer-stats > div {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .offer-stats dt {
        font-size: 11px;
        color: var(--color-text-tertiary);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .offer-stats dd {
        margin: 0;
        font-size: 14px;
        font-weight: var(--font-weight-semibold);
        font-variant-numeric: tabular-nums lining-nums;
        color: var(--color-text-primary);
      }
      .muted {
        color: var(--color-text-tertiary);
      }
      .header-row {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        flex-wrap: wrap;
      }
      .lead-status-chip {
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.04em;
      }
      .lead-status-chip[data-status='needs_first_contact'] {
        background: var(--color-warning-bg);
        color: var(--color-warning);
      }
      .lead-status-chip[data-status='document_collection'] {
        background: var(--color-info-bg);
        color: var(--color-info);
      }
      .lead-status-chip[data-status='ready_for_submission'] {
        background: var(--color-tonal-accent-bg);
        color: var(--color-tonal-accent);
      }
      .lead-status-chip[data-status='submitted_to_bank'] {
        background: var(--color-tonal-accent-bg);
        color: var(--color-brand-primary);
      }
      .lead-status-chip[data-status='bank_decided'] {
        background: var(--color-success-bg);
        color: var(--color-success);
      }
      .action-bar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        padding-block-start: var(--space-3);
        border-block-start: 1px solid var(--color-border-default);
      }
      .timeline-section h2 {
        margin: 0 0 var(--space-3);
        font-size: 15px;
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-text-secondary);
      }
    `,
  ],
})
export class ApplicationDetailPage implements OnInit {
  private readonly api = inject(ApplicationsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly modal = inject(NzModalService);
  private readonly auth = inject(AuthService);

  protected readonly detail = signal<AdminApplicationDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly activeEngineVersion = signal<string | null>(null);
  protected readonly submittedProgramCode = signal<string | null>(null);
  protected readonly submittedAt = signal<string | null>(null);
  protected readonly bankDecisionReason = signal<string | null>(null);
  protected readonly bankDecisionAt = signal<string | null>(null);

  protected isSubmittedOffer(programCode: string): boolean {
    return this.submittedProgramCode() === programCode;
  }

  protected sortedOffers(d: AdminApplicationDetail): AdminApplicationDetail['offers'] {
    const submitted = this.submittedProgramCode();
    return [...d.offers].sort((a, b) => {
      if (submitted) {
        if (a.programCode === submitted && b.programCode !== submitted) return -1;
        if (b.programCode === submitted && a.programCode !== submitted) return 1;
      }
      return b.approvalProbability.score - a.approvalProbability.score;
    });
  }
  protected decisionLabel(): string {
    const r = this.bankDecisionReason();
    if (!r) return '';
    return r
      .toLowerCase()
      .split('_')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');
  }
  protected decisionTone(): 'success' | 'error' | 'warning' | 'muted' {
    const r = this.bankDecisionReason();
    if (!r) return 'muted';
    if (r === 'APPROVED' || r === 'CONDITIONAL_APPROVAL') return 'success';
    if (r === 'REJECTED') return 'error';
    return 'warning';
  }

  @ViewChild('timeline')
  private timeline?: ActivityTimelineComponent;

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      return;
    }
    try {
      const d = await this.api.getById(id);
      this.detail.set(d);
      this.activeEngineVersion.set(d.offers[0]?.approvalProbability.engineVersion ?? null);
      await this.loadSubmissionState(id);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadSubmissionState(applicationId: string): Promise<void> {
    try {
      const res = await this.api.listActivities(applicationId, { limit: 100 });
      const sorted = [...res.rows].sort(
        (a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt),
      );
      const submission = sorted.find((r) => r.activityType === 'SUBMITTED_TO_BANK');
      const decision = sorted.find((r) => r.activityType === 'BANK_RESPONDED');
      this.submittedProgramCode.set(submission?.reason ?? null);
      this.submittedAt.set(submission?.occurredAt ?? null);
      this.bankDecisionReason.set(decision?.reason ?? null);
      this.bankDecisionAt.set(decision?.occurredAt ?? null);
    } catch {
      // silent — submission state is optional render
    }
  }

  labelForLeadStatus(s: string): string {
    return s
      .split('_')
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ');
  }

  labelForPurpose(p: string): string {
    const normalized = p.replace(/_/g, ' ');
    return normalized.charAt(0).toUpperCase() + normalized.slice(1) + ' loan';
  }

  shortId(id: string): string {
    return id.length > 8 ? id.slice(0, 8) : id;
  }

  formatAmount(raw: string | number): string {
    const value = typeof raw === 'string' ? Number(raw) : raw;
    if (!Number.isFinite(value)) return String(raw);
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(value);
  }

  canWrite(): boolean {
    const role = this.auth.currentUser()?.role;
    return role === 'super_admin' || role === 'sales_manager' || role === 'sales_agent';
  }

  canAssign(): boolean {
    const role = this.auth.currentUser()?.role;
    return role === 'super_admin' || role === 'sales_manager';
  }

  canMarkReady(): boolean {
    const d = this.detail();
    if (!d) return false;
    if (!this.canWrite()) return false;
    return d.leadStatus === 'document_collection' || d.leadStatus === 'needs_first_contact';
  }

  openAddActivity(): void {
    this.openDialog();
  }

  openAttachDocuments(): void {
    this.openDialog('RECEIVED_DOCUMENTS');
  }

  openTypedActivity(activityType: string): void {
    this.openDialog(activityType);
  }

  async markReady(): Promise<void> {
    const d = this.detail();
    if (!d) return;
    try {
      await this.api.createActivity(d.id, {
        activityType: 'MARKED_AS_REVIEWED',
        reason: 'READY_FOR_SUBMISSION',
      });
      await this.refreshDetail();
    } catch {
      // surfaced via global error interceptor toast
    }
  }

  openAssign(): void {
    const d = this.detail();
    if (!d) return;
    const ref = this.modal.create<LeadAssignDialog, LeadAssignDialogData, boolean>({
      nzContent: LeadAssignDialog,
      nzData: { applicationId: d.id, currentAgentId: d.assignedAgentStaffId ?? null },
      nzFooter: null,
      nzWidth: 480,
      nzAutofocus: null,
    });
    ref.afterClose.subscribe((saved) => {
      if (saved) void this.refreshDetail();
    });
  }

  private openDialog(defaultActivityType?: string): void {
    const d = this.detail();
    if (!d) return;
    const ref = this.modal.create<AddActivityDialog, AddActivityDialogData, boolean>({
      nzContent: AddActivityDialog,
      nzData: {
        applicationId: d.id,
        defaultActivityType,
        reasonsByType: ACTIVITY_REASONS,
      },
      nzFooter: null,
      nzWidth: 720,
      nzAutofocus: null,
    });
    ref.afterClose.subscribe((saved) => {
      if (saved) void this.refreshDetail();
    });
  }

  private async refreshDetail(): Promise<void> {
    const id = this.detail()?.id;
    if (!id) return;
    const d = await this.api.getById(id);
    this.detail.set(d);
    await this.loadSubmissionState(id);
    await this.timeline?.refresh();
  }
}
