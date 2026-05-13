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
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '@core/auth/auth.service';
import {
  ApplicationsApiService,
  type AdminApplicationDetail,
} from '../api/applications.api.service';
import { ApprovalPillComponent } from '../list/components/approval-pill.component';
import { WhyThisScorePanelComponent } from './components/why-this-score-panel.component';
import { ActivityTimelineComponent } from './components/activity-timeline.component';
import { AddActivityDialog } from './components/add-activity.dialog';
import { LeadAssignDialog } from './components/lead-assign.dialog';
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
    MatProgressBarModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatChipsModule,
    ApprovalPillComponent,
    WhyThisScorePanelComponent,
    ActivityTimelineComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <a routerLink="/applications" class="back-link">
        <mat-icon>arrow_back</mat-icon>
        <span i18n="@@applications.detail.back">Back to applications</span>
      </a>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      } @else if (detail()) {
        @let d = detail()!;
        <header class="page-header">
          <div class="header-row">
            <h1 class="title">
              {{ d.loanPurpose }} · {{ d.requestedAmountEGP }} {{ d.requestedCurrency }}
            </h1>
            @if (d.leadStatus) {
              <mat-chip-set>
                <mat-chip class="lead-status-chip" [attr.data-status]="d.leadStatus">{{
                  labelForLeadStatus(d.leadStatus)
                }}</mat-chip>
              </mat-chip-set>
            }
          </div>
          <p class="subtitle">
            <span>{{ d.status }}</span>
            <span aria-hidden="true">·</span>
            <span>{{ d.createdAt | date: 'medium' }}</span>
          </p>

          <div class="action-bar" role="toolbar" aria-label="Application actions">
            @if (canWrite()) {
              <button
                mat-flat-button
                color="primary"
                (click)="openAddActivity()"
                aria-label="Add Activity"
              >
                <mat-icon>add</mat-icon>
                <span i18n="@@app.detail.addActivity">Add Activity</span>
              </button>
              <button
                mat-stroked-button
                (click)="openAttachDocuments()"
                aria-label="Attach Documents"
              >
                <mat-icon>attach_file</mat-icon>
                <span i18n="@@app.detail.attach">Attach Documents</span>
              </button>
            }
            @if (canAssign()) {
              <button mat-stroked-button (click)="openAssign()" aria-label="Assign or reassign">
                <mat-icon>switch_account</mat-icon>
                <span i18n="@@app.detail.assign">Assign / Reassign</span>
              </button>
            }
            @if (canMarkReady()) {
              <button mat-stroked-button (click)="markReady()" aria-label="Mark ready for bank">
                <mat-icon>check_circle</mat-icon>
                <span i18n="@@app.detail.markReady">Mark Ready</span>
              </button>
            }
            @if (canWrite()) {
              <button mat-icon-button [matMenuTriggerFor]="moreMenu" aria-label="More actions">
                <mat-icon>more_vert</mat-icon>
              </button>
              <mat-menu #moreMenu="matMenu">
                <button mat-menu-item (click)="openTypedActivity('INTERNAL_NOTE')">
                  <mat-icon>sticky_note_2</mat-icon>
                  <span i18n="@@app.detail.menu.internalNote">Add Internal Note</span>
                </button>
                <button mat-menu-item (click)="openTypedActivity('REQUESTED_MORE_DOCS')">
                  <mat-icon>request_quote</mat-icon>
                  <span i18n="@@app.detail.menu.requestMore">Request More Documents</span>
                </button>
                <button mat-menu-item (click)="openTypedActivity('MARKED_AS_REVIEWED')">
                  <mat-icon>check_circle</mat-icon>
                  <span i18n="@@app.detail.menu.markReviewed">Mark as Reviewed</span>
                </button>
                <button mat-menu-item (click)="openTypedActivity('SUBMITTED_TO_BANK')">
                  <mat-icon>send</mat-icon>
                  <span i18n="@@app.detail.menu.submitBank">Submitted to Bank</span>
                </button>
                <button mat-menu-item (click)="openTypedActivity('BANK_RESPONDED')">
                  <mat-icon>inbox</mat-icon>
                  <span i18n="@@app.detail.menu.bankResponded">Bank Responded</span>
                </button>
                <button mat-menu-item (click)="openTypedActivity('UPDATED_APPLICANT_INFO')">
                  <mat-icon>edit</mat-icon>
                  <span i18n="@@app.detail.menu.updateInfo">Update Applicant Info</span>
                </button>
              </mat-menu>
            }
          </div>
        </header>

        <section class="timeline-section">
          <h2 i18n="@@app.detail.timeline.heading">Activity timeline</h2>
          <app-activity-timeline #timeline [applicationId]="d.id" />
        </section>

        <section class="offers">
          <h2 i18n="@@applications.detail.offers">Matched offers</h2>
          @if (d.offers.length === 0) {
            <p class="muted" i18n="@@applications.detail.noOffers">No matched offers.</p>
          }
          @for (offer of d.offers; track offer.programCode) {
            <article class="offer-card">
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
        font-size: 13px;
      }
      .back-link:hover {
        color: var(--color-brand-primary);
      }
      .title {
        margin: 0 0 4px;
        font-size: 22px;
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        letter-spacing: -0.015em;
      }
      .subtitle {
        margin: 0;
        font-size: 13px;
        color: var(--color-text-secondary);
        display: inline-flex;
        gap: 8px;
        align-items: center;
      }
      .offers h2 {
        margin: 0 0 var(--space-3);
        font-size: 15px;
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-text-secondary);
      }
      .offer-card {
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg, 12px);
        padding: var(--space-4) var(--space-5);
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        margin-block-end: var(--space-3);
      }
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
        display: inline-flex;
        flex-wrap: wrap;
        gap: var(--space-2);
        margin-block-start: var(--space-3);
        position: sticky;
        inset-block-start: var(--topbar-height, 64px);
        z-index: 5;
        padding-block: var(--space-2);
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
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthService);

  protected readonly detail = signal<AdminApplicationDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly activeEngineVersion = signal<string | null>(null);

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
    } finally {
      this.loading.set(false);
    }
  }

  labelForLeadStatus(s: string): string {
    return s
      .split('_')
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ');
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
    const ref = this.dialog.open(LeadAssignDialog, {
      data: { applicationId: d.id, currentAgentId: d.assignedAgentStaffId ?? null },
      panelClass: 'app-modal-panel',
      backdropClass: 'app-modal-backdrop',
      autoFocus: 'first-tabbable',
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) void this.refreshDetail();
    });
  }

  private openDialog(defaultActivityType?: string): void {
    const d = this.detail();
    if (!d) return;
    const ref = this.dialog.open(AddActivityDialog, {
      data: {
        applicationId: d.id,
        defaultActivityType,
        reasonsByType: ACTIVITY_REASONS,
      },
      panelClass: 'app-modal-panel',
      backdropClass: 'app-modal-backdrop',
      autoFocus: 'first-tabbable',
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) void this.refreshDetail();
    });
  }

  private async refreshDetail(): Promise<void> {
    const id = this.detail()?.id;
    if (!id) return;
    const d = await this.api.getById(id);
    this.detail.set(d);
    await this.timeline?.refresh();
  }
}
