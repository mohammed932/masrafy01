import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { ApplicationsApiService, type AdminApplicationDetail } from '../api/applications.api.service';
import { ApprovalPillComponent } from '../list/components/approval-pill.component';
import { WhyThisScorePanelComponent } from './components/why-this-score-panel.component';

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
    ApprovalPillComponent,
    WhyThisScorePanelComponent,
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
      } @else if (detail(); as d) {
        <header class="page-header">
          <h1 class="title">{{ d.loanPurpose }} · {{ d.requestedAmountEGP }} {{ d.requestedCurrency }}</h1>
          <p class="subtitle">
            <span>{{ d.status }}</span>
            <span aria-hidden="true">·</span>
            <span>{{ d.createdAt | date: 'medium' }}</span>
          </p>
        </header>

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
    `,
  ],
})
export class ApplicationDetailPage implements OnInit {
  private readonly api = inject(ApplicationsApiService);
  private readonly route = inject(ActivatedRoute);

  protected readonly detail = signal<AdminApplicationDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly activeEngineVersion = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      return;
    }
    try {
      const d = await this.api.getById(id);
      this.detail.set(d);
      // Active engine version inferred from the most recent offer; refined in T050.
      this.activeEngineVersion.set(d.offers[0]?.approvalProbability.engineVersion ?? null);
    } finally {
      this.loading.set(false);
    }
  }
}
