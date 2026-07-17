import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { ArrowLeftOutline } from '@ant-design/icons-angular/icons';
import { StatusPillComponent } from '@shared/ui';
import { CanDirective } from '@shared/can.directive';
import {
  ApplicationsApiService,
  type AdminApplicationDetail,
} from '../api/applications.api.service';
import {
  leadStatusMeta,
  LEAD_STATUS_VALUES,
  type LeadStatus,
  type LeadStatusMeta,
} from '../shared/lead-status';
import { ApprovalPillComponent } from '../list/components/approval-pill.component';
import { WhyThisScorePanelComponent } from './components/why-this-score-panel.component';
import { ApplicantCardComponent } from './components/applicant-card.component';
import { ApplicantQuestionnaireComponent } from './components/applicant-questionnaire.component';
import { ApplicantDocumentsComponent } from './components/applicant-documents.component';

/**
 * Application detail page. A calm, read-only view of one application: header
 * with requested amount + purpose, a little metadata, and every matched offer
 * with its "Why this score?" panel.
 */
@Component({
  selector: 'app-application-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    NzSpinModule,
    NzSelectModule,
    NzIconModule,
    StatusPillComponent,
    CanDirective,
    ApprovalPillComponent,
    WhyThisScorePanelComponent,
    ApplicantCardComponent,
    ApplicantQuestionnaireComponent,
    ApplicantDocumentsComponent,
  ],
  providers: [provideNzIconsPatch([ArrowLeftOutline])],
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

            <div class="hero-status">
              <span class="hero-status-label" i18n="@@applications.col.status">Status</span>
              <app-status-pill [label]="leadMeta().label" [tone]="leadMeta().tone" />
              <nz-select
                class="lead-select"
                [formControl]="leadStatusControl"
                [nzLoading]="savingStatus()"
                [nzDisabled]="savingStatus()"
                nzSize="small"
                [attr.aria-label]="changeStatusAria"
              >
                @for (s of leadStatusValues; track s) {
                  <nz-option [nzValue]="s" [nzLabel]="leadLabel(s)"></nz-option>
                }
              </nz-select>
            </div>
          </div>

          <dl class="hero-meta">
            <div class="meta-item">
              <dt i18n="@@app.detail.meta.created">Created</dt>
              <dd>{{ d.createdAt | date: 'mediumDate' }}</dd>
            </div>
            <div class="meta-item">
              <dt i18n="@@app.detail.meta.time">Submitted at</dt>
              <dd>{{ d.createdAt | date: 'shortTime' }}</dd>
            </div>
          </dl>
        </header>

        @if (d.applicant) {
          <app-applicant-card [applicant]="d.applicant" />
        }

        @if (d.questionnaire) {
          <app-applicant-questionnaire [data]="d.questionnaire" />
        }

        <div *can="['super_admin', 'sales_manager', 'sales_agent']">
          <app-applicant-documents
            [applicationId]="d.id"
            [maskedNationalId]="maskedNationalId(d)"
          />
        </div>

        <section class="offers">
          <h2 i18n="@@applications.detail.offers">Matched offers</h2>

          @if (d.offers.length === 0) {
            <p class="muted" i18n="@@applications.detail.noOffers">No matched offers.</p>
          }
          @for (offer of sortedOffers(d); track offer.programCode) {
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

      .hero-status {
        display: inline-flex;
        align-items: center;
        gap: var(--space-3);
        flex-wrap: wrap;
      }
      .hero-status-label {
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-text-tertiary);
      }
      .lead-select {
        min-inline-size: 150px;
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

      .offers h2 {
        margin: 0 0 var(--space-3);
        font-size: 15px;
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-text-secondary);
      }
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
    `,
  ],
})
export class ApplicationDetailPage implements OnInit {
  private readonly api = inject(ApplicationsApiService);
  private readonly route = inject(ActivatedRoute);

  protected readonly detail = signal<AdminApplicationDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly activeEngineVersion = signal<string | null>(null);

  // Lead (sales pipeline) status — admin-editable, separate from engine status.
  protected readonly leadStatus = signal<LeadStatus>('pending');
  protected readonly savingStatus = signal(false);
  protected readonly leadStatusControl = new FormControl<LeadStatus>('pending', {
    nonNullable: true,
  });
  protected readonly leadStatusValues = LEAD_STATUS_VALUES;
  protected readonly changeStatusAria = $localize`:@@app.detail.status.change:Change application status`;
  protected readonly leadMeta = computed<LeadStatusMeta>(() => leadStatusMeta(this.leadStatus()));

  protected leadLabel(s: LeadStatus): string {
    return leadStatusMeta(s).label;
  }

  protected sortedOffers(d: AdminApplicationDetail): AdminApplicationDetail['offers'] {
    return [...d.offers].sort((a, b) => b.approvalProbability.score - a.approvalProbability.score);
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      return;
    }
    try {
      const d = await this.api.getById(id);
      this.detail.set(d);
      this.leadStatus.set(d.leadStatus);
      this.leadStatusControl.setValue(d.leadStatus, { emitEvent: false });
      this.leadStatusControl.valueChanges.subscribe((v) => void this.saveLeadStatus(v));
      this.activeEngineVersion.set(d.offers[0]?.approvalProbability.engineVersion ?? null);
    } finally {
      this.loading.set(false);
    }
  }

  private async saveLeadStatus(next: LeadStatus): Promise<void> {
    const id = this.detail()?.id;
    const prev = this.leadStatus();
    if (!id || next === prev) return;
    this.savingStatus.set(true);
    try {
      await this.api.updateLeadStatus(id, next);
      this.leadStatus.set(next);
    } catch {
      // Revert the control; the HTTP error interceptor surfaces the typed toast.
      this.leadStatusControl.setValue(prev, { emitEvent: false });
    } finally {
      this.savingStatus.set(false);
    }
  }

  labelForPurpose(p: string): string {
    const normalized = p.replace(/_/g, ' ');
    return normalized.charAt(0).toUpperCase() + normalized.slice(1) + ' loan';
  }

  shortId(id: string): string {
    return id.length > 8 ? id.slice(0, 8) : id;
  }

  /** Masked National ID number (last 4) from the applicant profile, if declared. */
  maskedNationalId(d: AdminApplicationDetail): string | null {
    const nid = d.applicantProfile['nationalId'];
    return typeof nid === 'string' && nid.length > 0 ? nid : null;
  }

  formatAmount(raw: string | number): string {
    const value = typeof raw === 'string' ? Number(raw) : raw;
    if (!Number.isFinite(value)) return String(raw);
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(value);
  }
}
